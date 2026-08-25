import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type MediaAssetState = "missing" | "pending" | "processing" | "ready" | "failed";

export type ResolvedMediaAssetState = {
  status: MediaAssetState;
};

type EpisodeTarget = {
  type: "SERIES_EPISODE";
  episodeNumber: number;
  seriesSlug: string;
};

type ShortFilmTarget = {
  type: "SHORT_FILM";
  slug: string;
};

export type MediaTarget = EpisodeTarget | ShortFilmTarget;

async function getAdminClient(supabaseClient?: SupabaseClient<Database>) {
  return supabaseClient ?? createAdminClient();
}

async function resolveMediaAssetStatusById(
  mediaAssetId: string | null | undefined,
  supabaseClient?: SupabaseClient<Database>,
): Promise<MediaAssetState> {
  if (!mediaAssetId) {
    return "missing";
  }

  const supabase = await getAdminClient(supabaseClient);
  const { data, error } = await supabase
    .from("media_assets")
    .select("status")
    .eq("id", mediaAssetId)
    .maybeSingle();

  if (error || !data) {
    return "missing";
  }

  return data.status as MediaAssetState;
}

export async function resolveMediaAssetState(
  target: MediaTarget,
  supabaseClient?: SupabaseClient<Database>,
): Promise<ResolvedMediaAssetState> {
  const supabase = await getAdminClient(supabaseClient);

  if (target.type === "SERIES_EPISODE") {
    const { data: series, error: seriesError } = await supabase
      .from("series")
      .select("id")
      .eq("slug", target.seriesSlug)
      .maybeSingle();

    if (seriesError || !series) {
      return { status: "missing" };
    }

    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .select("media_asset_id")
      .eq("series_id", series.id)
      .eq("episode_number", target.episodeNumber)
      .maybeSingle();

    if (episodeError || !episode) {
      return { status: "missing" };
    }

    return {
      status: await resolveMediaAssetStatusById(episode.media_asset_id, supabase),
    };
  }

  const { data: shortFilm, error: shortFilmError } = await supabase
    .from("short_films")
    .select("media_asset_id")
    .eq("slug", target.slug)
    .maybeSingle();

  if (shortFilmError || !shortFilm) {
    return { status: "missing" };
  }

  return {
    status: await resolveMediaAssetStatusById(shortFilm.media_asset_id, supabase),
  };
}
