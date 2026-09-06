import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import {
  getMuxProviderInventory,
  type ProviderInventoryResult,
} from "./media-truth-provider-inventory";
import {
  buildProviderTruthSnap,
  classifyMediaAssetWithProvider,
  indexEpisodeMediaReferences,
  MEDIA_TRUTH_UNPROBED,
  type ClassifyInput,
  type ClassifyResult,
  type DerivedChildRef,
  type EpisodeRef,
  type MediaAssetRefs,
  type MediaAssetStatus,
  type MediaAssetSubtitles,
  type MediaAssetTruth,
  type MediaTruthClassification,
  type MediaTruthFlag,
  type MediaTruthLiveSource,
  type ProviderTruthSnap,
  type ShortFilmRef,
} from "./media-truth-model";
export type {
  ProviderInventoryState,
  MuxProviderAsset,
  ProviderInventoryResult,
  ProviderInventoryItem,
  DuplicateProviderMapping,
  RefreshSafeguard,
} from "./media-truth-provider-inventory";

export {
  getMuxProviderInventory,
  getReconciledState,
  getAssetsByState,
  hasRefreshSafetyConcerns,
} from "./media-truth-provider-inventory";

// Re-export the public type contract so consumers import from one place.
export type {
  ClassifyInput,
  ClassifyResult,
  DerivedChildRef,
  EpisodeRef,
  MediaAssetRefs,
  MediaAssetStatus,
  MediaAssetSubtitles,
  MediaAssetTruth,
  MediaTruthClassification,
  MediaTruthFlag,
  MediaTruthLiveSource,
  ShortFilmRef,
};
export { MEDIA_TRUTH_UNPROBED };

export interface BuildMediaTruthOptions {
  // Live provider truth source. Pass the result of ONE bounded
  // getMuxProviderInventory() call; every stored asset is reconciled against
  // this single inventory listing (never per-row Mux probes on page load).
  providerInventory?: ProviderInventoryResult;
  // Legacy flag. When true (default) and no providerInventory is supplied, a
  // single bounded getMuxProviderInventory() call is made once and used as the
  // provider truth input. This never issues per-row Mux requests.
  probeMux?: boolean;
  // Optional subset of asset ids to evaluate. When omitted, all assets rows
  // are evaluated.
  assetIds?: string[];
}

type SubtitleTrackRow = Database["public"]["Tables"]["subtitle_tracks"]["Row"];
// NOTE: Database["public"]["Tables"]["series"]["Row"] resolves to a stale
// duplicate "series" table entry in the generated types (missing
// published_at) because src/types/database.ts contains two "series" keys
// under Tables; TypeScript picks up the first one. That duplication is a
// pre-existing issue in the generated types file, out of scope for M6A, so
// this local type is declared explicitly here instead of relying on the
// (currently ambiguous) generated Row type.
type SeriesRow = {
  id: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
};

function pushRef<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

function aggregateSubtitles(tracks: SubtitleTrackRow[]): MediaAssetSubtitles {
  const agg: MediaAssetSubtitles = {
    total: tracks.length,
    ready: 0,
    failed: 0,
    processing: 0,
    pending: 0,
    deleted: 0,
  };
  for (const track of tracks) {
    if (track.status === "ready") agg.ready += 1;
    else if (track.status === "failed") agg.failed += 1;
    else if (track.status === "processing") agg.processing += 1;
    else if (track.status === "pending") agg.pending += 1;
    else if (track.status === "deleted") agg.deleted += 1;
  }
  return agg;
}

// Synthesizes a read-only inspection-shaped live source from the aggregated
// provider truth snap (derived from the single Mux inventory listing). This is
// NOT a per-asset Mux request: it only carries evidence already present in the
// provider inventory. When neither a matched Mux asset nor a proven absence
// (complete coverage + stored reference) exists, live stays UNPROBED.
function synthesizeLiveInspection(
  stored: Database["public"]["Tables"]["media_assets"]["Row"],
  provider: ProviderTruthSnap,
): MediaTruthLiveSource {
  const storedUploadRef = stored.provider_upload_reference?.trim() || null;
  const storedAssetRef = stored.provider_asset_reference?.trim() || null;
  const expectsProviderRefs = Boolean(storedUploadRef || storedAssetRef);
  const provesMissing =
    expectsProviderRefs && !provider.muxAssetExists && provider.muxInventoryComplete;

  if (!provider.muxAssetExists && !provesMissing) {
    return MEDIA_TRUTH_UNPROBED;
  }

  const mediaStatus =
    provider.muxAssetStatus === "ready"
      ? "ready"
      : provider.muxAssetStatus === "errored" ||
          provider.muxAssetStatus === "deleted" ||
          provider.muxAssetStatus === "cancelled"
        ? "failed"
        : provider.muxAssetExists
          ? "processing"
          : "failed";

  return {
    mediaAssetId: stored.id,
    status: "inspected",
    providerAssetReference: provider.muxAssetId ?? storedAssetRef,
    providerPlaybackReference: provider.signedPlaybackId,
    providerUploadReference: storedUploadRef,
    muxAssetStatus: provider.muxAssetStatus,
    muxUploadStatus: provider.muxUploadStatus,
    mediaStatus,
    muxAssetExists: provider.muxAssetExists,
    muxUploadExists: Boolean(storedUploadRef),
    signedPlaybackId: provider.signedPlaybackId,
    failureCode: provesMissing ? "mux_asset_missing" : null,
    failureMessage: provesMissing
      ? "Provider asset reference was not found in the live Mux inventory."
      : null,
    maxResolutionTier: null,
    resolutionTier: null,
  };
}

export async function buildMediaTruth(
  supabaseClient?: SupabaseClient<Database>,
  options: BuildMediaTruthOptions = {},
): Promise<MediaAssetTruth[]> {
  const supabase = supabaseClient ?? createAdminClient();
  const probeMux = options.probeMux ?? true;

  // ONE bounded provider inventory workflow. Explicitly NOT per-row probes:
  // the single getMuxProviderInventory() listing is the primary provider-truth
  // input for every stored asset below.
  let providerInventory = options.providerInventory;
  if (!providerInventory && probeMux) {
    providerInventory = await getMuxProviderInventory();
  }

  let assetQuery = supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (options.assetIds && options.assetIds.length > 0) {
    assetQuery = assetQuery.in("id", options.assetIds);
  }
  const { data: assets, error: assetsError } = await assetQuery;
  if (assetsError || !assets) {
    return [];
  }

  const assetById = new Map(assets.map((a) => [a.id, a]));

  const [
    { data: episodes, error: episodesError },
    { data: shortFilms, error: shortFilmsError },
    { data: subtitleTracks, error: subtitlesError },
    { data: series, error: seriesError },
  ] = await Promise.all([
    supabase
      .from("episodes")
      .select(
        "id,series_id,episode_number,status,published_at,media_asset_id,preview_media_asset_id",
      ),
    supabase.from("short_films").select("id,status,publish_at,media_asset_id"),
    supabase
      .from("subtitle_tracks")
      .select("id,target_type,episode_id,short_film_id,status"),
    supabase.from("series").select("id,status,published_at"),
  ]);

  if (episodesError || shortFilmsError || subtitlesError || seriesError) {
    return [];
  }

  const seriesById = new Map<string, SeriesRow>();
  for (const row of series ?? []) {
    const s = row as unknown as SeriesRow;
    seriesById.set(s.id, s);
  }
  const episodeReferenceRows = [];
  for (const ep of episodes ?? []) {
    const seriesRow = ep.series_id ? seriesById.get(ep.series_id) : undefined;
    episodeReferenceRows.push({
      id: ep.id,
      seriesId: ep.series_id,
      episodeNumber: ep.episode_number,
      status: ep.status,
      publishedAt: ep.published_at,
      seriesStatus: seriesRow?.status ?? "draft",
      seriesPublishedAt: seriesRow?.published_at ?? null,
      mediaAssetId: ep.media_asset_id,
      // COMPATIBILITY_REFERENCE_SAFETY: deletion/truth inspection only.
      legacyPreviewMediaAssetId: ep.preview_media_asset_id,
    });
  }
  const episodesByMediaAsset = indexEpisodeMediaReferences(episodeReferenceRows);

  const shortFilmsByMediaAsset = new Map<string, ShortFilmRef[]>();
  for (const sf of shortFilms ?? []) {
    if (!sf.media_asset_id) continue;
    pushRef(shortFilmsByMediaAsset, sf.media_asset_id, {
      id: sf.id,
      status: sf.status,
      publishAt: sf.publish_at,
    });
  }

  const derivedByParent = new Map<string, DerivedChildRef[]>();
  for (const a of assets) {
    if (!a.source_media_asset_id) continue;
    pushRef(derivedByParent, a.source_media_asset_id, {
      id: a.id,
      status: a.status,
    });
  }

  const subsByEpisode = new Map<string, SubtitleTrackRow[]>();
  const subsByShortFilm = new Map<string, SubtitleTrackRow[]>();
  for (const st of subtitleTracks ?? []) {
    if (st.target_type === "SERIES_EPISODE" && st.episode_id) {
      pushRef(subsByEpisode, st.episode_id, st);
    } else if (st.target_type === "SHORT_FILM" && st.short_film_id) {
      pushRef(subsByShortFilm, st.short_film_id, st);
    }
  }

  const truths: MediaAssetTruth[] = [];
  for (const asset of assets) {
    const refs: MediaAssetRefs = {
      episodes: episodesByMediaAsset.get(asset.id) ?? [],
      shortFilms: shortFilmsByMediaAsset.get(asset.id) ?? [],
      derivedChildren: derivedByParent.get(asset.id) ?? [],
    };

    const relatedSubs: SubtitleTrackRow[] = [];
    for (const ep of refs.episodes) {
      relatedSubs.push(...(subsByEpisode.get(ep.id) ?? []));
    }
    for (const sf of refs.shortFilms) {
      relatedSubs.push(...(subsByShortFilm.get(sf.id) ?? []));
    }

    const parentExists = asset.source_media_asset_id
      ? assetById.has(asset.source_media_asset_id)
      : true;

    // Reconcile this stored asset against the single live provider inventory
    // listing: never an individual N x Mux request on page load.
    const provider = buildProviderTruthSnap(asset, providerInventory);
    const live = providerInventory
      ? synthesizeLiveInspection(asset, provider)
      : MEDIA_TRUTH_UNPROBED;

    const { classification, flags } = classifyMediaAssetWithProvider({
      stored: asset,
      refs,
      parentExists,
      provider,
    });

    truths.push({
      assetId: asset.id,
      stored: asset,
      refs,
      subtitles: aggregateSubtitles(relatedSubs),
      live,
      parentExists,
      classification,
      flags,
    });
  }

  return truths;
}
