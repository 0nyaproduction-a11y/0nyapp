import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getEpisodeBySeriesSlugAndNumber } from "@/lib/catalog";
import { canUserWatchEpisode } from "@/lib/entitlements";
import { getShortFilmBySlug } from "@/lib/catalog";
import {
  getWatchProgress,
  runtimeToSeconds,
  saveServerWatchProgress,
  saveServerShortFilmWatchProgress,
} from "@/lib/watch-progress";

type WatchProgressPutBody = {
  contentType?: "series_episode" | "short_film";
  seriesSlug?: string;
  episodeNumber?: number;
  shortFilmSlug?: string;
  positionSeconds: number;
  adBreakState?: {
    pendingBreakSeconds: number | null;
    handledBreakSeconds: number[];
    waivedBreakSeconds: number[];
  };
};

const watchProgressPutFields = new Set([
  "contentType",
  "adBreakState",
  "seriesSlug",
  "episodeNumber",
  "shortFilmSlug",
  "positionSeconds",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseWatchProgressPutBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      error: "Request body must be valid JSON.",
      value: null,
    };
  }

  if (!isRecord(body)) {
    return {
      error: "Request body must be an object.",
      value: null,
    };
  }

  if ("user_id" in body || "userId" in body) {
    return {
      error: "User identity cannot be supplied by the client.",
      value: null,
    };
  }

  const unknownField = Object.keys(body).find(
    (field) => !watchProgressPutFields.has(field),
  );

  if (unknownField) {
    return {
      error: `Unsupported field: ${unknownField}.`,
      value: null,
    };
  }

  const { adBreakState, contentType, episodeNumber, positionSeconds, seriesSlug, shortFilmSlug } =
    body;

  if (
    typeof positionSeconds !== "number" ||
    !Number.isFinite(positionSeconds) ||
    positionSeconds < 0
  ) {
    return {
      error: "positionSeconds must be a finite non-negative number.",
      value: null,
    };
  }

  if (contentType === "short_film" || typeof shortFilmSlug === "string") {
    if (typeof shortFilmSlug !== "string" || shortFilmSlug.trim() === "") {
      return {
        error: "shortFilmSlug is required for short film progress.",
        value: null,
      };
    }

    return {
      error: null,
      value: {
        adBreakState: normalizeAdBreakState(adBreakState),
        contentType: "short_film" as const,
        positionSeconds,
        shortFilmSlug,
      } satisfies WatchProgressPutBody,
    };
  }

  if (typeof seriesSlug !== "string" || seriesSlug.trim() === "") {
    return {
      error: "seriesSlug is required.",
      value: null,
    };
  }

  if (
    typeof episodeNumber !== "number" ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber <= 0
  ) {
    return {
      error: "episodeNumber must be a positive integer.",
      value: null,
    };
  }

  return {
    error: null,
    value: {
      contentType: "series_episode" as const,
      episodeNumber,
      positionSeconds,
      seriesSlug,
    } satisfies WatchProgressPutBody,
  };
}

function serializeWatchProgress(row: {
  content_type: "series_episode" | "short_film";
  series_slug: string | null;
  episode_number: number | null;
  short_film_slug: string | null;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  ad_break_state: unknown;
  last_watched_at: string;
}) {
  const adBreakState = normalizeAdBreakState(row.ad_break_state);

  return {
    adBreakState,
    contentType: row.content_type,
    seriesSlug: row.series_slug,
    episodeNumber: row.episode_number,
    shortFilmSlug: row.short_film_slug,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    lastWatchedAt: row.last_watched_at,
  };
}

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

export async function GET(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const progress = await getWatchProgress(supabase);

  return dataResponse({
    progress: progress.map(serializeWatchProgress),
  });
}

export async function PUT(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const parsed = await parseWatchProgressPutBody(request);

  if (parsed.error || !parsed.value) {
    return errorResponse("invalid_request", parsed.error ?? "Invalid request.", 400);
  }

  const { episodeNumber, positionSeconds, seriesSlug } = parsed.value;
  if (parsed.value.contentType === "short_film") {
    const shortFilmSlug = parsed.value.shortFilmSlug;
    const shortFilm = shortFilmSlug ? await getShortFilmBySlug(shortFilmSlug) : null;

    if (!shortFilm) {
      return errorResponse("not_found", "Short film not found.", 404);
    }

    const progress = await saveServerShortFilmWatchProgress(supabase, {
      adBreakState: parsed.value.adBreakState,
      contentType: "short_film",
      durationSeconds: shortFilm.durationSeconds,
      positionSeconds,
      shortFilmSlug,
    });

    if (!progress) {
      return errorResponse("server_error", "Unable to save watch progress.", 500);
    }

    return dataResponse(serializeWatchProgress(progress));
  }

  if (typeof seriesSlug !== "string" || typeof episodeNumber !== "number") {
    return errorResponse("invalid_request", "seriesSlug and episodeNumber are required.", 400);
  }

  const catalogResult = await getEpisodeBySeriesSlugAndNumber(seriesSlug, episodeNumber, supabase);

  if (!catalogResult) {
    return errorResponse("not_found", "Episode not found.", 404);
  }

  const canWatch = await canUserWatchEpisode({
    userId: user.id,
    episode: catalogResult.episode,
    supabase,
  });

  if (!canWatch) {
    return errorResponse("forbidden", "Episode is not available for this user.", 403);
  }

  const progress = await saveServerWatchProgress(supabase, {
    contentType: "series_episode",
    durationSeconds: runtimeToSeconds(catalogResult.episode.runtime),
    episodeNumber: catalogResult.episode.number,
    positionSeconds,
    seriesSlug: catalogResult.series.slug,
  });

  if (!progress) {
    return errorResponse("server_error", "Unable to save watch progress.", 500);
  }

  return dataResponse(serializeWatchProgress(progress));
}
