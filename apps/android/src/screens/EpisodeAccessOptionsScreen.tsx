import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { BrandWordmark, RecoveryState } from "../components/ui";
import { ApiError, createRewardedAdAttempt, getRewardedAdAttemptStatus, getSeries, getWallet, purchaseEpisodeWithCoins } from "../lib/api";
import { useAdMob } from "../lib/adMob";
import { useAuth } from "../lib/authContext";
import { useEpisodeRewardedUnlockAd } from "../lib/episodeRewardedUnlockAd";
import type { RootStackParamList } from "../navigation/types";
import type { RewardedAdAttemptResponse, SeriesResponse } from "../types/api";
import { borders, colors, radii, spacing } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "EpisodeAccessOptions">;

type RewardedFlowState =
  | "idle"
  | "creating-attempt"
  | "ready"
  | "loading"
  | "showing"
  | "confirming"
  | "unavailable"
  | "failed"
  | "verified";

type PendingUnlockAction = "coin" | "plus" | "rewarded" | null;

type UnlockOptionRowProps = {
  accessibilityLabel: string;
  detail?: string | null;
  disabled?: boolean;
  onPress: () => void;
  subtitle: string;
  title: ReactNode;
};

function UnlockOptionRow({
  accessibilityLabel,
  detail,
  disabled,
  onPress,
  subtitle,
  title,
}: UnlockOptionRowProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        pressed && !disabled ? styles.optionRowPressed : null,
        disabled ? styles.optionRowDisabled : null,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
        {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.optionChevron}>›</Text>
    </Pressable>
  );
}

export function EpisodeAccessOptionsScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const adMob = useAdMob();
  const { episode, resumeAtSeconds, seriesSlug, seriesTitle } = route.params;
  const accessToken = session?.access_token;
  const isFocused = useIsFocused();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoadedToken, setWalletLoadedToken] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [rewardedAttempt, setRewardedAttempt] = useState<RewardedAdAttemptResponse | null>(null);
  const [rewardedFlowState, setRewardedFlowState] = useState<RewardedFlowState>("idle");
  const [rewardedFlowMessage, setRewardedFlowMessage] = useState<string | null>(null);
  const [rewardedRecovery, setRewardedRecovery] = useState<"expired" | "rejected" | null>(null);
  const [pendingUnlockAction, setPendingUnlockAction] = useState<PendingUnlockAction>(null);
  const pollingInFlightRef = useRef(false);

  const coinUnlockEnabled = episode.coinUnlockEnabled && episode.coinPrice > 0;
  const rewardedUnlockEnabled = episode.rewardedUnlockEnabled;
  const plusAccessEnabled = episode.plusAccess;
  const rewardedAdsReady = adMob.canRequestAds && adMob.isInitialized;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const rewardedUnlockAd = useEpisodeRewardedUnlockAd({
    customData: rewardedAttempt?.customData,
    enabled: Boolean(
      rewardedAttempt?.customData &&
        rewardedAdsReady &&
        (rewardedFlowState === "ready" ||
          rewardedFlowState === "loading" ||
          rewardedFlowState === "showing" ||
          rewardedFlowState === "confirming"),
    ),
  });

  const loadWallet = useCallback(async () => {
    if (!accessToken || !coinUnlockEnabled) {
      return null;
    }

    const wallet = await getWallet(accessToken);
    return wallet.balance;
  }, [accessToken, coinUnlockEnabled]);

  const openWatchAfterUnlock = useCallback(
    async (seriesResponse: SeriesResponse) => {
      const unlockedEpisode =
        seriesResponse.series.episodes.find((candidate) => candidate.number === episode.number) ??
        episode;
      const unlockedAccess =
        seriesResponse.episodeAccess[String(unlockedEpisode.number)] ?? {
          canWatch: true,
          kind: "owned" as const,
          label: "Owned" as const,
        };

      if (!unlockedAccess.canWatch) {
        throw new Error("Rewarded access was not reflected by the backend.");
      }

      navigation.replace("Watch", {
        access: unlockedAccess,
        episode: unlockedEpisode,
        episodeAccess: seriesResponse.episodeAccess,
        resumeAtSeconds,
        series: seriesResponse.series,
      });
    },
    [episode, navigation, resumeAtSeconds],
  );

  const refreshEpisodeAccessAndOpen = useCallback(async () => {
    if (!accessToken) {
      throw new Error("Authentication is required.");
    }

    const refreshed = await getSeries(seriesSlug, accessToken);
    await openWatchAfterUnlock(refreshed);
  }, [accessToken, openWatchAfterUnlock, seriesSlug]);

  const startRewardedUnlock = useCallback(async () => {
    if (!rewardedUnlockEnabled) {
      setRewardedFlowState("unavailable");
      setRewardedFlowMessage("Rewarded unlock is not available for this episode.");
      return;
    }

    if (!episode.id) {
      setRewardedFlowState("failed");
      setRewardedFlowMessage("Rewarded unlock is not available right now.");
      return;
    }

    if (!rewardedAdsReady) {
      setRewardedFlowState("unavailable");
      setRewardedFlowMessage("Rewarded ads are not ready right now.");
      return;
    }

    if (!accessToken) {
      setPendingUnlockAction("rewarded");
      navigation.navigate("SignIn");
      return;
    }

    const isBusy =
      rewardedFlowState === "creating-attempt" ||
      rewardedFlowState === "ready" ||
      rewardedFlowState === "loading" ||
      rewardedFlowState === "showing" ||
      rewardedFlowState === "confirming";

    if (isBusy) {
      return;
    }

    setRewardedRecovery(null);
    setRewardedFlowState("creating-attempt");
    setRewardedFlowMessage("Preparing unlock...");
    setRewardedAttempt(null);
    setUnlockError(null);

    try {
      const result = await createRewardedAdAttempt(accessToken, episode.id);

      if (result.status === "already_accessible") {
        try {
          setRewardedFlowState("verified");
          await refreshEpisodeAccessAndOpen();
        } catch {
          setRewardedFlowState("failed");
          setRewardedFlowMessage("Unlock could not be confirmed.");
          setRewardedAttempt(null);
        }
        return;
      }

      if (
        result.status === "rewarded_disabled" ||
        result.status === "unsupported_pending_policy" ||
        result.status === "expired" ||
        result.status === "failed"
      ) {
        setRewardedRecovery("expired");
        setRewardedFlowState("failed");
        setRewardedFlowMessage("Unlock couldn't be verified. Please try the rewarded ad again.");
        return;
      }

      if (!result.customData) {
        setRewardedFlowState("failed");
        setRewardedFlowMessage("We couldn't prepare the unlock right now.");
        return;
      }

      setRewardedAttempt(result);
      setRewardedFlowState("ready");
      setRewardedFlowMessage("Preparing rewarded ad...");
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_authenticated") {
        setPendingUnlockAction("rewarded");
        navigation.navigate("SignIn");
        return;
      }

      setRewardedFlowState("failed");
      setRewardedFlowMessage("We couldn't prepare the unlock right now.");
    }
  }, [
    accessToken,
    episode.id,
    navigation,
    refreshEpisodeAccessAndOpen,
    rewardedAdsReady,
    rewardedFlowState,
    rewardedUnlockEnabled,
  ]);

  useEffect(() => {
    let isMounted = true;

    if (!accessToken || !coinUnlockEnabled) {
      return () => {
        isMounted = false;
      };
    }

    loadWallet()
      .then((wallet) => {
        if (isMounted) {
          setWalletError(null);
          setWalletBalance(wallet);
        }
      })
      .catch(() => {
        if (isMounted) {
          setWalletBalance(null);
          setWalletError("We couldn't load this right now.");
        }
      })
      .finally(() => {
        if (isMounted && accessToken) {
          setWalletLoadedToken(accessToken);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadWallet, accessToken, coinUnlockEnabled]);

  useEffect(() => {
    if (rewardedFlowState !== "ready" || !rewardedAttempt?.customData) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRewardedFlowState("loading");
      setRewardedFlowMessage("Loading rewarded ad...");
      rewardedUnlockAd.show();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [rewardedAttempt?.customData, rewardedFlowState, rewardedUnlockAd]);

  useEffect(() => {
    if (rewardedUnlockAd.status === "showing") {
      const timeoutId = setTimeout(() => {
        setRewardedFlowState("showing");
        setRewardedFlowMessage("Watching ad...");
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    if (rewardedUnlockAd.status === "failed" && rewardedFlowState !== "confirming") {
      const timeoutId = setTimeout(() => {
        setRewardedFlowState("failed");
        setRewardedFlowMessage(rewardedUnlockAd.error ?? "We couldn't load the rewarded ad.");
        setRewardedAttempt(null);
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [rewardedFlowState, rewardedUnlockAd.error, rewardedUnlockAd.status]);

  useEffect(() => {
    if (rewardedUnlockAd.lastEvent !== "earned_client_signal") {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRewardedFlowState("confirming");
      setRewardedFlowMessage("We're confirming your rewarded ad. This can take a moment.");
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [rewardedUnlockAd.lastEvent]);

  useEffect(() => {
    if (rewardedUnlockAd.lastEvent !== "closed" || rewardedFlowState === "confirming") {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRewardedFlowState("idle");
      setRewardedFlowMessage(null);
      setRewardedAttempt(null);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [rewardedFlowState, rewardedUnlockAd.lastEvent]);

  useEffect(() => {
    const customData = rewardedAttempt?.customData;

    if (rewardedFlowState !== "confirming" || !accessToken || !customData) {
      return undefined;
    }

    let active = true;
    pollingInFlightRef.current = false;

    const pollAttemptStatus = async () => {
      if (!active || pollingInFlightRef.current) {
        return;
      }

      pollingInFlightRef.current = true;

      try {
        const status = await getRewardedAdAttemptStatus(accessToken, customData);

        if (!active) {
          return;
        }

        if (status.status === "granted" || status.status === "already_accessible") {
          try {
            setRewardedFlowState("verified");
            setRewardedFlowMessage("Unlock confirmed.");
            await refreshEpisodeAccessAndOpen();
          } catch {
            setRewardedFlowState("failed");
            setRewardedFlowMessage("Unlock could not be confirmed.");
            setRewardedAttempt(null);
          }
          return;
        }

        if (
          status.status === "expired" ||
          status.status === "failed" ||
          status.status === "unsupported_pending_policy" ||
          status.status === "rewarded_disabled" ||
          status.status === "not_found"
        ) {
          setRewardedRecovery(status.status === "expired" || status.status === "not_found" ? "expired" : "rejected");
          setRewardedFlowState("failed");
          setRewardedFlowMessage("Unlock couldn't be verified. Please try the rewarded ad again.");
          setRewardedAttempt(null);
        } else {
          setRewardedFlowMessage("We're confirming your rewarded ad. This can take a moment.");
        }
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.code === "not_authenticated") {
          setRewardedRecovery(null);
          setRewardedFlowState("failed");
          setRewardedFlowMessage("Unlock couldn't be verified. Please try the rewarded ad again.");
          setRewardedAttempt(null);
          return;
        }

        if (active) {
          setRewardedFlowMessage("We're confirming your rewarded ad. This can take a moment.");
        }
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    void pollAttemptStatus();
    const intervalId = setInterval(() => {
      void pollAttemptStatus();
    }, 3500);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [accessToken, refreshEpisodeAccessAndOpen, rewardedAttempt?.customData, rewardedFlowState]);

  const handleUnlockWithCoins = useCallback(async () => {
    if (!accessToken) {
      setPendingUnlockAction("coin");
      navigation.navigate("SignIn");
      return;
    }

    if (!episode.id || !coinUnlockEnabled) {
      setUnlockError("Coin unlock is not available for this episode.");
      return;
    }

    setIsUnlocking(true);
    setUnlockError(null);

    try {
      const result = await purchaseEpisodeWithCoins(accessToken, episode.id);

      if (result.status === "not_authenticated") {
        setPendingUnlockAction("coin");
        navigation.navigate("SignIn");
        return;
      }

      if (result.status === "insufficient_balance") {
        setWalletBalance(result.remainingBalance);
        setUnlockError("Not enough coins.");
        return;
      }

      if (
        result.success ||
        result.status === "already_owned" ||
        result.status === "already_accessible" ||
        result.status === "active_subscription"
      ) {
        setWalletBalance(result.remainingBalance);
        const refreshed = await getSeries(seriesSlug, accessToken);
        await openWatchAfterUnlock(refreshed);
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } catch (unlockFailure) {
      if (unlockFailure instanceof ApiError && unlockFailure.code === "not_authenticated") {
        setPendingUnlockAction("coin");
        navigation.navigate("SignIn");
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } finally {
      setIsUnlocking(false);
    }
  }, [accessToken, coinUnlockEnabled, episode.id, navigation, openWatchAfterUnlock, seriesSlug]);

  const handleOpenPlus = useCallback(() => {
    if (!accessToken) {
      setPendingUnlockAction("plus");
      navigation.navigate("SignIn");
      return;
    }

    navigation.navigate("Plus");
  }, [accessToken, navigation]);

  function handleSignIn(nextAction: Exclude<PendingUnlockAction, null>) {
    setPendingUnlockAction(nextAction);
    navigation.navigate("SignIn");
  }

  useEffect(() => {
    if (!pendingUnlockAction || !accessToken || !isFocused) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const nextAction = pendingUnlockAction;
      setPendingUnlockAction(null);

      if (nextAction === "rewarded") {
        void startRewardedUnlock();
        return;
      }

      if (nextAction === "coin") {
        void handleUnlockWithCoins();
        return;
      }

      if (nextAction === "plus") {
        handleOpenPlus();
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    accessToken,
    handleOpenPlus,
    handleUnlockWithCoins,
    isFocused,
    pendingUnlockAction,
    startRewardedUnlock,
  ]);

  const hasAnyUnlockMethods = coinUnlockEnabled || rewardedUnlockEnabled || plusAccessEnabled;
  const isRewardedBusy =
    rewardedFlowState === "creating-attempt" ||
    rewardedFlowState === "ready" ||
    rewardedFlowState === "loading" ||
    rewardedFlowState === "showing" ||
    rewardedFlowState === "confirming";
  const coinDetailText =
    accessToken && coinUnlockEnabled
      ? walletError
        ? "Wallet balance unavailable."
        : walletLoadedToken === accessToken && walletBalance !== null
          ? `Balance: ${walletBalance} coins.`
          : "Loading wallet balance..."
      : null;
  const rewardedDetailText =
    rewardedFlowState === "idle" ? null : rewardedFlowMessage ?? "Unlock this episode.";

  const handleRewardedRetry = useCallback(() => {
    setRewardedRecovery(null);
    setRewardedFlowState("idle");
    setRewardedFlowMessage(null);
    setRewardedAttempt(null);
    void startRewardedUnlock();
  }, [startRewardedUnlock]);

  if (rewardedRecovery) {
    return (
      <Screen>
        <RecoveryState
          body="Please try the rewarded ad again."
          onPrimaryAction={handleRewardedRetry}
          onSecondaryAction={() => navigation.goBack()}
          primaryActionLabel="Try Again"
          secondaryActionLabel="Back"
          title="Unlock couldn't be verified"
        />
      </Screen>
    );
  }

  if (!hasAnyUnlockMethods) {
    return (
      <Screen>
        <RecoveryState
          body="No unlock methods are enabled for this episode. This looks like a backend configuration issue."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Episode unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{`Unlock Episode ${episode.number}`}</Text>
          <Text style={styles.seriesTitle}>{seriesTitle}</Text>
          <Text style={styles.headerSubtitle}>Choose how to unlock</Text>
        </View>
      </View>

      <View style={styles.optionList}>
        {coinUnlockEnabled ? (
          <UnlockOptionRow
            accessibilityLabel={`Unlock ${episode.title} with ${episode.coinPrice} coins`}
            detail={coinDetailText}
            disabled={isUnlocking}
            onPress={handleUnlockWithCoins}
            subtitle="Permanent episode unlock"
            title={`${episode.coinPrice} Coins`}
          />
        ) : null}

        {rewardedUnlockEnabled ? (
          <UnlockOptionRow
            accessibilityLabel="Watch ad to unlock"
            detail={rewardedDetailText}
            disabled={isRewardedBusy || (accessToken ? !rewardedAdsReady : false)}
            onPress={
              accessToken
                ? () => {
                    if (isRewardedBusy) {
                      return;
                    }
                    void startRewardedUnlock();
                  }
                : () => handleSignIn("rewarded")
            }
            subtitle="Unlock this episode"
            title="Watch an ad"
          />
        ) : null}

        {plusAccessEnabled ? (
          <UnlockOptionRow
            accessibilityLabel="Open 0nya Plus"
            onPress={handleOpenPlus}
            subtitle="Included with Plus"
            title={<BrandWordmark plus style={styles.plusWordmark} />}
          />
        ) : null}
      </View>

      {unlockError ? <Text style={styles.inlineError}>{unlockError}</Text> : null}

      <Pressable
        accessibilityLabel="Not now"
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.notNowButton, pressed ? styles.notNowPressed : null]}
      >
        <Text style={styles.notNowText}>Not now</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
  },
  backButton: {
    alignItems: "flex-start",
    minHeight: 48,
    justifyContent: "center",
    width: 48,
  },
  backButtonPressed: {
    opacity: 0.72,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "400",
    lineHeight: 30,
  },
  headerCopy: {
    gap: 2,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  seriesTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 21,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: borders.color,
    borderRadius: radii.none,
    borderWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 14,
  },
  optionRowPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.08)",
    borderColor: "rgba(232, 228, 218, 0.14)",
  },
  optionRowDisabled: {
    opacity: 0.72,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  optionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  optionDetail: {
    color: "rgba(232, 228, 218, 0.68)",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  optionChevron: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: "400",
    lineHeight: 24,
    marginTop: -2,
  },
  plusWordmark: {
    fontSize: 16,
    lineHeight: 20,
  },
  inlineError: {
    color: "#ff8d76",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  notNowButton: {
    alignSelf: "flex-start",
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  notNowPressed: {
    opacity: 0.72,
  },
  notNowText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
});
