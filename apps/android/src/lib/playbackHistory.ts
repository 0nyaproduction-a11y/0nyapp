import type { Session } from "@supabase/supabase-js";
import { getPlaybackAuthorizationCredentials } from "./parentalControls";
import { ApiError, putWatchProgress, getWatchProgress } from "./api";
import { supabaseSecureStorage } from "./secureStorage";
import type { WatchProgressItem, WatchProgressWriteRequest } from "../types/api";

const LOCAL_HISTORY_KEY_PREFIX = "0nya.watch-history.v1";
const LOCAL_HISTORY_KEY = "0nya.watch-history.v1.guest";
const HISTORY_MERGE_STATE_KEY = "0nya.watch-history-merge-state.v1";

function normalizeAdBreakState(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      handledBreakSeconds: [],
      pendingBreakSeconds: null,
      waivedBreakSeconds: [],
    };
  }

  const record = value as {
    handledBreakSeconds?: unknown;
    pendingBreakSeconds?: unknown;
    waivedBreakSeconds?: unknown;
  };

  return {
    handledBreakSeconds: Array.isArray(record.handledBreakSeconds)
      ? record.handledBreakSeconds.filter(
          (item): item is number => Number.isInteger(item) && item >= 0,
        )
      : [],
    pendingBreakSeconds:
      typeof record.pendingBreakSeconds === "number" ? record.pendingBreakSeconds : null,
    waivedBreakSeconds: Array.isArray(record.waivedBreakSeconds)
      ? record.waivedBreakSeconds.filter((item): item is number => Number.isInteger(item) && item >= 0)
      : [],
  };
}

type WatchProgressKeySource = {
  contentType?: "series_episode" | "short_film";
  episodeNumber?: number | null;
  seriesSlug?: string | null;
  shortFilmSlug?: string | null;
};

function makeLocalRecordKey(item: WatchProgressItem) {
  return makeWatchProgressKey(item);
}

function makeLocalRequestKey(request: WatchProgressKeySource) {
  return makeWatchProgressKey(request);
}

function makeWatchProgressKey(item: WatchProgressKeySource) {
  return item.contentType === "short_film"
    ? `short_film:${item.shortFilmSlug ?? ""}`
    : `series_episode:${item.seriesSlug ?? ""}:${item.episodeNumber ?? ""}`;
}

async function getLegacyGuestHistoryKey(session: Session | null) {
  const { guestCredential } = await getPlaybackAuthorizationCredentials(session);

  if (!guestCredential) {
    return null;
  }

  return `${LOCAL_HISTORY_KEY_PREFIX}.${guestCredential}`;
}

async function getLocalHistoryStorageKeys(session: Session | null) {
  const keys = [LOCAL_HISTORY_KEY, await getLegacyGuestHistoryKey(session)].filter(
    (key): key is string => Boolean(key),
  );

  return Array.from(new Set(keys));
}

function parseStoredHistory(raw: string | null) {
  if (!raw) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (item): item is WatchProgressItem => Boolean(item) && typeof item === "object",
  );
}

async function readLocalHistory(session: Session | null) {
  const keys = await getLocalHistoryStorageKeys(session);
  const merged = new Map<string, WatchProgressItem>();

  for (const storageKey of keys) {
    const parsed = parseStoredHistory(await supabaseSecureStorage.getItem(storageKey));

    for (const item of parsed) {
      const key = makeLocalRecordKey(item);
      const existing = merged.get(key);

      if (!existing || new Date(item.lastWatchedAt).getTime() > new Date(existing.lastWatchedAt).getTime()) {
        merged.set(key, item);
      }
    }
  }

  return Array.from(merged.values()).sort(
    (left, right) => new Date(right.lastWatchedAt).getTime() - new Date(left.lastWatchedAt).getTime(),
  );
}

async function writeLocalHistory(_session: Session | null, progress: WatchProgressItem[]) {
  await supabaseSecureStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(progress));
}

async function removeLocalHistoryItems(session: Session | null, items: WatchProgressItem[]) {
  const staleKeys = new Set(items.map(makeLocalRecordKey));

  if (!staleKeys.size) {
    return;
  }

  for (const storageKey of await getLocalHistoryStorageKeys(session)) {
    const history = parseStoredHistory(await supabaseSecureStorage.getItem(storageKey));

    if (!history.length) {
      continue;
    }

    const nextHistory = history.filter((item) => !staleKeys.has(makeLocalRecordKey(item)));

    if (nextHistory.length === history.length) {
      continue;
    }

    if (nextHistory.length > 0) {
      await supabaseSecureStorage.setItem(storageKey, JSON.stringify(nextHistory));
    } else {
      await supabaseSecureStorage.removeItem(storageKey);
    }
  }
}

export type HistoryMergeStateEntry = {
  guestCredential: string | null;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  mergedAt: string;
  status?: "completed" | "pending";
};

export type HistoryMergeState = Record<string, HistoryMergeStateEntry>;

export type HistorySyncUiStatus = "idle" | "pending" | "retrying";

export type HistorySyncUiState = {
  errorMessage?: string;
  status: HistorySyncUiStatus;
};

function getErrorCode(error: unknown) {
  if (error instanceof ApiError) {
    return error.code;
  }

  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  return "unknown_error";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Unknown merge error.";
}

function isSystemicRetryableFailure(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 401 || error.status === 403 || error.status === 408 || error.status === 429 || error.status >= 500;
  }

  return true;
}

export async function readHistoryMergeState() {
  const raw = await supabaseSecureStorage.getItem(HISTORY_MERGE_STATE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as HistoryMergeState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeHistoryMergeState(state: HistoryMergeState) {
  await supabaseSecureStorage.setItem(HISTORY_MERGE_STATE_KEY, JSON.stringify(state));
}

export function getHistoryMergeUiStateFromEntry(entry?: HistoryMergeStateEntry | null): HistorySyncUiState {
  if (!entry || entry.status === "completed") {
    return { status: "idle" };
  }

  return {
    errorMessage: entry.lastErrorMessage ?? "Watch history couldn't fully sync.",
    status: "pending",
  };
}

export async function getHistoryMergeUiState(session: Session | null): Promise<HistorySyncUiState> {
  if (!session?.user?.id) {
    return { status: "idle" };
  }

  const state = await readHistoryMergeState();
  return getHistoryMergeUiStateFromEntry(state[session.user.id]);
}

export async function retryPendingGuestHistoryMerge(
  session: Session | null,
  mergeFn: (currentSession: Session | null) => Promise<{ pending: boolean }>,
) {
  if (!session?.user?.id || !session.access_token) {
    return { pending: false, retried: false, status: "idle" as const };
  }

  const result = await mergeFn(session);
  const status = result.pending ? "pending" : "idle";

  return {
    pending: result.pending,
    retried: true,
    status,
  };
}

export async function loadWatchHistory(session: Session | null) {
  if (session?.access_token) {
    const data = await getWatchProgress(session.access_token);
    return data.progress;
  }

  return readLocalHistory(session);
}

export async function saveWatchHistory(
  session: Session | null,
  request: WatchProgressWriteRequest,
  durationSeconds: number,
) {
  if (session?.access_token) {
    return putWatchProgress(session.access_token, request);
  }

  const history = await readLocalHistory(session);
  const now = new Date().toISOString();
  const safeDurationSeconds = Math.max(0, Math.floor(durationSeconds));
  const existingEntry = history.find((item) => makeLocalRequestKey(item) === makeLocalRequestKey(request));
  const preservedDurationSeconds = Math.max(
    safeDurationSeconds,
    existingEntry ? Math.max(0, Math.floor(existingEntry.durationSeconds)) : 0,
  );
  const completionThresholdSeconds =
    preservedDurationSeconds > 0
      ? Math.max(Math.ceil(preservedDurationSeconds * 0.95), preservedDurationSeconds - 5)
      : 0;
  const completed =
    preservedDurationSeconds > 0 &&
    Math.max(0, Math.floor(request.positionSeconds)) >= completionThresholdSeconds;

  const nextEntry: WatchProgressItem = request.contentType === "short_film"
    ? {
        adBreakState: normalizeAdBreakState(request.adBreakState),
        completed,
        contentType: "short_film",
        durationSeconds: preservedDurationSeconds,
        episodeNumber: null,
        lastWatchedAt: now,
        positionSeconds: Math.max(0, Math.floor(request.positionSeconds)),
        seriesSlug: null,
        shortFilmSlug: request.shortFilmSlug,
      }
    : {
        adBreakState: {
          handledBreakSeconds: [],
          pendingBreakSeconds: null,
          waivedBreakSeconds: [],
        },
        completed,
        contentType: "series_episode",
        durationSeconds: preservedDurationSeconds,
        episodeNumber: request.episodeNumber,
        lastWatchedAt: now,
        positionSeconds: Math.max(0, Math.floor(request.positionSeconds)),
        seriesSlug: request.seriesSlug,
        shortFilmSlug: null,
      };

  const nextHistory = [nextEntry, ...history.filter((item) => makeLocalRecordKey(item) !== makeLocalRequestKey(request))];
  await writeLocalHistory(session, nextHistory);

  if (__DEV__) {
    console.info("[0nya watch history save]", summarizeWatchProgress(nextEntry));
  }

  return nextEntry;
}

function summarizeWatchProgress(item: WatchProgressItem) {
  return {
    contentType: item.contentType,
    seriesSlug: item.seriesSlug,
    shortFilmSlug: item.shortFilmSlug,
    episodeNumber: item.episodeNumber,
    positionSeconds: item.positionSeconds,
    durationSeconds: item.durationSeconds,
    completed: item.completed,
    updatedAt: item.lastWatchedAt,
    qualifying: item.positionSeconds >= 5 && !item.completed,
    exclusionReason: item.completed ? "completed" : item.positionSeconds < 5 ? "below_threshold" : "included",
  };
}

function summarizeWatchProgressTarget(item: WatchProgressItem) {
  if (item.contentType === "short_film") {
    return {
      contentType: "short_film",
      shortFilmSlug: item.shortFilmSlug,
    };
  }

  return {
    contentType: "series_episode",
    episodeNumber: item.episodeNumber,
    seriesSlug: item.seriesSlug,
  };
}

function isStaleContentNotFoundError(error: unknown, item: WatchProgressItem) {
  if (!(error instanceof ApiError) || error.status !== 404 || error.code !== "not_found") {
    return false;
  }

  if (item.contentType === "short_film") {
    return error.message === "Short film not found.";
  }

  return error.message === "Episode not found.";
}

export async function mergeGuestWatchHistory(session: Session | null) {
  if (!session?.user?.id || !session.access_token) {
    return { failed: 0, merged: 0, pending: false, skipped: true, stale: 0 };
  }

  const [guestHistory, serverHistory, credentials, mergeState] = await Promise.all([
    loadWatchHistory(null),
    loadWatchHistory(session),
    getPlaybackAuthorizationCredentials(null),
    readHistoryMergeState(),
  ]);

  const guestCredential = credentials.guestCredential ?? null;
  const previousMerge = mergeState[session.user.id];
  const latestGuestAt = guestHistory.reduce((latest, item) => {
    const current = new Date(item.lastWatchedAt).getTime();
    return current > latest ? current : latest;
  }, 0);

  if (!guestHistory.length) {
    return { failed: 0, merged: 0, pending: false, skipped: true, stale: 0 };
  }

  if (
    previousMerge &&
    previousMerge.guestCredential === guestCredential &&
    previousMerge.status !== "pending" &&
    new Date(previousMerge.mergedAt).getTime() >= latestGuestAt
  ) {
    return { failed: 0, merged: 0, pending: false, skipped: true, stale: 0 };
  }

  const serverByKey = new Map(serverHistory.map((item) => [makeLocalRecordKey(item), item]));
  const candidates = guestHistory
    .filter((item) => {
      const serverItem = serverByKey.get(makeLocalRecordKey(item));

      if (!serverItem) {
        return true;
      }

      if (serverItem.completed && !item.completed) {
        return false;
      }

      return new Date(item.lastWatchedAt).getTime() > new Date(serverItem.lastWatchedAt).getTime();
    })
    .sort((left, right) => new Date(left.lastWatchedAt).getTime() - new Date(right.lastWatchedAt).getTime());

  let merged = 0;
  let failed = 0;
  const staleItems: WatchProgressItem[] = [];
  const failedItems: Array<{ error: unknown; item: WatchProgressItem }> = [];

  for (const item of candidates) {
    try {
      await saveWatchHistory(
        session,
        item.contentType === "short_film"
          ? {
              contentType: "short_film",
              positionSeconds: item.positionSeconds,
              shortFilmSlug: item.shortFilmSlug ?? "",
              adBreakState: item.adBreakState,
            }
          : {
              contentType: "series_episode",
              episodeNumber: item.episodeNumber ?? 0,
              positionSeconds: item.positionSeconds,
              seriesSlug: item.seriesSlug ?? "",
            },
        item.durationSeconds,
      );
      merged += 1;
    } catch (error) {
      if (isStaleContentNotFoundError(error, item)) {
        staleItems.push(item);

        if (__DEV__) {
          console.warn("[0nya watch history merge] stale local entry pruned", {
            ...summarizeWatchProgressTarget(item),
            reason: error instanceof ApiError ? error.message : "Content not found.",
          });
        }

        continue;
      }

      failed += 1;
      failedItems.push({ error, item });

      if (isSystemicRetryableFailure(error)) {
        console.warn("[0nya watch history merge] systemic retryable failure", {
          ...summarizeWatchProgressTarget(item),
          code: getErrorCode(error),
          message: getErrorMessage(error),
        });

        mergeState[session.user.id] = {
          guestCredential,
          lastErrorCode: getErrorCode(error),
          lastErrorMessage: getErrorMessage(error),
          mergedAt: new Date().toISOString(),
          status: "pending",
        };
        await writeHistoryMergeState(mergeState);

        return {
          failed,
          failedItems: failedItems.map(({ item: failedItem, error: failedError }) => ({
            code: getErrorCode(failedError),
            item: summarizeWatchProgressTarget(failedItem),
            message: getErrorMessage(failedError),
          })),
          merged,
          pending: true,
          skipped: false,
          stale: staleItems.length,
        };
      }

      console.warn("[0nya watch history merge] item-specific failure; continuing with remaining candidates", {
        ...summarizeWatchProgressTarget(item),
        code: getErrorCode(error),
        message: getErrorMessage(error),
      });
    }
  }

  if (staleItems.length > 0) {
    await removeLocalHistoryItems(null, staleItems);
  }

  if (merged > 0) {
    mergeState[session.user.id] = {
      guestCredential,
      mergedAt: new Date().toISOString(),
      status: "completed",
    };
    await writeHistoryMergeState(mergeState);
  }

  return {
    failed,
    failedItems: failedItems.map(({ item: failedItem, error: failedError }) => ({
      code: getErrorCode(failedError),
      item: summarizeWatchProgressTarget(failedItem),
      message: getErrorMessage(failedError),
    })),
    merged,
    pending: false,
    skipped: false,
    stale: staleItems.length,
  };
}
