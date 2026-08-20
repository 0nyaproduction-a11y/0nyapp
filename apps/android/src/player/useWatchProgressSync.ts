import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { putWatchProgress } from "../lib/api";
import type { PlaybackContext } from "./types";

type WatchProgressSyncOptions = {
  accessToken?: string | null;
  context: PlaybackContext;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isSyncArmedRef: RefObject<boolean>;
};

type LatestProgressState = {
  accessToken?: string | null;
  context: PlaybackContext;
  currentTime: number;
  duration: number;
};

const PERIODIC_WRITE_SECONDS = 5;
const MIN_WRITE_DELTA_SECONDS = 5;
const WRITE_TIMEOUT_MS = 4000;

export function useWatchProgressSync({
  accessToken,
  context,
  currentTime,
  duration,
  isPlaying,
  isSyncArmedRef,
}: WatchProgressSyncOptions) {
  const latestRef = useRef<LatestProgressState>({
    accessToken,
    context,
    currentTime,
    duration,
  });
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const lastQueuedPositionRef = useRef<number | null>(null);
  const contextKey = getProgressContextKey(context);

  useLayoutEffect(() => {
    latestRef.current = {
      accessToken,
      context,
      currentTime,
      duration,
    };
  }, [accessToken, context, currentTime, duration]);

  useEffect(() => {
    queueRef.current = Promise.resolve();
    lastQueuedPositionRef.current = null;
  }, [contextKey]);

  const enqueueSave = useCallback((mode: "final" | "periodic" | "user" = "user") => {
    const latest = latestRef.current;

    if (mode !== "final" && !isSyncArmedRef.current) {
      return Promise.resolve();
    }

    if (!latest.accessToken || latest.context.type !== "SERIES_EPISODE") {
      return Promise.resolve();
    }

    const rawPosition =
      mode === "final"
        ? Math.max(latest.currentTime, latest.duration)
        : latest.currentTime;
    const positionSeconds = normalizePosition(rawPosition, latest.duration);

    if (positionSeconds === null) {
      return Promise.resolve();
    }

    const previousPosition = lastQueuedPositionRef.current;
    const minDelta =
      mode === "periodic" ? PERIODIC_WRITE_SECONDS : MIN_WRITE_DELTA_SECONDS;

    if (
      mode === "periodic" &&
      previousPosition === null &&
      positionSeconds < PERIODIC_WRITE_SECONDS
    ) {
      return Promise.resolve();
    }

    if (
      mode !== "final" &&
      previousPosition !== null &&
      Math.abs(positionSeconds - previousPosition) < minDelta
    ) {
      return queueRef.current.catch(() => undefined);
    }

    lastQueuedPositionRef.current = positionSeconds;

    const request = {
      accessToken: latest.accessToken,
      episodeNumber: latest.context.episodeNumber,
      positionSeconds,
      seriesSlug: latest.context.seriesSlug,
    };

    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await withTimeout(
            putWatchProgress(request.accessToken, {
              episodeNumber: request.episodeNumber,
              positionSeconds: request.positionSeconds,
              seriesSlug: request.seriesSlug,
            }),
          );
        } catch {
          // Progress sync should never interrupt playback.
        }
      });

    return queueRef.current.catch(() => undefined);
  }, [isSyncArmedRef]);

  useEffect(() => {
    if (!isSyncArmedRef.current || !isPlaying || context.type !== "SERIES_EPISODE") {
      return;
    }

    void enqueueSave("periodic");
  }, [context.type, currentTime, enqueueSave, isPlaying, isSyncArmedRef]);

  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state !== "active") {
        void enqueueSave("user");
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [enqueueSave]);

  const saveFinal = useCallback(() => enqueueSave("final"), [enqueueSave]);
  const saveNow = useCallback(() => enqueueSave("user"), [enqueueSave]);

  return useMemo(
    () => ({
      saveFinal,
      saveNow,
    }),
    [saveFinal, saveNow],
  );
}

function getProgressContextKey(context: PlaybackContext) {
  if (context.type === "SERIES_EPISODE") {
    return `${context.seriesSlug}:${context.episodeNumber}`;
  }

  return `film:${context.filmSlug}`;
}

function normalizePosition(position: number, duration: number) {
  if (!Number.isFinite(position) || position < 0) {
    return null;
  }

  const flooredPosition = Math.floor(position);

  if (!Number.isFinite(duration) || duration <= 0) {
    return flooredPosition;
  }

  return Math.min(flooredPosition, Math.floor(duration));
}

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Progress sync timed out."));
      }, WRITE_TIMEOUT_MS);
    }),
  ]);
}
