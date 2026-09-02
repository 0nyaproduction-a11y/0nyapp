import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { BrandWordmark, RecoveryState } from "../components/ui";
import { ApiError, createRewardedAdAttempt, getRewardedAdAttemptStatus, getRewardedProgress, getSeries, getWallet, purchaseEpisodeWithCoins, recordRewardedEvent } from "../lib/api";
import { useAdMob } from "../lib/adMob";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import { publishConfirmedSeriesAccess } from "../lib/confirmedSeriesAccess";
import { useEpisodeRewardedUnlockAd, hasRewardedAdUnitId } from "../lib/episodeRewardedUnlockAd";
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
  | "verified"
  | "partial";

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
  const [rewardedPartial, setRewardedPartial] = useState<{ verifiedProgress: number; requiredCompletions: number } | null>(null);
  const [pendingUnlockAction, setPendingUnlockAction] = useState<PendingUnlockAction>(null);
  const pollingInFlightRef = useRef(false);

  // Launch multi-rewarded support. Required count is backend/CMS controlled and
  // is NEVER derived from coin price on the client.
  const requiredCount = rewardedPartial?.requiredCompletions ?? episode.requiredRewardedCompletions ?? 1;

  const coinUnlockEnabled = episode.coinUnlockEnabled && episode.coinPrice > 0;
  const rewardedUnlockEnabled = episode.rewardedUnlockEnabled;
  const plusAccessEnabled = episode.plusAccess;
  const rewardedAdsReady = adMob.canRequestAds && adMob.isInitialized && hasRewardedAdUnitId();
  const microDramaAccessContext = useMemo(
    () => ({
      access: route.params.access,
      episode,
      episodeAccess: route.params.episodeAccess,
      resumeAtSeconds,
      seriesSlug,
      seriesTitle,
    }),
    [episode, resumeAtSeconds, route.params.access, route.params.episodeAccess, seriesSlug, seriesTitle],
  );

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

      publishConfirmedSeriesAccess(seriesResponse);

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

  const emitRewardedEvent = useCallback(
    (eventType: Parameters<typeof recordRewardedEvent>[1]["eventType"]) => {
      if (!accessToken || !episode.id) {
        return;
      }

      void recordRewardedEvent(accessToken, {
        eventType,
        episodeId: episode.id,
        requiredCount,
      }).catch(() => undefined);
    },
    [accessToken, episode.id, requiredCount],
  );

  useEffect(() => {
    if (!accessToken || !rewardedUnlockEnabled || !episode.id) {
      return;
    }

    emitRewardedEvent("rewarded_offer_shown");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      void navigateToSignIn(
        () => navigation.navigate("SignIn"),
        { kind: "rewarded", accessContext: microDramaAccessContext },
      );
      return;
    }

    emitRewardedEvent("rewarded_cta_selected");

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
        void navigateToSignIn(
          () => navigation.navigate("SignIn"),
          { kind: "rewarded", accessContext: microDramaAccessContext },
        );
        return;
      }

      setRewardedFlowState("failed");
      setRewardedFlowMessage("We couldn't prepare the unlock right now.");
    }
}, [
    accessToken,
    episode.id,
    emitRewardedEvent,
    microDramaAccessContext,
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
    if (!accessToken || !rewardedUnlockEnabled || !episode.id) {
      return;
    }

    // Phase 12: recover verified partial progress from the backend when the
    // paywall mounts or refocuses. We never persist authoritative progress
    // client-side; the server remains authoritative.
    if (rewardedFlowState !== "idle" && rewardedFlowState !== "partial") {
      return;
    }

    let active = true;

    void (async () => {
      try {
        const progress = await getRewardedProgress(accessToken, episode.id);

        if (!active || !progress) {
          return;
        }

        if (
          progress.state === "partial" &&
          progress.verifiedProgress > 0 &&
          progress.verifiedProgress < progress.requiredCompletions
        ) {
          setRewardedPartial({
            verifiedProgress: progress.verifiedProgress,
            requiredCompletions: progress.requiredCompletions,
          });
          setRewardedFlowState("partial");
        } else if (progress.state === "complete") {
          await refreshEpisodeAccessAndOpen();
        }
      } catch {
        // Recovery is best-effort; ignore transient network errors here.
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, episode.id, rewardedUnlockEnabled, rewardedFlowState, refreshEpisodeAccessAndOpen]);

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
        emitRewardedEvent("rewarded_load_failed");
        setRewardedFlowState("failed");
        setRewardedFlowMessage(rewardedUnlockAd.error ?? "We couldn't load the rewarded ad.");
        setRewardedAttempt(null);
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [emitRewardedEvent, rewardedFlowState, rewardedUnlockAd.error, rewardedUnlockAd.status]);

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
    const startTime = Date.now();

    const pollAttemptStatus = async () => {
      if (!active || pollingInFlightRef.current) {
        return;
      }

      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= 60000) {
        if (active) {
          setRewardedRecovery("expired");
          setRewardedFlowState("failed");
          setRewardedFlowMessage("Confirmation timed out. Please try the rewarded ad again.");
          setRewardedAttempt(null);
        }
        return;
      }

      pollingInFlightRef.current = true;

      try {
        const status = await getRewardedAdAttemptStatus(accessToken, customData);

        if (!active) {
          return;
        }

        if (status.status === "already_accessible") {
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

        if (status.status === "granted") {
          const verified = status.verifiedProgress ?? 0;
          const required = status.requiredCompletions ?? requiredCount;

          // Phase 10/11: requirement fully met -> permanent entitlement granted.
          if (verified >= required) {
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

          // Partial progress: hold on a controlled 0nya screen. Do NOT auto-chain
          // the next ad. The user must explicitly tap "Watch next ad".
          setRewardedPartial({ verifiedProgress: verified, requiredCompletions: required });
          setRewardedAttempt(null);
          setRewardedFlowState("partial");
          setRewardedFlowMessage(null);
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
  }, [accessToken, refreshEpisodeAccessAndOpen, requiredCount, rewardedAttempt?.customData, rewardedFlowState]);

  const handleUnlockWithCoins = useCallback(async () => {
    if (!accessToken) {
      setPendingUnlockAction("coin");
      void navigateToSignIn(
        () => navigation.navigate("SignIn"),
        { kind: "coinUnlock", accessContext: microDramaAccessContext },
      );
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
        void navigateToSignIn(
          () => navigation.navigate("SignIn"),
          { kind: "coinUnlock", accessContext: microDramaAccessContext },
        );
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
        void navigateToSignIn(
          () => navigation.navigate("SignIn"),
          { kind: "coinUnlock", accessContext: microDramaAccessContext },
        );
        return;
      }

      setUnlockError("We couldn't complete this purchase right now.");
    } finally {
      setIsUnlocking(false);
    }
  }, [accessToken, coinUnlockEnabled, episode.id, microDramaAccessContext, navigation, openWatchAfterUnlock, seriesSlug]);

  const handleOpenPlus = useCallback(() => {
    if (!accessToken) {
      setPendingUnlockAction("plus");
      void navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "plus" });
      return;
    }

    navigation.navigate("Plus");
  }, [accessToken, navigation]);

  const handleOpenContextualWallet = useCallback(() => {
    navigation.navigate("Wallet", {
      microDramaAccess: microDramaAccessContext,
    });
  }, [microDramaAccessContext, navigation]);

  function handleSignIn(nextAction: Exclude<PendingUnlockAction, null>) {
    setPendingUnlockAction(nextAction);

    if (nextAction === "rewarded") {
      void navigateToSignIn(
        () => navigation.navigate("SignIn"),
        { kind: "rewarded", accessContext: microDramaAccessContext },
      );
      return;
    }

    if (nextAction === "coin") {
      void navigateToSignIn(
        () => navigation.navigate("SignIn"),
        { kind: "coinUnlock", accessContext: microDramaAccessContext },
      );
      return;
    }

    void navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "plus" });
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
    rewardedFlowState === "idle"
      ? !rewardedAdsReady
        ? "Rewarded ads are currently unavailable."
        : null
      : rewardedFlowMessage ?? "Unlock this episode.";

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

      {rewardedPartial ? (
        <Text style={styles.headerSubtitle}>{`Rewarded progress: ${rewardedPartial.verifiedProgress} of ${rewardedPartial.requiredCompletions} ads watched`}</Text>
      ) : null}

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
          rewardedPartial ? (
            <UnlockOptionRow
              accessibilityLabel="Watch next rewarded ad to continue unlocking"
              detail={`${rewardedPartial.verifiedProgress} of ${rewardedPartial.requiredCompletions} complete`}
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
              subtitle="Continue unlocking this episode"
              title="Watch next ad"
            />
          ) : (
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
              title={requiredCount >= 2 ? "Watch 2 ads to unlock" : "Watch an ad to unlock"}
            />
          )
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

      {unlockError ? (
        <View style={styles.inlineRecovery}>
          <Text style={styles.inlineError}>{unlockError}</Text>
          {unlockError === "Not enough coins." ? (
            <Pressable
              accessibilityLabel="Open Wallet to add coins for this episode"
              accessibilityRole="button"
              onPress={handleOpenContextualWallet}
              style={({ pressed }) => [styles.inlineAction, pressed ? styles.inlineActionPressed : null]}
            >
              <Text style={styles.inlineActionText}>Add Coins in Wallet</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
  inlineRecovery: {
    alignItems: "flex-start",
    gap: 8,
  },
  inlineAction: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: "rgba(13, 209, 188, 0.24)",
    borderWidth: borders.width,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  inlineActionPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.10)",
  },
  inlineActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
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
