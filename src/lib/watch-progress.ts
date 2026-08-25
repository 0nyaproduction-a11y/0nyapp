import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contentItems,
  getEpisode,
  getSeriesBySlug,
  type ContentItem,
} from "@/data/content";
import type { ShortFilm } from "@/lib/catalog";
import type { Database } from "@/types/database";

export type WatchProgress = Database["public"]["Tables"]["watch_progress"]["Row"];

type TypedSupabaseClient = SupabaseClient<Database>;

type SaveWatchProgressInput = {
  contentType?: "series_episode";
  seriesSlug: string;
  episodeNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  completed?: boolean;
};

type SaveServerWatchProgressInput = {
  contentType?: "series_episode";
  seriesSlug: string;
  episodeNumber: number;
  positionSeconds: number;
  durationSeconds: number;
};

type SaveShortFilmWatchProgressInput = {
  contentType: "short_film";
  shortFilmSlug: string;
  positionSeconds: number;
  durationSeconds: number;
  completed?: boolean;
  adBreakState?: ShortFilmAdBreakState;
};

type SaveServerShortFilmWatchProgressInput = {
  contentType: "short_film";
  shortFilmSlug: string;
  positionSeconds: number;
  durationSeconds: number;
  adBreakState?: ShortFilmAdBreakState;
};

export type ShortFilmAdBreakState = {
  pendingBreakSeconds: number | null;
  handledBreakSeconds: number[];
  waivedBreakSeconds: number[];
};

const DEFAULT_SHORT_FILM_AD_BREAK_STATE: ShortFilmAdBreakState = {
  pendingBreakSeconds: null,
  handledBreakSeconds: [],
  waivedBreakSeconds: [],
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

export async function getShortFilmProgress(supabase: TypedSupabaseClient, shortFilmSlug: string) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("watch_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("content_type", "short_film")
    .eq("short_film_slug", shortFilmSlug)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load short film progress.");
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
      content_type: input.contentType ?? "series_episode",
      user_id: userId,
      series_slug: input.seriesSlug,
      episode_number: input.episodeNumber,
      short_film_slug: null,
      position_seconds: positionSeconds,
      duration_seconds: durationSeconds,
      completed,
      ad_break_state: DEFAULT_SHORT_FILM_AD_BREAK_STATE,
      last_watched_at: now,
    },
    {
      onConflict: "user_id,content_type,series_slug,episode_number",
    },
  );

  if (error) {
    console.warn("Unable to save watch progress.");
    return false;
  }

  return true;
}

export async function saveShortFilmWatchProgress(
  supabase: TypedSupabaseClient,
  input: SaveShortFilmWatchProgressInput,
) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return false;
  }

  const durationSeconds = Math.max(0, Math.floor(input.durationSeconds));
  const positionSeconds = clampSeconds(input.positionSeconds, durationSeconds);
  const completed =
    input.completed ?? (durationSeconds > 0 && positionSeconds >= durationSeconds - 5);
  const now = new Date().toISOString();

  const { error } = await supabase.from("watch_progress").upsert(
    {
      ad_break_state: input.adBreakState ?? DEFAULT_SHORT_FILM_AD_BREAK_STATE,
      completed,
      content_type: "short_film",
      duration_seconds: durationSeconds,
      episode_number: null,
      last_watched_at: now,
      position_seconds: positionSeconds,
      series_slug: null,
      short_film_slug: input.shortFilmSlug,
      user_id: userId,
    },
    {
      onConflict: "user_id,content_type,short_film_slug",
    },
  );

  if (error) {
    console.warn("Unable to save short film progress.");
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
    .eq("content_type", "series_episode")
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
        content_type: input.contentType ?? "series_episode",
        ad_break_state: DEFAULT_SHORT_FILM_AD_BREAK_STATE,
        user_id: userId,
        series_slug: input.seriesSlug,
        episode_number: input.episodeNumber,
        short_film_slug: null,
        position_seconds: positionSeconds,
        duration_seconds: durationSeconds,
        completed,
        last_watched_at: now,
      },
      {
        onConflict: "user_id,content_type,series_slug,episode_number",
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

export async function saveServerShortFilmWatchProgress(
  supabase: TypedSupabaseClient,
  input: SaveServerShortFilmWatchProgressInput,
) {
  const userId = await getAuthenticatedUserId(supabase);

  if (!userId) {
    return null;
  }

  const durationSeconds = Math.max(0, Math.floor(input.durationSeconds));
  const positionSeconds = clampSeconds(input.positionSeconds, durationSeconds);
  const derivedCompleted =
    durationSeconds > 0 && durationSeconds - positionSeconds <= 5;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("watch_progress")
    .upsert(
      {
        ad_break_state: input.adBreakState ?? DEFAULT_SHORT_FILM_AD_BREAK_STATE,
        completed: derivedCompleted,
        content_type: "short_film",
        duration_seconds: durationSeconds,
        episode_number: null,
        last_watched_at: now,
        position_seconds: positionSeconds,
        series_slug: null,
        short_film_slug: input.shortFilmSlug,
        user_id: userId,
      },
      {
        onConflict: "user_id,content_type,short_film_slug",
      },
    )
    .select("*")
    .single();

  if (error) {
    console.warn("Unable to save short film progress.");
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
  shortFilms: ShortFilm[] = [],
) {
  const seen = new Set<string>();

  return progressRows.reduce<ContentItem[]>((items, progress) => {
    if (progress.content_type === "short_film") {
      const shortFilmSlug = progress.short_film_slug;

      if (!shortFilmSlug || progress.completed) {
        return items;
      }

      const shortFilm = shortFilms.find((item) => item.slug === shortFilmSlug);

      if (!shortFilm) {
        return items;
      }

      if (seen.has(`short:${shortFilm.slug}`)) {
        return items;
      }
      seen.add(`short:${shortFilm.slug}`);

      items.push({
        id: shortFilm.slug,
        title: shortFilm.title,
        slug: shortFilm.slug,
        genre: "Short Film",
        format: "Short",
        episodeCount: 1,
        episodeDuration: shortFilm.durationLabel,
        synopsis: shortFilm.synopsis,
        poster: shortFilm.poster ?? "/logo-og.jpg",
        accent: contentItems.find((item) => item.slug === shortFilm.slug)?.accent ?? "#0DD1BC",
        episodes: [],
        progress: getProgressPercentage(
          progress.position_seconds,
          progress.duration_seconds || shortFilm.durationSeconds,
        ),
        currentEpisode: "Resume",
      });
      return items;
    }

    const seriesSlug = progress.series_slug;
    const episodeNumber = progress.episode_number;

    if (!seriesSlug || !episodeNumber || progress.completed) {
      return items;
    }

    const series =
      catalogItems.find((item) => item.slug === seriesSlug) ?? getSeriesBySlug(seriesSlug);
    const episode = getEpisode(seriesSlug, episodeNumber);

    if (!series || !episode) {
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
