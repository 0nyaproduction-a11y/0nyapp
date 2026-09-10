"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { MediaAssetFormState } from "@/lib/cms/media";

type MediaAssetRefreshFormProps = {
  action: (state: MediaAssetFormState, formData: FormData) => Promise<MediaAssetFormState>;
  mediaAssetId: string;
};

/**
 * CMS-C08B-03: this control performs a WRITE — it checks the live provider
 * (Mux) and persists the resulting status onto the media asset record. It is
 * deliberately labelled "Sync" (not "Refresh") so it can never be mistaken
 * for the read-only list reload. Read-only refresh lives on the list itself
 * (CmsReloadButton), which never touches the database or Mux.
 */
export function MediaAssetRefreshForm({ action, mediaAssetId }: MediaAssetRefreshFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="mediaAssetId" value={mediaAssetId} />
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Syncing…" : "Sync status from Mux"}
        </Button>
        <p className="mt-1 text-[0.65rem] text-bone/40">
          Write operation: updates the stored asset status from Mux. Not a read-only refresh.
        </p>
      </div>
      {state.message && <p className="text-xs text-teal">{state.message}</p>}
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
