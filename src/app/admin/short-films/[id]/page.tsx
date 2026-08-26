import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArtworkUploadField } from "@/components/cms/ArtworkUploadField";
import { DangerZoneDeleteForm, type DeleteFormState } from "@/components/cms/DangerZoneDeleteForm";
import { MediaAssetAssignmentForm } from "@/components/cms/MediaAssetAssignmentForm";
import { ShortFilmChaiConfigForm } from "@/components/cms/ShortFilmChaiConfigForm";
import { ShortFilmMetadataForm } from "@/components/cms/ShortFilmMetadataForm";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { createArtworkUploadIntent, ARTWORK_MAX_FILE_SIZE_BYTES } from "@/lib/supabase/artwork";
import {
  assignShortFilmMediaAsset,
  listReadyMediaAssetsForAdmin,
  type MediaAssetFormState,
} from "@/lib/cms/media";
import {
  listChaiAllowedCoinAmountsForAdmin,
  updateChaiAllowedCoinAmount,
  updateShortFilmChaiEnabled,
} from "@/lib/cms/chai";
import { getShortFilmChaiDetails } from "@/lib/chai";
import {
  errorsToRecord,
  parseShortFilmFormData,
  type ShortFilmFormState,
} from "@/lib/cms/short-film-form";
import { resolveMediaAssetState } from "@/lib/media";
import { homeListPath, shortFilmEditPath, shortFilmListPath, shortFilmPath } from "@/lib/routes";
import {
  deleteShortFilm,
  getShortFilmDeletePreview,
  getShortFilmForAdminById,
  persistShortFilmArtwork,
  SHORT_FILM_STATUSES,
  updateShortFilmStatus,
  updateShortFilm,
} from "@/lib/cms/short-films";

const ARTWORK_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type AdminShortFilmEditPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; flash?: string }>;
};

function buildFlashUrl(path: string, kind: "error" | "flash", message: string) {
  const params = new URLSearchParams();
  params.set(kind, message);
  return `${path}?${params.toString()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminShortFilmEditPage({ params, searchParams }: AdminShortFilmEditPageProps) {
  const { id } = await params;
  const query = await (searchParams ?? Promise.resolve<{ error?: string; flash?: string }>({}));
  const context = await requireCmsAdmin(shortFilmEditPath(id));

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

  const shortFilm = await getShortFilmForAdminById(id);

  if (!shortFilm) {
    notFound();
  }

  const currentShortFilm = shortFilm;
  const flashMessage = typeof query.flash === "string" ? query.flash : null;
  const errorMessage = typeof query.error === "string" ? query.error : null;

  const [mediaReadiness, readyMediaAssets, chaiDetails] = await Promise.all([
    resolveMediaAssetState({ type: "SHORT_FILM", slug: shortFilm.slug }),
    listReadyMediaAssetsForAdmin(),
    getShortFilmChaiDetails(shortFilm.slug),
  ]);
  const chaiAllowedCoinAmounts = await listChaiAllowedCoinAmountsForAdmin();
  const deletePreview = await getShortFilmDeletePreview(id);

  async function updateShortFilmAction(
    _prevState: ShortFilmFormState,
    formData: FormData,
  ): Promise<ShortFilmFormState> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status === "forbidden") {
      return { errors: { form: "You are not authorized to manage content." } };
    }

    const existing = await getShortFilmForAdminById(id);

    if (!existing) {
      return { errors: { form: "Short film not found." } };
    }

    const input = parseShortFilmFormData(formData);
    input.posterUrl = existing.poster_url;
    input.heroImageUrl = existing.hero_image_url;

    const result = await updateShortFilm(id, input);

    if (!result.success) {
      return { errors: errorsToRecord(result.errors) };
    }

    revalidatePath(shortFilmEditPath(id));
    revalidatePath(shortFilmListPath);
    return { errors: {}, message: "Saved." };
  }

  async function requestPosterUploadAction(mimeType: string) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createArtworkUploadIntent({
        kind: "short-film-poster",
        targetId: id,
        mimeType,
      });
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function persistPosterAction(publicUrl: string) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status !== "authorized") {
      return { success: false as const, message: "Not authorized." };
    }

    const result = await persistShortFilmArtwork(id, "poster_url", publicUrl);

    if (!result.success) {
      return { success: false as const, message: "Unable to save artwork." };
    }

    revalidatePath(shortFilmEditPath(id));
    revalidatePath(shortFilmListPath);
    return { success: true as const };
  }

  async function requestHeroUploadAction(mimeType: string) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createArtworkUploadIntent({
        kind: "short-film-hero",
        targetId: id,
        mimeType,
      });
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function persistHeroAction(publicUrl: string) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status !== "authorized") {
      return { success: false as const, message: "Not authorized." };
    }

    const result = await persistShortFilmArtwork(id, "hero_image_url", publicUrl);

    if (!result.success) {
      return { success: false as const, message: "Unable to save artwork." };
    }

    revalidatePath(shortFilmEditPath(id));
    revalidatePath(shortFilmListPath);
    return { success: true as const };
  }

  async function assignMediaAssetAction(
    _state: MediaAssetFormState,
    formData: FormData,
  ): Promise<MediaAssetFormState> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    const mediaAssetId = String(formData.get("mediaAssetId") ?? "").trim();

    if (!mediaAssetId) {
      return { error: "Select a ready media asset." };
    }

    try {
      const result = await assignShortFilmMediaAsset(id, mediaAssetId);
      revalidatePath(shortFilmEditPath(id));
      revalidatePath(shortFilmListPath);
      return {
        message: result.updated ? "Media assignment updated." : "Media assignment already matched.",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unable to assign the media asset.",
      };
    }
  }

  async function updateChaiConfigAction(
    _state: ShortFilmFormState,
    formData: FormData,
  ): Promise<ShortFilmFormState> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status === "forbidden") {
      return { errors: { form: "You are not authorized to manage content." } };
    }

    const chaiEnabled = formData.get("chaiEnabled") === "on";
    const amountIds = formData.getAll("allowedCoinAmountId").map(String);
    for (let index = 0; index < amountIds.length; index += 1) {
      const amountId = amountIds[index];
      const coinAmount = Number(formData.get(`coinAmount-${amountId}`));
      const sortOrder = Number(formData.get(`sortOrder-${amountId}`));
      const enabled = formData.get(`enabled-${amountId}`) === "on";

      if (!Number.isInteger(coinAmount) || coinAmount <= 0) {
        return { errors: { form: "Allowed coin amounts must be positive whole numbers." } };
      }

      if (!Number.isInteger(sortOrder)) {
        return { errors: { form: "Sort order must be a whole number." } };
      }

      const updated = await updateChaiAllowedCoinAmount(amountIds[index], {
        coinAmount,
        enabled,
        sortOrder,
      });

      if (!updated) {
        return { errors: { form: "Unable to save Chai configuration." } };
      }
    }

    const shortFilmUpdate = await updateShortFilmChaiEnabled(id, chaiEnabled);

    if (!shortFilmUpdate) {
      return { errors: { form: "Unable to save Chai configuration." } };
    }

    revalidatePath(shortFilmEditPath(id));
    return { errors: {}, message: "Chai config saved." };
  }

  async function updateStatusAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status !== "authorized") {
      return;
    }

    const status = String(formData.get("status"));

    if (!SHORT_FILM_STATUSES.includes(status as (typeof SHORT_FILM_STATUSES)[number])) {
      redirect(buildFlashUrl(shortFilmEditPath(id), "error", "Unable to update short film status."));
    }

    const result = await updateShortFilmStatus(id, status as (typeof SHORT_FILM_STATUSES)[number]);

    if (!result.success) {
      redirect(buildFlashUrl(shortFilmEditPath(id), "error", "Unable to update short film status."));
    }

    revalidatePath(shortFilmEditPath(id));
    revalidatePath(shortFilmListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath(shortFilmPath(currentShortFilm.slug));
    revalidatePath("/api/v1/catalog");

    redirect(shortFilmEditPath(id));
  }

  async function deleteShortFilmAction(
    _prevState: DeleteFormState,
    formData: FormData,
  ): Promise<DeleteFormState> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmEditPath(id));

    if (guard.status === "forbidden") {
      return { error: "You are not authorized to manage content." };
    }

    const confirmation = String(formData.get("confirmation") ?? "").trim();

    if (confirmation !== currentShortFilm.slug) {
      return { error: `Type ${currentShortFilm.slug} exactly to confirm deletion.` };
    }

    const result = await deleteShortFilm(id);

    if (!result.success) {
      return { error: result.message, blockers: result.blockers };
    }

    revalidatePath(shortFilmListPath);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath(shortFilmPath(result.slug));
    const message =
      result.cleanupWarnings.length > 0
        ? `Deleted the short film, but ${result.cleanupWarnings.join(" ")}`
        : "Deleted short film.";
    redirect(buildFlashUrl(shortFilmListPath, result.cleanupWarnings.length > 0 ? "error" : "flash", message));
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-4xl space-y-10">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{shortFilm.title}</h1>
          <p className="mt-1 text-sm text-bone/50">/{shortFilm.slug}</p>
          <Link href={shortFilmListPath} className="mt-1 inline-block text-sm text-teal">
            ← Back to short films
          </Link>
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Artwork</h2>
          <div className="mt-3 flex flex-wrap gap-8">
            <ArtworkUploadField
              label="Poster"
              currentUrl={shortFilm.poster_url}
              maxFileSizeBytes={ARTWORK_MAX_FILE_SIZE_BYTES}
              acceptedMimeTypes={ARTWORK_MIME_TYPES}
              requestUploadAction={requestPosterUploadAction}
              onUploaded={persistPosterAction}
            />
            <ArtworkUploadField
              label="Hero image"
              currentUrl={shortFilm.hero_image_url}
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
            <ShortFilmMetadataForm action={updateShortFilmAction} shortFilm={shortFilm} submitLabel="Save changes" />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Status</h2>
          <form action={updateStatusAction} className="mt-3 flex items-center gap-3">
            <select
              name="status"
              defaultValue={shortFilm.status}
              className="border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
            >
              {SHORT_FILM_STATUSES.map((status) => (
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
            Media assignment
          </h2>
          <p className="mt-2 text-sm text-bone/60">
            Current media status: <span className="text-bone">{mediaReadiness.status}</span>
          </p>
          <div className="mt-4">
            <MediaAssetAssignmentForm
              action={assignMediaAssetAction}
              currentMediaAssetId={shortFilm.media_asset_id}
              currentMediaAssetStatus={mediaReadiness.status}
              label="Short film media"
              readyMediaAssets={readyMediaAssets}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Chai</h2>
          <p className="mt-2 text-sm text-bone/60">
            Chai enabled: <span className="text-bone">{shortFilm.chai_enabled ? "Yes" : "No"}</span>
          </p>
          <p className="mt-1 text-sm text-bone/60">
            Allowed amounts:{" "}
            <span className="text-bone">
              {chaiDetails.allowedCoinAmounts.length > 0
                ? chaiDetails.allowedCoinAmounts.join(", ")
                : "No configured amounts"}
            </span>
          </p>
          <div className="mt-4">
            <ShortFilmChaiConfigForm
              action={updateChaiConfigAction}
              chaiEnabled={shortFilm.chai_enabled}
              allowedCoinAmounts={chaiAllowedCoinAmounts}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Record</h2>
          <div className="mt-3 space-y-1 text-sm text-bone/60">
            <p>Status: <span className="text-bone">{shortFilm.status}</span></p>
            <p>Publish at: <span className="text-bone">{shortFilm.publish_at ? formatDate(shortFilm.publish_at) : "Not set"}</span></p>
            <p>Created: <span className="text-bone">{formatDate(shortFilm.created_at)}</span></p>
            <p>Updated: <span className="text-bone">{formatDate(shortFilm.updated_at)}</span></p>
            <p>Playback reference: <span className="text-bone">{shortFilm.playback_reference ?? "—"}</span></p>
          </div>
        </section>

        <section>
          <DangerZoneDeleteForm
            action={deleteShortFilmAction}
            blockers={deletePreview.blockers}
            confirmationValue={currentShortFilm.slug}
            description="This permanently removes the short film and any exclusively owned Mux media."
            submitLabel="Delete short film permanently"
            title="Danger zone"
          />
        </section>
      </div>
    </main>
  );
}
