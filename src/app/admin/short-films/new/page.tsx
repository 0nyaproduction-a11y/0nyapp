import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { NewShortFilmIntakeForm } from "@/components/cms/NewShortFilmIntakeForm";
import { createArtworkUploadIntent } from "@/lib/supabase/artwork";
import { attachShortFilmMediaUploadIntent, createMediaUploadIntent, assignShortFilmMediaAsset, refreshMediaAssetStatus } from "@/lib/cms/media";
import { createShortFilm, persistShortFilmArtwork, type ShortFilmActionResult, type ShortFilmInput } from "@/lib/cms/short-films";
import { listChaiAllowedCoinAmountsForAdmin } from "@/lib/cms/chai";
import { shortFilmEditPath, shortFilmListPath, shortFilmNewPath } from "@/lib/routes";
import { createSubtitleUploadIntent, finalizeSubtitleTrackUpload } from "@/lib/subtitles";

type ShortFilmCreateInput = ShortFilmInput;

type ShortFilmMediaFinalizeResult =
  | {
      success: true;
      assigned: boolean;
      shortFilmId: string;
      mediaAssetId: string;
      mediaStatus: "pending" | "processing" | "ready" | "failed";
    }
  | {
      success: false;
      error: string;
      mediaStatus?: "pending" | "processing" | "ready" | "failed" | "not_found";
    };

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

export default async function NewShortFilmPage() {
  const context = await requireCmsAdmin(shortFilmNewPath);

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

  const chaiAllowedCoinAmounts = await listChaiAllowedCoinAmountsForAdmin();
  const chaiSummary =
    chaiAllowedCoinAmounts.length > 0
      ? chaiAllowedCoinAmounts.map((row) => row.coin_amount).join(", ")
      : "No configured amounts";

  async function createShortFilmDraftAction(input: ShortFilmCreateInput): Promise<ShortFilmActionResult> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

    if (guard.status !== "authorized") {
      return { success: false, errors: [{ field: "form", message: "Not authorized." }] };
    }

    const result = await createShortFilm(input);
    if (result.success) {
      revalidatePath(shortFilmListPath);
      revalidatePath(shortFilmNewPath);
    }

    return result;
  }

  async function requestArtworkUploadAction(
    shortFilmId: string,
    kind: "short-film-poster" | "short-film-hero",
    mimeType: string,
  ) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createArtworkUploadIntent({
        kind,
        targetId: shortFilmId,
        mimeType,
      });
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function persistArtworkAction(
    shortFilmId: string,
    field: "poster_url" | "hero_image_url",
    publicUrl: string,
  ) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

    if (guard.status !== "authorized") {
      return { success: false as const, message: "Not authorized." };
    }

    const result = await persistShortFilmArtwork(shortFilmId, field, publicUrl);

    if (!result.success) {
      return { success: false as const, message: "Unable to save artwork." };
    }

    revalidatePath(shortFilmEditPath(shortFilmId));
    revalidatePath(shortFilmListPath);
    return { success: true as const };
  }

  async function requestMediaUploadAction(mimeType: string, corsOriginOverride?: string | null) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      return await createMediaUploadIntent(mimeType, corsOriginOverride);
    } catch {
      return { error: "Unable to prepare upload." };
    }
  }

  async function attachShortFilmMediaUploadIntentAction(input: {
    shortFilmId: string;
    mediaAssetId: string;
  }) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

    if (guard.status !== "authorized") {
      return { success: false as const, error: "Not authorized." };
    }

    try {
      await attachShortFilmMediaUploadIntent(input.shortFilmId, input.mediaAssetId);
      return { success: true as const };
    } catch {
      return { success: false as const, error: "Unable to attach upload to the short film." };
    }
  }

  async function requestSubtitleUploadAction(input: {
    closedCaptions: boolean;
    isDefault: boolean;
    label: string;
    languageCode: string;
    mimeType: string;
    shortFilmSlug: string;
    sourceFormat: "srt" | "vtt";
  }) {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

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
          slug: input.shortFilmSlug,
          type: "SHORT_FILM",
        },
      });
    } catch {
      return { error: "Unable to prepare subtitle upload." };
    }
  }

  async function finalizeSubtitleUploadAction(input: {
    closedCaptions: boolean;
    isDefault: boolean;
    label: string;
    languageCode: string;
    mimeType: string;
    objectPath: string;
    shortFilmSlug: string;
    sourceFormat: "srt" | "vtt";
  }): Promise<SubtitleFinalizeResult> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

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
          slug: input.shortFilmSlug,
          type: "SHORT_FILM",
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
    shortFilmId: string,
    input: { mediaAssetId: string },
  ): Promise<ShortFilmMediaFinalizeResult> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

    if (guard.status !== "authorized") {
      return { success: false as const, error: "Not authorized." };
    }

    const refresh = await refreshMediaAssetStatus(input.mediaAssetId);

    if (refresh.status === "not_found") {
      return { success: false as const, error: "Media asset not found.", mediaStatus: "not_found" };
    }

    const mediaStatus = refresh.mediaStatus as "pending" | "processing" | "ready" | "failed";

    if (mediaStatus !== "ready") {
      return {
        success: true as const,
        assigned: false,
        shortFilmId,
        mediaAssetId: input.mediaAssetId,
        mediaStatus,
      };
    }

    await assignShortFilmMediaAsset(shortFilmId, input.mediaAssetId);
    revalidatePath(shortFilmEditPath(shortFilmId));
    revalidatePath(shortFilmListPath);

    return {
      success: true as const,
      assigned: true,
      shortFilmId,
      mediaAssetId: input.mediaAssetId,
      mediaStatus: "ready",
    };
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">0nya CMS</p>
          <h1 className="mt-2 text-2xl font-semibold">New short film</h1>
          <Link href={shortFilmListPath} className="mt-1 inline-block text-sm text-teal">
            ← Back to short films
          </Link>
        </div>

        <NewShortFilmIntakeForm
          createShortFilmDraftAction={createShortFilmDraftAction}
          attachShortFilmMediaUploadIntentAction={attachShortFilmMediaUploadIntentAction}
          finalizeUploadAction={finalizeUploadAction}
          requestSubtitleUploadAction={requestSubtitleUploadAction}
          finalizeSubtitleUploadAction={finalizeSubtitleUploadAction}
          persistArtworkAction={persistArtworkAction}
          requestArtworkUploadAction={requestArtworkUploadAction}
          requestMediaUploadAction={requestMediaUploadAction}
          allowedCoinAmountsSummary={chaiSummary}
        />
      </div>
    </main>
  );
}
