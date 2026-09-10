import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArtworkUploadField } from "@/components/cms/ArtworkUploadField";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { DangerZoneDeleteForm, type DeleteFormState } from "@/components/cms/DangerZoneDeleteForm";
import { EpisodeMetadataForm } from "@/components/cms/EpisodeMetadataForm";
import { Button } from "@/components/ui/Button";
import { EpisodeMediaAssignmentForm } from "@/components/cms/EpisodeMediaAssignmentForm";
import { CmsBreadcrumb } from "@/components/cms/CmsBreadcrumb";
import { requireCmsAdmin } from "@/lib/cms/auth";
import {
  EPISODE_STATUSES,
  deleteEpisode,
  getEpisodeDeletePreview,
  getEpisodeForAdminById,
  persistEpisodeThumbnail,
  resolveEpisodeMediaReadiness,
  updateEpisode,
  updateEpisodeStatus,
  type EpisodeStatus,
} from "@/lib/cms/episodes";
import { errorsToRecord, parseEpisodeFormData, type EpisodeFormState } from "@/lib/cms/episode-form";
import { assignEpisodeMediaAsset, listReadyMediaAssetsForAdmin, type MediaAssetFormState } from "@/lib/cms/media";
import { getSeriesForAdminById } from "@/lib/cms/series";
import { episodeEditPath, homeListPath, seriesEditPath, seriesListPath, seriesPath, purchaseEpisodePath, watchEpisodePath } from "@/lib/routes";
import { ARTWORK_MAX_FILE_SIZE_BYTES, createArtworkUploadIntent } from "@/lib/supabase/artwork";

const ARTWORK_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type EpisodeEditPageProps = {
  params: Promise<{ id: string; episodeId: string }>;
};

function buildFlashUrl(path: string, kind: "error" | "flash", message: string) {
  const params = new URLSearchParams();
  params.set(kind, message);
  return `${path}?${params.toString()}`;
}

export default async function EpisodeEditPage({ params }: EpisodeEditPageProps) {
  const { id: seriesId, episodeId } = await params;
  const context = await requireCmsAdmin(episodeEditPath(seriesId, episodeId));

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

  const [series, episode] = await Promise.all([
    getSeriesForAdminById(seriesId),
    getEpisodeForAdminById(episodeId),
  ]);

  if (!series || !episode || episode.series_id !== seriesId) {
    notFound();
  }

  const currentSeries = series;
  const currentEpisode = episode;

  const mediaReadiness = await resolveEpisodeMediaReadiness(currentEpisode);
  const readyMediaAssets = await listReadyMediaAssetsForAdmin();
  const deletePreview = await getEpisodeDeletePreview(currentEpisode, currentSeries.slug);

  async function updateEpisodeAction(
    _prevState: EpisodeFormState,
    formData: FormData,
  ): Promise<EpisodeFormState> {
    "use server";

    const guard = await requireCmsAdmin(episodeEditPath(seriesId, episodeId));

    if (guard.status === "forbidden") {
      return { errors: { form: "You are not authorized to manage content." } };
    }

    const existing = await getEpisodeForAdminById(episodeId);

    if (!existing) {
      return { errors: { form: "Episode not found." } };
    }

    const input = parseEpisodeFormData(formData, existing.thumbnail_url);
    const result = await updateEpisode(episodeId, input);

    if (!result.success) {
      return { errors: errorsToRecord(result.errors) };
    }

    revalidatePath(episodeEditPath(seriesId, episodeId));
    return {
      errors: {},
      submittedAt: getSubmissionTimestamp(),
      submitMode: String(formData.get("submitMode") ?? "save"),
    };
  }

  async function updateStatusAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(episodeEditPath(seriesId, episodeId));

    if (guard.status !== "authorized") {
      return;
    }

    const status = String(formData.get("status"));

    if (!EPISODE_STATUSES.includes(status as EpisodeStatus)) {
      return;
    }

    const result = await updateEpisodeStatus(episodeId, status as EpisodeStatus);

    if (!result.success) {
      return;
    }

    revalidatePath(episodeEditPath(seriesId, episodeId));
    revalidatePath(seriesEditPath(seriesId));
    revalidatePath(seriesListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath(seriesPath(currentSeries.slug));
    revalidatePath(watchEpisodePath(currentSeries.slug, currentEpisode.episode_number));
    revalidatePath(purchaseEpisodePath(currentSeries.slug, currentEpisode.episode_number));
    revalidatePath("/api/v1/catalog");
    redirect(episodeEditPath(seriesId, episodeId));
  }

  async function requestThumbnailUploadAction(mimeType: string) {
    "use server";

    const guard = await requireCmsAdmin(episodeEditPath(seriesId, episodeId));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createArtworkUploadIntent({
        kind: "episode-thumbnail",
        targetId: episodeId,
        mimeType,
      });
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function persistThumbnailAction(publicUrl: string) {
    "use server";

    const guard = await requireCmsAdmin(episodeEditPath(seriesId, episodeId));

    if (guard.status !== "authorized") {
      return { success: false as const, message: "Not authorized." };
    }

    const result = await persistEpisodeThumbnail(episodeId, publicUrl);

    if (!result.success) {
      return { success: false as const, message: "Unable to save thumbnail." };
    }

    revalidatePath(episodeEditPath(seriesId, episodeId));
    return { success: true as const };
  }

  async function assignMediaAssetAction(
    _state: MediaAssetFormState,
    formData: FormData,
  ): Promise<MediaAssetFormState> {
    "use server";

    const guard = await requireCmsAdmin(episodeEditPath(seriesId, episodeId));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    const mediaAssetId = String(formData.get("mediaAssetId") ?? "").trim();

    if (!mediaAssetId) {
      return { error: "Select a ready media asset." };
    }

    try {
      const result = await assignEpisodeMediaAsset(episodeId, mediaAssetId);
      revalidatePath(episodeEditPath(seriesId, episodeId));
      return {
        message: result.updated ? "Media assignment updated." : "Media assignment already matched.",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unable to assign the media asset.",
      };
    }
  }

  async function deleteEpisodeAction(
    _prevState: DeleteFormState,
    formData: FormData,
  ): Promise<DeleteFormState> {
    "use server";

    const guard = await requireCmsAdmin(episodeEditPath(seriesId, episodeId));

    if (guard.status === "forbidden") {
      return { error: "You are not authorized to manage content." };
    }

    const confirmation = String(formData.get("confirmation") ?? "").trim();
    const confirmationValue = `${currentSeries.slug}#${currentEpisode.episode_number}`;

    if (confirmation !== confirmationValue) {
      return { error: `Type ${confirmationValue} exactly to confirm deletion.` };
    }

    const result = await deleteEpisode(currentEpisode, currentSeries.slug);

    if (!result.success) {
      return { error: result.message, blockers: result.blockers };
    }

    revalidatePath(seriesEditPath(seriesId));
    revalidatePath(seriesPath(currentSeries.slug));
    revalidatePath(watchEpisodePath(currentSeries.slug, currentEpisode.episode_number));
    revalidatePath(purchaseEpisodePath(currentSeries.slug, currentEpisode.episode_number));
    revalidatePath(seriesListPath);
    const message =
      result.cleanupWarnings.length > 0
        ? `Deleted episode ${currentEpisode.episode_number}, but ${result.cleanupWarnings.join(" ")}`
        : `Deleted episode ${currentEpisode.episode_number}.`;
    redirect(buildFlashUrl(seriesEditPath(seriesId), result.cleanupWarnings.length > 0 ? "error" : "flash", message));
  }

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Series", href: seriesListPath },
    { label: currentSeries.title, href: seriesEditPath(seriesId) },
    { label: `Episode ${currentEpisode.episode_number}`, isCurrent: true },
  ];

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-3xl space-y-10">
        <CmsBreadcrumb items={breadcrumbs} />

        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS · {series.title}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Episode {episode.episode_number}</h1>
        </div>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Status</h2>
          <form action={updateStatusAction} className="mt-3 flex items-center gap-3">
            <CmsSelect
              name="status"
              defaultValue={episode.status}
              className="w-40 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
              options={EPISODE_STATUSES.map((status) => ({ label: status, value: status }))}
            />
            <Button type="submit" variant="secondary">
              Update status
            </Button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Thumbnail</h2>
          <div className="mt-3">
            <ArtworkUploadField
              label="Thumbnail"
              currentUrl={episode.thumbnail_url}
              maxFileSizeBytes={ARTWORK_MAX_FILE_SIZE_BYTES}
              acceptedMimeTypes={ARTWORK_MIME_TYPES}
              requestUploadAction={requestThumbnailUploadAction}
              onUploaded={persistThumbnailAction}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
            Media assignment
          </h2>
          <p className="mt-2 text-sm text-bone/60">
            Video: <span className="text-bone">{mediaReadiness.video}</span>
          </p>
          <div className="mt-4">
            <EpisodeMediaAssignmentForm
              action={assignMediaAssetAction}
              currentMediaAssetId={episode.media_asset_id}
              currentMediaAssetStatus={mediaReadiness.video}
              readyMediaAssets={readyMediaAssets}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Metadata</h2>
          <div className="mt-3">
            <EpisodeMetadataForm action={updateEpisodeAction} episode={episode} submitLabel="Save changes" />
          </div>
        </section>

        <section>
          <DangerZoneDeleteForm
            action={deleteEpisodeAction}
            blockers={deletePreview.blockers}
            confirmationValue={`${currentSeries.slug}#${currentEpisode.episode_number}`}
            description="This permanently removes the episode and any exclusively owned Mux media."
            submitLabel="Delete episode permanently"
            title="Danger zone"
          />
        </section>
      </div>
    </main>
  );
}
function getSubmissionTimestamp(): number {
  return Date.now();
}
