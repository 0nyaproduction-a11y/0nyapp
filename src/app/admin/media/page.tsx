import { revalidatePath } from "next/cache";
import Link from "next/link";
import { MediaDirectUploadField } from "@/components/cms/MediaDirectUploadField";
import { MediaAssetRefreshForm } from "@/components/cms/MediaAssetRefreshForm";
import { requireCmsAdmin } from "@/lib/cms/auth";
import {
  createMediaUploadIntent,
  listMediaAssetsForAdmin,
  refreshMediaAssetStatus,
  type MediaAssetFormState,
} from "@/lib/cms/media";
import { mediaListPath, adminPath } from "@/lib/routes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminMediaPage() {
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

  const mediaAssets = await listMediaAssetsForAdmin();

  async function requestMediaUploadAction(mimeType: string) {
    "use server";

    const guard = await requireCmsAdmin(mediaListPath);

    if (guard.status !== "authorized") {
      return { error: "Not authorized." };
    }

    try {
      const intent = await createMediaUploadIntent(mimeType);
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

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Media</h1>
          <Link href={adminPath} className="mt-1 inline-block text-sm text-teal">
            ← Back to admin
          </Link>
        </div>

        <MediaDirectUploadField requestUploadAction={requestMediaUploadAction} />

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
              Media assets
            </h2>
            <p className="text-xs text-bone/40">{mediaAssets.length} assets</p>
          </div>

          <div className="mt-3 overflow-hidden border border-bone/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-bone/[0.03] text-xs uppercase tracking-[0.14em] text-bone/50">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Upload ID</th>
                  <th className="px-4 py-3">Asset ID</th>
                  <th className="px-4 py-3">Playback ID</th>
                  <th className="px-4 py-3">Failure</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {mediaAssets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-bone/60" colSpan={8}>
                      No media assets yet.
                    </td>
                  </tr>
                ) : (
                  mediaAssets.map((mediaAsset) => (
                    <tr key={mediaAsset.id} className="border-t border-bone/10 align-top">
                      <td className="px-4 py-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/70">
                        {mediaAsset.status}
                      </td>
                      <td className="px-4 py-4 text-bone/60">
                        {formatDate(mediaAsset.created_at)}
                      </td>
                      <td className="px-4 py-4 text-bone/70">{mediaAsset.provider_name ?? "mux"}</td>
                      <td className="px-4 py-4 font-mono text-[0.68rem] text-bone/60">
                        {mediaAsset.provider_upload_reference ?? "—"}
                      </td>
                      <td className="px-4 py-4 font-mono text-[0.68rem] text-bone/60">
                        {mediaAsset.provider_asset_reference ?? "—"}
                      </td>
                      <td className="px-4 py-4 font-mono text-[0.68rem] text-bone/60">
                        {mediaAsset.provider_playback_reference ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-xs text-bone/50">
                        <div>{mediaAsset.failure_code ?? "—"}</div>
                        {mediaAsset.failure_message && (
                          <div className="mt-1 max-w-xs text-bone/40">{mediaAsset.failure_message}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <MediaAssetRefreshForm action={refreshMediaAssetAction} mediaAssetId={mediaAsset.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
