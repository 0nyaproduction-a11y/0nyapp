"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export type MediaUploadIntent = {
  corsOrigin: string | null;
  mediaAssetId: string;
  uploadUrl: string;
};

type MediaDirectUploadFieldProps = {
  requestUploadAction: (mimeType: string) => Promise<MediaUploadIntent | { error: string }>;
};

export function MediaDirectUploadField({ requestUploadAction }: MediaDirectUploadFieldProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  function uploadFile(uploadUrl: string, file: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }

        reject(new Error(`Mux upload failed with status ${xhr.status}.`));
      };
      xhr.onerror = () => reject(new Error("Mux upload failed."));
      xhr.send(file);
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const looksLikeVideo = file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|mkv)$/i.test(file.name);

    if (!looksLikeVideo) {
      setError("Please choose a video file.");
      return;
    }

    setError(null);
    setMessage(null);
    setProgress(0);
    setIsUploading(true);

    try {
      const intent = await requestUploadAction(file.type || "video/mp4");

      if ("error" in intent) {
        setError(intent.error);
        return;
      }

      setMessage("Uploading to Mux…");
      await uploadFile(intent.uploadUrl, file);
      setProgress(100);
      setMessage(`Uploaded. Media asset ${intent.mediaAssetId} is processing.`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3 border border-bone/10 bg-bone/[0.03] p-4">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
          Direct upload
        </p>
        <p className="mt-1 text-sm text-bone/60">
          Choose a video file. The browser uploads it directly to Mux after a trusted CMS upload intent is created.
        </p>
      </div>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        disabled={isUploading}
        className="block w-full text-xs text-bone/70 file:mr-3 file:border file:border-bone/15 file:bg-bone/[0.03] file:px-3 file:py-1.5 file:text-[0.65rem] file:uppercase file:tracking-[0.14em] file:text-bone/80"
      />

      {isUploading && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden bg-bone/10">
            <div className="h-full bg-teal transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[0.65rem] text-bone/50">{progress}%</p>
        </div>
      )}

      {message && <p className="text-xs text-teal">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
