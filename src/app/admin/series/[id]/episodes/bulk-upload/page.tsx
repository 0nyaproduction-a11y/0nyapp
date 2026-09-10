import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { BulkEpisodeUploadForm } from "@/components/cms/BulkEpisodeUploadForm";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { createEpisode, listEpisodesForSeries } from "@/lib/cms/episodes";
import { getSeriesForAdminById } from "@/lib/cms/series";
import { assignEpisodeMediaAsset, attachEpisodeMediaUploadIntent, createMediaUploadIntent, refreshMediaAssetStatus } from "@/lib/cms/media";
import {
  buildEpisodeInputForBulkCreate,
  type BulkEpisodeCreateInput,
  type BulkEpisodeCreateResult,
  type BulkEpisodeFinalizeResult,
} from "@/lib/cms/bulk-episodes";
import { episodeBulkUploadPath, episodeEditPath, episodeNewPath, seriesEditPath } from "@/lib/routes";

type BulkEpisodeUploadPageProps = {
  params: Promise<{ id: string }>;
};

function toCreateResult(result: Awaited<ReturnType<typeof createEpisode>>): BulkEpisodeCreateResult {
  if (result.success) {
    return {
      success: true,
      episode: {
        duration_seconds: result.episode.duration_seconds,
        id: result.episode.id,
        episode_number: result.episode.episode_number,
        media_asset_id: result.episode.media_asset_id,
        status: result.episode.status,
        title: result.episode.title,
      },
    };
  }

  return {
    success: false,
    error: result.errors[0]?.message ?? "Unable to create episode.",
  };
}

export default async function BulkEpisodeUploadPage({ params }: BulkEpisodeUploadPageProps) {
  const { id } = await params;
  const context = await requireCmsAdmin(episodeBulkUploadPath(id));

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

  const currentSeries = await getSeriesForAdminById(id);

  if (!currentSeries) {
    notFound();
  }

  const existingNumbers = (await listEpisodesForSeries(id)).rows.map((episode) => episode.episode_number);

  async function createEpisodeAction(input: BulkEpisodeCreateInput): Promise<BulkEpisodeCreateResult> {
    "use server";

    const guard = await requireCmsAdmin(episodeBulkUploadPath(id));

    if (guard.status !== "authorized") {
      return { success: false, error: "Not authorized." };
    }

    if (existingNumbers.includes(input.episodeNumber)) {
      return { success: false, error: "That episode number is already used in this series." };
    }

    const result = await createEpisode(id, buildEpisodeInputForBulkCreate(input));
    if (result.success) {
      revalidatePath(seriesEditPath(id));
    }

    return toCreateResult(result);
  }

  async function requestUploadAction(mimeType: string, corsOriginOverride?: string | null) {
    "use server";

    const guard = await requireCmsAdmin(episodeBulkUploadPath(id));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createMediaUploadIntent(mimeType, corsOriginOverride);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unable to prepare upload.",
      };
    }
  }

  async function attachEpisodeMediaUploadIntentAction(input: {
    episodeId: string;
    mediaAssetId: string;
  }) {
    "use server";

    const guard = await requireCmsAdmin(episodeBulkUploadPath(id));

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

  async function finalizeUploadAction(input: { episodeId: string; mediaAssetId: string }): Promise<BulkEpisodeFinalizeResult> {
    "use server";

    const guard = await requireCmsAdmin(episodeBulkUploadPath(id));

    if (guard.status !== "authorized") {
      return { success: false, error: "Not authorized." };
    }

    const refresh = await refreshMediaAssetStatus(input.mediaAssetId);

    if (refresh.status === "not_found") {
      return { success: false, error: "Media asset not found.", mediaStatus: "not_found" };
    }

    if (refresh.mediaStatus !== "ready") {
      return { success: true, assigned: false, episodeId: input.episodeId, mediaAssetId: input.mediaAssetId, mediaStatus: refresh.mediaStatus };
    }

    await assignEpisodeMediaAsset(input.episodeId, input.mediaAssetId);
    revalidatePath(seriesEditPath(id));
    revalidatePath(episodeEditPath(id, input.episodeId));

    return { success: true, assigned: true, episodeId: input.episodeId, mediaAssetId: input.mediaAssetId, mediaStatus: "ready" };
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">0nya CMS</p>
          <h1 className="mt-2 text-2xl font-semibold">Bulk upload episodes</h1>
          <p className="mt-1 text-sm text-bone/50">/{currentSeries.slug}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link href={seriesEditPath(id)} className="text-teal">
              ← Back to series
            </Link>
            <Link href={episodeNewPath(id)} className="text-teal">
              Add episode
            </Link>
          </div>
        </div>

        <BulkEpisodeUploadForm
          attachEpisodeMediaUploadIntentAction={attachEpisodeMediaUploadIntentAction}
          createEpisodeAction={createEpisodeAction}
          existingEpisodeNumbers={existingNumbers}
          finalizeUploadAction={finalizeUploadAction}
          requestUploadAction={requestUploadAction}
          seriesId={id}
        />
      </div>
    </main>
  );
}
