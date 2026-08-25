"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export type ArtworkUploadIntent = {
  bucket: string;
  objectPath: string;
  signedUploadUrl: string;
  token: string;
  publicUrl: string;
  mimeType: string;
};

export type ArtworkUploadFieldProps = {
  label: string;
  currentUrl: string | null;
  maxFileSizeBytes: number;
  acceptedMimeTypes: readonly string[];
  requestUploadAction: (mimeType: string) => Promise<ArtworkUploadIntent | { error: string }>;
  onUploaded: (publicUrl: string) => Promise<{ success: boolean; message?: string }>;
};

export function ArtworkUploadField({
  label,
  currentUrl,
  maxFileSizeBytes,
  acceptedMimeTypes,
  requestUploadAction,
  onUploaded,
}: ArtworkUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!acceptedMimeTypes.includes(file.type)) {
      setError(`Unsupported file type. Use: ${acceptedMimeTypes.join(", ")}.`);
      return;
    }

    if (file.size > maxFileSizeBytes) {
      setError(`File is too large. Maximum size is ${Math.floor(maxFileSizeBytes / (1024 * 1024))}MB.`);
      return;
    }

    setError(null);

    startTransition(async () => {
      // requestUploadAction re-verifies CMS admin authorization server-side
      // on every call; the browser never holds storage/service-role secrets.
      const intent = await requestUploadAction(file.type);

      if ("error" in intent) {
        setError(intent.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(intent.bucket)
        .uploadToSignedUrl(intent.objectPath, intent.token, file);

      if (uploadError) {
        setError("Upload failed. Try again.");
        return;
      }

      const persistResult = await onUploaded(intent.publicUrl);

      if (!persistResult.success) {
        setError(persistResult.message ?? "Unable to save artwork.");
        return;
      }

      setPreviewUrl(intent.publicUrl);
    });
  }

  return (
    <div className="space-y-2">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">{label}</p>
      {previewUrl ? (
        <Image
          alt=""
          src={previewUrl}
          width={96}
          height={128}
          className="h-32 w-24 border border-bone/10 object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-32 w-24 items-center justify-center border border-dashed border-bone/15 text-[0.6rem] text-bone/40">
          No image
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept={acceptedMimeTypes.join(",")}
          onChange={handleFileChange}
          disabled={isPending}
          className="text-xs text-bone/70 file:mr-3 file:border file:border-bone/15 file:bg-bone/[0.03] file:px-3 file:py-1.5 file:text-[0.65rem] file:uppercase file:tracking-[0.14em] file:text-bone/80"
        />
        {isPending && <span className="text-[0.65rem] text-bone/50">Uploading…</span>}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
