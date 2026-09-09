import type { Session } from "@supabase/supabase-js";
import type { WatchProgressItem } from "../types/api";
import type { HistoryMergeStateEntry } from "./historySyncState";
import { isPlaybackCompleted } from "./playbackCompletion";

export type HistoryMergeDependencies = {
  loadGuest: () => Promise<WatchProgressItem[]>;
  loadAccount: (session: Session) => Promise<WatchProgressItem[]>;
  guestCredential: () => Promise<string | null>;
  readEntry: (userId: string) => Promise<HistoryMergeStateEntry | undefined>;
  writeEntry: (userId: string, entry: HistoryMergeStateEntry) => Promise<void>;
  save: (session: Session, item: WatchProgressItem) => Promise<unknown>;
  prune: (items: WatchProgressItem[]) => Promise<void>;
  isStale: (error: unknown, item: WatchProgressItem) => boolean;
  isSystemic: (error: unknown) => boolean;
};

export function watchHistoryKey(item: Pick<WatchProgressItem, "contentType" | "seriesSlug" | "episodeNumber" | "shortFilmSlug">) {
  return item.contentType === "short_film"
    ? `short_film:${item.shortFilmSlug ?? ""}`
    : `series_episode:${item.seriesSlug ?? ""}:${item.episodeNumber ?? ""}`;
}

function describeError(error: unknown) {
  return {
    lastErrorCode: error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code : "unknown_error",
    lastErrorMessage: error instanceof Error ? error.message : "Watch history couldn't fully sync.",
  };
}

/** Same merge algorithm for runtime and tests; dependencies only adapt storage/API. */
export async function runGuestHistoryMerge(
  session: Session | null,
  dependencies: HistoryMergeDependencies,
  isCurrent: () => boolean = () => true,
) {
  const result = { failed: 0, merged: 0, pending: false, skipped: true, stale: 0 };
  if (!session?.user.id || !session.access_token || !isCurrent()) return result;
  const userId = session.user.id;
  let guestCredential: string | null = null;
  const pending = async (error: unknown) => {
    result.pending = true;
    if (isCurrent()) {
      await dependencies.writeEntry(userId, {
        guestCredential, ...describeError(error), mergedAt: new Date().toISOString(), status: "pending",
      });
    }
  };
  try {
    const [guestHistory, credential, previous] = await Promise.all([
      dependencies.loadGuest(), dependencies.guestCredential(), dependencies.readEntry(userId),
    ]);
    guestCredential = credential;
    if (!isCurrent()) return result;
    const latestGuestAt = guestHistory.reduce((latest, item) => Math.max(latest, Date.parse(item.lastWatchedAt) || 0), 0);
    if (guestHistory.length && previous?.guestCredential === credential && previous.status !== "pending" &&
      Date.parse(previous.mergedAt) >= latestGuestAt) return result;

    // Empty guest history still clears an old pending marker; no account fetch is needed.
    const account = guestHistory.length ? await dependencies.loadAccount(session) : [];
    if (!isCurrent()) return result;
    const byKey = new Map(account.map((item) => [watchHistoryKey(item), item]));
    const candidates = guestHistory.filter((item) => {
      const existing = byKey.get(watchHistoryKey(item));
      if (!existing) return true;
      if (isPlaybackCompleted(existing) && !isPlaybackCompleted(item)) return false;
      return Date.parse(item.lastWatchedAt) > Date.parse(existing.lastWatchedAt);
    }).sort((left, right) => Date.parse(left.lastWatchedAt) - Date.parse(right.lastWatchedAt));

    result.skipped = candidates.length === 0;
    const stale: WatchProgressItem[] = [];
    let failure: unknown;
    for (const item of candidates) {
      if (!isCurrent()) return result;
      try {
        await dependencies.save(session, item);
        result.merged += 1;
      } catch (error) {
        if (dependencies.isStale(error, item)) {
          stale.push(item);
          result.stale += 1;
          continue;
        }
        result.failed += 1;
        failure = error;
        if (dependencies.isSystemic(error)) break;
      }
    }
    if (!isCurrent()) return result;
    if (stale.length) await dependencies.prune(stale);
    if (!isCurrent()) return result;
    if (result.failed) await pending(failure);
    else await dependencies.writeEntry(userId, {
      guestCredential, mergedAt: new Date().toISOString(), status: "completed",
    });
  } catch (error) {
    result.failed += 1;
    // Includes the FIRST load/network failure, before any candidate was written.
    // The result stays pending even when local storage itself is unavailable.
    try { await pending(error); } catch { result.pending = true; }
  }
  return result;
}
