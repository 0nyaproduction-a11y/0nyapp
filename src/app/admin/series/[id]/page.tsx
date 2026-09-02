import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ArtworkUploadField } from "@/components/cms/ArtworkUploadField";
import { DangerZoneDeleteForm, type DeleteFormState } from "@/components/cms/DangerZoneDeleteForm";
import { SeriesMetadataForm } from "@/components/cms/SeriesMetadataForm";
import { SeriesEpisodeManager } from "@/components/cms/SeriesEpisodeManager";
import { SeriesStatusForm, type SeriesStatusFormState } from "@/components/cms/SeriesStatusForm";
import { requireCmsAdmin } from "@/lib/cms/auth";
import {
  archiveAllEpisodesForSeries,
  deleteAllEpisodesForSeries,
  getSeriesEpisodesDeletePreview,
  listEpisodesForSeries,
  resolveEpisodeMediaReadiness,
  updateEpisode,
} from "@/lib/cms/episodes";
import { reconcileOrphanedProcessingMediaAssets } from "@/lib/cms/media";
import {
  getSeriesForAdminById,
  deleteSeries,
  getSeriesDeletePreview,
  persistSeriesArtwork,
  SERIES_STATUSES,
  updateSeries,
  updateSeriesStatus,
  type SeriesStatus,
} from "@/lib/cms/series";
import { errorsToRecord, parseSeriesFormData, type SeriesFormState } from "@/lib/cms/series-form";
import { parseEpisodeFormData, type EpisodeFormState } from "@/lib/cms/episode-form";
import {
  episodeBulkUploadPath,
  episodeEditPath,
  episodeNewPath,
  homeListPath,
  purchaseEpisodePath,
  seriesEditPath,
  seriesListPath,
  seriesPath,
  watchEpisodePath,
} from "@/lib/routes";
import { ARTWORK_MAX_FILE_SIZE_BYTES, createArtworkUploadIntent } from "@/lib/supabase/artwork";

const ARTWORK_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type AdminSeriesEditPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; flash?: string }>;
};

function buildFlashUrl(path: string, kind: "error" | "flash", message: string) {
  const params = new URLSearchParams();
  params.set(kind, message);
  return `${path}?${params.toString()}`;
}

export default async function AdminSeriesEditPage({ params, searchParams }: AdminSeriesEditPageProps) {
  const { id } = await params;
  const query = await (searchParams ?? Promise.resolve<{ error?: string; flash?: string }>({}));
  const context = await requireCmsAdmin(seriesEditPath(id));

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

  const series = await getSeriesForAdminById(id);

  if (!series) {
    notFound();
  }

  const currentSeries = series;
  const flashMessage = typeof query.flash === "string" ? query.flash : null;
  const errorMessage = typeof query.error === "string" ? query.error : null;

  const episodes = await listEpisodesForSeries(id);
  const hasEpisodes = episodes.length > 0;
  const hasUnassignedMediaEpisode = episodes.some((episode) => !episode.media_asset_id);
  const episodeManagerRows = await Promise.all(
    episodes.map(async (episode) => ({
      episode,
      action: buildEpisodeUpdateAction(episode.id),
      fullPageHref: episodeEditPath(id, episode.id),
      mediaReadiness: await resolveEpisodeMediaReadiness(episode),
    })),
  );
  const deleteEpisodesPreview = await getSeriesEpisodesDeletePreview(id);
  const deletePreview = await getSeriesDeletePreview(id);

  function buildEpisodeUpdateAction(episodeId: string) {
    return async function updateEpisodeReviewAction(
      _prevState: EpisodeFormState,
      formData: FormData,
    ): Promise<EpisodeFormState> {
      "use server";

      const guard = await requireCmsAdmin(seriesEditPath(id));

      if (guard.status === "forbidden") {
        return { errors: { form: "You are not authorized to manage content." } };
      }

      const existing = episodes.find((episode) => episode.id === episodeId);

      if (!existing) {
        return { errors: { form: "Episode not found." } };
      }

      const input = parseEpisodeFormData(formData, existing.thumbnail_url);
      const result = await updateEpisode(episodeId, input);

      if (!result.success) {
        return { errors: errorsToRecord(result.errors) };
      }

      revalidatePath(seriesEditPath(id));
      revalidatePath(seriesPath(currentSeries.slug));
      revalidatePath(watchEpisodePath(currentSeries.slug, existing.episode_number));
      revalidatePath(purchaseEpisodePath(currentSeries.slug, existing.episode_number));
      revalidatePath(episodeEditPath(id, episodeId));
      return {
        errors: {},
        submittedAt: Date.now(),
        submitMode: String(formData.get("submitMode") ?? "save"),
      };
    };
  }

  async function updateSeriesAction(
    _prevState: SeriesFormState,
    formData: FormData,
  ): Promise<SeriesFormState> {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status === "forbidden") {
      return { errors: { form: "You are not authorized to manage content." } };
    }

    const existing = await getSeriesForAdminById(id);

    if (!existing) {
      return { errors: { form: "Series not found." } };
    }

    const input = parseSeriesFormData(formData);
    input.posterUrl = existing.poster_url;
    input.heroImageUrl = existing.hero_image_url;

    const result = await updateSeries(id, input);

    if (!result.success) {
      return { errors: errorsToRecord(result.errors) };
    }

    revalidatePath(seriesEditPath(id));
    return { errors: {} };
  }

  async function updateStatusAction(
    _prevState: SeriesStatusFormState,
    formData: FormData,
  ): Promise<SeriesStatusFormState> {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status !== "authorized") {
      return { error: "You are not authorized to manage content." };
    }

    const status = String(formData.get("status"));

    if (!SERIES_STATUSES.includes(status as SeriesStatus)) {
      return { error: "Unsupported status." };
    }

    if (status === "archived") {
      const archiveResult = await archiveAllEpisodesForSeries(id);

      if (!archiveResult.success) {
        return { error: archiveResult.message };
      }
    }

    const result = await updateSeriesStatus(id, status as SeriesStatus);

    if (!result.success) {
      const blockerMessage =
        result.blockers && result.blockers.length > 0
          ? result.blockers.join(" ")
          : result.errors[0]?.message ?? "Unable to update series status.";
      return { error: blockerMessage };
    }

    revalidatePath(seriesEditPath(id));
    revalidatePath(seriesListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath(seriesPath(result.series.slug));
    revalidatePath("/api/v1/catalog");

    if (status === "archived" || status === "published") {
      const refreshedEpisodes = await listEpisodesForSeries(id);

      for (const episode of refreshedEpisodes) {
        revalidatePath(episodeEditPath(id, episode.id));
        revalidatePath(watchEpisodePath(result.series.slug, episode.episode_number));
        revalidatePath(purchaseEpisodePath(result.series.slug, episode.episode_number));
      }
    }

    redirect(seriesEditPath(id));
  }

  async function refreshProcessingMediaAction() {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status !== "authorized") {
      return;
    }

    // Reuses the existing Mux reconciliation path only — does not create any new
    // upload/asset and does not assign anything. It simply lets media_assets rows
    // that were orphaned mid-batch (e.g. a temporary intake page was left before an
    // upload finished) catch up to their real current Mux status, so a still-unassigned
    // Episode's original upload can then be assigned via the existing "Ready media
    // asset" picker on its edit page.
    const summary = await reconcileOrphanedProcessingMediaAssets();

    revalidatePath(seriesEditPath(id));

    const message =
      summary.checked === 0
        ? "No orphaned processing uploads found."
        : `Checked ${summary.checked} processing upload(s): ${summary.becameReady} became ready, ${summary.stillProcessing} still processing, ${summary.becameFailed} failed.`;

    redirect(buildFlashUrl(seriesEditPath(id), "flash", message));
  }

  async function requestPosterUploadAction(mimeType: string) {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createArtworkUploadIntent({ kind: "series-poster", targetId: id, mimeType });
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function persistPosterAction(publicUrl: string) {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status !== "authorized") {
      return { success: false as const, message: "Not authorized." };
    }

    const result = await persistSeriesArtwork(id, "poster_url", publicUrl);

    if (!result.success) {
      return { success: false as const, message: "Unable to save artwork." };
    }

    revalidatePath(seriesEditPath(id));
    return { success: true as const };
  }

  async function requestHeroUploadAction(mimeType: string) {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createArtworkUploadIntent({ kind: "series-hero", targetId: id, mimeType });
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function persistHeroAction(publicUrl: string) {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status !== "authorized") {
      return { success: false as const, message: "Not authorized." };
    }

    const result = await persistSeriesArtwork(id, "hero_image_url", publicUrl);

    if (!result.success) {
      return { success: false as const, message: "Unable to save artwork." };
    }

    revalidatePath(seriesEditPath(id));
    return { success: true as const };
  }

  async function deleteSeriesAction(
    _prevState: DeleteFormState,
    formData: FormData,
  ): Promise<DeleteFormState> {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status === "forbidden") {
      return { error: "You are not authorized to manage content." };
    }

    const confirmation = String(formData.get("confirmation") ?? "").trim();

    if (confirmation !== currentSeries.slug) {
      return { error: `Type ${currentSeries.slug} exactly to confirm deletion.` };
    }

    const result = await deleteSeries(id);

    if (!result.success) {
      return { error: result.message, blockers: result.blockers };
    }

    revalidatePath(seriesListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath(seriesPath(result.slug));
    const message =
      result.cleanupWarnings.length > 0
        ? `Deleted series, but ${result.cleanupWarnings.join(" ")}`
        : "Deleted series.";
    redirect(buildFlashUrl(seriesListPath, result.cleanupWarnings.length > 0 ? "error" : "flash", message));
  }

  async function deleteAllEpisodesAction(
    _prevState: DeleteFormState,
    formData: FormData,
  ): Promise<DeleteFormState> {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status === "forbidden") {
      return { error: "You are not authorized to manage content." };
    }

    const confirmation = String(formData.get("confirmation") ?? "").trim();
    const confirmationValue = `DELETE ALL EPISODES ${currentSeries.slug}`;

    if (confirmation !== confirmationValue) {
      return { error: `Type ${confirmationValue} exactly to confirm deletion.` };
    }

    const result = await deleteAllEpisodesForSeries(id);

    if (!result.success) {
      return { error: result.message, blockers: result.blockers };
    }

    revalidatePath(seriesEditPath(id));
    revalidatePath(seriesPath(currentSeries.slug));
    revalidatePath(seriesListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");
    const message =
      result.cleanupWarnings.length > 0
        ? `Deleted ${result.deletedCount} episodes, but ${result.cleanupWarnings.join(" ")}`
        : `Deleted ${result.deletedCount} episodes.`;
    redirect(buildFlashUrl(seriesEditPath(id), result.cleanupWarnings.length > 0 ? "error" : "flash", message));
  }

  async function deleteSeriesAndEpisodesAction(
    _prevState: DeleteFormState,
    formData: FormData,
  ): Promise<DeleteFormState> {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status === "forbidden") {
      return { error: "You are not authorized to manage content." };
    }

    const confirmation = String(formData.get("confirmation") ?? "").trim();
    const confirmationValue = `DELETE SERIES AND EPISODES ${currentSeries.slug}`;

    if (confirmation !== confirmationValue) {
      return { error: `Type ${confirmationValue} exactly to confirm deletion.` };
    }

    const episodesResult = await deleteAllEpisodesForSeries(id);

    if (!episodesResult.success) {
      return { error: episodesResult.message, blockers: episodesResult.blockers };
    }

    revalidatePath(seriesEditPath(id));
    revalidatePath(seriesPath(currentSeries.slug));
    revalidatePath(seriesListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");

    const seriesResult = await deleteSeries(id);

    if (!seriesResult.success) {
      return { error: seriesResult.message, blockers: seriesResult.blockers };
    }

    revalidatePath(seriesListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");

    const cleanupWarnings = [...episodesResult.cleanupWarnings, ...seriesResult.cleanupWarnings];
    const message =
      cleanupWarnings.length > 0
        ? `Deleted the series and episodes, but ${cleanupWarnings.join(" ")}`
        : "Deleted the series and episodes.";
    redirect(buildFlashUrl(seriesListPath, cleanupWarnings.length > 0 ? "error" : "flash", message));
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-3xl space-y-10">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{series.title}</h1>
          <p className="mt-1 text-sm text-bone/50">/{series.slug}</p>
        </div>

        {flashMessage && (
          <div className="border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">
            {flashMessage}
          </div>
        )}

        {errorMessage && (
          <div className="border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Status</h2>
          <SeriesStatusForm action={updateStatusAction} defaultValue={series.status} />
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Artwork</h2>
          <div className="mt-3 flex flex-wrap gap-8">
            <ArtworkUploadField
              label="Poster"
              currentUrl={series.poster_url}
              maxFileSizeBytes={ARTWORK_MAX_FILE_SIZE_BYTES}
              acceptedMimeTypes={ARTWORK_MIME_TYPES}
              requestUploadAction={requestPosterUploadAction}
              onUploaded={persistPosterAction}
            />
            <ArtworkUploadField
              label="Hero image"
              currentUrl={series.hero_image_url}
              maxFileSizeBytes={ARTWORK_MAX_FILE_SIZE_BYTES}
              acceptedMimeTypes={ARTWORK_MIME_TYPES}
              requestUploadAction={requestHeroUploadAction}
              onUploaded={persistHeroAction}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Metadata</h2>
          <div className="mt-3">
            <SeriesMetadataForm action={updateSeriesAction} series={series} submitLabel="Save changes" />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
                Episodes
              </h2>
              <p className="text-sm text-bone/60">
                Overview of every episode in this series. Use{" "}
                <span className="text-teal">Configure access</span> for quick access and
                metadata edits, or open the full episode editor for Media, Thumbnail,
                Status and advanced controls.
              </p>
            </div>
            {hasUnassignedMediaEpisode && (
              <form action={refreshProcessingMediaAction}>
                <Button type="submit" variant="secondary">
                  Refresh processing uploads
                </Button>
              </form>
            )}
          </div>

          <div className="mt-3">
            {episodeManagerRows.length === 0 ? (
              <p className="text-sm text-bone/60">No episodes yet.</p>
            ) : (
              <SeriesEpisodeManager
                addEpisodeHref={episodeNewPath(id)}
                bulkUploadHref={episodeBulkUploadPath(id)}
                rows={episodeManagerRows}
              />
            )}
          </div>
        </section>

        <section className="border border-rose-500/25 bg-rose-500/[0.04] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-100">Danger zone</h2>

          {hasEpisodes ? (
            <div className="mt-4 divide-y divide-rose-500/15">
              <div className="py-4 first:pt-0 last:pb-0">
                <DangerZoneDeleteForm
                  variant="bare"
                  action={deleteAllEpisodesAction}
                  blockers={deleteEpisodesPreview.blockers}
                  confirmationValue={`DELETE ALL EPISODES ${currentSeries.slug}`}
                  description="Removes all deletable episodes and their exclusively owned Mux media. The series, metadata and artwork remain."
                  submitLabel="Delete all episodes permanently"
                  title="Delete all episodes"
                />
              </div>

              <div className="py-4 first:pt-0 last:pb-0">
                <DangerZoneDeleteForm
                  variant="bare"
                  action={deleteSeriesAndEpisodesAction}
                  blockers={deleteEpisodesPreview.blockers}
                  confirmationValue={`DELETE SERIES AND EPISODES ${currentSeries.slug}`}
                  description="Removes this series, all deletable episodes and their exclusively owned Mux media."
                  submitLabel="Delete series and episodes permanently"
                  title="Delete series + all episodes"
                />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <DangerZoneDeleteForm
                variant="bare"
                action={deleteSeriesAction}
                blockers={deletePreview.blockers}
                confirmationValue={currentSeries.slug}
                description="Permanently removes this series."
                submitLabel="Delete series permanently"
                title="Delete series"
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
