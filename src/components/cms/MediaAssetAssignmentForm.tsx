"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import type { MediaAssetRow, MediaAssetFormState } from "@/lib/cms/media";

type MediaAssetAssignmentFormProps = {
  action: (state: MediaAssetFormState, formData: FormData) => Promise<MediaAssetFormState>;
  currentMediaAssetId: string | null;
  currentMediaAssetStatus: string;
  label: string;
  readyMediaAssets: MediaAssetRow[];
};

export function MediaAssetAssignmentForm({
  action,
  currentMediaAssetId,
  currentMediaAssetStatus,
  label,
  readyMediaAssets,
}: MediaAssetAssignmentFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-bone/60">
        {label}: <span className="text-bone">{currentMediaAssetId ?? "not assigned"}</span> ·{" "}
        <span className="text-bone">{currentMediaAssetStatus}</span>
      </p>

      <label className="block space-y-1.5">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
          Ready media asset
        </span>
        <CmsSelect
          name="mediaAssetId"
          defaultValue={currentMediaAssetId ?? ""}
          disabled={readyMediaAssets.length === 0 || pending}
          className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
          placeholderLabel="Choose a ready media asset"
          options={[
            { label: "Choose a ready media asset", value: "" },
            ...readyMediaAssets.map((mediaAsset) => ({
              label: `${mediaAsset.id} · ${mediaAsset.provider_name ?? "mux"} · ${mediaAsset.created_at}`,
              value: mediaAsset.id,
            })),
          ]}
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending || readyMediaAssets.length === 0}>
          {pending ? "Assigning…" : "Assign media"}
        </Button>
        {readyMediaAssets.length === 0 && (
          <p className="text-xs text-bone/50">No ready media assets available.</p>
        )}
      </div>

      {state.message && <p className="text-xs text-teal">{state.message}</p>}
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
