import { useCallback, useEffect, useState } from "react";
import { ApiError, createRewardedAdAttempt, getRewardedAdAttemptStatus, getRewardedProgress, getSeries, recordRewardedEvent } from "./api";
import { startBoundedPolling } from "./boundedPolling";
import { useEpisodeRewardedUnlockAd } from "./episodeRewardedUnlockAd";
import type { ApiEpisode } from "../types/api";
import type { MicroDramaAccessContext } from "../navigation/types";
import { getConfirmedPlayableEpisode } from "./confirmedSeriesAccess";

export type RewardedFlowState =
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

type RewardedPartial = {
  verifiedProgress: number;
  requiredCompletions: number;
};

type UseRewardedEpisodeUnlockOptions = {
  accessToken: string | undefined;
  episode: ApiEpisode | null;
  isCurrent: () => boolean;
  isFocused: boolean;
  microDramaAccessContext: MicroDramaAccessContext | null;
  onRequireSignIn: () => void;
  onEntitlementConfirmed: () => Promise<void>;
  rewardedAdsReady: boolean;
};

const EMPTY_EPISODE: ApiEpisode = {
  ageVerificationRequired: false,
  coinPrice: 0,
  coinUnlockEnabled: false,
  contentDescriptors: [],
  contentDescriptorsOverride: [],
  contentRating: null,
  contentRatingOverride: null,
  description: "",
  id: "",
  isFree: false,
  lockedPreviewSeconds: 0,
  number: 0,
  parentalLockRequired: false,
  plusAccess: false,
  requiredRewardedCompletions: 1,
  rewardedAccessMode: "permanent",
  rewardedUnlockEnabled: false,
  runtime: "",
  title: "",
};

export function useRewardedEpisodeUnlock({
  accessToken,
  episode,
  isCurrent,
  isFocused,
  microDramaAccessContext,
  onRequireSignIn,
  onEntitlementConfirmed,
  rewardedAdsReady,
}: UseRewardedEpisodeUnlockOptions) {
  const activeEpisode = episode ?? EMPTY_EPISODE;
  const rewardedUnlockEnabled = activeEpisode.rewardedUnlockEnabled;
  const [rewardedAttempt, setRewardedAttempt] = useState<{ customData: string | null } | null>(null);
  const [rewardedFlowState, setRewardedFlowState] = useState<RewardedFlowState>("idle");
  const [rewardedFlowMessage, setRewardedFlowMessage] = useState<string | null>(null);
  const [rewardedRecovery, setRewardedRecovery] = useState<"expired" | "rejected" | null>(null);
  const [rewardedPartial, setRewardedPartial] = useState<RewardedPartial | null>(null);
  const requiredCount = rewardedPartial?.requiredCompletions ?? activeEpisode.requiredRewardedCompletions;

  const rewardedUnlockAd = useEpisodeRewardedUnlockAd({
    customData: rewardedAttempt?.customData,
    enabled: Boolean(
      isFocused &&
        rewardedAttempt?.customData &&
        rewardedAdsReady &&
        ["ready", "loading", "showing", "confirming"].includes(rewardedFlowState),
    ),
  });

  const emitRewardedEvent = useCallback(
    (eventType: Parameters<typeof recordRewardedEvent>[1]["eventType"]) => {
      if (!accessToken || !activeEpisode.id) return;
      void recordRewardedEvent(accessToken, {
        eventType,
        episodeId: activeEpisode.id,
        requiredCount,
      }).catch(() => undefined);
    },
    [accessToken, activeEpisode.id, requiredCount],
  );

  useEffect(() => {
    if (isFocused && accessToken && rewardedUnlockEnabled && activeEpisode.id) {
      emitRewardedEvent("rewarded_offer_shown");
    }
  }, [accessToken, activeEpisode.id, emitRewardedEvent, isFocused, rewardedUnlockEnabled]);

  const confirmEntitlement = useCallback(
    async (active: () => boolean = isCurrent) => {
      if (!accessToken) throw new Error("Authentication is required.");
      if (!microDramaAccessContext) throw new Error("Episode context is required.");
      const refreshed = await getSeries(microDramaAccessContext.seriesSlug, accessToken);
      const confirmed = getConfirmedPlayableEpisode(refreshed, activeEpisode.number);
      if (!confirmed) throw new Error("Rewarded access was not reflected by the backend.");
      if (active() && isCurrent()) await onEntitlementConfirmed();
    },
    [accessToken, activeEpisode.number, isCurrent, microDramaAccessContext, onEntitlementConfirmed],
  );

  const startRewardedUnlock = useCallback(async () => {
    if (!rewardedUnlockEnabled || !activeEpisode.id) {
      setRewardedFlowState("unavailable");
      setRewardedFlowMessage("Rewarded unlock is not available for this episode.");
      return;
    }
    if (!rewardedAdsReady) {
      setRewardedFlowState("unavailable");
      setRewardedFlowMessage("Rewarded ads are not ready right now.");
      return;
    }
    if (!accessToken) {
      onRequireSignIn();
      return;
    }
    const isBusy = ["creating-attempt", "ready", "loading", "showing", "confirming"].includes(rewardedFlowState);
    if (isBusy) return;

    emitRewardedEvent("rewarded_cta_selected");
    setRewardedRecovery(null);
    setRewardedFlowState("creating-attempt");
    setRewardedFlowMessage("Preparing unlock...");
    setRewardedAttempt(null);

    try {
      const result = await createRewardedAdAttempt(accessToken, activeEpisode.id);
      if (!isCurrent()) return;
      if (result.status === "already_accessible") {
        setRewardedFlowState("verified");
        await confirmEntitlement();
        return;
      }
      if (["rewarded_disabled", "expired", "failed"].includes(result.status)) {
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
      if (!isCurrent()) return;
      if (error instanceof ApiError && error.code === "not_authenticated") {
        onRequireSignIn();
        return;
      }
      setRewardedFlowState("failed");
      setRewardedFlowMessage("We couldn't prepare the unlock right now.");
    }
  }, [
    accessToken,
    confirmEntitlement,
    emitRewardedEvent,
    activeEpisode.id,
    isCurrent,
    onRequireSignIn,
    rewardedAdsReady,
    rewardedFlowState,
    rewardedUnlockEnabled,
  ]);

  useEffect(() => {
    if (!isFocused || !accessToken || !rewardedUnlockEnabled || !activeEpisode.id || !["idle", "partial"].includes(rewardedFlowState)) {
      return;
    }
    const controller = new AbortController();
    void getRewardedProgress(accessToken, activeEpisode.id, controller.signal)
      .then(async (progress) => {
        if (controller.signal.aborted) return;
        if (progress.state === "partial" && progress.verifiedProgress > 0) {
          setRewardedPartial({
            verifiedProgress: progress.verifiedProgress,
            requiredCompletions: progress.requiredCompletions,
          });
          setRewardedFlowState("partial");
        } else if (progress.state === "complete") {
          await confirmEntitlement(() => !controller.signal.aborted);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [accessToken, activeEpisode.id, confirmEntitlement, isFocused, rewardedFlowState, rewardedUnlockEnabled]);

  useEffect(() => {
    if (rewardedFlowState !== "ready" || !rewardedAttempt?.customData) return;
    const timeoutId = setTimeout(() => {
      setRewardedFlowState("loading");
      setRewardedFlowMessage("Loading rewarded ad...");
      rewardedUnlockAd.show();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [rewardedAttempt?.customData, rewardedFlowState, rewardedUnlockAd]);

  useEffect(() => {
    if (rewardedUnlockAd.status === "showing") {
      setRewardedFlowState("showing");
      setRewardedFlowMessage("Watching ad...");
    } else if (rewardedUnlockAd.status === "failed" && rewardedFlowState !== "confirming") {
      emitRewardedEvent("rewarded_load_failed");
      setRewardedFlowState("failed");
      setRewardedFlowMessage(rewardedUnlockAd.error ?? "We couldn't load the rewarded ad.");
      setRewardedAttempt(null);
    }
  }, [emitRewardedEvent, rewardedFlowState, rewardedUnlockAd.error, rewardedUnlockAd.status]);

  useEffect(() => {
    if (rewardedUnlockAd.lastEvent === "earned_client_signal") {
      setRewardedFlowState("confirming");
      setRewardedFlowMessage("We're confirming your rewarded ad. This can take a moment.");
    } else if (rewardedUnlockAd.lastEvent === "closed" && rewardedFlowState !== "confirming") {
      setRewardedFlowState("idle");
      setRewardedFlowMessage(null);
      setRewardedAttempt(null);
    }
  }, [rewardedFlowState, rewardedUnlockAd.lastEvent]);

  useEffect(() => {
    const customData = rewardedAttempt?.customData;
    if (!isFocused || rewardedFlowState !== "confirming" || !accessToken || !customData) return;
    return startBoundedPolling({
      timeoutMs: 60000,
      intervalMs: 3500,
      read: (signal) => getRewardedAdAttemptStatus(accessToken, customData, signal),
      onValue: async (status, active) => {
        if (
          status.status === "already_accessible" ||
          (status.status === "granted" &&
            (status.verifiedProgress ?? 0) >= (status.requiredCompletions ?? requiredCount))
        ) {
          await confirmEntitlement(active);
          return true;
        }
        if (status.status === "granted") {
          setRewardedPartial({
            verifiedProgress: status.verifiedProgress ?? 0,
            requiredCompletions: status.requiredCompletions ?? requiredCount,
          });
          setRewardedAttempt(null);
          setRewardedFlowState("partial");
          setRewardedFlowMessage(null);
          return true;
        }
        if (["expired", "failed", "rewarded_disabled", "not_found"].includes(status.status)) {
          setRewardedRecovery("expired");
          setRewardedFlowState("failed");
          setRewardedFlowMessage("Unlock couldn't be verified. Please try the rewarded ad again.");
          setRewardedAttempt(null);
          return true;
        }
        return false;
      },
      onError: (error) => {
        if (error instanceof ApiError && ["not_authenticated", "obsolete_request"].includes(error.code)) {
          setRewardedFlowState("failed");
          setRewardedFlowMessage("Unlock couldn't be verified. Please try the rewarded ad again.");
          setRewardedAttempt(null);
          return true;
        }
        return false;
      },
      onTimeout: () => {
        setRewardedRecovery("expired");
        setRewardedFlowState("failed");
        setRewardedFlowMessage("Confirmation timed out. Please try the rewarded ad again.");
        setRewardedAttempt(null);
      },
    });
  }, [accessToken, confirmEntitlement, isFocused, requiredCount, rewardedAttempt?.customData, rewardedFlowState]);

  const retryRewarded = useCallback(() => {
    setRewardedRecovery(null);
    setRewardedFlowState("idle");
    setRewardedFlowMessage(null);
    setRewardedAttempt(null);
    void startRewardedUnlock();
  }, [startRewardedUnlock]);

  return {
    rewardedFlowState,
    rewardedFlowMessage,
    rewardedRecovery,
    rewardedPartial,
    requiredCount,
    rewardedAdsReady,
    isRewardedBusy: ["creating-attempt", "ready", "loading", "showing", "confirming"].includes(rewardedFlowState),
    startRewardedUnlock,
    retryRewarded,
  };
}
