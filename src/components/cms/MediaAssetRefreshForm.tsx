"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { MediaAssetFormState } from "@/lib/cms/media";

type MediaAssetRefreshFormProps = {
  action: (state: MediaAssetFormState, formData: FormData) => Promise<MediaAssetFormState>;
  mediaAssetId: string;
};

export function MediaAssetRefreshForm({ action, mediaAssetId }: MediaAssetRefreshFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="mediaAssetId" value={mediaAssetId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Refreshing…" : "Refresh"}
      </Button>
      {state.message && <p className="text-xs text-teal">{state.message}</p>}
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
