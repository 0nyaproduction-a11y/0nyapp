import type { WatchProgressItem } from "../types/api";
import { getResumePositionSeconds } from "./resumePosition";

export type ResumeTarget =
  | { type: "SERIES_EPISODE"; seriesSlug: string; episodeNumber: number }
  | { type: "SHORT_FILM"; filmSlug: string };

export function getPlaybackTargetKey(target: ResumeTarget) {
  return target.type === "SERIES_EPISODE"
    ? `series:${target.seriesSlug}:${target.episodeNumber}`
    : `film:${target.filmSlug}`;
}

export function getPlaybackResumeOwner(target: ResumeTarget, userId?: string | null) {
  return JSON.stringify([userId ?? "guest", getPlaybackTargetKey(target)]);
}

export type TargetHistoryState = {
  owner: string;
  status: "loading" | "resolved" | "error";
  progress?: WatchProgressItem;
};

/** Used by Watch's effect: cancellation owns both success and failure publication. */
export function loadTargetPlaybackHistory(options: {
  owner: string;
  target: ResumeTarget;
  load: () => Promise<WatchProgressItem[]>;
  publish: (state: TargetHistoryState) => void;
}) {
  let active = true;
  options.publish({ owner: options.owner, status: "loading" });
  const done = options.load().then((history) => {
    if (!active) return;
    const target = options.target;
    const progress = history.find((item) => target.type === "SERIES_EPISODE"
      ? item.contentType === "series_episode" && item.seriesSlug === target.seriesSlug && item.episodeNumber === target.episodeNumber
      : item.contentType === "short_film" && item.shortFilmSlug === target.filmSlug);
    options.publish({ owner: options.owner, status: "resolved", progress });
  }).catch(() => {
    if (active) options.publish({ owner: options.owner, status: "error" });
  });
  return { done, cancel: () => { active = false; } };
}

/** A null decision means wait; position 0 is an intentional, consumable seek. */
export function resolveInitialPlaybackSeek(options: {
  owner: string;
  appliedOwner: string | null;
  isProgressResolved: boolean;
  sourceLoadCount: number;
  initialSeekSeconds?: number | null;
  savedProgress?: WatchProgressItem;
  durationSeconds: number;
}) {
  if (!options.isProgressResolved || options.sourceLoadCount === 0 || options.appliedOwner === options.owner) {
    return null;
  }
  const explicit = options.initialSeekSeconds;
  const duration = Number.isFinite(options.durationSeconds) && options.durationSeconds > 0
    ? options.durationSeconds : null;
  const position = typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 0
    ? explicit
    : getResumePositionSeconds(options.savedProgress, duration) ?? 0;
  return { positionSeconds: duration === null ? position : Math.min(position, duration) };
}
