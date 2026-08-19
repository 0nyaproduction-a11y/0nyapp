import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getWatchProgress } from "@/lib/watch-progress";

export async function GET(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const progress = await getWatchProgress(supabase);

  return dataResponse({
    progress: progress.map((row) => ({
      seriesSlug: row.series_slug,
      episodeNumber: row.episode_number,
      positionSeconds: row.position_seconds,
      durationSeconds: row.duration_seconds,
      completed: row.completed,
      lastWatchedAt: row.last_watched_at,
    })),
  });
}
