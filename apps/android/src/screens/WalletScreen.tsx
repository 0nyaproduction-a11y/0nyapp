import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Body,
  Card,
  CoinDiscIcon,
  CompactPillButton,
  Label,
  LoadingState,
  PlayTriangleIcon,
  PlusVectorIcon,
  RecoveryState,
  TealCircleBadge,
  Title,
  VectorChevron,
} from "../components/ui";
import { ApiError, getMe, getRequestRecoveryCopy, getSeries, getWallet, purchaseEpisodeWithCoins, type RecoveryCopy } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import type { RootStackScreenProps } from "../navigation/types";
import type { MeResponse, WalletResponse } from "../types/api";
import { captureAccessRequest, getConfirmedPlayableEpisode, isCurrentAccessIdentity } from "../lib/confirmedSeriesAccess";
import { createOperationLifetime } from "../lib/operationLifetime";
import { hasRewardedAdUnitId, resolveRewardedUnlockAdUnitId } from "../lib/episodeRewardedUnlockAd";
import { AdEventType, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";
import { useAdMob } from "../lib/adMob";
import { useRewardedEpisodeUnlock } from "../lib/useRewardedEpisodeUnlock";
import { WalletAccessPaywall } from "../components/WalletAccessPaywall";
import { colors, radii, surfaces, typography } from "../theme/tokens";

type WalletEntry = WalletResponse["recentTransactions"][number];
type Props = RootStackScreenProps<"Wallet">;

const ledgerDescriptionByType: Record<WalletEntry["type"], string> = {
  credit: "Coin top-up",
  episode_purchase: "Episode unlock",
  refund: "Refund",
  promo: "Promotional credit",
};

function formatActivityDate(value: string) {
  try {
    const date = new Date(value);
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()] ?? "";
    const time = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return `${day} ${month} · ${time}`;
  } catch {
    return value;
  }
}

function formatActivityAmount(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount} coins`;
}

export function WalletScreen(props: Props) {
  const { session } = useAuth();
  return <WalletContent key={session?.user.id ?? "guest"} {...props} />;
}

function WalletContent({ route }: Props) {
  const navigation = useNavigation<RootStackScreenProps<"Wallet">["navigation"]>();
  const { session } = useAuth();
  const adMob = useAdMob();
  const microDramaAccess = route.params?.microDramaAccess ?? null;
  const isLedgerView = route.params?.view === "ledger";
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlockingEpisode, setIsUnlockingEpisode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "earned" | "used">("all");
  const token = session?.access_token;
  const isFocused = useIsFocused();
  const owner = useMemo(() => createOperationLifetime(isFocused), [isFocused]);

  useEffect(() => {
    navigation.setOptions({
      title: "Activity",
    });
  }, [navigation]);

  useEffect(() => {
    if (isFocused) owner.activate();
    return owner.cancel;
  }, [isFocused, owner]);

  const isCurrent = useCallback(
    () => owner.isActive() && isCurrentAccessIdentity(captureAccessRequest(token)),
    [owner, token],
  );

  const episode = microDramaAccess?.episode ?? null;
  const coinUnlockEnabled = Boolean(episode?.coinUnlockEnabled && episode.coinPrice > 0);
  const rewardedUnlockEnabled = Boolean(episode?.rewardedUnlockEnabled);
  const isPlusActive = me?.subscription.status === "active";
  const plusAccessEnabled = Boolean(episode?.plusAccess && !isPlusActive);

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
      if (!isCurrent()) return;

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
      if (isCurrent()) setIsLoading(false);
    }
  }, [isCurrent, token]);

  const openWatchAfterUnlock = useCallback(async () => {
    if (!token || !microDramaAccess) {
      return;
    }

    const refreshed = await getSeries(microDramaAccess.seriesSlug, token);
    const confirmed = getConfirmedPlayableEpisode(refreshed, microDramaAccess.episode.number);
    if (!confirmed) throw new Error("Episode access was not reflected by the backend.");

    if (!isCurrent()) return;

    navigation.replace("Watch", {
      seriesSlug: refreshed.series.slug,
      episodeNumber: confirmed.episode.number,
      resumeAtSeconds: microDramaAccess.resumeAtSeconds,
    });
  }, [isCurrent, microDramaAccess, navigation, token]);

  const rewardedUnlock = useRewardedEpisodeUnlock({
    accessToken: token,
    episode,
    isCurrent,
    isFocused,
    microDramaAccessContext: microDramaAccess,
    onRequireSignIn: () => {
      if (microDramaAccess) {
        void navigateToSignIn(() => navigation.navigate("SignIn"), {
          kind: "rewarded",
          accessContext: microDramaAccess,
        });
      }
    },
    onEntitlementConfirmed: openWatchAfterUnlock,
    rewardedAdsReady: adMob.canRequestAds && adMob.isInitialized && hasRewardedAdUnitId(),
  });

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
      if (!isCurrent()) return;

      if (result.status === "not_authenticated") {
        await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "wallet", microDramaAccess });
        return;
      }

      if (result.status === "insufficient_balance") {
        const remainingBalance = result.remainingBalance;
        if (remainingBalance !== null) {
          setWallet((current) => (current ? { ...current, balance: remainingBalance } : current));
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
          setWallet((current) => (current ? { ...current, balance: remainingBalance } : current));
        }
        await openWatchAfterUnlock();
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } catch (unlockFailure) {
      if (!isCurrent()) return;
      if (unlockFailure instanceof ApiError && unlockFailure.code === "not_authenticated") {
        await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "wallet", microDramaAccess });
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } finally {
      if (isCurrent()) setIsUnlockingEpisode(false);
    }
  }, [coinUnlockEnabled, episode, isCurrent, microDramaAccess, navigation, openWatchAfterUnlock, token]);

  const handleOpenRewarded = useCallback(() => {
    if (microDramaAccess) {
      if (!token) {
        void navigateToSignIn(() => navigation.navigate("SignIn"), {
          kind: "rewarded",
          accessContext: microDramaAccess,
        });
        return;
      }

      void rewardedUnlock.startRewardedUnlock();
      return;
    }

    try {
      const adUnitId = resolveRewardedUnlockAdUnitId();
      if (!adUnitId) return;
      const rewarded = RewardedAd.createForAdRequest(adUnitId);
      const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show({ immersiveModeEnabled: true });
      });
      const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        void loadWallet();
      });
      const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
      });
      rewarded.load();
    } catch {
      // safe fallback
    }
  }, [loadWallet, microDramaAccess, navigation, rewardedUnlock, token]);

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

  useEffect(() => {
    if (isPlusActive && episode?.plusAccess && isFocused) {
      void openWatchAfterUnlock();
    }
  }, [isPlusActive, episode?.plusAccess, isFocused, openWatchAfterUnlock]);

  const rewardCoinAmount = episode?.coinPrice && episode.coinPrice > 0 ? episode.coinPrice : 10;
  const isWatchAndEarnAvailable = Boolean(
    (microDramaAccess && episode?.rewardedUnlockEnabled) ||
    hasRewardedAdUnitId()
  );
  const isWatchAndEarnDisabled = !isWatchAndEarnAvailable || rewardedUnlock.isRewardedBusy;

  // Rewarded action label logic adhering strictly to real configured state
  const watchAndEarnLabel = useMemo(() => {
    if (rewardedUnlock.rewardedFlowState === "showing" || rewardedUnlock.isRewardedBusy) {
      return "Starting reward…";
    }
    if (rewardedUnlock.rewardedFlowState === "verified") {
      return `+${rewardCoinAmount} coins added`;
    }
    if (rewardedUnlock.rewardedPartial) {
      return `Watch ad (${rewardedUnlock.rewardedPartial.verifiedProgress}/${rewardedUnlock.rewardedPartial.requiredCompletions})`;
    }
    if (!isWatchAndEarnAvailable) {
      if (rewardedUnlock.rewardedFlowState === "unavailable") {
        return "Unavailable";
      }
      return "Unavailable";
    }
    return "Watch to Earn";
  }, [isWatchAndEarnAvailable, rewardCoinAmount, rewardedUnlock.isRewardedBusy, rewardedUnlock.rewardedFlowState, rewardedUnlock.rewardedPartial]);

  // Activity list window: strictly latest 3 transactions on Wallet landing screen
  const latestTransactions = useMemo(() => {
    if (!wallet?.recentTransactions) return [];
    return wallet.recentTransactions.slice(0, 3);
  }, [wallet?.recentTransactions]);

  // Filtered transactions for dedicated Activity screen
  const filteredTransactions = useMemo(() => {
    if (!wallet?.recentTransactions) return [];
    if (activityFilter === "earned") {
      return wallet.recentTransactions.filter(
        (t) => t.amount > 0 || t.type === "credit" || t.type === "promo" || t.type === "refund",
      );
    }
    if (activityFilter === "used") {
      return wallet.recentTransactions.filter(
        (t) => t.amount < 0 || t.type === "episode_purchase",
      );
    }
    return wallet.recentTransactions;
  }, [activityFilter, wallet?.recentTransactions]);

  if (!token) {
    return (
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card>
            <Label>Guest</Label>
            <Title>
              {microDramaAccess ? `Sign in to unlock Episode ${episode?.number ?? ""}` : "Sign in to view your wallet"}
            </Title>
            <Body>
              {microDramaAccess
                ? `Sign in to access ${microDramaAccess.seriesTitle || "this series"}.`
                : "Sign in to view your coins and wallet activity."}
            </Body>
            <CompactPillButton
              accessibilityLabel={microDramaAccess ? "Sign in to unlock episode" : "Sign in to view wallet"}
              onPress={async () => {
                await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "wallet", microDramaAccess });
              }}
              size="md"
              variant="primary"
            >
              Sign In
            </CompactPillButton>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // DEDICATED ACTIVITY SCREEN
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.activityScrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && !wallet && !error ? <LoadingState /> : null}
        {error ? (
          <RecoveryState
            body={error.body}
            onPrimaryAction={() => void loadWallet()}
            primaryActionLabel="Retry"
            variant="cinematic"
            title={error.title}
          />
        ) : null}
        {wallet ? (
          <View style={styles.activityStack}>
            {/* 1. COMPACT BALANCE / ACTION STRIP — Secondary context, dark pills, gold coin, teal icons */}
            <View style={styles.compactBalanceStrip}>
              <View style={styles.compactBalanceRow}>
                <CoinDiscIcon size={16} />
                <Text style={styles.compactBalanceText}>
                  <Text style={styles.compactBalanceAmount}>{wallet.balance}</Text>
                  {" Coins available"}
                </Text>
              </View>

              <View style={styles.compactActionsRow}>
                <CompactPillButton
                  accessibilityLabel="Add coins"
                  icon={
                    <TealCircleBadge size={18}>
                      <PlusVectorIcon color="#030504" size={8} />
                    </TealCircleBadge>
                  }
                  onPress={handleAddCoins}
                  size="sm"
                  style={styles.compactActionPill}
                  textStyle={styles.compactActionPillText}
                  variant="primary"
                >
                  Add Coins
                </CompactPillButton>

                <CompactPillButton
                  accessibilityLabel={
                    isWatchAndEarnDisabled
                      ? `Watch and earn coins (${watchAndEarnLabel})`
                      : "Watch and earn coins"
                  }
                  disabled={isWatchAndEarnDisabled}
                  icon={
                    <TealCircleBadge size={18}>
                      <PlayTriangleIcon color="#030504" size={7} />
                    </TealCircleBadge>
                  }
                  onPress={handleOpenRewarded}
                  size="sm"
                  style={[
                    styles.compactActionPill,
                    isWatchAndEarnDisabled
                      ? styles.compactActionPillDisabled
                      : styles.compactActionPillActive,
                  ]}
                  textStyle={[
                    styles.compactActionPillText,
                    isWatchAndEarnDisabled && styles.compactActionPillTextDisabled,
                  ]}
                  variant="secondary"
                >
                  {watchAndEarnLabel}
                </CompactPillButton>
              </View>

              {rewardedUnlock.rewardedRecovery ? (
                <View style={styles.retryRow}>
                  <CompactPillButton
                    accessibilityLabel="Try rewarded unlock again"
                    onPress={rewardedUnlock.retryRewarded}
                    size="sm"
                    variant="primary"
                  >
                    Try Again
                  </CompactPillButton>
                </View>
              ) : null}
            </View>

            {/* Contextual Episode Access Card (shown ONLY when navigated from locked episode) */}
            {microDramaAccess ? (
              <WalletAccessPaywall
                microDramaAccess={microDramaAccess}
                variant="card"
              />
            ) : null}

            {/* 2. OPTIONAL SMART FILTERS — [ All ] [ Earned ] [ Used ] */}
            <View style={styles.filterRow}>
              {(["all", "earned", "used"] as const).map((filterKey) => {
                const isSelected = activityFilter === filterKey;
                const label =
                  filterKey === "all"
                    ? "All"
                    : filterKey === "earned"
                    ? "Earned"
                    : "Used";
                return (
                  <Pressable
                    key={filterKey}
                    accessibilityLabel={`Filter by ${label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setActivityFilter(filterKey)}
                    style={({ pressed }) => [
                      styles.filterPill,
                      isSelected ? styles.filterPillSelected : styles.filterPillUnselected,
                      pressed && styles.filterPillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isSelected
                          ? styles.filterPillTextSelected
                          : styles.filterPillTextUnselected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3. FULL ACTIVITY LIST — Begins directly without duplicate Activity heading */}
            <View style={styles.card}>
              {filteredTransactions.length > 0 ? (
                <View style={styles.activityList}>
                  {filteredTransactions.map((transaction, index) => {
                    const rawTx = transaction as any;
                    const seriesTitle =
                      rawTx.seriesTitle ??
                      rawTx.metadata?.seriesTitle ??
                      rawTx.series_title ??
                      rawTx.metadata?.series_title ??
                      rawTx.seriesName ??
                      rawTx.metadata?.seriesName;
                    const episodeNum =
                      rawTx.episodeNumber ??
                      rawTx.metadata?.episodeNumber ??
                      rawTx.episode_number ??
                      rawTx.metadata?.episode_number;
                    const episodeTitle =
                      rawTx.episodeTitle ??
                      rawTx.metadata?.episodeTitle ??
                      rawTx.episode_title ??
                      rawTx.metadata?.episode_title;
                    const description =
                      seriesTitle && (episodeNum != null || episodeTitle)
                        ? `${seriesTitle} · ${episodeNum != null ? `Episode ${episodeNum}` : episodeTitle}`
                        : (ledgerDescriptionByType[transaction.type] ?? "Transaction");
                    const amountLabel = formatActivityAmount(transaction.amount);
                    const isCredit = transaction.amount > 0;
                    const isLast = index === filteredTransactions.length - 1;

                    return (
                      <View
                        key={`${transaction.type}-${transaction.createdAt}-${index}`}
                        style={[styles.activityRow, isLast && styles.activityRowLast]}
                      >
                        <View style={styles.rowText}>
                          <Text style={styles.rowTitle}>{description}</Text>
                          <Text style={styles.rowMeta}>{formatActivityDate(transaction.createdAt)}</Text>
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
                <Text style={styles.emptyState}>
                  {activityFilter === "all"
                    ? "No activity yet."
                    : `No ${activityFilter} activity yet.`}
                </Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  stack: {
    gap: 12,
  },
  ledgerStack: {
    gap: 12,
  },
  activityScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  activityStack: {
    gap: 10,
  },
  compactBalanceStrip: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.06)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compactBalanceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  compactBalanceText: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  compactBalanceAmount: {
    color: "#FEFDFD",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  compactActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  compactActionPill: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  compactActionPillText: {
    color: "#FEFDFD",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  compactActionPillActive: {
    backgroundColor: "#0D1412",
    borderColor: "rgba(43, 126, 125, 0.32)",
    borderWidth: 1,
  },
  compactActionPillDisabled: {
    backgroundColor: "rgba(254, 253, 253, 0.03)",
    borderColor: "rgba(254, 253, 253, 0.07)",
    opacity: 0.55,
  },
  compactActionPillTextDisabled: {
    color: "rgba(254, 253, 253, 0.45)",
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 28,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  filterPillUnselected: {
    backgroundColor: "rgba(254, 253, 253, 0.03)",
    borderColor: "rgba(254, 253, 253, 0.08)",
  },
  filterPillSelected: {
    backgroundColor: "rgba(43, 126, 125, 0.16)",
    borderColor: colors.accent,
  },
  filterPillPressed: {
    opacity: 0.75,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  filterPillTextUnselected: {
    color: colors.textSecondary,
  },
  filterPillTextSelected: {
    color: "#FEFDFD",
    fontWeight: "600",
  },
  activityListHeading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  balanceBlock: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.06)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  balanceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  balanceUnit: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: "500",
    marginTop: 2,
  },
  balanceSubtext: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: "400",
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actionPillFlex: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 6,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  watchAndEarnActive: {
    backgroundColor: "#0D1412",
    borderColor: "rgba(43, 126, 125, 0.32)",
    borderWidth: 1,
  },
  watchAndEarnActiveText: {
    color: "#FEFDFD",
    fontWeight: "600",
  },
  watchAndEarnDisabled: {
    backgroundColor: "rgba(254, 253, 253, 0.03)",
    borderColor: "rgba(254, 253, 253, 0.07)",
    opacity: 0.5,
  },
  watchAndEarnDisabledText: {
    color: "rgba(254, 253, 253, 0.40)",
    fontWeight: "500",
  },
  retryRow: {
    alignItems: "flex-start",
    marginTop: 8,
  },
  episodeAccessCard: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.06)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  contentPrimaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  contentSecondaryMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  card: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.06)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  cardEyebrow: {
    color: "rgba(254, 253, 253, 0.45)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 16,
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  activityHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  viewAllBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  viewAllBtnPressed: {
    opacity: 0.7,
  },
  viewAllText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  activityList: {
    gap: 0,
  },
  activityRow: {
    alignItems: "center",
    borderBottomColor: "rgba(254, 253, 253, 0.06)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 9,
  },
  activityRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "600",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "500",
  },
  rowAmount: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  rowAmountCredit: {
    color: colors.accent,
  },
  rowAmountDebit: {
    color: colors.textSecondary,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  plusCard: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.06)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
  },
  plusBrandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  plusBrandWordmark: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  brand0: {
    color: colors.accent,
  },
  brandNya: {
    color: colors.text,
  },
  brandPlus: {
    color: colors.plusRed,
  },
  activeStatusPill: {
    backgroundColor: "rgba(43, 126, 125, 0.16)",
    borderColor: colors.accent,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  activeStatusText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  plusHeadline: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  plusFeatureLine: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: "600",
  },
  plusMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  plusCtaRow: {
    alignItems: "flex-start",
    marginTop: 3,
  },
  explorePlansCta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#121212",
    borderColor: "rgba(254, 253, 253, 0.12)",
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  explorePlansCtaPressed: {
    backgroundColor: "rgba(254, 253, 253, 0.04)",
    opacity: 0.9,
  },
  explorePlansCtaText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  explorePlusText: {
    color: colors.plusRed,
    fontWeight: "700",
  },
  exploreChevronText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  chooseUnlockPrompt: {
    color: "rgba(254, 253, 253, 0.45)",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  accessMethodsList: {
    gap: 8,
    marginTop: 4,
  },
  accessMethodRow: {
    alignItems: "center",
    backgroundColor: "rgba(254, 253, 253, 0.03)",
    borderColor: "rgba(254, 253, 253, 0.08)",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accessMethodRowActive: {
    borderColor: "rgba(43, 126, 125, 0.28)",
  },
  accessMethodRowDisabled: {
    opacity: 0.55,
  },
  accessMethodRowPressed: {
    backgroundColor: "rgba(254, 253, 253, 0.06)",
    opacity: 0.9,
  },
  addCoinsMethodRow: {
    borderColor: "rgba(43, 126, 125, 0.35)",
  },
  plusMethodRow: {
    borderColor: "rgba(254, 253, 253, 0.12)",
  },
  accessMethodLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  accessMethodTextCol: {
    flex: 1,
    gap: 1,
  },
  accessMethodTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  accessMethodSubtitle: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "400",
    lineHeight: 15,
  },
  unlockActionPill: {
    alignItems: "center",
    backgroundColor: "#121212",
    borderColor: "rgba(254, 253, 253, 0.14)",
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  unlockActionPillText: {
    color: "#FEFDFD",
    fontSize: 12,
    fontWeight: "700",
  },
  insufficientBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  insufficientBadgeText: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "500",
  },
  addCoinsCtaText: {
    color: colors.accent,
    fontSize: 12.5,
    fontWeight: "700",
  },
  plusMethodWordmark: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  explorePlusCtaText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "600",
  },
  contextActions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  unlockPillCta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#121212",
    borderColor: "rgba(254, 253, 253, 0.12)",
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  unlockPillCtaPressed: {
    backgroundColor: "rgba(254, 253, 253, 0.04)",
    opacity: 0.85,
  },
  unlockPillCtaDisabled: {
    opacity: 0.45,
  },
  unlockPillText: {
    color: "#FEFDFD",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  inlineError: {
    color: "#ff8d76",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
