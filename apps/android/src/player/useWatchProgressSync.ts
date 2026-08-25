import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { saveWatchHistory } from "../lib/playbackHistory";
import type { PlaybackContext } from "./types";

type WatchProgressSyncOptions = {
  context: PlaybackContext;
  currentTime: number;
  duration: number;
  enabled?: boolean;
  isPlaying: boolean;
  isSyncArmedRef: RefObject<boolean>;
  session: Session | null;
};

type LatestProgressState = {
  context: PlaybackContext;
  currentTime: number;
  duration: number;
};

const PERIODIC_WRITE_SECONDS = 5;
const MIN_WRITE_DELTA_SECONDS = 5;
const WRITE_TIMEOUT_MS = 4000;

export function useWatchProgressSync({
  context,
  currentTime,
  duration,
  enabled = true,
  isPlaying,
  isSyncArmedRef,
  session,
}: WatchProgressSyncOptions) {
  const latestRef = useRef<LatestProgressState>({
    context,
    currentTime,
    duration,
  });
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const lastQueuedPositionRef = useRef<number | null>(null);
  const contextKey = getProgressContextKey(context);

  useLayoutEffect(() => {
    latestRef.current = {
      context,
      currentTime,
      duration,
    };
  }, [context, currentTime, duration]);

  useEffect(() => {
    queueRef.current = Promise.resolve();
    lastQueuedPositionRef.current = null;
  }, [contextKey]);

  const enqueueSave = useCallback((mode: "final" | "periodic" | "user" = "user") => {
    if (!enabled) {
      return Promise.resolve();
    }

    const latest = latestRef.current;

    if (mode !== "final" && !isSyncArmedRef.current) {
      return Promise.resolve();
    }

    if (latest.context.type !== "SERIES_EPISODE" && latest.context.type !== "SHORT_FILM") {
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

    const request =
      latest.context.type === "SERIES_EPISODE"
        ? {
            contentType: "series_episode" as const,
            episodeNumber: latest.context.episodeNumber,
            positionSeconds,
            seriesSlug: latest.context.seriesSlug,
          }
        : {
            contentType: "short_film" as const,
            positionSeconds,
            shortFilmSlug: latest.context.filmSlug,
          };

    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await withTimeout(saveWatchHistory(session, request, latest.duration));
        } catch {
          // Progress sync should never interrupt playback.
        }
      });

    return queueRef.current.catch(() => undefined);
  }, [enabled, isSyncArmedRef, session]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (
      !isSyncArmedRef.current ||
      !isPlaying ||
      (context.type !== "SERIES_EPISODE" && context.type !== "SHORT_FILM")
    ) {
      return;
    }

    void enqueueSave("periodic");
  }, [context.type, currentTime, enabled, enqueueSave, isPlaying, isSyncArmedRef]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state !== "active") {
        void enqueueSave("user");
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [enabled, enqueueSave]);

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
