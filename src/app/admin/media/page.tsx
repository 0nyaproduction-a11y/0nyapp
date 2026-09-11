import { revalidatePath } from "next/cache";
import { MediaAdminClient } from "@/components/cms/MediaAdminClient";
import { CmsBreadcrumb } from "@/components/cms/CmsBreadcrumb";
import { CmsStatusBadge, type CmsOperatorStatus } from "@/components/cms/CmsStates";
import { requireCmsAdmin } from "@/lib/cms/auth";
import {
  createMediaUploadIntent,
  refreshMediaAssetStatus,
  type MediaAssetFormState,
} from "@/lib/cms/media";
import {
  getAssetDetailMedia,
  getMediaViewRows,
} from "@/lib/cms/media-truth-views";
import type { MediaViewRow, MediaViewTab } from "@/lib/cms/media-truth-model";
import { mediaListPath } from "@/lib/routes";
import {
  scanMediaAssetForDeletion,
  type DeleteImpactReport,
} from "@/lib/cms/media-delete-impact";
import {
  confirmAndDeleteMediaAsset,
  getQuarantineStatus,
  quarantineMediaAsset,
  releaseMediaAssetFromQuarantine,
  type ConfirmDeleteResult,
  type QuarantineStatus,
} from "@/lib/cms/media-delete-executor";

type AdminMediaPageProps = {
  searchParams?: Promise<{
    tab?: string;
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }>;
};

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTS = [25, 50, 100];

const MEDIA_VIEW_TABS: MediaViewTab[] = ["all", "processing", "problems", "unassigned"];

function parseTab(value: string | undefined): MediaViewTab {
  if (value && (MEDIA_VIEW_TABS as string[]).includes(value)) {
    return value as MediaViewTab;
  }
  return "all";
}

export default async function AdminMediaPage({ searchParams }: AdminMediaPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ tab?: string; search?: string; status?: string; page?: number; pageSize?: number }>({}));
  const context = await requireCmsAdmin(mediaListPath);

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

  const tab = parseTab(params.tab);
  const search = String(params.search ?? "").trim();
  const status = String(params.status ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = PAGE_SIZE_OPTS.includes(Number(params.pageSize)) ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;

  const result = await getMediaViewRows({
    tab,
    search,
    status: status || undefined,
    page,
    pageSize,
  });

  async function requestMediaUploadAction(mimeType: string, corsOriginOverride?: string | null) {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      const intent = await createMediaUploadIntent(mimeType, corsOriginOverride);
      revalidatePath(mediaListPath);
      return intent;
    } catch (error) {
      revalidatePath(mediaListPath);
      return {
        error: error instanceof Error ? error.message : "Unable to prepare the upload.",
      };
    }
  }

  async function refreshMediaAssetAction(
    _prevState: MediaAssetFormState,
    formData: FormData,
  ): Promise<MediaAssetFormState> {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    const mediaAssetId = String(formData.get("mediaAssetId") ?? "").trim();

    if (!mediaAssetId) {
      return { error: "Media asset ID is required." };
    }

    try {
      const result = await refreshMediaAssetStatus(mediaAssetId);
      revalidatePath(mediaListPath);

      if (result.status === "not_found") {
        return { error: "Media asset not found." };
      }

      return {
        message: `Status updated to ${result.mediaStatus}.`,
      };
    } catch (error) {
      revalidatePath(mediaListPath);
      return {
        error: error instanceof Error ? error.message : "Unable to refresh media status.",
      };
    }
  }

  async function loadAssetDetailAction(assetId: string): Promise<MediaViewRow | null> {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return null;
    }

    return getAssetDetailMedia(assetId);
  }

  async function loadAssetDetailAndImpactAction(assetId: string): Promise<{ detail: MediaViewRow | null, impact: DeleteImpactReport | null }> {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return { detail: null, impact: null };
    }

    const detail = await getAssetDetailMedia(assetId);
    const impact = detail ? await scanMediaAssetForDeletion(assetId) : null;

    return { detail, impact };
  }

  async function loadQuarantineStatusAction(assetId: string): Promise<QuarantineStatus> {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return "not_quarantined";
    }

    return getQuarantineStatus(assetId);
  }

  async function quarantineMediaAssetAction(
    assetId: string,
    reason?: string,
  ): Promise<{ error?: string; status?: QuarantineStatus }> {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    const result = await quarantineMediaAsset(assetId, guard.user.id, reason);
    revalidatePath(mediaListPath);

    if (!result.ok) {
      return { error: result.error };
    }

    return { status: result.status };
  }

  async function releaseQuarantineAction(
    assetId: string,
  ): Promise<{ error?: string; status?: QuarantineStatus }> {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    const result = await releaseMediaAssetFromQuarantine(assetId, guard.user.id);
    revalidatePath(mediaListPath);

    if (!result.ok) {
      return { error: result.error };
    }

    return { status: result.status };
  }

  async function confirmDeleteMediaAssetAction(
    assetId: string,
    confirmationToken: string,
  ): Promise<ConfirmDeleteResult> {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return {
        ok: false,
        error: "Not authorized.",
        report: null,
        ledgerId: null,
      };
    }

    const result = await confirmAndDeleteMediaAsset(assetId, guard.user.id, confirmationToken);
    revalidatePath(mediaListPath);
    return result;
  }

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Media", isCurrent: true },
  ];

  // Derive operator status from the loaded data (no synthetic health).
  // If any rows are in FAILED/MISSING classification, mark DEGRADED.
  const hasProblems = result.rows.some(
    (row) => row.classification === "FAILED" || row.classification === "MISSING",
  );
  const mediaStatus: CmsOperatorStatus = hasProblems ? "DEGRADED" : "HEALTHY";

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl space-y-8">
        <CmsBreadcrumb items={breadcrumbs} />

        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Media</h1>
          <CmsStatusBadge status={mediaStatus} showDescription />
        </div>

        <MediaAdminClient
          key={tab}
          result={result}
          initialTab={tab}
          requestUploadAction={requestMediaUploadAction}
          refreshAction={refreshMediaAssetAction}
          loadAssetDetailAction={loadAssetDetailAction}
          loadAssetDetailAndImpactAction={loadAssetDetailAndImpactAction}
          loadQuarantineStatusAction={loadQuarantineStatusAction}
          quarantineMediaAssetAction={quarantineMediaAssetAction}
          releaseQuarantineAction={releaseQuarantineAction}
          confirmDeleteMediaAssetAction={confirmDeleteMediaAssetAction}
        />
      </div>
    </main>
  );
}
