import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CoinDiscIcon,
  PlayTriangleIcon,
  PlusVectorIcon,
  TealCircleBadge,
} from "./ui";
import {
  ApiError,
  getMe,
  getSeries,
  getWallet,
  purchaseEpisodeWithCoins,
} from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import {
  captureAccessRequest,
  getConfirmedPlayableEpisode,
  isCurrentAccessIdentity,
  publishConfirmedSeriesAccess,
} from "../lib/confirmedSeriesAccess";
import { createOperationLifetime } from "../lib/operationLifetime";
import { hasRewardedAdUnitId } from "../lib/episodeRewardedUnlockAd";
import { useAdMob } from "../lib/adMob";
import { useRewardedEpisodeUnlock } from "../lib/useRewardedEpisodeUnlock";
import { colors, radii, surfaces } from "../theme/tokens";
import type { MicroDramaAccessContext, RootStackParamList } from "../navigation/types";
import type { ApiEpisode, MeResponse, WalletResponse } from "../types/api";

export type WalletAccessPaywallProps = {
  microDramaAccess: MicroDramaAccessContext;
  onDismiss?: () => void;
  onSuccess?: (confirmedEpisode: ApiEpisode) => void;
  variant?: "player" | "card";
};

/**
 * Shared Wallet-owned Micro Drama Access Paywall.
 * Reused between PlayerScreen (in-player paywall over frozen preview frame)
 * and WalletScreen (contextual episode unlock card).
 */
export function WalletAccessPaywall({
  microDramaAccess,
  onDismiss,
  onSuccess,
  variant = "player",
}: WalletAccessPaywallProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const token = session?.access_token;
  const adMob = useAdMob();
  const episode = microDramaAccess.episode;

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlockingEpisode, setIsUnlockingEpisode] = useState(false);
  const isFocused = useIsFocused();
  const owner = useMemo(() => createOperationLifetime(isFocused), [isFocused]);

  useEffect(() => {
    if (isFocused) owner.activate();
    return owner.cancel;
  }, [isFocused, owner]);

  const isCurrent = useCallback(
    () => owner.isActive() && isCurrentAccessIdentity(captureAccessRequest(token)),
    [owner, token],
  );

  const coinUnlockEnabled = Boolean(episode?.coinUnlockEnabled && episode.coinPrice > 0);
  const rewardedUnlockEnabled = Boolean(episode?.rewardedUnlockEnabled);
  const isPlusActive = me?.subscription.status === "active";
  const plusAccessEnabled = Boolean(episode?.plusAccess && !isPlusActive);

  const loadWallet = useCallback(async () => {
    if (!token) {
      setWallet(null);
      setMe(null);
      return;
    }

    try {
      const [walletResult, meResult] = await Promise.allSettled([
        getWallet(token),
        getMe(token),
      ]);
      if (!isCurrent()) return;

      if (walletResult.status === "fulfilled") {
        setWallet(walletResult.value);
      } else {
        setWallet(null);
      }

      if (meResult.status === "fulfilled") {
        setMe(meResult.value);
      } else {
        setMe(null);
      }
    } catch {
      // Non-blocking ledger refresh
    }
  }, [isCurrent, token]);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet]),
  );

  const handleSuccess = useCallback(async () => {
    if (!microDramaAccess) {
      return;
    }

    let confirmedEpisode: ApiEpisode = microDramaAccess.episode;

    if (token) {
      try {
        const refreshed = await getSeries(microDramaAccess.seriesSlug, token);
        const confirmed = getConfirmedPlayableEpisode(refreshed, microDramaAccess.episode.number);
        if (confirmed) {
          confirmedEpisode = confirmed.episode;
        }
        publishConfirmedSeriesAccess(refreshed, captureAccessRequest(token));
      } catch {
        // Fallback to navigation handler
      }
    }

    if (!isCurrent()) return;

    if (onSuccess) {
      onSuccess(confirmedEpisode);
    } else {
      navigation.replace("Watch", {
        seriesSlug: microDramaAccess.seriesSlug,
        episodeNumber: microDramaAccess.episode.number,
        resumeAtSeconds: microDramaAccess.resumeAtSeconds,
      });
    }
  }, [isCurrent, microDramaAccess, navigation, onSuccess, token]);

  const rewardedUnlock = useRewardedEpisodeUnlock({
    accessToken: token,
    episode,
    isCurrent,
    isFocused,
    microDramaAccessContext: microDramaAccess,
    onRequireSignIn: () => {
      void navigateToSignIn(() => navigation.navigate("SignIn"), {
        kind: "rewarded",
        accessContext: microDramaAccess,
      });
    },
    onEntitlementConfirmed: handleSuccess,
    rewardedAdsReady: adMob.canRequestAds && adMob.isInitialized && hasRewardedAdUnitId(),
  });

  const handleUnlockEpisode = useCallback(async () => {
    if (!microDramaAccess || !episode || !coinUnlockEnabled) {
      return;
    }

    if (!token) {
      await navigateToSignIn(() => navigation.navigate("SignIn"), {
        kind: "wallet",
        microDramaAccess,
      });
      return;
    }

    setIsUnlockingEpisode(true);
    setUnlockError(null);

    try {
      const result = await purchaseEpisodeWithCoins(token, episode.id);
      if (!isCurrent()) return;

      if (result.status === "not_authenticated") {
        await navigateToSignIn(() => navigation.navigate("SignIn"), {
          kind: "wallet",
          microDramaAccess,
        });
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
        await handleSuccess();
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } catch (unlockFailure) {
      if (!isCurrent()) return;
      if (unlockFailure instanceof ApiError && unlockFailure.code === "not_authenticated") {
        await navigateToSignIn(() => navigation.navigate("SignIn"), {
          kind: "wallet",
          microDramaAccess,
        });
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } finally {
      if (isCurrent()) setIsUnlockingEpisode(false);
    }
  }, [coinUnlockEnabled, episode, handleSuccess, isCurrent, microDramaAccess, navigation, token]);

  const handleOpenRewarded = useCallback(() => {
    if (!microDramaAccess) {
      return;
    }

    if (!token) {
      void navigateToSignIn(() => navigation.navigate("SignIn"), {
        kind: "rewarded",
        accessContext: microDramaAccess,
      });
      return;
    }

    void rewardedUnlock.startRewardedUnlock();
  }, [microDramaAccess, navigation, rewardedUnlock, token]);

  const handleAddCoins = useCallback(() => {
    navigation.navigate("CoinPurchase", {
      returnToWallet: {
        microDramaAccess,
      },
    });
  }, [microDramaAccess, navigation]);

  const handleOpenPlus = useCallback(() => {
    navigation.navigate("Plus");
  }, [navigation]);

  useEffect(() => {
    if (isPlusActive && episode?.plusAccess && isFocused) {
      void handleSuccess();
    }
  }, [isPlusActive, episode?.plusAccess, isFocused, handleSuccess]);

  const hasInsufficientCoins = Boolean(
    coinUnlockEnabled && token && wallet !== null && wallet.balance < episode.coinPrice,
  );
  const isCoinAffordable = !token || (wallet !== null && wallet.balance >= episode.coinPrice);

  const isPlayerVariant = variant === "player";

  return (
    <View style={[styles.cardContainer, isPlayerVariant ? styles.cardContainerPlayer : styles.cardContainerCard]}>
      {/* Header */}
      <Text style={styles.cardEyebrow}>EPISODE ACCESS</Text>
      <Text style={styles.contentPrimaryTitle}>
        {microDramaAccess.seriesTitle || episode.title}
      </Text>
      <Text style={styles.contentSecondaryMeta}>{`Episode ${episode.number}`}</Text>
      <Text style={styles.chooseUnlockPrompt}>Choose how to unlock</Text>

      {/* Access Methods List */}
      <View style={styles.accessMethodsList}>
        {/* 1. COIN UNLOCK */}
        {coinUnlockEnabled ? (
          <Pressable
            accessibilityLabel={`Unlock for ${episode.coinPrice} Coins`}
            accessibilityRole="button"
            disabled={isUnlockingEpisode || (Boolean(token) && !isCoinAffordable)}
            onPress={() => void handleUnlockEpisode()}
            style={({ pressed }) => [
              styles.accessMethodRow,
              isCoinAffordable && styles.accessMethodRowActive,
              !isCoinAffordable && styles.accessMethodRowDisabled,
              pressed && isCoinAffordable && styles.accessMethodRowPressed,
            ]}
          >
            <View style={styles.accessMethodLeft}>
              <CoinDiscIcon size={16} />
              <View style={styles.accessMethodTextCol}>
                <Text style={styles.accessMethodTitle}>{`Coin — ${episode.coinPrice} Coins`}</Text>
                <Text style={styles.accessMethodSubtitle}>
                  {token
                    ? wallet !== null
                      ? `Balance: ${wallet.balance}`
                      : "Permanent episode unlock"
                    : "Sign in to unlock"}
                </Text>
              </View>
            </View>
            {token && !isCoinAffordable ? (
              <View style={styles.insufficientBadge}>
                <Text style={styles.insufficientBadgeText}>Need more coins</Text>
              </View>
            ) : (
              <View style={styles.unlockActionPill}>
                <Text style={styles.unlockActionPillText}>
                  {isUnlockingEpisode ? "Unlocking..." : !token ? "Sign In" : "Unlock"}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}

        {/* 2. REWARDED UNLOCK */}
        {rewardedUnlockEnabled ? (
          <Pressable
            accessibilityLabel={
              rewardedUnlock.rewardedPartial
                ? `Watch ad to continue unlocking (${rewardedUnlock.rewardedPartial.verifiedProgress} of ${rewardedUnlock.rewardedPartial.requiredCompletions} complete)`
                : "Watch ad to unlock"
            }
            accessibilityRole="button"
            disabled={rewardedUnlock.isRewardedBusy || !rewardedUnlock.rewardedAdsReady}
            onPress={handleOpenRewarded}
            style={({ pressed }) => [
              styles.accessMethodRow,
              rewardedUnlock.rewardedAdsReady && !rewardedUnlock.isRewardedBusy && styles.accessMethodRowActive,
              (!rewardedUnlock.rewardedAdsReady || rewardedUnlock.isRewardedBusy) && styles.accessMethodRowDisabled,
              pressed && rewardedUnlock.rewardedAdsReady && styles.accessMethodRowPressed,
            ]}
          >
            <View style={styles.accessMethodLeft}>
              <TealCircleBadge size={20}>
                <PlayTriangleIcon color="#030504" size={8} />
              </TealCircleBadge>
              <View style={styles.accessMethodTextCol}>
                <Text style={styles.accessMethodTitle}>
                  {rewardedUnlock.rewardedPartial
                    ? `Rewarded — Watch Ad (${rewardedUnlock.rewardedPartial.verifiedProgress}/${rewardedUnlock.rewardedPartial.requiredCompletions})`
                    : rewardedUnlock.requiredCount >= 2
                      ? "Rewarded — Watch 2 Ads"
                      : "Rewarded — Watch Ad"}
                </Text>
                <Text style={styles.accessMethodSubtitle}>
                  {rewardedUnlock.rewardedPartial
                    ? `${rewardedUnlock.rewardedPartial.verifiedProgress} of ${rewardedUnlock.rewardedPartial.requiredCompletions} watched`
                    : !rewardedUnlock.rewardedAdsReady
                      ? "Rewarded ads currently unavailable"
                      : "Free episode unlock"}
                </Text>
              </View>
            </View>
            <View style={styles.unlockActionPill}>
              <Text style={styles.unlockActionPillText}>
                {rewardedUnlock.isRewardedBusy ? "Loading..." : "Watch Ad"}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* 3. ADD COINS (contextual, when balance is insufficient) */}
        {hasInsufficientCoins ? (
          <Pressable
            accessibilityLabel="Add coins for this episode"
            accessibilityRole="button"
            onPress={handleAddCoins}
            style={({ pressed }) => [
              styles.accessMethodRow,
              styles.addCoinsMethodRow,
              pressed && styles.accessMethodRowPressed,
            ]}
          >
            <View style={styles.accessMethodLeft}>
              <TealCircleBadge size={20}>
                <PlusVectorIcon color="#030504" size={9} />
              </TealCircleBadge>
              <View style={styles.accessMethodTextCol}>
                <Text style={styles.accessMethodTitle}>Add Coins</Text>
                <Text style={styles.accessMethodSubtitle}>Top up your balance to unlock this episode</Text>
              </View>
            </View>
            <Text style={styles.addCoinsCtaText}>Buy Coins ›</Text>
          </Pressable>
        ) : null}

        {/* 4. ONYA+ (when eligible and not already subscriber) */}
        {plusAccessEnabled ? (
          <Pressable
            accessibilityLabel="Unlock with 0nya+"
            accessibilityRole="button"
            onPress={handleOpenPlus}
            style={({ pressed }) => [
              styles.accessMethodRow,
              styles.plusMethodRow,
              pressed && styles.accessMethodRowPressed,
            ]}
          >
            <View style={styles.accessMethodLeft}>
              <Text accessibilityLabel="0nya+" style={styles.plusMethodWordmark}>
                <Text style={styles.brand0}>0</Text>
                <Text style={styles.brandNya}>nya</Text>
                <Text style={styles.brandPlus}>+</Text>
              </Text>
              <View style={styles.accessMethodTextCol}>
                <Text style={styles.accessMethodTitle}>0nya+ — Unlimited Access</Text>
                <Text style={styles.accessMethodSubtitle}>Included with unlimited membership</Text>
              </View>
            </View>
            <Text style={styles.explorePlusCtaText}>
              {"Explore "}
              <Text style={styles.explorePlusText}>+</Text>
              {" ›"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Inline Errors / Recovery */}
      {unlockError ? <Text style={styles.inlineError}>{unlockError}</Text> : null}
      {rewardedUnlock.rewardedFlowMessage && rewardedUnlock.rewardedFlowState === "failed" ? (
        <Text style={styles.inlineError}>{rewardedUnlock.rewardedFlowMessage}</Text>
      ) : null}
      {rewardedUnlock.rewardedRecovery ? (
        <Pressable
          accessibilityLabel="Try rewarded unlock again"
          accessibilityRole="button"
          onPress={rewardedUnlock.retryRewarded}
          style={styles.retryBtn}
        >
          <Text style={styles.retryBtnText}>Try Again</Text>
        </Pressable>
      ) : null}

      {/* 5. NOT NOW */}
      {onDismiss ? (
        <Pressable
          accessibilityLabel="Not now"
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [styles.notNowBtn, pressed && styles.notNowBtnPressed]}
        >
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    gap: 3,
  },
  cardContainerPlayer: {
    backgroundColor: "rgba(16, 19, 18, 0.94)",
    borderColor: "rgba(254, 253, 253, 0.12)",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 400,
    paddingHorizontal: 18,
    paddingVertical: 18,
    width: "100%",
  },
  cardContainerCard: {
    backgroundColor: surfaces.s2,
    borderColor: "rgba(254, 253, 253, 0.06)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
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
  brand0: {
    color: colors.accent,
  },
  brandNya: {
    color: colors.text,
  },
  brandPlus: {
    color: colors.plusRed,
  },
  explorePlusCtaText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "600",
  },
  explorePlusText: {
    color: colors.plusRed,
    fontWeight: "700",
  },
  inlineError: {
    color: "#ff8d76",
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 4,
  },
  retryBtn: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#121212",
    borderColor: "rgba(254, 253, 253, 0.14)",
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  notNowBtn: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 8,
  },
  notNowBtnPressed: {
    opacity: 0.6,
  },
  notNowText: {
    color: "rgba(254, 253, 253, 0.55)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
