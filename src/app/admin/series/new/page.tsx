import { revalidatePath } from "next/cache";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { NewSeriesIntakeForm } from "@/components/cms/NewSeriesIntakeForm";
import { createSeriesDraftAction } from "@/app/admin/series/actions";
import { createArtworkUploadIntent } from "@/lib/supabase/artwork";
import {
  attachEpisodeMediaUploadIntent,
  createMediaUploadIntent,
  assignEpisodeMediaAsset,
  refreshMediaAssetStatus,
} from "@/lib/cms/media";
import { buildEpisodeInputForBulkCreate, type BulkEpisodeFinalizeResult } from "@/lib/cms/bulk-episodes";
import { createEpisode, getEpisodeForSeriesByNumber } from "@/lib/cms/episodes";
import { getSeriesForAdminById, persistSeriesArtwork } from "@/lib/cms/series";
import { episodeEditPath, seriesEditPath, seriesListPath, seriesNewPath } from "@/lib/routes";
import { createSubtitleUploadIntent, finalizeSubtitleTrackUpload } from "@/lib/subtitles";

type SeriesNewPageProps = {
  params?: Promise<Record<string, never>>;
};

type FinalizeMediaStatus = "pending" | "processing" | "ready" | "failed" | "not_found";
type SubtitleFinalizeResult =
  | {
      success: true;
      subtitleTrackId: string;
      status: "ready" | "processing";
    }
  | {
      success: false;
      error: string;
    };

export default async function NewSeriesPage({ params }: SeriesNewPageProps) {
  if (params) {
    await params;
  }

  const context = await requireCmsAdmin(seriesNewPath);

  if (context.status === "forbidden") {
    return (
      <main className="min-h-screen bg-deep px-4 py-10 text-bone">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-bone/70">You are not authorized for CMS access.</p>
        </div>
      </main>
    );
  }

  async function createEpisodeAction(seriesId: string, input: Parameters<typeof buildEpisodeInputForBulkCreate>[0]) {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { success: false as const, error: "Not authorized." };
    }

    const existingSeries = await getSeriesForAdminById(seriesId);
    if (!existingSeries) {
      return { success: false as const, error: "Series not found." };
    }

    const existingEpisode = await getEpisodeForSeriesByNumber(seriesId, input.episodeNumber);
    if (existingEpisode) {
      return {
        success: true as const,
        episode: {
          duration_seconds: existingEpisode.duration_seconds,
          id: existingEpisode.id,
          episode_number: existingEpisode.episode_number,
          media_asset_id: existingEpisode.media_asset_id,
          status: existingEpisode.status,
          title: existingEpisode.title,
        },
      };
    }

    const result = await createEpisode(seriesId, buildEpisodeInputForBulkCreate(input));

    if (result.success) {
      revalidatePath(seriesEditPath(seriesId));
    }

    return result.success
      ? {
          success: true as const,
          episode: {
            duration_seconds: result.episode.duration_seconds,
            id: result.episode.id,
            episode_number: result.episode.episode_number,
            media_asset_id: result.episode.media_asset_id,
            status: result.episode.status,
            title: result.episode.title,
          },
        }
      : { success: false as const, error: result.errors[0]?.message ?? "Unable to create episode." };
  }

  async function requestArtworkUploadAction(
    seriesId: string,
    kind: "series-poster" | "series-hero",
    mimeType: string,
  ) {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    const series = await getSeriesForAdminById(seriesId);
    if (!series) {
      return { error: "Series not found." };
    }

    try {
      return await createArtworkUploadIntent({
        kind,
        targetId: seriesId,
        mimeType,
      });
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function persistArtworkAction(
    seriesId: string,
    field: "poster_url" | "hero_image_url",
    publicUrl: string,
  ) {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { success: false as const, message: "Not authorized." };
    }

    const series = await getSeriesForAdminById(seriesId);
    if (!series) {
      return { success: false as const, message: "Series not found." };
    }

    const result = await persistSeriesArtwork(seriesId, field, publicUrl);
    if (!result.success) {
      return { success: false as const, message: "Unable to save artwork." };
    }

    revalidatePath(seriesEditPath(seriesId));
    revalidatePath(seriesListPath);
    return { success: true as const };
  }

  async function requestMediaUploadAction(mimeType: string, corsOriginOverride?: string | null) {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createMediaUploadIntent(mimeType, corsOriginOverride);
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function attachEpisodeMediaUploadIntentAction(
    input: { episodeId: string; mediaAssetId: string },
  ) {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { success: false as const, error: "Not authorized." };
    }

    try {
      await attachEpisodeMediaUploadIntent(input.episodeId, input.mediaAssetId);
      return { success: true as const };
    } catch {
      return { success: false as const, error: "Unable to attach upload to the episode." };
    }
  }

  async function requestSubtitleUploadAction(input: {
    closedCaptions: boolean;
    episodeNumber: number;
    isDefault: boolean;
    label: string;
    languageCode: string;
    mimeType: string;
    seriesSlug: string;
    sourceFormat: "srt" | "vtt";
  }) {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createSubtitleUploadIntent({
        closedCaptions: input.closedCaptions,
        isDefault: input.isDefault,
        label: input.label,
        languageCode: input.languageCode,
        mimeType: input.mimeType,
        sourceFormat: input.sourceFormat,
        target: {
          episodeNumber: input.episodeNumber,
          seriesSlug: input.seriesSlug,
          type: "SERIES_EPISODE",
        },
      });
    } catch {
      return { error: "Unable to prepare subtitle upload." };
    }
  }

  async function finalizeSubtitleUploadAction(input: {
    closedCaptions: boolean;
    episodeNumber: number;
    isDefault: boolean;
    label: string;
    languageCode: string;
    mimeType: string;
    objectPath: string;
    seriesSlug: string;
    sourceFormat: "srt" | "vtt";
  }): Promise<SubtitleFinalizeResult> {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { success: false, error: "Not authorized." };
    }

    try {
      const result = await finalizeSubtitleTrackUpload({
        closedCaptions: input.closedCaptions,
        isDefault: input.isDefault,
        label: input.label,
        languageCode: input.languageCode,
        mimeType: input.mimeType,
        objectPath: input.objectPath,
        sourceFormat: input.sourceFormat,
        target: {
          episodeNumber: input.episodeNumber,
          seriesSlug: input.seriesSlug,
          type: "SERIES_EPISODE",
        },
      });

      if (result.status === "failed") {
        return { success: false, error: "Mux subtitle track creation failed." };
      }

      return {
        success: true,
        status: result.status,
        subtitleTrackId: result.subtitleTrackId,
      };
    } catch {
      return { success: false, error: "Unable to save subtitle track." };
    }
  }

  async function finalizeUploadAction(
    seriesId: string,
    input: { episodeId: string; mediaAssetId: string },
  ): Promise<BulkEpisodeFinalizeResult> {
    "use server";

    const guard = await requireCmsAdmin(seriesNewPath);

    if (guard.status !== "authorized") {
      return { success: false as const, error: "Not authorized." };
    }

    const series = await getSeriesForAdminById(seriesId);
    if (!series) {
      return { success: false as const, error: "Series not found." };
    }

    const refresh = await refreshMediaAssetStatus(input.mediaAssetId);

    const mediaStatus = refresh.status === "updated" ? (refresh.mediaStatus as Exclude<FinalizeMediaStatus, "not_found">) : "not_found";

    if (mediaStatus === "not_found") {
      return { success: false as const, error: "Media asset not found.", mediaStatus: "not_found" };
    }

    if (mediaStatus !== "ready") {
      return {
        success: true as const,
        assigned: false,
        episodeId: input.episodeId,
        mediaAssetId: input.mediaAssetId,
        mediaStatus,
      };
    }

    await assignEpisodeMediaAsset(input.episodeId, input.mediaAssetId);
    revalidatePath(seriesEditPath(seriesId));
    revalidatePath(episodeEditPath(seriesId, input.episodeId));

    return {
      success: true as const,
      assigned: true,
      episodeId: input.episodeId,
      mediaAssetId: input.mediaAssetId,
      mediaStatus: "ready",
    };
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">0nya CMS</p>
          <h1 className="mt-2 text-2xl font-semibold">New series</h1>
          <p className="mt-1 text-sm text-bone/60">Start with the media, then confirm the draft series setup.</p>
        </div>

        <NewSeriesIntakeForm
          createSeriesDraftAction={createSeriesDraftAction}
          createEpisodeAction={createEpisodeAction}
          finalizeUploadAction={finalizeUploadAction}
          attachEpisodeMediaUploadIntentAction={attachEpisodeMediaUploadIntentAction}
          requestSubtitleUploadAction={requestSubtitleUploadAction}
          finalizeSubtitleUploadAction={finalizeSubtitleUploadAction}
          persistArtworkAction={persistArtworkAction}
          requestArtworkUploadAction={requestArtworkUploadAction}
          requestMediaUploadAction={requestMediaUploadAction}
        />
      </div>
    </main>
  );
}
