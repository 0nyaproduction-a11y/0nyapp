"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS, type ContentDescriptor, type ContentRating } from "@/lib/classification";
import { seriesEditPath } from "@/lib/routes";
import {
  buildEpisodeDurationLabel,
  buildSlugFromTitle,
  buildVideoIntakeRows,
  filterSupportedVideoFiles,
  formatDuration,
  probeVideoMetadata,
  type VideoIntakeRow,
} from "@/lib/cms/video-intake";
import {
  createUploadProgressState,
  formatUploadBytes,
  formatUploadProgressBytes,
  type UploadProgressState,
} from "@/lib/cms/upload-progress";
import {
  buildSubtitleIntakeRows,
  filterSupportedSubtitleFiles,
  formatSubtitleTargetLabel,
  type SubtitleIntakeRow,
} from "@/lib/cms/subtitle-intake";
import type { MediaUploadIntent } from "@/components/cms/MediaDirectUploadField";
import type { BulkEpisodeCreateInput, BulkEpisodeDefaults, BulkEpisodeFinalizeResult } from "@/lib/cms/bulk-episodes";
import type { SubtitleUploadIntent } from "@/lib/subtitles";
import { CANONICAL_GENRES } from "@/lib/taxonomy";

type ArtworkUploadIntent = {
  bucket: string;
  objectPath: string;
  signedUploadUrl: string;
  token: string;
  publicUrl: string;
  mimeType: string;
};

type SignedUploadIntent = {
  bucket: string;
  objectPath: string;
  token: string;
};

type UploadSummary = {
  activeUploads: number;
  failedUploads: number;
  loadedBytes: number;
  percentage: number;
  processingUploads: number;
  readyUploads: number;
  totalBytes: number;
  waitingUploads: number;
};

type SeriesDraftInput = {
  title: string;
  slug: string;
  synopsis: string | null;
  genre: string | null;
  language: string | null;
  format: string | null;
  episodeDurationLabel: string | null;
  episodeCount: number;
  posterUrl: string | null;
  heroImageUrl: string | null;
  contentRating: ContentRating | null;
  contentDescriptors: ContentDescriptor[];
  featured: boolean;
  sortOrder: number;
};

type SeriesDraftResult =
  | { success: true; series: { hero_image_url?: string | null; id: string; poster_url?: string | null; slug: string } }
  | { success: false; errors: Array<{ field: string; message: string }> };

type EpisodeCreateResult =
  | {
      success: true;
      episode: {
        duration_seconds: number;
        id: string;
        episode_number: number;
        media_asset_id: string | null;
        status: string;
        title: string | null;
      };
    }
  | { success: false; error: string };

type SubtitleCreateResult =
  | {
      success: true;
      subtitleTrackId: string;
      status: "ready" | "processing";
    }
  | {
      success: false;
      error: string;
    };

type NewSeriesIntakeFormProps = {
  createSeriesDraftAction: (input: SeriesDraftInput) => Promise<SeriesDraftResult>;
  createEpisodeAction: (seriesId: string, input: BulkEpisodeCreateInput) => Promise<EpisodeCreateResult>;
  finalizeUploadAction: (seriesId: string, input: { episodeId: string; mediaAssetId: string }) => Promise<BulkEpisodeFinalizeResult>;
  attachEpisodeMediaUploadIntentAction: (
    input: { episodeId: string; mediaAssetId: string },
  ) => Promise<{ success: true } | { success: false; error: string }>;
  requestSubtitleUploadAction: (
    input: {
      closedCaptions: boolean;
      episodeNumber: number;
      isDefault: boolean;
      label: string;
      languageCode: string;
      mimeType: string;
      seriesSlug: string;
      sourceFormat: "srt" | "vtt";
    },
  ) => Promise<SubtitleUploadIntent | { error: string }>;
  finalizeSubtitleUploadAction: (
    input: {
      closedCaptions: boolean;
      episodeNumber: number;
      isDefault: boolean;
      label: string;
      languageCode: string;
      mimeType: string;
      objectPath: string;
      seriesSlug: string;
      sourceFormat: "srt" | "vtt";
    },
  ) => Promise<SubtitleCreateResult>;
  persistArtworkAction: (
    seriesId: string,
    field: "poster_url" | "hero_image_url",
    publicUrl: string,
  ) => Promise<{ success: boolean; message?: string }>;
  requestArtworkUploadAction: (
    seriesId: string,
    kind: "series-poster" | "series-hero",
    mimeType: string,
  ) => Promise<ArtworkUploadIntent | { error: string }>;
  requestMediaUploadAction: (
    mimeType: string,
    corsOrigin?: string | null,
  ) => Promise<MediaUploadIntent | { error: string }>;
};

type SeriesFormValues = {
  title: string;
  slug: string;
  synopsis: string;
  genre: string;
  language: string;
  format: string;
  episodeDurationLabel: string;
  episodeCount: string;
  sortOrder: string;
  contentRating: ContentRating | "";
  featured: boolean;
  contentDescriptors: ContentDescriptor[];
};

type ArtworkSelection = {
  file: File | null;
  previewUrl: string | null;
  uploaded: boolean;
};

const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";
const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [color-scheme:dark]";

const DRAFT_EPISODE_DEFAULTS: BulkEpisodeDefaults = {
  isFree: false,
  coinUnlockEnabled: false,
  coinPrice: 0,
  rewardedUnlockEnabled: false,
  rewardedAccessMode: "permanent",
  requiredRewardedCompletions: 1,
  plusAccess: false,
  lockedPreviewSeconds: 0,
  contentRatingOverride: null,
  contentDescriptorsOverride: [],
};

function toErrorRecord(errors: Array<{ field: string; message: string }>) {
  const record: Record<string, string> = {};

  for (const error of errors) {
    if (!record[error.field]) {
      record[error.field] = error.message;
    }
  }

  return record;
}

function buildSeriesInput(values: SeriesFormValues): SeriesDraftInput {
  return {
    title: values.title.trim(),
    slug: values.slug.trim().toLowerCase(),
    synopsis: values.synopsis.trim() ? values.synopsis.trim() : null,
    genre: values.genre.trim() ? values.genre.trim() : null,
    language: values.language.trim() ? values.language.trim() : null,
    format: values.format.trim() ? values.format.trim() : null,
    episodeDurationLabel: values.episodeDurationLabel.trim() ? values.episodeDurationLabel.trim() : null,
    episodeCount: Number.isFinite(Number(values.episodeCount)) ? Math.trunc(Number(values.episodeCount)) : 0,
    posterUrl: null,
    heroImageUrl: null,
    contentRating: values.contentRating || null,
    contentDescriptors: values.contentDescriptors,
    featured: values.featured,
    sortOrder: Number.isFinite(Number(values.sortOrder)) ? Math.trunc(Number(values.sortOrder)) : 0,
  };
}

function buildUploadSummary(rows: VideoIntakeRow[]): UploadSummary {
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalBytes += row.file.size;

      if (row.status === "ready" || row.status === "processing") {
        acc.loadedBytes += row.file.size;
      } else if (row.uploadProgress) {
        acc.loadedBytes += row.uploadProgress.loadedBytes;
      }

      if (row.status === "ready") {
        acc.readyUploads += 1;
      } else if (row.status === "processing") {
        acc.processingUploads += 1;
      } else if (row.status === "failed") {
        acc.failedUploads += 1;
      } else if (row.status === "uploading") {
        acc.activeUploads += 1;
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

  const percentage = totals.totalBytes > 0 ? Math.min(100, Math.round((totals.loadedBytes / totals.totalBytes) * 100)) : 0;

  return { ...totals, percentage };
}

function validateSeriesInput(values: SeriesFormValues) {
  const errors: Record<string, string> = {};
  const seriesInput = buildSeriesInput(values);

  if (!seriesInput.title) {
    errors.title = "Title is required.";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seriesInput.slug)) {
    errors.slug = "Slug must be lowercase letters, numbers, and hyphens only.";
  }

  if (seriesInput.format && !["Series", "Mini", "Short"].includes(seriesInput.format)) {
    errors.format = "Unsupported format.";
  }

  if (seriesInput.contentRating && !CONTENT_RATINGS.includes(seriesInput.contentRating)) {
    errors.contentRating = "Unsupported content rating.";
  }

  if (!Number.isInteger(seriesInput.episodeCount) || seriesInput.episodeCount < 0) {
    errors.episodeCount = "Episode count must be zero or a positive whole number.";
  }

  if (!Number.isInteger(seriesInput.sortOrder)) {
    errors.sortOrder = "Sort order must be a whole number.";
  }

  for (const descriptor of seriesInput.contentDescriptors) {
    if (!CONTENT_DESCRIPTORS.includes(descriptor as (typeof CONTENT_DESCRIPTORS)[number])) {
      errors.contentDescriptors = `Unsupported content descriptor: ${descriptor}.`;
      break;
    }
  }

  return errors;
}

function usePreviewUrl(file: File | null) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clears a derived object URL when the selected file is removed.
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return previewUrl;
}

function uploadSignedArtworkFile(intent: SignedUploadIntent, file: File) {
  return new Promise<void>((resolve, reject) => {
    createClient()
      .storage.from(intent.bucket)
      .uploadToSignedUrl(intent.objectPath, intent.token, file)
      .then(({ error }) => {
        if (error) {
          reject(new Error("Upload failed. Try again."));
          return;
        }

        resolve();
      })
      .catch((error) => reject(error));
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

function updateRows(rows: VideoIntakeRow[], index: number, patch: Partial<VideoIntakeRow>) {
  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
}

function buildDurationFromRows(rows: VideoIntakeRow[]) {
  return buildEpisodeDurationLabel(rows);
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 45000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function NewSeriesIntakeForm({
  createSeriesDraftAction,
  createEpisodeAction,
  finalizeUploadAction,
  attachEpisodeMediaUploadIntentAction,
  requestSubtitleUploadAction,
  finalizeSubtitleUploadAction,
  persistArtworkAction,
  requestArtworkUploadAction,
  requestMediaUploadAction,
}: NewSeriesIntakeFormProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleFolderInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleFilesInputRef = useRef<HTMLInputElement | null>(null);
  const processingPollTickRef = useRef<() => void>(() => {});
  const processingPollBusyRef = useRef(false);
  const [rows, setRows] = useState<VideoIntakeRow[]>([]);
  const [subtitleRows, setSubtitleRows] = useState<SubtitleIntakeRow[]>([]);
  const [ignoredFiles, setIgnoredFiles] = useState(0);
  const [ignoredSubtitleFiles, setIgnoredSubtitleFiles] = useState(0);
  const [startEpisodeNumber, setStartEpisodeNumber] = useState(1);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [isPreparingSubtitleFiles, setIsPreparingSubtitleFiles] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seriesErrors, setSeriesErrors] = useState<Record<string, string>>({});
  const [seriesCreatedId, setSeriesCreatedId] = useState<string | null>(null);
  const [seriesCreatedSlug, setSeriesCreatedSlug] = useState<string | null>(null);
  const [posterSelection, setPosterSelection] = useState<ArtworkSelection>({ file: null, previewUrl: null, uploaded: false });
  const [heroSelection, setHeroSelection] = useState<ArtworkSelection>({ file: null, previewUrl: null, uploaded: false });
  const [usePosterAsHero, setUsePosterAsHero] = useState(true);
  const [episodeDurationTouched, setEpisodeDurationTouched] = useState(false);
  const [seriesValues, setSeriesValues] = useState<SeriesFormValues>({
    title: "",
    slug: "",
    synopsis: "",
    genre: "",
    language: "",
    format: "",
    episodeDurationLabel: "",
    episodeCount: "0",
    sortOrder: "0",
    contentRating: "",
    featured: false,
    contentDescriptors: [],
  });
  const posterPreviewUrl = usePreviewUrl(posterSelection.file);
  const heroPreviewUrl = usePreviewUrl(heroSelection.file);

  const duplicateEpisodeNumbers = useMemo(() => {
    const counts = new Map<number, number>();

    for (const row of rows) {
      counts.set(row.episodeNumber, (counts.get(row.episodeNumber) ?? 0) + 1);
    }

    return new Set(rows.filter((row) => (counts.get(row.episodeNumber) ?? 0) > 1).map((row) => row.episodeNumber));
  }, [rows]);

  const hasClearEpisodeNumbers = useMemo(() => {
    if (rows.length === 0) {
      return false;
    }

    const detectedNumbers = rows.map((row) => row.detectedEpisodeNumber);
    if (detectedNumbers.some((value) => value === null || value <= 0)) {
      return false;
    }

    return new Set(detectedNumbers).size === rows.length;
  }, [rows]);

  const showFallbackNumbering = rows.length > 0 && !hasClearEpisodeNumbers;

  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    const currentSeriesErrors = validateSeriesInput(seriesValues);

    if (rows.length === 0) {
      messages.push("Select episode videos first.");
    }

    if (rows.some((row) => row.metadataStatus !== "ready")) {
      messages.push("One or more files still need metadata review or retry.");
    }

    if (rows.some((row) => row.durationSeconds === null && row.metadataStatus === "ready")) {
      messages.push("One or more files did not expose a readable duration.");
    }

    if (duplicateEpisodeNumbers.size > 0) {
      messages.push(`Episode numbers already duplicated: ${Array.from(duplicateEpisodeNumbers).join(", ")}.`);
    }

    for (const subtitleRow of subtitleRows) {
      if (subtitleRow.targetEpisodeNumber === null) {
        messages.push(`Subtitle ${subtitleRow.fileName} needs an episode association.`);
      }

      if (!subtitleRow.languageCode.trim()) {
        messages.push(`Subtitle ${subtitleRow.fileName} needs a language code.`);
      }

      if (!subtitleRow.label.trim()) {
        messages.push(`Subtitle ${subtitleRow.fileName} needs a label.`);
      }
    }

    if (!posterSelection.file) {
      messages.push("Choose a poster before creating the series.");
    }

    for (const errorMessage of Object.values(currentSeriesErrors)) {
      messages.push(errorMessage);
    }

    return messages;
  }, [duplicateEpisodeNumbers, posterSelection.file, rows, seriesValues, subtitleRows]);

  const rowCounts = useMemo(() => {
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
      { selected: 0, ready: 0, processing: 0, failed: 0, waiting: 0 },
    );
  }, [rows]);

  const uploadSummary = useMemo(() => buildUploadSummary(rows), [rows]);
  const uploadInProgress = uploadSummary.activeUploads > 0;
  const uploadComplete = !uploadInProgress && (uploadSummary.processingUploads > 0 || uploadSummary.readyUploads > 0 || uploadSummary.failedUploads > 0);

  const hasFailedRows = rowCounts.failed > 0;
  const hasProcessingRows = rowCounts.processing > 0;
  const hasWaitingRows = rowCounts.waiting > 0;
  const allRowsReady = rows.length > 0 && rowCounts.ready === rows.length;

  // Keep the latest closures available to the interval below without
  // resubscribing the interval on every keystroke/progress update.
  useEffect(() => {
    processingPollTickRef.current = () => {
      if (isRunning || processingPollBusyRef.current || !seriesCreatedId) {
        return;
      }

      const seriesId = seriesCreatedId;
      const targets = rows
        .map((row, index) => ({ row, index }))
        .filter(
          (entry): entry is { row: VideoIntakeRow & { episodeId: string; mediaAssetId: string }; index: number } =>
            entry.row.status === "processing" && Boolean(entry.row.episodeId) && Boolean(entry.row.mediaAssetId),
        );

      if (targets.length === 0) {
        return;
      }

      processingPollBusyRef.current = true;

      void (async () => {
        try {
          for (const { row, index } of targets) {
            const ready = await reconcileEpisodeMediaStatus(seriesId, row.episodeId, row.mediaAssetId, index);

            if (ready && seriesCreatedSlug) {
              await uploadSubtitleRowsForEpisode(seriesCreatedSlug, row.episodeNumber);
            }
          }
        } finally {
          processingPollBusyRef.current = false;
        }
      })();
    };
  });

  // Auto-refresh rows still processing on Mux by reusing the existing
  // finalizeUploadAction reconciliation path. Stops once nothing is processing.
  useEffect(() => {
    if (!seriesCreatedId || !hasProcessingRows) {
      return;
    }

    const intervalId = window.setInterval(() => {
      processingPollTickRef.current();
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [seriesCreatedId, hasProcessingRows]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keeps editable defaults aligned with the current file intake.
    setSeriesValues((current) => {
      const nextEpisodeCount = String(rows.length);
      const nextDurationLabel = buildDurationFromRows(rows) ?? "";
      let updated = current;

      if (current.episodeCount !== nextEpisodeCount) {
        updated = { ...updated, episodeCount: nextEpisodeCount };
      }

      if (!episodeDurationTouched && current.episodeDurationLabel !== (nextDurationLabel ?? "")) {
        updated = { ...updated, episodeDurationLabel: nextDurationLabel };
      }

      return updated;
    });
  }, [episodeDurationTouched, rows]);

  async function loadFiles(files: File[]) {
    const { ignoredCount, supported } = filterSupportedVideoFiles(files);
    setIgnoredFiles(ignoredCount);

    if (supported.length === 0) {
      setRows([]);
      setError("No supported video files were selected.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsPreparingFiles(true);
    setSubtitleRows([]);
    setIgnoredSubtitleFiles(0);
    setEpisodeDurationTouched(false);

    try {
      const normalizedRows = buildVideoIntakeRows(supported, startEpisodeNumber);
      setRows(normalizedRows);

      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];

        if (!row) {
          continue;
        }

        const metadata = await probeVideoMetadata(row.file);

        if (metadata.durationSeconds === null || metadata.videoWidth === null || metadata.videoHeight === null) {
          setRows((current) =>
            updateRows(current, index, {
              aspectRatioLabel: metadata.aspectRatioLabel,
              aspectRatioWarning: metadata.aspectRatioWarning,
              durationSeconds: metadata.durationSeconds,
              metadataError: "Unable to read video metadata from this file.",
              metadataStatus: "failed",
              orientationLabel: metadata.orientationLabel,
              resolutionLabel: metadata.resolutionLabel,
              videoHeight: metadata.videoHeight,
              videoWidth: metadata.videoWidth,
            }),
          );
          continue;
        }

        setRows((current) =>
          updateRows(current, index, {
            aspectRatioLabel: metadata.aspectRatioLabel,
            aspectRatioWarning: metadata.aspectRatioWarning,
            durationSeconds: metadata.durationSeconds,
            metadataError: null,
            metadataStatus: "ready",
            orientationLabel: metadata.orientationLabel,
            resolutionLabel: metadata.resolutionLabel,
            videoHeight: metadata.videoHeight,
            videoWidth: metadata.videoWidth,
          }),
        );
      }
    } finally {
      setIsPreparingFiles(false);
    }
  }

  async function loadSubtitleFiles(files: File[]) {
    const { ignoredCount, supported } = filterSupportedSubtitleFiles(files);
    setIgnoredSubtitleFiles(ignoredCount);

    if (supported.length === 0) {
      setSubtitleRows([]);
      setError("No supported subtitle files were selected.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsPreparingSubtitleFiles(true);

    try {
      setSubtitleRows(buildSubtitleIntakeRows(supported));
    } finally {
      setIsPreparingSubtitleFiles(false);
    }
  }

  async function handleFolderSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    await loadFiles(files);
  }

  async function handleFilesSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    await loadFiles(files);
  }

  async function handleSubtitleFolderSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    await loadSubtitleFiles(files);
  }

  async function handleSubtitleFilesSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    await loadSubtitleFiles(files);
  }

  function updateRowState(index: number, patch: Partial<VideoIntakeRow>) {
    setRows((current) => updateRows(current, index, patch));
  }

  function updateSubtitleRow(index: number, patch: Partial<SubtitleIntakeRow>) {
    setSubtitleRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeSubtitleRow(index: number) {
    setSubtitleRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleSeriesField<K extends keyof SeriesFormValues>(field: K, value: SeriesFormValues[K]) {
    if (field === "episodeDurationLabel") {
      setEpisodeDurationTouched(true);
    }

    setSeriesErrors({});
    setSeriesValues((current) => ({ ...current, [field]: value }));
  }

  function handleSeriesTitleChange(value: string) {
    setSeriesErrors({});
    setSeriesValues((current) => {
      const nextSlug = current.slug === buildSlugFromTitle(current.title) || !current.slug.trim()
        ? buildSlugFromTitle(value)
        : current.slug;

      return {
        ...current,
        title: value,
        slug: nextSlug,
      };
    });
  }

  function handleSlugChange(value: string) {
    setSeriesErrors({});
    setSeriesValues((current) => ({ ...current, slug: value.toLowerCase() }));
  }

  function toggleDescriptor(descriptor: ContentDescriptor) {
    setSeriesErrors({});
    setSeriesValues((current) => {
      const nextDescriptors = new Set(current.contentDescriptors);

      if (nextDescriptors.has(descriptor)) {
        nextDescriptors.delete(descriptor);
      } else {
        nextDescriptors.add(descriptor);
      }

      return { ...current, contentDescriptors: Array.from(nextDescriptors) };
    });
  }

  function removeRow(index: number) {
    if (isRunning || isPreparingFiles) {
      return;
    }

    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function retryMetadataRow(row: VideoIntakeRow, index: number) {
    if (isRunning || isPreparingFiles) {
      return;
    }

    updateRowState(index, {
      metadataError: null,
      metadataStatus: "pending",
    });

    const metadata = await probeVideoMetadata(row.file);

    if (metadata.durationSeconds === null || metadata.videoWidth === null || metadata.videoHeight === null) {
      updateRowState(index, {
        aspectRatioLabel: metadata.aspectRatioLabel,
        aspectRatioWarning: metadata.aspectRatioWarning,
        durationSeconds: metadata.durationSeconds,
        metadataError: "Unable to read video metadata from this file.",
        metadataStatus: "failed",
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
      metadataError: null,
      metadataStatus: "ready",
      orientationLabel: metadata.orientationLabel,
      resolutionLabel: metadata.resolutionLabel,
      videoHeight: metadata.videoHeight,
      videoWidth: metadata.videoWidth,
    });
  }

  async function uploadArtwork(
    seriesId: string,
    field: "poster_url" | "hero_image_url",
    kind: "series-poster" | "series-hero",
    selection: ArtworkSelection,
  ) {
    if (!selection.file) {
      return { success: false as const, message: "Select an image first." };
    }

    setMessage(`Preparing ${kind === "series-poster" ? "poster" : "hero"} artwork upload.`);
    const intent = await withTimeout(
      requestArtworkUploadAction(seriesId, kind, selection.file.type || "image/jpeg"),
      `${kind === "series-poster" ? "Poster" : "Hero"} artwork preparation timed out.`,
    );

    if ("error" in intent) {
      return { success: false as const, message: intent.error };
    }

    setMessage(`Uploading ${kind === "series-poster" ? "poster" : "hero"} artwork.`);
    await withTimeout(
      uploadSignedArtworkFile(intent, selection.file),
      `${kind === "series-poster" ? "Poster" : "Hero"} artwork upload timed out.`,
    );

    setMessage(`Saving ${kind === "series-poster" ? "poster" : "hero"} artwork.`);
    const persistResult = await withTimeout(
      persistArtworkAction(seriesId, field, intent.publicUrl),
      `${kind === "series-poster" ? "Poster" : "Hero"} artwork save timed out.`,
    );
    if (!persistResult.success) {
      return { success: false as const, message: persistResult.message ?? "Unable to save artwork." };
    }

    return { success: true as const, publicUrl: intent.publicUrl };
  }

  async function createEpisodeRow(seriesId: string, row: VideoIntakeRow, index: number) {
    if (row.metadataStatus !== "ready" || row.durationSeconds === null) {
      updateRowState(index, {
        error: "Metadata review is not complete for this file.",
        status: "failed",
      });
      return null;
    }

    if (row.episodeId) {
      return row.episodeId;
    }

    updateRowState(index, { error: null, progress: 0, status: "creating" });
    setMessage(`Creating Episode ${row.episodeNumber}.`);
    const result = await withTimeout(
      createEpisodeAction(seriesId, {
        episodeNumber: row.episodeNumber,
        title: row.title,
        durationSeconds: row.durationSeconds,
        defaults: DRAFT_EPISODE_DEFAULTS,
      }),
      `Episode ${row.episodeNumber} creation timed out. Press Continue Upload once before retrying the page.`,
    );

    if (!result.success) {
      updateRowState(index, { error: result.error, status: "failed" });
      return null;
    }

    updateRowState(index, {
      episodeId: result.episode.id,
      error: null,
      status: "waiting",
    });

    return result.episode.id;
  }

  // Shared reconciliation path: reused by the initial upload flow below AND by
  // the processing auto-refresh interval so there is a single source of truth
  // for how a row transitions out of "processing".
  async function reconcileEpisodeMediaStatus(seriesId: string, episodeId: string, mediaAssetId: string, index: number) {
    try {
      const result = await finalizeUploadAction(seriesId, {
        episodeId,
        mediaAssetId,
      });

      if (!result.success) {
        updateRowState(index, {
          error: result.error,
          status: result.mediaStatus === "failed" ? "failed" : "processing",
        });
        return false;
      }

      updateRowState(index, {
        error: null,
        status: result.mediaStatus === "ready" ? "ready" : "processing",
      });

      return result.mediaStatus === "ready";
    } catch (refreshError) {
      updateRowState(index, {
        error: refreshError instanceof Error ? refreshError.message : "Unable to refresh status.",
        status: "failed",
      });
      return false;
    }
  }

  async function uploadEpisodeMedia(seriesId: string, row: VideoIntakeRow, index: number, episodeId: string) {
    let episodeReady = false;

    if (row.mediaAssetId) {
      setMessage(`Verifying Episode ${row.episodeNumber} media ownership.`);
      const attachResult = await withTimeout(
        attachEpisodeMediaUploadIntentAction({
          episodeId,
          mediaAssetId: row.mediaAssetId,
        }),
        `Episode ${row.episodeNumber} media ownership check timed out.`,
      );

      if (!attachResult.success) {
        updateRowState(index, {
          error: attachResult.error,
          status: "failed",
        });
        return false;
      }

      if (row.uploadUrl) {
        updateRowState(index, {
          error: null,
          progress: 0,
          status: "uploading",
          uploadProgress: { loadedBytes: 0, totalBytes: row.file.size, percentage: 0 },
        });

        try {
          await uploadToMux(row.uploadUrl, row.file, (progress) =>
            updateRowState(index, {
              progress: progress.percentage,
              uploadProgress: progress,
            }),
          );
        } catch (uploadError) {
          updateRowState(index, {
            error:
              uploadError instanceof Error ? `Mux browser upload failed: ${uploadError.message}` : "Mux browser upload failed.",
            status: "failed",
          });
          return false;
        }
      }

      updateRowState(index, {
        error: null,
        progress: 100,
        uploadProgress: { loadedBytes: row.file.size, totalBytes: row.file.size, percentage: 100 },
        uploadUrl: null,
        status: "processing",
      });

      episodeReady = await reconcileEpisodeMediaStatus(seriesId, episodeId, row.mediaAssetId, index);

      return episodeReady;
    }

    updateRowState(index, {
      error: null,
      progress: 0,
      status: "creating",
      uploadProgress: null,
    });

    setMessage(`Preparing Episode ${row.episodeNumber} upload.`);
    const intent = await withTimeout(
      requestMediaUploadAction(row.mimeType, window.location.origin),
      `Episode ${row.episodeNumber} upload preparation timed out.`,
    );

    if ("error" in intent) {
      updateRowState(index, {
        error: `Unable to prepare the Mux upload: ${intent.error}`,
        status: "failed",
      });
      return;
    }

    updateRowState(index, {
      mediaAssetId: intent.mediaAssetId,
      uploadUrl: intent.uploadUrl,
    });

    setMessage(`Attaching Episode ${row.episodeNumber} upload before sending video.`);
    const attachResult = await withTimeout(
      attachEpisodeMediaUploadIntentAction({
        episodeId,
        mediaAssetId: intent.mediaAssetId,
      }),
      `Episode ${row.episodeNumber} media attachment timed out.`,
    );

    if (!attachResult.success) {
      updateRowState(index, {
        error: attachResult.error,
        status: "failed",
      });
      return;
    }

    updateRowState(index, {
      error: null,
      progress: 0,
      status: "uploading",
      uploadProgress: { loadedBytes: 0, totalBytes: row.file.size, percentage: 0 },
    });

    try {
      setMessage(`Uploading Episode ${row.episodeNumber}.`);
      await uploadToMux(intent.uploadUrl, row.file, (progress) =>
        updateRowState(index, {
          progress: progress.percentage,
          uploadProgress: progress,
        }),
      );
    } catch (uploadError) {
      updateRowState(index, {
        error:
          uploadError instanceof Error ? `Mux browser upload failed: ${uploadError.message}` : "Mux browser upload failed.",
        status: "failed",
      });
      return;
    }

    updateRowState(index, {
      mediaAssetId: intent.mediaAssetId,
      progress: 100,
      status: "processing",
      uploadProgress: { loadedBytes: row.file.size, totalBytes: row.file.size, percentage: 100 },
      uploadUrl: null,
    });

    setMessage(`Checking Episode ${row.episodeNumber} processing status.`);
    episodeReady = await reconcileEpisodeMediaStatus(seriesId, episodeId, intent.mediaAssetId, index);

    return episodeReady;
  }

  async function uploadSubtitleRow(seriesSlug: string, subtitleRow: SubtitleIntakeRow, index: number) {
    if (!subtitleRow.targetEpisodeNumber) {
      updateSubtitleRow(index, {
        error: "Subtitle must be associated with an episode first.",
        status: "failed",
      });
      return;
    }

    if (subtitleRow.status === "ready" && subtitleRow.subtitleTrackId) {
      return;
    }

    updateSubtitleRow(index, { error: null, progress: 0, status: "uploading" });

    const intent = await requestSubtitleUploadAction({
      closedCaptions: subtitleRow.closedCaptions,
      episodeNumber: subtitleRow.targetEpisodeNumber,
      isDefault: subtitleRow.isDefault,
      label: subtitleRow.label.trim(),
      languageCode: subtitleRow.languageCode.trim(),
      mimeType: subtitleRow.mimeType,
      seriesSlug,
      sourceFormat: subtitleRow.sourceFormat,
    });

    if ("error" in intent) {
      updateSubtitleRow(index, { error: intent.error, status: "failed" });
      return;
    }

    try {
      await uploadSignedArtworkFile(intent, subtitleRow.file);
    } catch (uploadError) {
      updateSubtitleRow(index, {
        error: uploadError instanceof Error ? uploadError.message : "Subtitle upload failed.",
        status: "failed",
      });
      return;
    }

    updateSubtitleRow(index, {
      error: null,
      mediaAssetId: intent.mediaAssetId,
      progress: 100,
      status: "processing",
    });

    const finalizeResult = await finalizeSubtitleUploadAction({
      closedCaptions: subtitleRow.closedCaptions,
      episodeNumber: subtitleRow.targetEpisodeNumber,
      isDefault: subtitleRow.isDefault,
      label: subtitleRow.label.trim(),
      languageCode: subtitleRow.languageCode.trim(),
      mimeType: subtitleRow.mimeType,
      objectPath: intent.objectPath,
      seriesSlug,
      sourceFormat: subtitleRow.sourceFormat,
    });

    if (!finalizeResult.success) {
      updateSubtitleRow(index, {
        error: finalizeResult.error,
        status: "failed",
      });
      return;
    }

    updateSubtitleRow(index, {
      error: null,
      progress: 100,
      status: finalizeResult.status,
      subtitleTrackId: finalizeResult.subtitleTrackId,
    });
  }

  async function uploadSubtitleRowsForEpisode(seriesSlug: string, episodeNumber: number) {
    const indexes = subtitleRows
      .map((row, index) => ({ index, row }))
      .filter(({ row }) => row.targetEpisodeNumber === episodeNumber && row.status !== "ready");

    for (const entry of indexes) {
      await uploadSubtitleRow(seriesSlug, entry.row, entry.index);
    }
  }

  async function runWorkflow() {
    if (isRunning || isPreparingFiles) {
      return;
    }

    setHasAttemptedSubmit(true);
    setSeriesErrors({});
    setError(null);
    setMessage(null);

    const currentSeriesErrors = validateSeriesInput(seriesValues);

    if (validationMessages.length > 0 || rows.length === 0 || rows.some((row) => row.metadataStatus !== "ready") || duplicateEpisodeNumbers.size > 0 || !posterSelection.file || Object.keys(currentSeriesErrors).length > 0) {
      setSeriesErrors(currentSeriesErrors);
      setError("Fix the highlighted issues before creating the series.");
      return;
    }

    setIsRunning(true);

    try {
      let currentSeriesId = seriesCreatedId;
      let currentSeriesSlug = seriesCreatedSlug;
      let draftAlreadyHasHero = false;
      let draftAlreadyHasPoster = false;

      if (!currentSeriesId) {
        const createResult = await createSeriesDraftAction(buildSeriesInput(seriesValues));

        if (!createResult.success) {
          setSeriesErrors(toErrorRecord(createResult.errors));
          setError("Unable to create series.");
          return;
        }

        currentSeriesId = createResult.series.id;
        currentSeriesSlug = createResult.series.slug;
        draftAlreadyHasHero = Boolean(createResult.series.hero_image_url);
        draftAlreadyHasPoster = Boolean(createResult.series.poster_url);
        setSeriesCreatedId(currentSeriesId);
        setSeriesCreatedSlug(currentSeriesSlug);
        if (draftAlreadyHasPoster) {
          setPosterSelection((current) => ({ ...current, uploaded: true }));
        }
        if (usePosterAsHero || draftAlreadyHasHero) {
          setHeroSelection((current) => ({ ...current, uploaded: true }));
        }
        setMessage("Series created. Configure episodes next.");
      }

      if (currentSeriesId && posterSelection.file && !posterSelection.uploaded && !draftAlreadyHasPoster) {
        const posterUpload = await uploadArtwork(currentSeriesId, "poster_url", "series-poster", posterSelection);
        if (!posterUpload.success) {
          setError(posterUpload.message);
          return;
        }

        setPosterSelection((current) => ({ ...current, uploaded: true }));
        if (usePosterAsHero) {
          setHeroSelection({ file: null, previewUrl: null, uploaded: true });
        }
      }

      if (currentSeriesId && !usePosterAsHero && heroSelection.file && !heroSelection.uploaded && !draftAlreadyHasHero) {
        const heroUpload = await uploadArtwork(currentSeriesId, "hero_image_url", "series-hero", heroSelection);
        if (!heroUpload.success) {
          setError(heroUpload.message);
          return;
        }

        setHeroSelection((current) => ({ ...current, uploaded: true }));
      }

      if (!currentSeriesId) {
        setError("Series ID missing after creation.");
        return;
      }

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row || row.status === "ready") {
          if (row && currentSeriesSlug) {
            await uploadSubtitleRowsForEpisode(currentSeriesSlug, row.episodeNumber);
          }
          continue;
        }

        const episodeId = await createEpisodeRow(currentSeriesId, row, index);
        if (!episodeId) {
          continue;
        }

        const episodeReady = await uploadEpisodeMedia(currentSeriesId, row, index, episodeId);

        if (episodeReady && currentSeriesSlug) {
          await uploadSubtitleRowsForEpisode(currentSeriesSlug, row.episodeNumber);
        }
      }

      setMessage(
        currentSeriesSlug
          ? `Series ${currentSeriesSlug} is ready. Configure episodes next.`
          : "Series is ready for review.",
      );
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Upload workflow stopped unexpectedly.");
    } finally {
      setIsRunning(false);
    }
  }

  // Keep a resume path after the draft series is created but episode uploads
  // have not started yet, for example after an interrupted artwork step.
  const submitLabel = !seriesCreatedId
    ? rows.length > 0
      ? `CREATE SERIES & UPLOAD ${rows.length} EPISODES`
      : "CREATE SERIES & UPLOAD"
    : hasWaitingRows
      ? "CONTINUE UPLOAD"
    : "RETRY FAILED";

  const seriesEditHref = seriesCreatedId ? seriesEditPath(seriesCreatedId) : null;
  const showRetryButton = !seriesCreatedId || hasFailedRows || hasWaitingRows;
  const showConfigureEpisodesPrimary = Boolean(seriesCreatedId) && !hasFailedRows && !hasProcessingRows && !hasWaitingRows && allRowsReady;

  return (
    <div className="space-y-8">
      <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
        <div className="space-y-1">
          <p className={labelClassName}>Select episode videos</p>
          <p className="text-sm text-bone/60">
            Pick a folder or pick files. The batch stays local until you confirm the full series setup.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Button type="button" onClick={() => folderInputRef.current?.click()} disabled={isRunning || isPreparingFiles}>
              SELECT EPISODE FOLDER
            </Button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              /* @ts-expect-error webkitdirectory is a non-standard browser attribute */
              webkitdirectory=""
              accept="video/*"
              onChange={handleFolderSelect}
              disabled={isRunning || isPreparingFiles}
            />
          </div>

          <div className="space-y-2">
            <Button type="button" onClick={() => filesInputRef.current?.click()} disabled={isRunning || isPreparingFiles}>
              SELECT VIDEO FILES
            </Button>
            <input
              ref={filesInputRef}
              type="file"
              multiple
              className="hidden"
              accept="video/*"
              onChange={handleFilesSelect}
              disabled={isRunning || isPreparingFiles}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className={labelClassName}>Selection summary</p>
            <p className="text-sm text-bone/70">
              {rows.length > 0 ? `${rows.length} supported video file(s) selected.` : "No videos selected yet."}
            </p>
            {ignoredFiles > 0 && <p className="text-xs text-bone/45">Ignored {ignoredFiles} non-video file(s).</p>}
          </div>

          {showFallbackNumbering && (
            <label className="block space-y-1.5">
              <span className={labelClassName}>Numbering needs review</span>
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
          )}
        </div>

        {rows.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {hasClearEpisodeNumbers ? (
              <div className="space-y-2">
                <p className={labelClassName}>Detected numbering</p>
                <p className="text-sm text-bone/70">Filenames already identify the episode numbers.</p>
                <div className="flex flex-wrap gap-2">
                  {rows.map((row) => (
                    <span
                      key={row.clientId}
                      className="rounded border border-bone/15 bg-bone/[0.03] px-2 py-1 text-xs text-bone/75"
                    >
                      Episode {row.episodeNumber}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-bone/45">Edit any row in the review table below to override numbering.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className={labelClassName}>Numbering needs review</p>
                <p className="text-sm text-bone/70">Use the fallback control above to propose sequential numbering.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Review episodes</p>
            <p className="text-sm text-bone/60">
              Confirm episode mapping, titles, duration, resolution, and remove or retry any unreadable file.
            </p>
          </div>

          <div className="space-y-2 border border-bone/10 bg-bone/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                  {uploadInProgress ? "Upload in progress — do not close this page" : uploadComplete ? "Upload complete" : "Batch ready"}
                </p>
                <p className="text-sm text-bone/70">
                  {uploadSummary.readyUploads} ready · {uploadSummary.processingUploads} processing · {uploadSummary.failedUploads} failed
                </p>
              </div>
              <div className="text-right text-xs text-bone/60">
                <div>{formatUploadProgressBytes({ loadedBytes: uploadSummary.loadedBytes, totalBytes: uploadSummary.totalBytes, percentage: uploadSummary.percentage })}</div>
                <div>{uploadSummary.percentage}%</div>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden bg-bone/10">
              <div className="h-full bg-teal transition-all" style={{ width: `${uploadSummary.percentage}%` }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[0.65rem] uppercase tracking-[0.18em] text-bone/45">
                <tr>
                  <th className="py-2 pr-3">Episode</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Duration</th>
                  <th className="py-2 pr-3">Resolution</th>
                  <th className="py-2 pr-3">Ratio</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.clientId} className="border-t border-bone/10 align-top">
                    <td className="py-3 pr-3">
                      <input
                        className={inputClassName}
                        type="number"
                        min={1}
                        value={row.episodeNumber}
                        onChange={(event) => {
                          const episodeNumber = Math.max(1, Number(event.target.value) || 1);
                          updateRowState(index, {
                            episodeNumber,
                            title: row.titleEdited ? row.title : `Episode ${episodeNumber}`,
                          });
                        }}
                        disabled={isRunning || isPreparingFiles}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        className={inputClassName}
                        value={row.title}
                        onChange={(event) =>
                          updateRowState(index, { title: event.target.value, titleEdited: true })
                        }
                        disabled={isRunning || isPreparingFiles}
                      />
                    </td>
                    <td className="py-3 pr-3 text-xs text-bone/70">
                      <div>{row.fileName}</div>
                      {row.relativePath && row.relativePath !== row.fileName && (
                        <div className="mt-1 text-bone/45">{row.relativePath}</div>
                      )}
                    </td>
                    <td className="py-3 pr-3">{row.durationSeconds === null ? "—" : formatDuration(row.durationSeconds)}</td>
                    <td className="py-3 pr-3">{row.resolutionLabel}</td>
                    <td className="py-3 pr-3">
                      <div>{row.aspectRatioLabel}</div>
                      {row.aspectRatioWarning && <div className="text-xs text-amber-300">{row.aspectRatioWarning}</div>}
                    </td>
                    <td className="py-3 pr-3">{row.fileSizeLabel}</td>
                    <td className="py-3 pr-3 text-xs">
                      {row.status === "uploading" && row.uploadProgress ? (
                        <div className="space-y-1">
                          <div className="font-mono uppercase tracking-[0.14em] text-teal">
                            Uploading {row.uploadProgress.percentage}%
                          </div>
                          <div className="text-bone/60">
                            {formatUploadProgressBytes(row.uploadProgress)}
                          </div>
                          <div className="h-1.5 overflow-hidden bg-bone/10">
                            <div className="h-full bg-teal transition-all" style={{ width: `${row.uploadProgress.percentage}%` }} />
                          </div>
                        </div>
                      ) : row.status === "processing" && row.uploadProgress ? (
                        <div className="space-y-1">
                          <div className="font-mono uppercase tracking-[0.14em] text-bone/50">Processing</div>
                          <div className="text-bone/60">
                            {formatUploadProgressBytes(row.uploadProgress)}
                          </div>
                        </div>
                      ) : row.status === "failed" && row.uploadProgress ? (
                        <div className="space-y-1">
                          <div className="font-mono uppercase tracking-[0.14em] text-red-400">
                            Failed at {row.uploadProgress.percentage}%
                          </div>
                          <div className="text-bone/60">
                            {formatUploadProgressBytes(row.uploadProgress)}
                          </div>
                        </div>
                      ) : row.metadataStatus === "ready" ? (
                        <span className="text-teal">Ready</span>
                      ) : row.metadataStatus === "failed" ? (
                        <span className="text-red-400">{row.metadataError ?? "Needs review"}</span>
                      ) : (
                        <span className="text-bone/50">Pending</span>
                      )}
                      {row.error && <div className="mt-1 text-red-400">{row.error}</div>}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        {row.metadataStatus === "failed" && (
                          <button
                            type="button"
                            className="text-xs text-teal"
                            onClick={() => retryMetadataRow(row, index)}
                            disabled={isRunning || isPreparingFiles}
                          >
                            Retry
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs text-red-300"
                          onClick={() => removeRow(index)}
                          disabled={isRunning || isPreparingFiles}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Subtitle tracks</p>
            <p className="text-sm text-bone/60">
              Optional subtitle files can be mapped to episodes and uploaded with the media-first batch.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Button type="button" onClick={() => subtitleFolderInputRef.current?.click()} disabled={isRunning || isPreparingSubtitleFiles}>
                SELECT SUBTITLE FOLDER
              </Button>
              <input
                ref={subtitleFolderInputRef}
                type="file"
                multiple
                className="hidden"
                /* @ts-expect-error webkitdirectory is a non-standard browser attribute */
                webkitdirectory=""
                accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain"
                onChange={handleSubtitleFolderSelect}
                disabled={isRunning || isPreparingSubtitleFiles}
              />
            </div>

            <div className="space-y-2">
              <Button type="button" onClick={() => subtitleFilesInputRef.current?.click()} disabled={isRunning || isPreparingSubtitleFiles}>
                SELECT SUBTITLE FILES
              </Button>
              <input
                ref={subtitleFilesInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain"
                onChange={handleSubtitleFilesSelect}
                disabled={isRunning || isPreparingSubtitleFiles}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className={labelClassName}>Selection summary</p>
              <p className="text-sm text-bone/70">
                {subtitleRows.length > 0 ? `${subtitleRows.length} supported subtitle file(s) selected.` : "No subtitle files selected yet."}
              </p>
              {ignoredSubtitleFiles > 0 && (
                <p className="text-xs text-bone/45">Ignored {ignoredSubtitleFiles} non-subtitle file(s).</p>
              )}
            </div>
          </div>

          {subtitleRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[0.65rem] uppercase tracking-[0.18em] text-bone/45">
                  <tr>
                    <th className="py-2 pr-3">File</th>
                    <th className="py-2 pr-3">Episode</th>
                    <th className="py-2 pr-3">Language</th>
                    <th className="py-2 pr-3">Label</th>
                    <th className="py-2 pr-3">Default</th>
                    <th className="py-2 pr-3">CC</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subtitleRows.map((subtitleRow, index) => (
                    <tr key={subtitleRow.clientId} className="border-t border-bone/10 align-top">
                      <td className="py-3 pr-3 text-xs text-bone/70">
                        <div>{subtitleRow.fileName}</div>
                        {subtitleRow.relativePath && subtitleRow.relativePath !== subtitleRow.fileName && (
                          <div className="mt-1 text-bone/45">{subtitleRow.relativePath}</div>
                        )}
                        <div className="mt-1 text-bone/45">{subtitleRow.fileSizeLabel}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <CmsSelect
                          className={inputClassName}
                          value={String(subtitleRow.targetEpisodeNumber ?? "")}
                          onChange={(newValue) =>
                            updateSubtitleRow(index, {
                              targetEpisodeNumber: newValue ? Math.max(1, Number(newValue) || 1) : null,
                            })
                          }
                          disabled={isRunning || isPreparingSubtitleFiles}
                          placeholderLabel="Select episode"
                          options={[
                            { label: "Select episode", value: "" },
                            ...Array.from(new Set(rows.map((row) => row.episodeNumber)))
                              .sort((left, right) => left - right)
                              .map((episodeNumber) => ({
                                label: formatSubtitleTargetLabel(episodeNumber, index),
                                value: String(episodeNumber),
                              })),
                          ]}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          className={inputClassName}
                          value={subtitleRow.languageCode}
                          onChange={(event) =>
                            updateSubtitleRow(index, {
                              languageCode: event.target.value.toLowerCase(),
                              label:
                                subtitleRow.titleEdited || subtitleRow.label.trim()
                                  ? subtitleRow.label
                                  : event.target.value.trim().toLowerCase() || subtitleRow.label,
                            })
                          }
                          placeholder="en"
                          disabled={isRunning || isPreparingSubtitleFiles}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          className={inputClassName}
                          value={subtitleRow.label}
                          onChange={(event) => updateSubtitleRow(index, { label: event.target.value, titleEdited: true })}
                          disabled={isRunning || isPreparingSubtitleFiles}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <label className="inline-flex items-center gap-2 text-xs text-bone/80">
                          <input
                            type="checkbox"
                            checked={subtitleRow.isDefault}
                            onChange={(event) => updateSubtitleRow(index, { isDefault: event.target.checked })}
                            className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                            disabled={isRunning || isPreparingSubtitleFiles}
                          />
                          Default
                        </label>
                      </td>
                      <td className="py-3 pr-3">
                        <label className="inline-flex items-center gap-2 text-xs text-bone/80">
                          <input
                            type="checkbox"
                            checked={subtitleRow.closedCaptions}
                            onChange={(event) => updateSubtitleRow(index, { closedCaptions: event.target.checked })}
                            className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                            disabled={isRunning || isPreparingSubtitleFiles}
                          />
                          CC
                        </label>
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {subtitleRow.status === "ready" ? (
                          <span className="text-teal">Ready</span>
                        ) : subtitleRow.status === "failed" ? (
                          <span className="text-red-400">{subtitleRow.error ?? "Needs review"}</span>
                        ) : subtitleRow.status === "processing" || subtitleRow.status === "uploading" ? (
                          <span className="text-bone/50">Uploading</span>
                        ) : (
                          <span className="text-bone/50">Pending</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          className="text-xs text-red-300"
                          onClick={() => removeSubtitleRow(index)}
                          disabled={isRunning || isPreparingSubtitleFiles}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Series details</p>
            <p className="text-sm text-bone/60">Fill these after inspecting the selected episodes.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Title</span>
              <input
                className={inputClassName}
                value={seriesValues.title}
                onChange={(event) => {
                  const value = event.target.value;
                  handleSeriesTitleChange(value);
                }}
                disabled={isRunning}
              />
              {hasAttemptedSubmit && seriesErrors.title && <span className="text-xs text-red-400">{seriesErrors.title}</span>}
            </label>

            <label className="block space-y-1.5">
              <span className={labelClassName}>Slug</span>
              <input
                className={inputClassName}
                value={seriesValues.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                disabled={isRunning}
              />
              {hasAttemptedSubmit && seriesErrors.slug && <span className="text-xs text-red-400">{seriesErrors.slug}</span>}
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className={labelClassName}>Synopsis</span>
            <textarea
              className={inputClassName}
              rows={3}
              value={seriesValues.synopsis}
              onChange={(event) => handleSeriesField("synopsis", event.target.value)}
              disabled={isRunning}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Genre</span>
              <CmsSelect
                className={inputClassName}
                value={seriesValues.genre}
                onChange={(newValue) => handleSeriesField("genre", newValue)}
                disabled={isRunning}
                placeholderLabel="Unset"
                options={[
                  { label: "Unset", value: "" },
                  ...CANONICAL_GENRES.map((genre) => ({ label: genre.displayName, value: genre.id })),
                ]}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClassName}>Language</span>
              <input className={inputClassName} value={seriesValues.language} onChange={(event) => handleSeriesField("language", event.target.value)} disabled={isRunning} />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClassName}>Format</span>
              <CmsSelect
                className={inputClassName}
                value={seriesValues.format}
                onChange={(newValue) => handleSeriesField("format", newValue)}
                disabled={isRunning}
                placeholderLabel="Unset"
                options={[
                  { label: "Unset", value: "" },
                  ...["Series", "Mini", "Short"].map((format) => ({ label: format, value: format })),
                ]}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Episode duration label</span>
              <input
                className={inputClassName}
                value={seriesValues.episodeDurationLabel}
                onChange={(event) => handleSeriesField("episodeDurationLabel", event.target.value)}
                placeholder="e.g. 1:10–1:25"
                disabled={isRunning}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClassName}>Episode count</span>
              <div className="rounded border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone">
                {seriesValues.episodeCount}
              </div>
            </label>
            <label className="block space-y-1.5">
              <span className={labelClassName}>Sort order</span>
              <input className={inputClassName} type="number" value={seriesValues.sortOrder} onChange={(event) => handleSeriesField("sortOrder", event.target.value)} disabled={isRunning} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Content rating</span>
              <CmsSelect
                className={inputClassName}
                value={seriesValues.contentRating}
                onChange={(newValue) => handleSeriesField("contentRating", newValue as ContentRating | "")}
                disabled={isRunning}
                placeholderLabel="Unrated"
                options={[
                  { label: "Unrated", value: "" },
                  ...CONTENT_RATINGS.map((rating) => ({ label: rating, value: rating })),
                ]}
              />
            </label>

            <label className="flex items-center gap-2 self-end pb-2 text-sm text-bone/80">
              <input
                type="checkbox"
                checked={seriesValues.featured}
                onChange={(event) => handleSeriesField("featured", event.target.checked)}
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                disabled={isRunning}
              />
              Featured
            </label>
          </div>

          <fieldset>
            <legend className={labelClassName}>Content descriptors</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {CONTENT_DESCRIPTORS.map((descriptor) => (
                <label key={descriptor} className="flex items-center gap-2 text-sm text-bone/80">
                  <input
                    type="checkbox"
                    checked={seriesValues.contentDescriptors.includes(descriptor)}
                    onChange={() => toggleDescriptor(descriptor)}
                    className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                    disabled={isRunning}
                  />
                  {descriptor}
                </label>
              ))}
            </div>
            {hasAttemptedSubmit && seriesErrors.contentDescriptors && (
              <p className="mt-1 text-xs text-red-400">{seriesErrors.contentDescriptors}</p>
            )}
          </fieldset>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Artwork</p>
            <p className="text-sm text-bone/60">Select a poster first. Use the same poster as hero unless you need a separate hero image.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <p className={labelClassName}>Poster</p>
              {posterPreviewUrl ? (
                <img src={posterPreviewUrl} alt="" className="h-40 w-28 border border-bone/10 object-cover" />
              ) : (
                <div className="flex h-40 w-28 items-center justify-center border border-dashed border-bone/15 text-[0.6rem] text-bone/40">No image</div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  setPosterSelection({ file, previewUrl: null, uploaded: false });
                  if (usePosterAsHero) {
                    setHeroSelection({ file: null, previewUrl: null, uploaded: false });
                  }
                }}
                disabled={isRunning}
                className="block w-full text-xs text-bone/70 file:mr-3 file:border file:border-bone/15 file:bg-bone/[0.03] file:px-3 file:py-1.5 file:text-[0.65rem] file:uppercase file:tracking-[0.14em] file:text-bone/80"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-bone/80">
                <input
                  type="checkbox"
                  checked={usePosterAsHero}
                  onChange={(event) => {
                    setUsePosterAsHero(event.target.checked);
                    if (event.target.checked) {
                      setHeroSelection({ file: null, previewUrl: null, uploaded: false });
                    }
                  }}
                  className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                  disabled={isRunning}
                />
                Use poster as hero
              </label>

              {!usePosterAsHero && (
                <>
                  {heroPreviewUrl ? (
                    <img src={heroPreviewUrl} alt="" className="h-40 w-28 border border-bone/10 object-cover" />
                  ) : (
                    <div className="flex h-40 w-28 items-center justify-center border border-dashed border-bone/15 text-[0.6rem] text-bone/40">No image</div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      setHeroSelection({ file, previewUrl: null, uploaded: false });
                    }}
                    disabled={isRunning}
                    className="block w-full text-xs text-bone/70 file:mr-3 file:border file:border-bone/15 file:bg-bone/[0.03] file:px-3 file:py-1.5 file:text-[0.65rem] file:uppercase file:tracking-[0.14em] file:text-bone/80"
                  />
                </>
              )}
            </div>
          </div>
        </section>
      )}
      {validationMessages.length > 0 && (
        <section className="space-y-2 border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-amber-200/80">Review checklist</p>
          <ul className="list-disc space-y-1 pl-5">
            {validationMessages.map((validationMessage) => (
              <li key={validationMessage}>{validationMessage}</li>
            ))}
          </ul>
        </section>
      )}

      {seriesCreatedId && (
        <section className="space-y-2 border border-teal/20 bg-teal/5 p-4 text-sm text-bone/80">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-teal">
            {hasFailedRows ? "Action needed" : allRowsReady ? "Upload complete" : "Upload complete — processing"}
          </p>
          <p>
            Draft series{seriesCreatedSlug ? ` “${seriesCreatedSlug}”` : ""} is ready.
            {seriesEditHref && (
              <>
                {" "}
                <Link href={seriesEditHref} className="text-teal">
                  Configure episodes
                </Link>
              </>
            )}
          </p>
          <p className="text-xs text-bone/50">
            {rowCounts.ready} ready · {rowCounts.processing} processing · {rowCounts.failed} failed
          </p>
        </section>
      )}

      <div className="space-y-3">
        {showRetryButton ? (
          <Button type="button" onClick={runWorkflow} disabled={isPreparingFiles || isRunning || rows.length === 0}>
            {isRunning ? "Working…" : submitLabel}
          </Button>
        ) : showConfigureEpisodesPrimary && seriesEditHref ? (
          <ButtonLink href={seriesEditHref}>Configure episodes</ButtonLink>
        ) : hasProcessingRows ? (
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            {rowCounts.processing} {rowCounts.processing === 1 ? "episode" : "episodes"} still processing on Mux —
            refreshing automatically…
          </p>
        ) : null}
        {message && <p className="text-sm text-teal">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {rows.some((row) => row.relativePath && row.relativePath.includes("/")) && (
          <p className="text-xs text-bone/45">
            Nested folder paths are preserved for review so unrelated files can be removed before upload.
          </p>
        )}
        {seriesCreatedId && (
          <p className="text-xs text-bone/45">Use the linked edit page to make follow-up CMS changes after review.</p>
        )}
      </div>
    </div>
  );
}
