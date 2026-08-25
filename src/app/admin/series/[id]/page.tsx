import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ArtworkUploadField } from "@/components/cms/ArtworkUploadField";
import { DangerZoneDeleteForm, type DeleteFormState } from "@/components/cms/DangerZoneDeleteForm";
import { SeriesMetadataForm } from "@/components/cms/SeriesMetadataForm";
import { requireCmsAdmin } from "@/lib/cms/auth";
import {
  deleteAllEpisodesForSeries,
  getSeriesEpisodesDeletePreview,
  listEpisodesForSeries,
} from "@/lib/cms/episodes";
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
import { homeListPath, episodeEditPath, episodeNewPath, seriesEditPath, seriesListPath, seriesPath } from "@/lib/routes";
import { ARTWORK_MAX_FILE_SIZE_BYTES, createArtworkUploadIntent } from "@/lib/supabase/artwork";

const ARTWORK_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const EPISODE_STATUS_STYLES: Record<string, string> = {
  draft: "text-bone/50 border-bone/20",
  published: "text-teal border-teal/50",
  archived: "text-bone/30 border-bone/10",
};

type AdminSeriesEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSeriesEditPage({ params }: AdminSeriesEditPageProps) {
  const { id } = await params;
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

  const episodes = await listEpisodesForSeries(id);
  const deleteEpisodesPreview = await getSeriesEpisodesDeletePreview(id);
  const deletePreview = await getSeriesDeletePreview(id);

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

  async function updateStatusAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(seriesEditPath(id));

    if (guard.status !== "authorized") {
      return;
    }

    const status = String(formData.get("status"));

    if (!SERIES_STATUSES.includes(status as SeriesStatus)) {
      return;
    }

    const result = await updateSeriesStatus(id, status as SeriesStatus);

    if (!result.success) {
      return;
    }

    revalidatePath(seriesEditPath(id));
    revalidatePath(seriesListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath(seriesPath(result.series.slug));
    revalidatePath("/api/v1/catalog");
    redirect(seriesEditPath(id));
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
    redirect(seriesListPath);
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
    return { message: `Deleted ${result.deletedCount} episodes.` };
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

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Status</h2>
          <form action={updateStatusAction} className="mt-3 flex items-center gap-3">
            <select
              name="status"
              defaultValue={series.status}
              className="border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
            >
              {SERIES_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Update status
            </Button>
          </form>
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Episodes</h2>
            <ButtonLink href={episodeNewPath(id)} variant="secondary">
              Add episode
            </ButtonLink>
          </div>

          <div className="mt-3 divide-y divide-bone/10 border border-bone/10">
            {episodes.length === 0 && (
              <p className="px-4 py-6 text-sm text-bone/60">No episodes yet.</p>
            )}
            {episodes.map((episode) => (
              <Link
                key={episode.id}
                href={episodeEditPath(id, episode.id)}
                className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-bone/[0.03]"
              >
                <div>
                  <p className="font-medium">
                    Episode {episode.episode_number}
                    {episode.title ? ` — ${episode.title}` : ""}
                  </p>
                  <p className="text-xs text-bone/50">
                    {episode.is_free ? "Free" : `${episode.coin_price} coins`}
                    {episode.plus_access ? " · Plus" : ""}
                  </p>
                </div>
                <span
                  className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${EPISODE_STATUS_STYLES[episode.status] ?? EPISODE_STATUS_STYLES.draft}`}
                >
                  {episode.status}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <DangerZoneDeleteForm
            action={deleteAllEpisodesAction}
            blockers={deleteEpisodesPreview.blockers}
            confirmationValue={`DELETE ALL EPISODES ${currentSeries.slug}`}
            description="This permanently removes every episode in the series and leaves the series record intact."
            submitLabel="Delete all episodes permanently"
            title="Danger zone · Episodes"
          />
        </section>

        <section>
          <DangerZoneDeleteForm
            action={deleteSeriesAction}
            blockers={deletePreview.blockers}
            confirmationValue={currentSeries.slug}
            description="This permanently removes the series after all episodes are gone. Linked home-row placements are cleaned up automatically."
            submitLabel="Delete series permanently"
            title="Danger zone"
          />
        </section>
      </div>
    </main>
  );
}
