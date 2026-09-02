import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  Body,
  Button,
  Card,
  Label,
  LoadingState,
  RecoveryState,
  Title,
} from "../components/ui";
import { ApiError, getMe, getRequestRecoveryCopy, getSeries, getWallet, purchaseEpisodeWithCoins, type RecoveryCopy } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import type { RootStackScreenProps } from "../navigation/types";
import type { MeResponse, WalletResponse } from "../types/api";
import { publishConfirmedSeriesAccess } from "../lib/confirmedSeriesAccess";
import { colors, borders } from "../theme/tokens";

type WalletEntry = WalletResponse["recentTransactions"][number];
type Props = RootStackScreenProps<"Wallet">;

const ledgerDescriptionByType: Record<WalletEntry["type"], string> = {
  credit: "Coin top-up",
  episode_purchase: "Episode unlock",
  refund: "Refund",
  promo: "Promotional credit",
};

function formatLedgerDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatLedgerAmount(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount} coins`;
}

export function WalletScreen({ route }: Props) {
  const navigation = useNavigation<RootStackScreenProps<"Wallet">["navigation"]>();
  const { session } = useAuth();
  const microDramaAccess = route.params?.microDramaAccess ?? null;
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlockingEpisode, setIsUnlockingEpisode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const token = session?.access_token;
  const episode = microDramaAccess?.episode ?? null;
  const coinUnlockEnabled = Boolean(episode?.coinUnlockEnabled && episode.coinPrice > 0);
  const rewardedUnlockEnabled = Boolean(episode?.rewardedUnlockEnabled);
  const plusAccessEnabled = Boolean(episode?.plusAccess && me?.subscription.status !== "active");

  const loadWallet = useCallback(async () => {
    if (!token) {
      setWallet(null);
      setMe(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [walletResult, meResult] = await Promise.allSettled([getWallet(token), getMe(token)]);

      if (walletResult.status === "fulfilled") {
        setWallet(walletResult.value);
        setError(null);
      } else {
        setWallet(null);
        setError(
          getRequestRecoveryCopy(walletResult.reason, {
            body: "Please try again.",
            title: "We couldn't load this right now.",
          }),
        );
      }

      if (meResult.status === "fulfilled") {
        setMe(meResult.value);
      } else {
        setMe(null);
        if (__DEV__) {
          console.info(
            "[0nya wallet me refresh]",
            meResult.reason instanceof Error ? meResult.reason.message : String(meResult.reason),
            meResult.reason instanceof Error ? meResult.reason.stack : undefined,
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const openWatchAfterUnlock = useCallback(async () => {
    if (!token || !microDramaAccess) {
      return;
    }

    const refreshed = await getSeries(microDramaAccess.seriesSlug, token);
    const refreshedEpisode =
      refreshed.series.episodes.find((candidate) => candidate.number === microDramaAccess.episode.number) ??
      microDramaAccess.episode;
    const refreshedAccess =
      refreshed.episodeAccess[String(refreshedEpisode.number)] ??
      microDramaAccess.access;

    if (!refreshedAccess.canWatch) {
      throw new Error("Episode access was not reflected by the backend.");
    }

    publishConfirmedSeriesAccess(refreshed);

    navigation.replace("Watch", {
      access: refreshedAccess,
      episode: refreshedEpisode,
      episodeAccess: refreshed.episodeAccess,
      resumeAtSeconds: microDramaAccess.resumeAtSeconds,
      series: refreshed.series,
    });
  }, [microDramaAccess, navigation, token]);

  const handleUnlockEpisode = useCallback(async () => {
    if (!microDramaAccess || !episode || !coinUnlockEnabled) {
      return;
    }

    if (!token) {
      await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "wallet", microDramaAccess });
      return;
    }

    setIsUnlockingEpisode(true);
    setUnlockError(null);

    try {
      const result = await purchaseEpisodeWithCoins(token, episode.id);

      if (result.status === "not_authenticated") {
        await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "wallet", microDramaAccess });
        return;
      }

      if (result.status === "insufficient_balance") {
        const remainingBalance = result.remainingBalance;
        if (remainingBalance !== null) {
          setWallet((current) => current ? { ...current, balance: remainingBalance } : current);
        }
        setUnlockError("Not enough coins.");
        return;
      }

      if (
        result.success ||
        result.status === "already_owned" ||
        result.status === "already_accessible" ||
        result.status === "active_subscription"
      ) {
        const remainingBalance = result.remainingBalance;
        if (remainingBalance !== null) {
          setWallet((current) => current ? { ...current, balance: remainingBalance } : current);
        }
        await openWatchAfterUnlock();
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } catch (unlockFailure) {
      if (unlockFailure instanceof ApiError && unlockFailure.code === "not_authenticated") {
        await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "wallet", microDramaAccess });
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } finally {
      setIsUnlockingEpisode(false);
    }
  }, [coinUnlockEnabled, episode, microDramaAccess, navigation, openWatchAfterUnlock, token]);

  const handleOpenRewarded = useCallback(() => {
    if (!microDramaAccess) {
      return;
    }

    navigation.navigate("EpisodeAccessOptions", microDramaAccess);
  }, [microDramaAccess, navigation]);

  const handleAddCoins = useCallback(() => {
    if (microDramaAccess) {
      navigation.navigate("CoinPurchase", {
        returnToWallet: {
          microDramaAccess,
        },
      });
      return;
    }

    navigation.navigate("CoinPurchase");
  }, [microDramaAccess, navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet]),
  );

  if (!token) {
    return (
      <Screen>
        <Card>
          <Label>Guest</Label>
          <Title>Sign in to view your wallet</Title>
          <Body>Sign in to view your coins and wallet activity.</Body>
          <Button accessibilityLabel="Sign in to view wallet" onPress={async () => { await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "wallet", microDramaAccess: null }); }}>
            Sign in
          </Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {isLoading && !wallet && !error ? <LoadingState /> : null}
      {error ? (
        <Screen scroll={false}>
          <RecoveryState
            body={error.body}
            onPrimaryAction={() => void loadWallet()}
            primaryActionLabel="Retry"
            variant="cinematic"
            title={error.title}
          />
        </Screen>
      ) : null}
      {wallet ? (
        <View style={styles.stack}>
          <View style={styles.balanceBlock}>
            <Text style={styles.balanceValue}>{wallet.balance}</Text>
            <Text style={styles.balanceUnit}>Coins</Text>
            <Pressable
              accessibilityLabel="Add coins"
              accessibilityRole="button"
              onPress={handleAddCoins}
              style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
            >
              <Text style={styles.actionPillText}>Add Coins</Text>
            </Pressable>
          </View>

          {microDramaAccess && episode ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>{`Unlock Episode ${episode.number}`}</Text>
              <Text style={styles.plusStatus}>{microDramaAccess.seriesTitle}</Text>
              <Text style={styles.plusBody}>{episode.title}</Text>
              <View style={styles.contextActions}>
                {coinUnlockEnabled ? (
                  <Pressable
                    accessibilityLabel={`Unlock ${episode.title} with ${episode.coinPrice} coins`}
                    accessibilityRole="button"
                    disabled={isUnlockingEpisode}
                    onPress={() => void handleUnlockEpisode()}
                    style={({ pressed }) => [
                      styles.actionPill,
                      pressed && styles.actionPillPressed,
                      isUnlockingEpisode && styles.actionPillDisabled,
                    ]}
                  >
                    <Text style={styles.actionPillText}>
                      {isUnlockingEpisode ? "Unlocking" : `Unlock for ${episode.coinPrice} Coins`}
                    </Text>
                  </Pressable>
                ) : null}
                {coinUnlockEnabled && wallet.balance < episode.coinPrice ? (
                  <Pressable
                    accessibilityLabel="Add coins for this episode"
                    accessibilityRole="button"
                    onPress={handleAddCoins}
                    style={({ pressed }) => [styles.actionPill, styles.actionPillSecondary, pressed && styles.actionPillPressed]}
                  >
                    <Text style={styles.actionPillText}>Add Coins</Text>
                  </Pressable>
                ) : null}
                {rewardedUnlockEnabled ? (
                  <Pressable
                    accessibilityLabel="Watch rewarded ad for this episode"
                    accessibilityRole="button"
                    onPress={handleOpenRewarded}
                    style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                  >
                    <Text style={styles.actionPillText}>Watch Ad</Text>
                  </Pressable>
                ) : null}
                {plusAccessEnabled ? (
                  <Pressable
                    accessibilityLabel="Open 0nya Plus for this episode"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate("Plus")}
                    style={({ pressed }) => [styles.actionPill, styles.actionPillSecondary, pressed && styles.actionPillPressed]}
                  >
                    <Text style={styles.actionPillText}>Get 0nya Plus</Text>
                  </Pressable>
                ) : null}
              </View>
              {unlockError ? <Text style={styles.inlineError}>{unlockError}</Text> : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Recent Activity</Text>
            {wallet.recentTransactions.length > 0 ? (
              <View style={styles.activityList}>
                {wallet.recentTransactions.map((transaction) => {
                  const description = ledgerDescriptionByType[transaction.type];
                  const amountLabel = formatLedgerAmount(transaction.amount);
                  const isCredit = transaction.amount > 0;

                  return (
                    <View key={`${transaction.type}-${transaction.createdAt}`} style={styles.activityRow}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>{description}</Text>
                        <Text style={styles.rowMeta}>{formatLedgerDate(transaction.createdAt)}</Text>
                      </View>
                      <Text
                        style={[
                          styles.rowAmount,
                          isCredit ? styles.rowAmountCredit : styles.rowAmountDebit,
                        ]}
                      >
                        {amountLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyState}>No wallet activity yet.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>0nya Plus</Text>
            <Text style={styles.plusStatus}>
              {me?.subscription.status === "active" ? "Active" : "Weekly membership"}
            </Text>
            <Text style={styles.plusBody}>
              {me?.subscription.status === "active"
                ? me.subscription.endsAt
                  ? `Active until ${new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(me.subscription.endsAt))}`
                  : me.subscription.label
                : "View membership details in Plus."}
            </Text>
            <Pressable
              accessibilityLabel={me?.subscription.status === "active" ? "Manage 0nya Plus" : "Get 0nya Plus"}
              accessibilityRole="button"
              onPress={() => navigation.navigate("Plus")}
              style={({ pressed }) => [styles.actionPill, styles.actionPillSecondary, pressed && styles.actionPillPressed]}
            >
              <Text style={styles.actionPillText}>
                {me?.subscription.status === "active" ? "Manage 0nya Plus" : "Get 0nya Plus"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  balanceBlock: {
    gap: 2,
    paddingTop: 0,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 44,
  },
  balanceUnit: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  actionPill: {
    alignSelf: "flex-start",
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: borders.width,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  actionPillSecondary: {
    backgroundColor: "rgba(13, 209, 188, 0.06)",
    borderColor: "rgba(13, 209, 188, 0.24)",
  },
  actionPillPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
    borderColor: "rgba(13, 209, 188, 0.34)",
  },
  actionPillDisabled: {
    opacity: 0.58,
  },
  actionPillText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  section: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: borders.width,
    gap: 10,
    padding: 16,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  contextActions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inlineError: {
    color: "#ff8d76",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  activityList: {
    gap: 0,
  },
  activityRow: {
    alignItems: "center",
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  rowAmountCredit: {
    color: colors.accent,
  },
  rowAmountDebit: {
    color: colors.text,
  },
  emptyState: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  plusStatus: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  plusBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
