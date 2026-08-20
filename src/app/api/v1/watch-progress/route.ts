import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getEpisodeBySeriesSlugAndNumber } from "@/lib/catalog";
import { canUserWatchEpisode } from "@/lib/entitlements";
import {
  getWatchProgress,
  runtimeToSeconds,
  saveServerWatchProgress,
} from "@/lib/watch-progress";

type WatchProgressPutBody = {
  seriesSlug: string;
  episodeNumber: number;
  positionSeconds: number;
};

const watchProgressPutFields = new Set([
  "seriesSlug",
  "episodeNumber",
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

  const { episodeNumber, positionSeconds, seriesSlug } = body;

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

  const parsedSeriesSlug = seriesSlug;
  const parsedEpisodeNumber = episodeNumber;
  const parsedPositionSeconds = positionSeconds;

  return {
    error: null,
    value: {
      seriesSlug: parsedSeriesSlug,
      episodeNumber: parsedEpisodeNumber,
      positionSeconds: parsedPositionSeconds,
    } satisfies WatchProgressPutBody,
  };
}

function serializeWatchProgress(row: {
  series_slug: string;
  episode_number: number;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_watched_at: string;
}) {
  return {
    seriesSlug: row.series_slug,
    episodeNumber: row.episode_number,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    lastWatchedAt: row.last_watched_at,
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
  const catalogResult = await getEpisodeBySeriesSlugAndNumber(
    seriesSlug,
    episodeNumber,
    supabase,
  );

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
    seriesSlug: catalogResult.series.slug,
    episodeNumber: catalogResult.episode.number,
    positionSeconds,
    durationSeconds: runtimeToSeconds(catalogResult.episode.runtime),
  });

  if (!progress) {
    return errorResponse("server_error", "Unable to save watch progress.", 500);
  }

  return dataResponse(serializeWatchProgress(progress));
}
