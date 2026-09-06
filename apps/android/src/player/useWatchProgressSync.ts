import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { saveWatchHistory } from "../lib/playbackHistory";
import { captureRequestIdentity, isCurrentAccessIdentity } from "../lib/confirmedSeriesAccess";
import { perfEnd, perfMark, perfStart } from "../lib/perf";
import type { PlaybackContext } from "./types";
import { createProgressSaveQueue, waitForProgressFlush, type ProgressSyncMode } from "./progressSaveQueue";

type WatchProgressSyncOptions = {
  context: PlaybackContext;
  currentTime: number;
  duration: number;
  enabled?: boolean;
  isPlaying: boolean;
  isSyncArmedRef: RefObject<boolean>;
  session: Session | null;
};

export function useWatchProgressSync({
  context, currentTime, duration, enabled = true, isPlaying, isSyncArmedRef, session,
}: WatchProgressSyncOptions) {
  const identity = session?.user.id ?? "guest";
  const identityRef = useRef(identity);
  const sessionRef = useRef(session);
  const contextType = context.type;
  const seriesSlug = context.type === "SERIES_EPISODE" ? context.seriesSlug : "";
  const episodeNumber = context.type === "SERIES_EPISODE" ? context.episodeNumber : 0;
  const filmSlug = context.type === "SHORT_FILM" ? context.filmSlug : "";
  useLayoutEffect(() => { identityRef.current = identity; sessionRef.current = session; }, [identity, session]);

  const ownerRef = useRef<{
    latest: { positionSeconds: number; durationSeconds: number };
    observed: { positionSeconds: number; durationSeconds: number };
    armed: boolean;
    enabled: boolean;
    queue: ReturnType<typeof createProgressSaveQueue>;
  } | null>(null);

  // A target owns its samples; cleanup never reads the newly rendered target.
  useLayoutEffect(() => {
    const identityScope = captureRequestIdentity();
    const isCurrentIdentity = () => identityRef.current === identity && isCurrentAccessIdentity(identityScope);
    const scope = `${identity}:${contextType}:${seriesSlug}:${episodeNumber}:${filmSlug}`;
    const owner = {
      latest: { positionSeconds: 0, durationSeconds: 0 },
      observed: { positionSeconds: 0, durationSeconds: 0 },
      armed: false,
      enabled: false,
      queue: createProgressSaveQueue({
        scope,
        isCurrentIdentity,
        async save(sample, mode) {
          const request = contextType === "SERIES_EPISODE" ? {
            contentType: "series_episode" as const, seriesSlug,
            episodeNumber, positionSeconds: sample.positionSeconds,
          } : {
            contentType: "short_film" as const, shortFilmSlug: filmSlug,
            positionSeconds: sample.positionSeconds,
          };
          const measure = perfStart("PROGRESS_SYNC", { content_type: request.contentType, mode });
          try {
            await saveWatchHistory(sessionRef.current, request, sample.durationSeconds, isCurrentIdentity);
            perfEnd(measure, { content_type: request.contentType, mode, position_seconds: sample.positionSeconds, result: "ok" });
          } catch (error) {
            perfEnd(measure, { content_type: request.contentType, mode, position_seconds: sample.positionSeconds, result: "error" });
            throw error;
          }
        },
      }),
    };
    ownerRef.current = owner;
    return () => {
      if (owner.enabled && owner.armed) void owner.queue.enqueue(owner.latest, "lifecycle");
    };
  }, [contextType, episodeNumber, filmSlug, identity, seriesSlug]);

  useLayoutEffect(() => {
    const owner = ownerRef.current;
    if (!owner) return;
    owner.enabled = enabled;
    owner.observed = { positionSeconds: currentTime, durationSeconds: duration };
    if (enabled && isSyncArmedRef.current) {
      owner.armed = true;
      owner.latest = { positionSeconds: currentTime, durationSeconds: duration };
    }
  }, [contextType, currentTime, duration, enabled, episodeNumber, filmSlug, identity, isSyncArmedRef, seriesSlug]);

  const enqueueSave = useCallback((mode: ProgressSyncMode = "user") => {
    const owner = ownerRef.current;
    if (!owner || !enabled || (mode !== "final" && !isSyncArmedRef.current)) return Promise.resolve();
    owner.armed = true;
    const sample = mode === "final" ? {
      positionSeconds: Math.max(owner.observed.positionSeconds, owner.observed.durationSeconds),
      durationSeconds: owner.observed.durationSeconds,
    } : owner.observed;
    owner.latest = sample;
    return waitForProgressFlush(owner.queue.enqueue(sample, mode));
  }, [enabled, isSyncArmedRef]);

  useEffect(() => {
    if (enabled && isPlaying && isSyncArmedRef.current) void enqueueSave("periodic");
  }, [currentTime, enabled, enqueueSave, isPlaying, isSyncArmedRef]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active") {
        perfMark("PROGRESS_SYNC_LIFECYCLE_SAVE", { app_state: state });
        void enqueueSave("lifecycle");
      }
    });
    return () => subscription.remove();
  }, [enabled, enqueueSave]);

  const saveFinal = useCallback(() => enqueueSave("final"), [enqueueSave]);
  const saveNow = useCallback(() => enqueueSave("user"), [enqueueSave]);
  return useMemo(() => ({ saveFinal, saveNow }), [saveFinal, saveNow]);
}
