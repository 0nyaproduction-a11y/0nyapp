"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS, type ContentRating } from "@/lib/classification";
import { episodeEditPath } from "@/lib/routes";
import type { MediaUploadIntent } from "@/components/cms/MediaDirectUploadField";
import {
  createUploadProgressState,
  formatUploadBytes,
  formatUploadProgressBytes,
  type UploadProgressState,
} from "@/lib/cms/upload-progress";
import type {
  BulkEpisodeCreateInput,
  BulkEpisodeCreateResult,
  BulkEpisodeDefaults,
  BulkEpisodeFinalizeResult,
} from "@/lib/cms/bulk-episodes";
import { REWARDED_REQUIRED_COMPLETIONS_VALUES } from "@/lib/cms/constants";

type BulkEpisodeUploadFormProps = {
  attachEpisodeMediaUploadIntentAction: (
    input: { episodeId: string; mediaAssetId: string },
  ) => Promise<{ success: true } | { success: false; error: string }>;
  createEpisodeAction: (input: BulkEpisodeCreateInput) => Promise<BulkEpisodeCreateResult>;
  existingEpisodeNumbers: number[];
  finalizeUploadAction: (input: { episodeId: string; mediaAssetId: string }) => Promise<BulkEpisodeFinalizeResult>;
  requestUploadAction: (mimeType: string, corsOrigin?: string | null) => Promise<MediaUploadIntent | { error: string }>;
  seriesId: string;
};

type BulkEpisodeStatus = "waiting" | "creating" | "uploading" | "processing" | "ready" | "failed";

type BulkEpisodeMetadataStatus = "pending" | "ready" | "failed";

type BulkEpisodeRow = {
  clientId: string;
  detectedEpisodeNumber: number | null;
  durationSeconds: number | null;
  editHref: string | null;
  episodeId: string | null;
  episodeNumber: number;
  error: string | null;
  file: File;
  fileName: string;
  fileSizeLabel: string;
  fileSizeBytes: number;
  metadataError: string | null;
  metadataStatus: BulkEpisodeMetadataStatus;
  mimeType: string;
  orientationLabel: string;
  mediaAssetId: string | null;
  uploadProgress: UploadProgressState | null;
  progress: number;
  status: BulkEpisodeStatus;
  title: string;
  titleEdited: boolean;
  videoHeight: number | null;
  videoWidth: number | null;
  resolutionLabel: string;
  aspectRatioLabel: string;
  aspectRatioWarning: string | null;
};

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [color-scheme:dark]";
const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";

const DEFAULT_DEFAULTS: BulkEpisodeDefaults = {
  isFree: true,
  coinUnlockEnabled: false,
  coinPrice: 0,
  rewardedUnlockEnabled: false,
  rewardedAccessMode: "permanent",
  requiredRewardedCompletions: 1,
  plusAccess: true,
  lockedPreviewSeconds: 0,
  contentRatingOverride: null,
  contentDescriptorsOverride: [],
};

function naturalCompare(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function formatDuration(durationSeconds: number | null) {
  if (durationSeconds === null) {
    return "—";
  }

  const safeSeconds = Math.max(0, Math.trunc(durationSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function detectEpisodeNumber(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim();
  const match = baseName.match(/^(?:ep(?:isode)?[\s._-]*)?0*(\d+)$/i);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function buildAutoTitle(episodeNumber: number) {
  return `Episode ${episodeNumber}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function greatestCommonDivisor(left: number, right: number) {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a || 1;
}

function getOrientationLabel(width: number, height: number) {
  if (width === height) {
    return "square";
  }

  return width < height ? "portrait" : "landscape";
}

function getAspectRatioLabel(width: number, height: number) {
  const commonRatios = new Set(["1:1", "4:5", "3:4", "9:16", "2:3", "16:9", "5:4", "4:3", "3:2"]);
  const reducedLeftRight = greatestCommonDivisor(width, height);
  const reduced = `${width / reducedLeftRight}:${height / reducedLeftRight}`;

  if (commonRatios.has(reduced)) {
    return { label: reduced, warning: null };
  }

  if (width >= height) {
    return { label: `≈ ${(width / height).toFixed(2)}:1`, warning: "Unusual source ratio" };
  }

  return { label: `≈ 1:${(height / width).toFixed(2)}`, warning: "Unusual source ratio" };
}

function buildResolutionLabel(width: number | null, height: number | null) {
  if (!width || !height) {
    return "—";
  }

  return `${width} x ${height}`;
}

function buildMetadataError(message: string) {
  return { metadataError: message, metadataStatus: "failed" as const };
}

function updateRow(rows: BulkEpisodeRow[], index: number, patch: Partial<BulkEpisodeRow>) {
  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
}

function normalizeFileList(files: File[], startEpisodeNumber: number) {
  const sortedFiles = [...files].sort((left, right) => naturalCompare(left.name, right.name));
  const detectedNumbers = sortedFiles.map((file) => detectEpisodeNumber(file.name));
  const hasClearDetectedNumbers =
    detectedNumbers.every((value) => value !== null) &&
    new Set(detectedNumbers.map((value) => value ?? -1)).size === detectedNumbers.length;

  return sortedFiles.map((file, index) => {
    const detectedEpisodeNumber = detectedNumbers[index];
    const episodeNumber = hasClearDetectedNumbers && detectedEpisodeNumber !== null ? detectedEpisodeNumber : startEpisodeNumber + index;

    return {
      clientId: crypto.randomUUID(),
      detectedEpisodeNumber,
      durationSeconds: null,
      editHref: null,
      episodeId: null,
      episodeNumber,
      error: null,
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileSizeLabel: formatFileSize(file.size),
      metadataError: null,
      metadataStatus: "pending" as const,
      mimeType: file.type || "video/*",
      mediaAssetId: null,
      uploadProgress: null,
      progress: 0,
      status: "waiting" as const,
      title: buildAutoTitle(episodeNumber),
      titleEdited: false,
      videoHeight: null,
      videoWidth: null,
      resolutionLabel: "—",
      orientationLabel: "—",
      aspectRatioLabel: "—",
      aspectRatioWarning: null,
    };
  });
}

function probeVideoMetadata(file: File) {
  return new Promise<{
    aspectRatioLabel: string;
    aspectRatioWarning: string | null;
    durationSeconds: number | null;
    orientationLabel: string;
    resolutionLabel: string;
    videoHeight: number | null;
    videoWidth: number | null;
  }>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationSeconds = Number.isFinite(video.duration) ? Math.max(0, Math.round(video.duration)) : null;
      const videoWidth = Number.isFinite(video.videoWidth) && video.videoWidth > 0 ? Math.trunc(video.videoWidth) : null;
      const videoHeight = Number.isFinite(video.videoHeight) && video.videoHeight > 0 ? Math.trunc(video.videoHeight) : null;
      const resolutionLabel = buildResolutionLabel(videoWidth, videoHeight);
      const orientationLabel = videoWidth && videoHeight ? getOrientationLabel(videoWidth, videoHeight) : "—";
      const aspect = videoWidth && videoHeight ? getAspectRatioLabel(videoWidth, videoHeight) : { label: "—", warning: null };

      URL.revokeObjectURL(objectUrl);
      resolve({
        aspectRatioLabel: aspect.label,
        aspectRatioWarning: aspect.warning,
        durationSeconds,
        orientationLabel,
        resolutionLabel,
        videoHeight,
        videoWidth,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        aspectRatioLabel: "—",
        aspectRatioWarning: null,
        durationSeconds: null,
        orientationLabel: "—",
        resolutionLabel: "—",
        videoHeight: null,
        videoWidth: null,
      });
    };
    video.src = objectUrl;
  });
}

function uploadToMux(
  uploadUrl: string,
  file: File,
  onProgress: (progress: UploadProgressState) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(createUploadProgressState(event.loaded, event.total));
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

export function BulkEpisodeUploadForm({
  attachEpisodeMediaUploadIntentAction,
  createEpisodeAction,
  existingEpisodeNumbers,
  finalizeUploadAction,
  requestUploadAction,
  seriesId,
}: BulkEpisodeUploadFormProps) {
  const [rows, setRows] = useState<BulkEpisodeRow[]>([]);
  const [batchDefaults, setBatchDefaults] = useState<BulkEpisodeDefaults>(DEFAULT_DEFAULTS);
  const [startEpisodeNumber, setStartEpisodeNumber] = useState(1);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const duplicateEpisodeNumbers = useMemo(() => {
    const counts = new Map<number, number>();

    for (const row of rows) {
      counts.set(row.episodeNumber, (counts.get(row.episodeNumber) ?? 0) + 1);
    }

    return new Set(
      rows
        .filter((row) => (counts.get(row.episodeNumber) ?? 0) > 1 || existingEpisodeNumbers.includes(row.episodeNumber))
        .map((row) => row.episodeNumber),
    );
  }, [existingEpisodeNumbers, rows]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (rows.length === 0) {
      messages.push("Choose video files to build the batch.");
    }

    if (rows.some((row) => row.metadataStatus !== "ready")) {
      messages.push("One or more files still need metadata review or retry.");
    }

    if (rows.some((row) => row.durationSeconds === null && row.metadataStatus === "ready")) {
      messages.push("One or more files did not expose a readable duration.");
    }

    if (duplicateEpisodeNumbers.size > 0) {
      messages.push(`Episode numbers already in use or duplicated: ${Array.from(duplicateEpisodeNumbers).join(", ")}.`);
    }

    if (batchDefaults.coinUnlockEnabled && batchDefaults.coinPrice <= 0) {
      messages.push("Coin price must be greater than zero when coin unlock is enabled.");
    }

    if (batchDefaults.lockedPreviewSeconds < 0 || batchDefaults.lockedPreviewSeconds > 3) {
      messages.push("Locked preview seconds must be between 0 and 3.");
    }

    if (!REWARDED_REQUIRED_COMPLETIONS_VALUES.includes(batchDefaults.requiredRewardedCompletions as 1 | 2)) {
      messages.push("Rewarded ads required must be 1 or 2.");
    }

    return messages;
  }, [
    batchDefaults.coinPrice,
    batchDefaults.coinUnlockEnabled,
    batchDefaults.lockedPreviewSeconds,
    batchDefaults.requiredRewardedCompletions,
    duplicateEpisodeNumbers,
    rows,
  ]);

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.selected += 1;
        if (row.status === "ready") {
          acc.ready += 1;
        } else if (row.status === "processing") {
          acc.processing += 1;
        } else if (row.status === "failed") {
          acc.failed += 1;
        } else {
          acc.waiting += 1;
        }

        return acc;
      },
      { failed: 0, processing: 0, ready: 0, selected: 0, waiting: 0 },
    );
  }, [rows]);

  const uploadSummary = useMemo(() => {
    const totals = rows.reduce(
      (acc, row) => {
        acc.totalBytes += row.file.size;

        if (row.status === "ready" || row.status === "processing") {
          acc.loadedBytes += row.file.size;
        } else if (row.uploadProgress) {
          acc.loadedBytes += row.uploadProgress.loadedBytes;
        }

        if (row.status === "uploading") {
          acc.activeUploads += 1;
        } else if (row.status === "processing") {
          acc.processingUploads += 1;
        } else if (row.status === "ready") {
          acc.readyUploads += 1;
        } else if (row.status === "failed") {
          acc.failedUploads += 1;
        } else {
          acc.waitingUploads += 1;
        }

        return acc;
      },
      {
        activeUploads: 0,
        failedUploads: 0,
        loadedBytes: 0,
        processingUploads: 0,
        readyUploads: 0,
        totalBytes: 0,
        waitingUploads: 0,
      },
    );

    return {
      ...totals,
      percentage: totals.totalBytes > 0 ? Math.min(100, Math.round((totals.loadedBytes / totals.totalBytes) * 100)) : 0,
    };
  }, [rows]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setIsPreparingFiles(true);
    setError(null);
    setMessage(null);

    const normalizedRows = normalizeFileList(files, startEpisodeNumber);
    setRows(normalizedRows);

    for (let index = 0; index < normalizedRows.length; index += 1) {
      const row = normalizedRows[index];

      if (!row) {
        continue;
      }

      const metadata = await probeVideoMetadata(row.file);

      if (metadata.durationSeconds === null || metadata.videoWidth === null || metadata.videoHeight === null) {
        updateRowState(index, {
          ...buildMetadataError("Unable to read video metadata from this file."),
          aspectRatioLabel: metadata.aspectRatioLabel,
          aspectRatioWarning: metadata.aspectRatioWarning,
          durationSeconds: metadata.durationSeconds,
          orientationLabel: metadata.orientationLabel,
          resolutionLabel: metadata.resolutionLabel,
          videoHeight: metadata.videoHeight,
          videoWidth: metadata.videoWidth,
        });
        continue;
      }

      updateRowState(index, {
        aspectRatioLabel: metadata.aspectRatioLabel,
        aspectRatioWarning: metadata.aspectRatioWarning,
        durationSeconds: metadata.durationSeconds,
        error: null,
        metadataError: null,
        metadataStatus: "ready",
        orientationLabel: metadata.orientationLabel,
        resolutionLabel: metadata.resolutionLabel,
        videoHeight: metadata.videoHeight,
        videoWidth: metadata.videoWidth,
      });
    }

    setIsPreparingFiles(false);
  }

  function updateRowState(index: number, patch: Partial<BulkEpisodeRow>) {
    setRows((current) => updateRow(current, index, patch));
  }

  async function uploadRow(row: BulkEpisodeRow, index: number) {
    if (row.metadataStatus !== "ready" || row.durationSeconds === null) {
      updateRowState(index, {
        error: "Metadata review is not complete for this file.",
        status: "failed",
      });
      return;
    }

    try {
      let episodeId = row.episodeId;

      if (!episodeId) {
        updateRowState(index, { error: null, progress: 0, status: "creating", uploadProgress: null });
        const created = await createEpisodeAction({
          episodeNumber: row.episodeNumber,
          title: row.title,
          durationSeconds: row.durationSeconds,
          defaults: batchDefaults,
        });

        if (!created.success) {
          updateRowState(index, { error: created.error, status: "failed" });
          return;
        }

        episodeId = created.episode.id;
        updateRowState(index, {
          editHref: episodeEditPath(seriesId, episodeId),
          episodeId,
          error: null,
          status: "uploading",
          uploadProgress: null,
        });
      } else {
        updateRowState(index, { error: null, progress: 0, status: "uploading", uploadProgress: null });
      }

      const intent = await requestUploadAction(row.file.type || "video/mp4", window.location.origin);

      if ("error" in intent) {
        updateRowState(index, { error: intent.error, status: "failed" });
        return;
      }

      // Attach the pending media asset to the episode BEFORE sending any bytes,
      // mirroring the proven episode attach-before-upload pattern. If the browser
      // upload or reconciliation is interrupted, the media asset is already owned
      // by this episode, so it is never left orphaned.
      const attachResult = await attachEpisodeMediaUploadIntentAction({
        episodeId,
        mediaAssetId: intent.mediaAssetId,
      });

      if (!attachResult.success) {
        updateRowState(index, { error: attachResult.error, status: "failed" });
        return;
      }

      updateRowState(index, {
       mediaAssetId: intent.mediaAssetId,
       status: "uploading",
       uploadProgress: { loadedBytes: 0, totalBytes: row.file.size, percentage: 0 },
      });

      await uploadToMux(intent.uploadUrl, row.file, (progress) => {
       updateRowState(index, { progress: progress.percentage, status: "uploading", uploadProgress: progress });
      });

      updateRowState(index, {
       progress: 100,
       status: "processing",
       uploadProgress: { loadedBytes: row.file.size, totalBytes: row.file.size, percentage: 100 },
      });

      const finalize = await finalizeUploadAction({
        episodeId,
        mediaAssetId: intent.mediaAssetId,
      });

      if ("error" in finalize) {
        updateRowState(index, {
          error: finalize.error,
          status: finalize.mediaStatus === "failed" ? "failed" : "processing",
        });
        return;
      }

      updateRowState(index, {
        error: null,
        mediaAssetId: intent.mediaAssetId,
        status: finalize.mediaStatus === "ready" ? "ready" : "processing",
        uploadProgress: { loadedBytes: row.file.size, totalBytes: row.file.size, percentage: 100 },
      });
    } catch (uploadError) {
      updateRowState(index, {
        error: uploadError instanceof Error ? uploadError.message : "Upload failed.",
        status: "failed",
      });
    }
  }

  async function refreshRow(row: BulkEpisodeRow, index: number) {
    if (!row.episodeId || !row.mediaAssetId) {
      updateRowState(index, {
        error: "Upload details are missing for this episode.",
        status: "failed",
      });
      return;
    }

    try {
      const result = await finalizeUploadAction({
        episodeId: row.episodeId,
        mediaAssetId: row.mediaAssetId,
      });

      if ("error" in result) {
        updateRowState(index, {
          error: result.error,
          status: result.mediaStatus === "failed" ? "failed" : "processing",
        });
        return;
      }

      updateRowState(index, {
        error: null,
        status: result.mediaStatus === "ready" ? "ready" : "processing",
      });
    } catch (refreshError) {
      updateRowState(index, {
        error: refreshError instanceof Error ? refreshError.message : "Unable to refresh status.",
        status: "failed",
      });
    }
  }

  async function retryMetadataRow(row: BulkEpisodeRow, index: number) {
    if (isRunning || isPreparingFiles) {
      return;
    }

    updateRowState(index, {
      error: null,
      metadataError: null,
      metadataStatus: "pending",
    });

    const metadata = await probeVideoMetadata(row.file);

    if (metadata.durationSeconds === null || metadata.videoWidth === null || metadata.videoHeight === null) {
      updateRowState(index, {
        ...buildMetadataError("Unable to read video metadata from this file."),
        aspectRatioLabel: metadata.aspectRatioLabel,
        aspectRatioWarning: metadata.aspectRatioWarning,
        durationSeconds: metadata.durationSeconds,
        orientationLabel: metadata.orientationLabel,
        resolutionLabel: metadata.resolutionLabel,
        videoHeight: metadata.videoHeight,
        videoWidth: metadata.videoWidth,
      });
      return;
    }

    updateRowState(index, {
      aspectRatioLabel: metadata.aspectRatioLabel,
      aspectRatioWarning: metadata.aspectRatioWarning,
      durationSeconds: metadata.durationSeconds,
      error: null,
      metadataError: null,
      metadataStatus: "ready",
      orientationLabel: metadata.orientationLabel,
      resolutionLabel: metadata.resolutionLabel,
      videoHeight: metadata.videoHeight,
      videoWidth: metadata.videoWidth,
    });
  }

  function removeRow(index: number) {
    if (isRunning || isPreparingFiles) {
      return;
    }

    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleStartBatch() {
    if (validationMessages.length > 0 || rows.length === 0 || isPreparingFiles || isRunning) {
      return;
    }

    setIsRunning(true);
    setError(null);
    setMessage(null);

    try {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];

        if (!row) {
          continue;
        }

        await uploadRow(row, index);
      }

      setMessage("Batch finished. Review the results below.");
    } finally {
      setIsRunning(false);
    }
  }

  const hasCreatedRows = rows.length > 0;
  const canStart = validationMessages.length === 0 && !isPreparingFiles && !isRunning && hasCreatedRows;

  return (
    <div className="space-y-8">
      <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
        <div className="space-y-1">
          <p className={labelClassName}>Select episode videos</p>
          <p className="text-sm text-bone/60">
            Choose all files once. The batch stays draft until each file has been uploaded and linked.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelClassName}>Start episode number</span>
            <input
              className={inputClassName}
              type="number"
              min={1}
              value={startEpisodeNumber}
              onChange={(event) => setStartEpisodeNumber(Math.max(1, Number(event.target.value) || 1))}
              disabled={isRunning}
            />
            <p className="text-xs text-bone/45">Used when filenames do not expose a clear episode number.</p>
          </label>

          <label className="block space-y-1.5">
            <span className={labelClassName}>Choose files</span>
            <input
              className="block w-full text-xs text-bone/70 file:mr-3 file:border file:border-bone/15 file:bg-bone/[0.03] file:px-3 file:py-1.5 file:text-[0.65rem] file:uppercase file:tracking-[0.14em] file:text-bone/80"
              type="file"
              accept="video/*"
              multiple
              onChange={handleFileChange}
              disabled={isPreparingFiles || isRunning}
            />
          </label>
        </div>

        <fieldset className="space-y-3 border border-bone/10 p-4">
          <legend className={labelClassName}>Batch defaults</legend>
          <p className="text-xs text-bone/45">
            Leave classification override fields blank to inherit the series values.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-bone/80">
              <input
                type="checkbox"
                checked={batchDefaults.isFree}
                onChange={(event) => setBatchDefaults((current) => ({ ...current, isFree: event.target.checked }))}
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
              />
              Free to watch
            </label>

            <label className="flex items-center gap-2 text-sm text-bone/80">
              <input
                type="checkbox"
                checked={batchDefaults.coinUnlockEnabled}
                onChange={(event) =>
                  setBatchDefaults((current) => ({
                    ...current,
                    coinUnlockEnabled: event.target.checked,
                  }))
                }
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
              />
              Coin unlock enabled
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Coin price</span>
              <input
                className={inputClassName}
                type="number"
                min={0}
                value={batchDefaults.coinPrice}
                onChange={(event) =>
                  setBatchDefaults((current) => ({
                    ...current,
                    coinPrice: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
                disabled={isRunning}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-bone/80">
              <input
                type="checkbox"
                checked={batchDefaults.rewardedUnlockEnabled}
                onChange={(event) =>
                  setBatchDefaults((current) => ({
                    ...current,
                    rewardedUnlockEnabled: event.target.checked,
                  }))
                }
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
              />
              Rewarded-ad unlock enabled
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Rewarded access mode</span>
              <CmsSelect
                className={inputClassName}
                value={batchDefaults.rewardedAccessMode}
                onChange={() =>
                  setBatchDefaults((current) => ({
                    ...current,
                    rewardedAccessMode: "permanent",
                  }))
                }
                disabled={isRunning}
                options={[{ label: "Permanent", value: "permanent" }]}
              />
            </label>

            <label className="block space-y-1.5">
              <span className={labelClassName}>Rewarded ads required</span>
              <CmsSelect
                className={inputClassName}
                value={String(batchDefaults.requiredRewardedCompletions)}
                onChange={(newValue) =>
                  setBatchDefaults((current) => ({
                    ...current,
                    requiredRewardedCompletions: newValue === "2" ? 2 : 1,
                  }))
                }
                disabled={isRunning}
                options={[
                  { label: "1 (single ad)", value: "1" },
                  { label: "2 (two ads)", value: "2" },
                ]}
              />
            </label>
          </div>

          <p className="text-xs text-bone/40">
            Launch rewarded unlock is permanent only. Session mode is not supported in current rewarded unlocks.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-bone/80">
              <input
                type="checkbox"
                checked={batchDefaults.plusAccess}
                onChange={(event) =>
                  setBatchDefaults((current) => ({
                    ...current,
                    plusAccess: event.target.checked,
                  }))
                }
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
              />
              Included with Plus
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Locked preview seconds</span>
              <input
                className={inputClassName}
                type="number"
                min={0}
                max={3}
                value={batchDefaults.lockedPreviewSeconds}
                onChange={(event) =>
                  setBatchDefaults((current) => ({
                    ...current,
                    lockedPreviewSeconds: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                  }))
                }
                disabled={isRunning}
              />
            </label>

            <label className="block space-y-1.5">
              <span className={labelClassName}>Content rating override</span>
              <CmsSelect
                className={inputClassName}
                value={batchDefaults.contentRatingOverride ?? ""}
                onChange={(newValue) =>
                  setBatchDefaults((current) => ({
                    ...current,
                    contentRatingOverride: newValue ? (newValue as ContentRating) : null,
                  }))
                }
                disabled={isRunning}
                placeholderLabel="Inherit from series"
                options={[
                  { label: "Inherit from series", value: "" },
                  ...CONTENT_RATINGS.map((rating) => ({ label: rating, value: rating })),
                ]}
              />
            </label>
          </div>

          <div>
            <span className={labelClassName}>Content descriptor overrides</span>
            <div className="mt-2 flex flex-wrap gap-3">
              {CONTENT_DESCRIPTORS.map((descriptor) => {
                const checked = batchDefaults.contentDescriptorsOverride.includes(descriptor);

                return (
                  <label key={descriptor} className="flex items-center gap-2 text-sm text-bone/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setBatchDefaults((current) => {
                          const nextDescriptors = new Set(current.contentDescriptorsOverride);

                          if (event.target.checked) {
                            nextDescriptors.add(descriptor);
                          } else {
                            nextDescriptors.delete(descriptor);
                          }

                          return { ...current, contentDescriptorsOverride: Array.from(nextDescriptors) };
                        })
                      }
                      className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                    />
                    {descriptor}
                  </label>
                );
              })}
            </div>
          </div>
        </fieldset>

        {isPreparingFiles && <p className="text-xs text-bone/50">Reading file metadata…</p>}
        {message && <p className="text-sm text-teal">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {validationMessages.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-300">
            {validationMessages.map((validationMessage) => (
              <li key={validationMessage}>{validationMessage}</li>
            ))}
          </ul>
        )}

        <Button type="button" onClick={handleStartBatch} disabled={!canStart}>
          {isRunning ? "Running batch…" : "Start batch"}
        </Button>
      </section>

      {hasCreatedRows && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Review queue</h2>
              <p className="text-xs text-bone/45">Edit titles and numbers before starting the batch.</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs text-bone/50 sm:flex sm:flex-wrap sm:gap-4">
              <span>{counts.selected} selected</span>
              <span>{counts.ready} ready</span>
              <span>{counts.processing} processing</span>
              <span>{counts.failed} failed</span>
              <span>{counts.waiting} waiting</span>
            </div>
          </div>

          <div className="space-y-2 border border-bone/10 bg-bone/[0.02] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                  {uploadSummary.activeUploads > 0
                    ? "Upload in progress — do not close this page"
                    : uploadSummary.processingUploads > 0
                      ? "Upload complete"
                      : "Batch ready"}
                </p>
                <p className="text-sm text-bone/70">
                  {uploadSummary.readyUploads} ready · {uploadSummary.processingUploads} processing · {uploadSummary.failedUploads} failed
                </p>
              </div>
              <div className="text-right text-xs text-bone/60">
                <div>{formatUploadBytes(uploadSummary.loadedBytes)} / {formatUploadBytes(uploadSummary.totalBytes)}</div>
                <div>{uploadSummary.percentage}%</div>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden bg-bone/10">
              <div className="h-full bg-teal transition-all" style={{ width: `${uploadSummary.percentage}%` }} />
            </div>
          </div>

          <div className="overflow-x-auto border border-bone/10">
            <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
              <thead className="bg-bone/[0.03] text-xs uppercase tracking-[0.14em] text-bone/50">
                <tr>
                  <th className="px-4 py-3">Episode</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Resolution</th>
                  <th className="px-4 py-3">Orientation / Aspect</th>
                  <th className="px-4 py-3">File Size</th>
                  <th className="px-4 py-3">Metadata Status</th>
                  <th className="px-4 py-3">Upload Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isEditable = row.status === "waiting" || row.status === "failed";

                  return (
                    <tr key={row.clientId} className="border-t border-bone/10 align-top">
                      <td className="px-4 py-4">
                        <input
                          className={`${inputClassName} max-w-[7rem]`}
                          type="number"
                          min={1}
                          value={row.episodeNumber}
                          onChange={(event) => {
                            const nextEpisodeNumber = Math.max(1, Number(event.target.value) || 1);
                            updateRowState(index, {
                              episodeNumber: nextEpisodeNumber,
                              title: row.titleEdited ? row.title : buildAutoTitle(nextEpisodeNumber),
                              titleEdited: row.titleEdited,
                            });
                          }}
                          disabled={!isEditable || isRunning}
                        />
                        <p className="mt-1 text-[0.65rem] text-bone/45">
                          {row.detectedEpisodeNumber ? `Detected ${row.detectedEpisodeNumber}` : "No number detected"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          className={inputClassName}
                          value={row.title}
                          onChange={(event) =>
                            updateRowState(index, {
                              title: event.target.value,
                              titleEdited: true,
                            })
                          }
                          disabled={!isEditable || isRunning}
                        />
                      </td>
                      <td className="px-4 py-4 text-bone/70">
                        <p className="font-medium">{row.fileName}</p>
                        <p className="mt-1 text-xs text-bone/45">{row.mimeType}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-[0.68rem] text-bone/60">
                        {formatDuration(row.durationSeconds)}
                      </td>
                      <td className="px-4 py-4 text-sm text-bone/70">
                        <p>{row.resolutionLabel}</p>
                        {row.videoWidth && row.videoHeight && (
                          <p className="mt-1 text-xs text-bone/45">
                            Source {row.videoWidth} x {row.videoHeight}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-bone/70">
                        <p className="capitalize">{row.orientationLabel}</p>
                        <p className="mt-1 font-mono text-[0.68rem] text-bone/60">{row.aspectRatioLabel}</p>
                        {row.aspectRatioWarning && <p className="mt-1 text-xs text-amber-300">{row.aspectRatioWarning}</p>}
                      </td>
                      <td className="px-4 py-4 text-xs text-bone/70">
                        <p>{row.fileSizeLabel}</p>
                        <p className="mt-1 text-bone/45">{row.fileSizeBytes.toLocaleString()} bytes</p>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div className="font-mono uppercase tracking-[0.14em] text-bone/70">
                          {row.metadataStatus === "pending"
                            ? "Needs review"
                            : row.metadataStatus === "ready"
                              ? "Ready"
                              : "Failed"}
                        </div>
                        {row.metadataError && <p className="mt-2 max-w-xs text-red-400">{row.metadataError}</p>}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div className="font-mono uppercase tracking-[0.14em] text-bone/70">{row.status}</div>
                        {row.status === "uploading" && row.uploadProgress && (
                          <div className="mt-2 space-y-1">
                            <div className="text-teal">
                              {row.uploadProgress.percentage}% · {formatUploadProgressBytes(row.uploadProgress)}
                            </div>
                            <div className="h-1.5 overflow-hidden bg-bone/10">
                              <div className="h-full bg-teal transition-all" style={{ width: `${row.uploadProgress.percentage}%` }} />
                            </div>
                          </div>
                        )}
                        {row.status === "processing" && row.uploadProgress && (
                          <p className="mt-2 text-bone/60">{formatUploadProgressBytes(row.uploadProgress)} · Processing</p>
                        )}
                        {row.status === "failed" && row.uploadProgress && (
                          <p className="mt-2 text-red-400">
                            Failed at {row.uploadProgress.percentage}% · {formatUploadProgressBytes(row.uploadProgress)}
                          </p>
                        )}
                        {row.error && <p className="mt-2 max-w-xs text-red-400">{row.error}</p>}
                      </td>
                      <td className="px-4 py-4 space-y-2">
                        {row.metadataStatus === "failed" ? (
                          <Button type="button" variant="secondary" onClick={() => retryMetadataRow(row, index)} disabled={isRunning || isPreparingFiles}>
                            Retry metadata
                          </Button>
                        ) : row.status === "ready" && row.editHref ? (
                          <Link href={row.editHref} className="block text-sm text-teal">
                            Edit
                          </Link>
                        ) : row.status === "processing" && row.episodeId && row.mediaAssetId ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => refreshRow(row, index)}
                            disabled={isRunning}
                          >
                            Refresh status
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => uploadRow(row, index)}
                            disabled={isRunning || row.status === "creating" || row.status === "uploading"}
                          >
                            {row.episodeId ? "Retry upload" : "Retry"}
                          </Button>
                        )}

                        {!isRunning && !isPreparingFiles && row.status === "waiting" && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="border-bone/15 bg-bone/[0.02] text-bone/70 hover:border-bone/30 hover:bg-bone/[0.06]"
                            onClick={() => removeRow(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {hasCreatedRows && (
        <section className="space-y-3 border border-bone/10 bg-bone/[0.03] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">Batch summary</h2>
          <p className="text-sm text-bone/60">
            {counts.selected} selected · {counts.ready} ready · {counts.processing} processing · {counts.failed} failed
          </p>

          <div className="space-y-2">
            {rows.map((row) =>
              row.editHref ? (
                <div key={row.clientId} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-bone/70">
                    Episode {row.episodeNumber}
                    {row.title ? ` — ${row.title}` : ""}
                  </span>
                  <Link href={row.editHref} className="text-teal">
                    Edit
                  </Link>
                </div>
              ) : null,
            )}
          </div>
        </section>
      )}
    </div>
  );
}
