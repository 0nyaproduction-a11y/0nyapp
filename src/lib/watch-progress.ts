import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contentItems,
  getEpisode,
  getSeriesBySlug,
  type ContentItem,
} from "@/data/content";
import type { Database } from "@/types/database";

export type WatchProgress = Database["public"]["Tables"]["watch_progress"]["Row"];

type TypedSupabaseClient = SupabaseClient<Database>;

type SaveWatchProgressInput = {
  seriesSlug: string;
  episodeNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  completed?: boolean;
};

type SaveServerWatchProgressInput = {
  seriesSlug: string;
  episodeNumber: number;
  positionSeconds: number;
  durationSeconds: number;
};

function clampSeconds(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.floor(value), Math.max(0, max)));
}

function getProgressPercentage(positionSeconds: number, durationSeconds: number) {
  if (durationSeconds <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((positionSeconds / durationSeconds) * 100)),
  );
}

async function getAuthenticatedUserId(supabase: TypedSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export function runtimeToSeconds(runtime: string) {
  const [minutes = "0", seconds = "0"] = runtime.split(":");
  const parsedMinutes = Number(minutes);
  const parsedSeconds = Number(seconds);

  if (!Number.isFinite(parsedMinutes) || !Number.isFinite(parsedSeconds)) {
    return 0;
  }

  return parsedMinutes * 60 + parsedSeconds;
}

export function formatSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = `${safeSeconds % 60}`.padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function getResumePositionSeconds(
  progress: WatchProgress | null,
  fallbackPositionSeconds: number,
  durationSeconds: number,
) {
  if (!progress) {
    return clampSeconds(fallbackPositionSeconds, durationSeconds);
  }

  if (progress.completed || progress.position_seconds >= durationSeconds - 5) {
    return 0;
  }

  return clampSeconds(progress.position_seconds, durationSeconds);
}

export async function getWatchProgress(supabase: TypedSupabaseClient) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("watch_progress")
    .select("*")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false });

  if (error) {
    console.warn("Unable to load watch progress.");
    return [];
  }

  return data;
}

export async function getEpisodeProgress(
  supabase: TypedSupabaseClient,
  seriesSlug: string,
  episodeNumber: number,
) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("watch_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("series_slug", seriesSlug)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load episode progress.");
    return null;
  }

  return data;
}

export async function saveWatchProgress(
  supabase: TypedSupabaseClient,
  input: SaveWatchProgressInput,
) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return false;
  }

  const durationSeconds = Math.max(0, Math.floor(input.durationSeconds));
  const positionSeconds = clampSeconds(input.positionSeconds, durationSeconds);
  const now = new Date().toISOString();
  const completed =
    input.completed ?? (durationSeconds > 0 && positionSeconds >= durationSeconds - 5);

  const { error } = await supabase.from("watch_progress").upsert(
    {
      user_id: userId,
      series_slug: input.seriesSlug,
      episode_number: input.episodeNumber,
      position_seconds: positionSeconds,
      duration_seconds: durationSeconds,
      completed,
      last_watched_at: now,
    },
    {
      onConflict: "user_id,series_slug,episode_number",
    },
  );

  if (error) {
    console.warn("Unable to save watch progress.");
    return false;
  }

  return true;
}

export async function saveServerWatchProgress(
  supabase: TypedSupabaseClient,
  input: SaveServerWatchProgressInput,
) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return null;
  }

  const durationSeconds = Math.max(0, Math.floor(input.durationSeconds));
  const positionSeconds = durationSeconds > 0
    ? clampSeconds(input.positionSeconds, durationSeconds)
    : Math.max(0, Math.floor(input.positionSeconds));
  const derivedCompleted =
    durationSeconds > 0 && durationSeconds - positionSeconds <= 5;
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("watch_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("series_slug", input.seriesSlug)
    .eq("episode_number", input.episodeNumber)
    .maybeSingle();

  if (existingError) {
    console.warn("Unable to load existing watch progress.");
    return null;
  }

  const completed = Boolean(existing?.completed || derivedCompleted);
  const { data, error } = await supabase
    .from("watch_progress")
    .upsert(
      {
        user_id: userId,
        series_slug: input.seriesSlug,
        episode_number: input.episodeNumber,
        position_seconds: positionSeconds,
        duration_seconds: durationSeconds,
        completed,
        last_watched_at: now,
      },
      {
        onConflict: "user_id,series_slug,episode_number",
      },
    )
    .select("*")
    .single();

  if (error) {
    console.warn("Unable to save watch progress.");
    return null;
  }

  return data;
}

export async function markEpisodeCompleted(
  supabase: TypedSupabaseClient,
  seriesSlug: string,
  episodeNumber: number,
  durationSeconds: number,
) {
  return saveWatchProgress(supabase, {
    seriesSlug,
    episodeNumber,
    positionSeconds: durationSeconds,
    durationSeconds,
    completed: true,
  });
}

export async function getContinueWatching(supabase: TypedSupabaseClient) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("watch_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("completed", false)
    .order("last_watched_at", { ascending: false })
    .limit(12);

  if (error) {
    console.warn("Unable to load continue watching.");
    return [];
  }

  return data;
}

export function progressToContentItems(
  progressRows: WatchProgress[],
  catalogItems = contentItems,
) {
  const seen = new Set<string>();

  return progressRows.reduce<ContentItem[]>((items, progress) => {
    const series =
      catalogItems.find((item) => item.slug === progress.series_slug) ??
      getSeriesBySlug(progress.series_slug);
    const episode = getEpisode(progress.series_slug, progress.episode_number);

    if (!series || !episode || progress.completed) {
      return items;
    }

    const key = series.id;

    if (seen.has(key)) {
      return items;
    }

    seen.add(key);

    items.push({
      ...series,
      progress: getProgressPercentage(
        progress.position_seconds,
        progress.duration_seconds || runtimeToSeconds(episode.runtime),
      ),
      currentEpisode: `Episode ${episode.number}`,
    });

    return items;
  }, []);
}

export function getFallbackPositionSeconds(progressPercent: number | undefined, runtime: string) {
  const durationSeconds = runtimeToSeconds(runtime);

  if (typeof progressPercent !== "number") {
    return 0;
  }

  return clampSeconds((durationSeconds * progressPercent) / 100, durationSeconds);
}

export function getKnownSeriesSlugs() {
  return contentItems.map((item) => item.slug);
}
