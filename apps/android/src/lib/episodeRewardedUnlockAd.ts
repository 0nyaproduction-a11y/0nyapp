import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { getMobileEnv } from "../config/env";

export type EpisodeRewardedUnlockAdEvent =
  | "loaded"
  | "opened"
  | "earned_client_signal"
  | "closed"
  | "failed";

type EpisodeRewardedUnlockAdStatus = "idle" | "loading" | "loaded" | "showing" | "failed";

type EpisodeRewardedUnlockAdOptions = {
  customData?: string | null;
  enabled: boolean;
};

type EpisodeRewardedUnlockAdState = {
  error: string | null;
  lastEvent: EpisodeRewardedUnlockAdEvent | null;
  prepare: () => void;
  show: () => void;
  status: EpisodeRewardedUnlockAdStatus;
};

export function resolveRewardedUnlockAdUnitId() {
  if (__DEV__) {
    return TestIds.REWARDED;
  }

  return getMobileEnv().admobRewardedAdUnitId;
}

export function hasRewardedAdUnitId() {
  if (__DEV__) {
    return true;
  }

  const unitId = getMobileEnv().admobRewardedAdUnitId;
  return Boolean(unitId && unitId.trim().length > 0);
}

function createRewardedUnlockAd(customData?: string | null) {
  const adUnitId = resolveRewardedUnlockAdUnitId();

  if (!adUnitId) {
    throw new Error("Missing EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID.");
  }

  return RewardedAd.createForAdRequest(
    adUnitId,
    customData
      ? {
          serverSideVerificationOptions: {
            customData,
          },
        }
      : undefined,
  );
}

export function useEpisodeRewardedUnlockAd({
  customData,
  enabled,
}: EpisodeRewardedUnlockAdOptions): EpisodeRewardedUnlockAdState {
  const adRef = useRef<RewardedAd | null>(null);
  const listenerCleanupsRef = useRef<(() => void)[]>([]);
  const pendingShowRef = useRef(false);
  const earnedRewardRef = useRef(false);
  const [status, setStatus] = useState<EpisodeRewardedUnlockAdStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<EpisodeRewardedUnlockAdEvent | null>(null);

  const clearListeners = useCallback(() => {
    for (const cleanup of listenerCleanupsRef.current) {
      cleanup();
    }

    listenerCleanupsRef.current = [];
  }, []);

  const ensureAd = useCallback(() => {
    if (!enabled) {
      throw new Error("Rewarded unlock ads are disabled.");
    }

    if (!adRef.current) {
      const ad = createRewardedUnlockAd(customData);
      earnedRewardRef.current = false;

      listenerCleanupsRef.current = [
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          if (adRef.current !== ad) return;
          setError(null);
          setStatus("loaded");
          setLastEvent("loaded");

          if (pendingShowRef.current) {
            pendingShowRef.current = false;
            setStatus("showing");
            ad.show({ immersiveModeEnabled: true });
          }
        }),
        ad.addAdEventListener(AdEventType.OPENED, () => {
          if (adRef.current !== ad) return;
          setStatus("showing");
          setLastEvent("opened");
        }),
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          if (adRef.current !== ad) return;
          earnedRewardRef.current = true;
          setLastEvent("earned_client_signal");
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          if (adRef.current !== ad) return;
          setStatus("idle");
          // A rapid close must not erase the signal that starts server polling.
          setLastEvent(earnedRewardRef.current ? "earned_client_signal" : "closed");
        }),
        ad.addAdEventListener(AdEventType.ERROR, (adError) => {
          if (adRef.current !== ad) return;
          setStatus("failed");
          setError(adError.message);
          setLastEvent("failed");
          pendingShowRef.current = false;
        }),
      ];

      adRef.current = ad;
    }

    return adRef.current;
  }, [customData, enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let ad: RewardedAd | null = null;
    try {
      ad = ensureAd();
    } catch (adError) {
      const message = adError instanceof Error ? adError.message : "Unable to configure rewarded ad.";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("failed");
      setError(message);
      setLastEvent("failed");
    }

    return () => {
      pendingShowRef.current = false;
      clearListeners();
      if (ad) {
        ad.removeAllListeners();
      }
      adRef.current = null;
      setStatus("idle");
      setError(null);
      setLastEvent(null);
    };
  }, [clearListeners, enabled, ensureAd]);

  useEffect(() => {
    if (status !== "loading") return;
    const timeout = setTimeout(() => {
      pendingShowRef.current = false;
      clearListeners();
      adRef.current = null;
      setStatus("failed");
      setError("The rewarded ad timed out. Please try again.");
      setLastEvent("failed");
    }, 30000);
    return () => clearTimeout(timeout);
  }, [clearListeners, status]);

  const prepare = useCallback(() => {
    if (!enabled) {
      return;
    }

    try {
      const ad = ensureAd();

      if (status === "loading" || status === "loaded" || status === "showing") {
        return;
      }

      setError(null);
      setStatus("loading");
      pendingShowRef.current = false;
      ad.load();
    } catch (adError) {
      const message = adError instanceof Error ? adError.message : "Unable to prepare rewarded ad.";
      setStatus("failed");
      setError(message);
      setLastEvent("failed");
      pendingShowRef.current = false;
    }
  }, [enabled, ensureAd, status]);

  const show = useCallback(() => {
    if (!enabled) {
      return;
    }

    try {
      const ad = ensureAd();
      pendingShowRef.current = true;
      setError(null);

      if (status === "loaded") {
        pendingShowRef.current = false;
        setStatus("showing");
        ad.show({ immersiveModeEnabled: true });
        return;
      }

      if (status !== "loading") {
        setStatus("loading");
        ad.load();
      }
    } catch (adError) {
      const message = adError instanceof Error ? adError.message : "Unable to show rewarded ad.";
      setStatus("failed");
      setError(message);
      setLastEvent("failed");
      pendingShowRef.current = false;
    }
  }, [enabled, ensureAd, status]);

  return {
    error,
    lastEvent,
    prepare,
    show,
    status,
  };
}
