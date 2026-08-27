"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS, type ContentDescriptor, type ContentRating } from "@/lib/classification";
import { shortFilmEditPath } from "@/lib/routes";
import {
  buildSlugFromTitle,
  formatDuration,
  formatFileSize,
  probeVideoMetadata,
} from "@/lib/cms/video-intake";
import {
  createUploadProgressState,
  formatUploadProgressBytes,
  type UploadProgressState,
} from "@/lib/cms/upload-progress";
import {
  buildSubtitleIntakeRows,
  filterSupportedSubtitleFiles,
  type SubtitleIntakeRow,
} from "@/lib/cms/subtitle-intake";
import type { MediaUploadIntent } from "@/components/cms/MediaDirectUploadField";
import type { SubtitleUploadIntent } from "@/lib/subtitles";

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

type ShortFilmCreateInput = {
  title: string;
  slug: string;
  synopsis: string | null;
  posterUrl: string | null;
  heroImageUrl: string | null;
  creatorReference: string | null;
  durationSeconds: number;
  language: string | null;
  contentRating: ContentRating | null;
  contentDescriptors: ContentDescriptor[];
  status: "draft";
  publishAt: string | null;
  midrollEnabled: boolean;
  midrollTimecodes: number[];
  postrollEnabled: boolean;
  chaiEnabled: boolean;
};

type ShortFilmCreateResult =
  | { success: true; shortFilm: { id: string; slug: string } }
  | { success: false; errors: Array<{ field: string; message: string }> };

type ShortFilmMediaFinalizeResult =
  | { success: true; assigned: boolean; shortFilmId: string; mediaAssetId: string; mediaStatus: "pending" | "processing" | "ready" | "failed" }
  | { success: false; error: string; mediaStatus?: "pending" | "processing" | "ready" | "failed" | "not_found" };

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

type ShortFilmIntakeFormProps = {
  createShortFilmDraftAction: (input: ShortFilmCreateInput) => Promise<ShortFilmCreateResult>;
  finalizeUploadAction: (shortFilmId: string, input: { mediaAssetId: string }) => Promise<ShortFilmMediaFinalizeResult>;
  requestSubtitleUploadAction: (
    input: {
      closedCaptions: boolean;
      isDefault: boolean;
      label: string;
      languageCode: string;
      mimeType: string;
      shortFilmSlug: string;
      sourceFormat: "srt" | "vtt";
    },
  ) => Promise<SubtitleUploadIntent | { error: string }>;
  finalizeSubtitleUploadAction: (
    input: {
      closedCaptions: boolean;
      isDefault: boolean;
      label: string;
      languageCode: string;
      mimeType: string;
      objectPath: string;
      shortFilmSlug: string;
      sourceFormat: "srt" | "vtt";
    },
  ) => Promise<SubtitleCreateResult>;
  persistArtworkAction: (
    shortFilmId: string,
    field: "poster_url" | "hero_image_url",
    publicUrl: string,
  ) => Promise<{ success: boolean; message?: string }>;
  requestArtworkUploadAction: (
    shortFilmId: string,
    kind: "short-film-poster" | "short-film-hero",
    mimeType: string,
  ) => Promise<ArtworkUploadIntent | { error: string }>;
  requestMediaUploadAction: (
    mimeType: string,
    corsOrigin?: string | null,
  ) => Promise<MediaUploadIntent | { error: string }>;
  allowedCoinAmountsSummary: string;
};

type ShortFilmValues = {
  title: string;
  slug: string;
  synopsis: string;
  creatorReference: string;
  durationSeconds: string;
  language: string;
  contentRating: ContentRating | "";
  contentDescriptors: ContentDescriptor[];
  publishAt: string;
  midrollEnabled: boolean;
  midrollTimecodes: string;
  postrollEnabled: boolean;
  chaiEnabled: boolean;
};

type FileSelection = {
  file: File | null;
  uploaded: boolean;
};

const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";
const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [color-scheme:dark]";

function toErrorRecord(errors: Array<{ field: string; message: string }>) {
  const record: Record<string, string> = {};

  for (const error of errors) {
    if (!record[error.field]) {
      record[error.field] = error.message;
    }
  }

  return record;
}

function parseMidrollTimecodes(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.trunc(item));
}

function buildShortFilmInput(values: ShortFilmValues, durationSeconds: number): ShortFilmCreateInput {
  const parsedDurationSeconds = Number(values.durationSeconds);
  const resolvedDurationSeconds =
    values.durationSeconds.trim() && Number.isFinite(parsedDurationSeconds)
      ? Math.max(0, Math.trunc(parsedDurationSeconds))
      : durationSeconds;

  return {
    title: values.title.trim(),
    slug: values.slug.trim().toLowerCase(),
    synopsis: values.synopsis.trim() ? values.synopsis.trim() : null,
    posterUrl: null,
    heroImageUrl: null,
    creatorReference: values.creatorReference.trim() ? values.creatorReference.trim() : null,
    durationSeconds: resolvedDurationSeconds,
    language: values.language.trim() ? values.language.trim() : null,
    contentRating: values.contentRating || null,
    contentDescriptors: values.contentDescriptors,
    status: "draft",
    publishAt: values.publishAt.trim() ? values.publishAt.trim() : null,
    midrollEnabled: values.midrollEnabled,
    midrollTimecodes: parseMidrollTimecodes(values.midrollTimecodes),
    postrollEnabled: values.postrollEnabled,
    chaiEnabled: values.chaiEnabled,
  };
}

function validateShortFilmValues(values: ShortFilmValues, durationSeconds: number | null, hasVideo: boolean, posterFile: File | null, heroFile: File | null, usePosterAsHero: boolean) {
  const errors: Record<string, string> = {};

  if (!values.title.trim()) {
    errors.title = "Title is required.";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim().toLowerCase())) {
    errors.slug = "Slug must be lowercase letters, numbers, and hyphens only.";
  }

  if (!hasVideo) {
    errors.video = "Choose a video file first.";
  }

  if (durationSeconds === null) {
    errors.durationSeconds = "Video metadata must be readable before upload.";
  }

  if (!posterFile) {
    errors.poster = "Choose a poster before creating the short film.";
  }

  if (!usePosterAsHero && !heroFile) {
    errors.hero = "Choose a hero image or use the poster as hero.";
  }

  if (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds < 0)) {
    errors.durationSeconds = "Runtime must be a positive whole number.";
  }

  if (values.durationSeconds.trim()) {
    const parsedDurationSeconds = Number(values.durationSeconds);
    if (!Number.isInteger(parsedDurationSeconds) || parsedDurationSeconds < 0) {
      errors.durationSeconds = "Runtime must be a positive whole number.";
    }
  }

  if (values.contentRating && !CONTENT_RATINGS.includes(values.contentRating)) {
    errors.contentRating = "Unsupported content rating.";
  }

  for (const descriptor of values.contentDescriptors) {
    if (!CONTENT_DESCRIPTORS.includes(descriptor)) {
      errors.contentDescriptors = `Unsupported content descriptor: ${descriptor}.`;
      break;
    }
  }

  if (values.publishAt.trim()) {
    const parsed = Date.parse(values.publishAt.trim());
    if (Number.isNaN(parsed)) {
      errors.publishAt = "Publish at must be a valid date and time.";
    }
  }

  for (const timecode of parseMidrollTimecodes(values.midrollTimecodes)) {
    if (!Number.isInteger(timecode) || timecode < 0) {
      errors.midrollTimecodes = "Mid-roll timecodes must be zero or positive whole numbers.";
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
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return previewUrl;
}

async function uploadSignedArtworkFile(intent: SignedUploadIntent, file: File) {
  const supabase = createClient();
  const { error } = await supabase.storage.from(intent.bucket).uploadToSignedUrl(intent.objectPath, intent.token, file);

  if (error) {
    throw new Error("Upload failed. Try again.");
  }
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

export function NewShortFilmIntakeForm({
  createShortFilmDraftAction,
  finalizeUploadAction,
  requestSubtitleUploadAction,
  finalizeSubtitleUploadAction,
  persistArtworkAction,
  requestArtworkUploadAction,
  requestMediaUploadAction,
  allowedCoinAmountsSummary,
}: ShortFilmIntakeFormProps) {
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleFilesInputRef = useRef<HTMLInputElement | null>(null);
  const [video, setVideo] = useState<FileSelection>({ file: null, uploaded: false });
  const [subtitleRows, setSubtitleRows] = useState<SubtitleIntakeRow[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPreparingSubtitles, setIsPreparingSubtitles] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shortFilmId, setShortFilmId] = useState<string | null>(null);
  const [shortFilmSlug, setShortFilmSlug] = useState<string | null>(null);
  const [videoMediaAssetId, setVideoMediaAssetId] = useState<string | null>(null);
  const [ignoredSubtitleFiles, setIgnoredSubtitleFiles] = useState(0);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [posterUploaded, setPosterUploaded] = useState(false);
  const [heroUploaded, setHeroUploaded] = useState(false);
  const [usePosterAsHero, setUsePosterAsHero] = useState(true);
  const [videoMetadataStatus, setVideoMetadataStatus] = useState<"pending" | "ready" | "failed">("pending");
  const [videoMetadataError, setVideoMetadataError] = useState<string | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [videoWidth, setVideoWidth] = useState<number | null>(null);
  const [videoHeight, setVideoHeight] = useState<number | null>(null);
  const [videoOrientationLabel, setVideoOrientationLabel] = useState<string>("—");
  const [videoAspectRatioLabel, setVideoAspectRatioLabel] = useState<string>("—");
  const [videoAspectRatioWarning, setVideoAspectRatioWarning] = useState<string | null>(null);
  const [videoResolutionLabel, setVideoResolutionLabel] = useState<string>("—");
  const [videoSizeLabel, setVideoSizeLabel] = useState<string>("—");
  const [videoFileName, setVideoFileName] = useState<string>("—");
  const [videoMimeType, setVideoMimeType] = useState<string>("video/*");
  const [videoUploadProgress, setVideoUploadProgress] = useState<UploadProgressState | null>(null);
  const [videoUploadStatus, setVideoUploadStatus] = useState<"idle" | "uploading" | "processing" | "ready" | "failed">("idle");
  const videoPollTickRef = useRef<() => void>(() => {});
  const videoPollBusyRef = useRef(false);
  const [values, setValues] = useState<ShortFilmValues>({
    title: "",
    slug: "",
    synopsis: "",
    creatorReference: "",
    durationSeconds: "",
    language: "",
    contentRating: "",
    contentDescriptors: [],
    publishAt: "",
    midrollEnabled: false,
    midrollTimecodes: "",
    postrollEnabled: false,
    chaiEnabled: false,
  });
  const posterPreviewUrl = usePreviewUrl(posterFile);
  const heroPreviewUrl = usePreviewUrl(heroFile);

  useEffect(() => {
    if (!values.title.trim()) {
      return;
    }

    if (!values.slug.trim() || values.slug === buildSlugFromTitle(values.title)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Keeps the draft slug in sync until the editor overrides it.
      setValues((current) => ({ ...current, slug: buildSlugFromTitle(values.title) }));
    }
  }, [values.title]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleValue<K extends keyof ShortFilmValues>(field: K, value: ShortFilmValues[K]) {
    setError(null);
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsPreparing(true);
    setError(null);
    setMessage(null);
    setVideoMetadataStatus("pending");
    setVideoMetadataError(null);
    setSubtitleRows([]);
    setIgnoredSubtitleFiles(0);
    setVideoMediaAssetId(null);
    setVideoUploadProgress(null);
    setVideoUploadStatus("idle");

    setVideo({ file, uploaded: false });
    setVideoFileName(file.name);
    setVideoSizeLabel(formatFileSize(file.size));
    setVideoMimeType(file.type || "video/*");

    const metadata = await probeVideoMetadata(file);

    if (metadata.durationSeconds === null || metadata.videoWidth === null || metadata.videoHeight === null) {
      setVideoMetadataStatus("failed");
      setVideoMetadataError("Unable to read video metadata from this file.");
      setVideoDurationSeconds(null);
      setVideoWidth(metadata.videoWidth);
      setVideoHeight(metadata.videoHeight);
      setVideoResolutionLabel(metadata.resolutionLabel);
      setVideoOrientationLabel(metadata.orientationLabel);
      setVideoAspectRatioLabel(metadata.aspectRatioLabel);
      setVideoAspectRatioWarning(metadata.aspectRatioWarning);
      setIsPreparing(false);
      return;
    }

    setVideoMetadataStatus("ready");
    setVideoMetadataError(null);
    setVideoDurationSeconds(metadata.durationSeconds);
    setVideoWidth(metadata.videoWidth);
    setVideoHeight(metadata.videoHeight);
    setVideoResolutionLabel(metadata.resolutionLabel);
    setVideoOrientationLabel(metadata.orientationLabel);
    setVideoAspectRatioLabel(metadata.aspectRatioLabel);
    setVideoAspectRatioWarning(metadata.aspectRatioWarning);
    setValues((current) => ({
      ...current,
      title: current.title.trim() ? current.title : file.name.replace(/\.[^.]+$/, ""),
      slug: current.slug.trim() ? current.slug : buildSlugFromTitle(file.name.replace(/\.[^.]+$/, "")),
      durationSeconds: String(metadata.durationSeconds),
    }));
    setIsPreparing(false);
  }

  async function handleSubtitleFilesSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";

    const { ignoredCount, supported } = filterSupportedSubtitleFiles(files);
    setIgnoredSubtitleFiles(ignoredCount);

    if (supported.length === 0) {
      setSubtitleRows([]);
      return;
    }

    setIsPreparingSubtitles(true);
    setError(null);
    setMessage(null);

    try {
      setSubtitleRows(buildSubtitleIntakeRows(supported));
    } finally {
      setIsPreparingSubtitles(false);
    }
  }

  function updateSubtitleRow(index: number, patch: Partial<SubtitleIntakeRow>) {
    setSubtitleRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeSubtitleRow(index: number) {
    setSubtitleRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function handlePosterChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setPosterFile(file);
    setPosterUploaded(false);

    if (usePosterAsHero) {
      setHeroFile(null);
      setHeroUploaded(false);
    }
  }

  function handleHeroChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setHeroFile(file);
    setHeroUploaded(false);
  }

  function toggleDescriptor(descriptor: ContentDescriptor) {
    setValues((current) => {
      const next = new Set(current.contentDescriptors);
      if (next.has(descriptor)) {
        next.delete(descriptor);
      } else {
        next.add(descriptor);
      }
      return { ...current, contentDescriptors: Array.from(next) };
    });
  }

  const validationErrors = useMemo(
    () =>
      validateShortFilmValues(
        values,
        videoDurationSeconds,
        Boolean(video.file),
        posterFile,
        heroFile,
        usePosterAsHero,
      ),
    [heroFile, posterFile, usePosterAsHero, values, video.file, videoDurationSeconds],
  );

  const subtitleValidationErrors = useMemo(() => {
    const messages: string[] = [];

    for (const subtitleRow of subtitleRows) {
      if (!subtitleRow.languageCode.trim()) {
        messages.push(`Subtitle ${subtitleRow.fileName} needs a language code.`);
      }

      if (!subtitleRow.label.trim()) {
        messages.push(`Subtitle ${subtitleRow.fileName} needs a label.`);
      }
    }

    return messages;
  }, [subtitleRows]);

  async function uploadArtwork(
    shortFilmIdValue: string,
    field: "poster_url" | "hero_image_url",
    kind: "short-film-poster" | "short-film-hero",
    file: File,
  ) {
    const intent = await requestArtworkUploadAction(shortFilmIdValue, kind, file.type || "image/jpeg");

    if ("error" in intent) {
      throw new Error(intent.error);
    }

    await uploadSignedArtworkFile(intent, file);

    const result = await persistArtworkAction(shortFilmIdValue, field, intent.publicUrl);
    if (!result.success) {
      throw new Error(result.message ?? "Unable to save artwork.");
    }
  }

  // Shared reconciliation path: reused by the initial upload flow below AND by
  // the processing auto-refresh interval so there is a single source of truth
  // for how the video transitions out of "processing". Mirrors the equivalent
  // helper already fixed in NewSeriesIntakeForm.tsx (reconcileEpisodeMediaStatus).
  async function reconcileVideoMediaStatus(shortFilmIdValue: string, mediaAssetId: string) {
    try {
      const result = await finalizeUploadAction(shortFilmIdValue, { mediaAssetId });

      if (!result.success) {
        setVideoUploadStatus(result.mediaStatus === "failed" ? "failed" : "processing");
        return { ready: false, error: result.error };
      }

      setError(null);
      setVideoUploadStatus(result.mediaStatus === "ready" ? "ready" : "processing");
      return { ready: result.mediaStatus === "ready", error: null };
    } catch (refreshError) {
      setVideoUploadStatus("failed");
      return {
        ready: false,
        error: refreshError instanceof Error ? refreshError.message : "Unable to refresh status.",
      };
    }
  }

  // Keep the latest closures available to the interval below without
  // resubscribing the interval on every keystroke/progress update.
  useEffect(() => {
    videoPollTickRef.current = () => {
      if (isRunning || videoPollBusyRef.current || !shortFilmId || !videoMediaAssetId) {
        return;
      }

      const currentShortFilmId = shortFilmId;
      const currentShortFilmSlug = shortFilmSlug;
      const currentMediaAssetId = videoMediaAssetId;

      videoPollBusyRef.current = true;

      void (async () => {
        try {
          const outcome = await reconcileVideoMediaStatus(currentShortFilmId, currentMediaAssetId);

          if (outcome.ready) {
            setVideo((current) => ({ ...current, uploaded: true }));

            if (currentShortFilmSlug) {
              for (let index = 0; index < subtitleRows.length; index += 1) {
                const subtitleRow = subtitleRows[index];

                if (!subtitleRow) {
                  continue;
                }

                await uploadSubtitleRow(currentShortFilmSlug, subtitleRow, index);
              }
            }
          }
        } finally {
          videoPollBusyRef.current = false;
        }
      })();
    };
  });

  // Auto-refresh the video while it is still processing on Mux by reusing the
  // existing finalizeUploadAction reconciliation path. Stops once the media
  // becomes ready or failed — no separate polling architecture.
  useEffect(() => {
    if (!shortFilmId || !videoMediaAssetId || videoUploadStatus !== "processing") {
      return;
    }

    const intervalId = window.setInterval(() => {
      videoPollTickRef.current();
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [shortFilmId, videoMediaAssetId, videoUploadStatus]);

  async function uploadMedia(shortFilmIdValue: string, currentFile: File) {
    if (
      video.uploaded &&
      videoMediaAssetId &&
      videoMetadataStatus === "ready" &&
      video.file === currentFile &&
      shortFilmIdValue &&
      videoDurationSeconds !== null
    ) {
      setVideoUploadStatus("processing");
      setVideoUploadProgress({
        loadedBytes: currentFile.size,
        totalBytes: currentFile.size,
        percentage: 100,
      });
      const outcome = await reconcileVideoMediaStatus(shortFilmIdValue, videoMediaAssetId);

      if (outcome.error) {
        throw new Error(outcome.error);
      }

      return outcome.ready;
    }

    const intent = await requestMediaUploadAction(videoMimeType, window.location.origin);
    if ("error" in intent) {
      throw new Error(intent.error);
    }

    setVideoUploadStatus("uploading");
    setVideoUploadProgress({ loadedBytes: 0, totalBytes: currentFile.size, percentage: 0 });
    await uploadToMux(intent.uploadUrl, currentFile, (progress) => {
      setVideoUploadProgress(progress);
    });
    setVideoUploadProgress({
      loadedBytes: currentFile.size,
      totalBytes: currentFile.size,
      percentage: 100,
    });
    setVideoUploadStatus("processing");
    // Set the media asset id before reconciling so the auto-refresh interval
    // above can pick this video up even if this specific reconcile call fails.
    setVideoMediaAssetId(intent.mediaAssetId);
    const outcome = await reconcileVideoMediaStatus(shortFilmIdValue, intent.mediaAssetId);

    if (outcome.error) {
      throw new Error(outcome.error);
    }

    setVideo((current) => ({ ...current, uploaded: true }));
    return outcome.ready;
  }

  async function uploadSubtitleRow(shortFilmSlugValue: string, subtitleRow: SubtitleIntakeRow, index: number) {
    if (subtitleRow.status === "ready" && subtitleRow.subtitleTrackId) {
      return;
    }

    updateSubtitleRow(index, { error: null, progress: 0, status: "uploading" });

    const intent = await requestSubtitleUploadAction({
      closedCaptions: subtitleRow.closedCaptions,
      isDefault: subtitleRow.isDefault,
      label: subtitleRow.label.trim(),
      languageCode: subtitleRow.languageCode.trim(),
      mimeType: subtitleRow.mimeType,
      shortFilmSlug: shortFilmSlugValue,
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
      isDefault: subtitleRow.isDefault,
      label: subtitleRow.label.trim(),
      languageCode: subtitleRow.languageCode.trim(),
      mimeType: subtitleRow.mimeType,
      objectPath: intent.objectPath,
      shortFilmSlug: shortFilmSlugValue,
      sourceFormat: subtitleRow.sourceFormat,
    });

    if (!finalizeResult.success) {
      updateSubtitleRow(index, { error: finalizeResult.error, status: "failed" });
      return;
    }

    updateSubtitleRow(index, {
      error: null,
      progress: 100,
      status: finalizeResult.status,
      subtitleTrackId: finalizeResult.subtitleTrackId,
    });
  }

  // "Retry failed" must only ever reflect the CURRENT video upload/media
  // status, not simply whether a short film has already been created.
  const hasFailedVideo = videoUploadStatus === "failed";
  const isVideoReady = videoUploadStatus === "ready";
  const hasProcessingVideo = videoUploadStatus === "processing";
  const showRetryButton = !shortFilmId || hasFailedVideo;
  const showEditPrimary = Boolean(shortFilmId) && !hasFailedVideo && isVideoReady;
  const submitLabel = !shortFilmId ? "CREATE SHORT FILM & UPLOAD" : "RETRY FAILED";

  async function handleSubmit() {
    if (isPreparing || isRunning) {
      return;
    }

    setHasAttemptedSubmit(true);
    setError(null);
    setMessage(null);

    if (Object.keys(validationErrors).length > 0 || subtitleValidationErrors.length > 0) {
      setError("Fix the highlighted issues before creating the short film.");
      return;
    }

    if (!video.file || videoDurationSeconds === null) {
      setError("Select a readable video file first.");
      return;
    }

    setIsRunning(true);

    try {
      let currentShortFilmId = shortFilmId;
      let currentShortFilmSlug = shortFilmSlug;
      let mediaReady = false;

      if (!currentShortFilmId) {
        const createResult = await createShortFilmDraftAction(
          buildShortFilmInput(values, videoDurationSeconds),
        );

        if (!createResult.success) {
          setError(createResult.errors[0]?.message ?? "Unable to create short film.");
          return;
        }

        currentShortFilmId = createResult.shortFilm.id;
        currentShortFilmSlug = createResult.shortFilm.slug;
        setShortFilmId(currentShortFilmId);
        setShortFilmSlug(currentShortFilmSlug);
      }

      if (!posterUploaded && posterFile && currentShortFilmId) {
        await uploadArtwork(
          currentShortFilmId,
          "poster_url",
          "short-film-poster",
          posterFile,
        );
        setPosterUploaded(true);
        if (usePosterAsHero) {
          setHeroUploaded(true);
        }
      }

      if (!usePosterAsHero && !heroUploaded && heroFile && currentShortFilmId) {
        await uploadArtwork(
          currentShortFilmId,
          "hero_image_url",
          "short-film-hero",
          heroFile,
        );
        setHeroUploaded(true);
      }

      if (currentShortFilmId) {
        mediaReady = await uploadMedia(currentShortFilmId, video.file);

        if (mediaReady && currentShortFilmSlug) {
          for (let index = 0; index < subtitleRows.length; index += 1) {
            const subtitleRow = subtitleRows[index];

            if (!subtitleRow) {
              continue;
            }

            await uploadSubtitleRow(currentShortFilmSlug, subtitleRow, index);
          }
        }

      }

      setMessage(
        currentShortFilmSlug
          ? mediaReady
            ? `Short film ${currentShortFilmSlug} is ready for review.`
            : `Short film ${currentShortFilmSlug} uploaded. Processing video…`
          : mediaReady
            ? "Short film is ready for review."
            : "Short film uploaded. Processing video…",
      );
    } catch (submitError) {
      if (videoUploadStatus === "uploading" || videoUploadStatus === "processing") {
        setVideoUploadStatus("failed");
      }
      setError(submitError instanceof Error ? submitError.message : "Unable to complete creation.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
        <div className="space-y-1">
          <p className={labelClassName}>Select video file</p>
          <p className="text-sm text-bone/60">The first step is choosing the actual short film video.</p>
        </div>

        <div className="space-y-2">
          <Button type="button" onClick={() => videoInputRef.current?.click()} disabled={isRunning || isPreparing}>
            SELECT VIDEO FILE
          </Button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoChange}
            disabled={isRunning || isPreparing}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelClassName}>Runtime (seconds)</span>
            <input
              className={inputClassName}
              type="number"
              min={0}
              value={values.durationSeconds}
              onChange={(event) => handleValue("durationSeconds", event.target.value)}
              disabled={isRunning}
            />
          </label>
          <div className="space-y-1.5">
            <p className={labelClassName}>Selection summary</p>
            <p className="text-sm text-bone/70">{video.file ? videoFileName : "No video selected yet."}</p>
            {video.file && <p className="text-xs text-bone/45">{videoSizeLabel}</p>}
          </div>
        </div>
      </section>

      {video.file && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Review video</p>
            <p className="text-sm text-bone/60">Confirm the detected runtime, resolution, orientation, and aspect ratio.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Title</span>
              <input
                className={inputClassName}
                value={values.title}
                onChange={(event) => handleValue("title", event.target.value)}
                disabled={isRunning}
              />
              {hasAttemptedSubmit && validationErrors.title && <span className="text-xs text-red-400">{validationErrors.title}</span>}
            </label>
            <label className="block space-y-1.5">
              <span className={labelClassName}>Slug</span>
              <input
                className={inputClassName}
                value={values.slug}
                onChange={(event) => handleValue("slug", event.target.value.toLowerCase())}
                disabled={isRunning}
              />
              {hasAttemptedSubmit && validationErrors.slug && <span className="text-xs text-red-400">{validationErrors.slug}</span>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className={labelClassName}>Duration</p>
              <p className="mt-2 text-sm text-bone">{videoDurationSeconds === null ? "—" : formatDuration(videoDurationSeconds)}</p>
            </div>
            <div>
              <p className={labelClassName}>Resolution</p>
              <p className="mt-2 text-sm text-bone">{videoResolutionLabel}</p>
            </div>
            <div>
              <p className={labelClassName}>Orientation</p>
              <p className="mt-2 text-sm text-bone">{videoOrientationLabel}</p>
            </div>
            <div>
              <p className={labelClassName}>Aspect</p>
              <p className="mt-2 text-sm text-bone">{videoAspectRatioLabel}</p>
              {videoAspectRatioWarning && <p className="text-xs text-amber-300">{videoAspectRatioWarning}</p>}
            </div>
          </div>

          {videoMetadataStatus === "failed" && (
            <div className="border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
              {videoMetadataError ?? "Metadata failed."}
            </div>
          )}
        </section>
      )}

      {video.file && videoUploadStatus !== "idle" && (
        <section className="space-y-2 border border-bone/10 bg-bone/[0.03] p-4">
          <p className={labelClassName}>
            {videoUploadStatus === "uploading"
              ? "Uploading video — do not close this page"
              : videoUploadStatus === "processing"
                ? "Upload complete — processing video"
                : videoUploadStatus === "ready"
                  ? "Video ready"
                  : "Video upload failed"}
          </p>
          <div className="flex items-center justify-between gap-3 text-sm text-bone/70">
            <span>
              {videoUploadProgress ? formatUploadProgressBytes(videoUploadProgress) : "Waiting"}
            </span>
            <span>{videoUploadProgress ? `${videoUploadProgress.percentage}%` : "0%"}</span>
          </div>
          <div className="h-1.5 overflow-hidden bg-bone/10">
            <div
              className="h-full bg-teal transition-all"
              style={{ width: `${videoUploadProgress ? videoUploadProgress.percentage : 0}%` }}
            />
          </div>
        </section>
      )}

      {video.file && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Subtitle tracks</p>
            <p className="text-sm text-bone/60">Optional subtitle files are uploaded to the same short film after the video is ready.</p>
          </div>

          <div className="space-y-2">
            <Button type="button" onClick={() => subtitleFilesInputRef.current?.click()} disabled={isRunning || isPreparingSubtitles}>
              SELECT SUBTITLE FILES
            </Button>
            <input
              ref={subtitleFilesInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain"
              onChange={handleSubtitleFilesSelect}
              disabled={isRunning || isPreparingSubtitles}
            />
          </div>

          <div className="space-y-1.5">
            <p className={labelClassName}>Selection summary</p>
            <p className="text-sm text-bone/70">
              {subtitleRows.length > 0 ? `${subtitleRows.length} supported subtitle file(s) selected.` : "No subtitle files selected yet."}
            </p>
            {ignoredSubtitleFiles > 0 && (
              <p className="text-xs text-bone/45">Ignored {ignoredSubtitleFiles} non-subtitle file(s).</p>
            )}
            {subtitleValidationErrors.length > 0 && (
              <div className="space-y-1 text-xs text-red-400">
                {subtitleValidationErrors.map((subtitleError) => (
                  <p key={subtitleError}>{subtitleError}</p>
                ))}
              </div>
            )}
          </div>

          {subtitleRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[0.65rem] uppercase tracking-[0.18em] text-bone/45">
                  <tr>
                    <th className="py-2 pr-3">File</th>
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
                        <input
                          className={inputClassName}
                          value={subtitleRow.languageCode}
                          onChange={(event) =>
                            updateSubtitleRow(index, {
                              languageCode: event.target.value.toLowerCase(),
                            })
                          }
                          placeholder="en"
                          disabled={isRunning || isPreparingSubtitles}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          className={inputClassName}
                          value={subtitleRow.label}
                          onChange={(event) => updateSubtitleRow(index, { label: event.target.value, titleEdited: true })}
                          disabled={isRunning || isPreparingSubtitles}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <label className="inline-flex items-center gap-2 text-xs text-bone/80">
                          <input
                            type="checkbox"
                            checked={subtitleRow.isDefault}
                            onChange={(event) => updateSubtitleRow(index, { isDefault: event.target.checked })}
                            className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                            disabled={isRunning || isPreparingSubtitles}
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
                            disabled={isRunning || isPreparingSubtitles}
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
                          disabled={isRunning || isPreparingSubtitles}
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

      {video.file && videoUploadStatus !== "idle" && (
        <section className="space-y-2 border border-bone/10 bg-bone/[0.03] p-4">
          <p className={labelClassName}>
            {videoUploadStatus === "uploading"
              ? "Uploading video — do not close this page"
              : videoUploadStatus === "processing"
                ? "Upload complete — processing video"
                : videoUploadStatus === "ready"
                  ? "Video ready"
                  : "Video upload failed"}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-bone/70">
            <span>
              {videoUploadProgress
                ? formatUploadProgressBytes(videoUploadProgress)
                : videoUploadStatus === "ready"
                  ? `${formatUploadProgressBytes({
                      loadedBytes: video.file.size,
                      totalBytes: video.file.size,
                      percentage: 100,
                    })}`
                  : "Waiting"}
            </span>
            <span>
              {videoUploadProgress ? `${videoUploadProgress.percentage}%` : videoUploadStatus === "ready" ? "100%" : "0%"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden bg-bone/10">
            <div
              className="h-full bg-teal transition-all"
              style={{
                width: `${videoUploadProgress ? videoUploadProgress.percentage : videoUploadStatus === "ready" ? 100 : 0}%`,
              }}
            />
          </div>
        </section>
      )}

      {video.file && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Short film details</p>
            <p className="text-sm text-bone/60">Fill the editorial fields after inspecting the video.</p>
          </div>

          <label className="block space-y-1.5">
            <span className={labelClassName}>Synopsis</span>
            <textarea className={inputClassName} rows={3} value={values.synopsis} onChange={(event) => handleValue("synopsis", event.target.value)} disabled={isRunning} />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
            <span className={labelClassName}>Language</span>
              <input className={inputClassName} value={values.language} onChange={(event) => handleValue("language", event.target.value)} disabled={isRunning} />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClassName}>Creator reference</span>
              <input className={inputClassName} value={values.creatorReference} onChange={(event) => handleValue("creatorReference", event.target.value)} disabled={isRunning} />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClassName}>Publish at</span>
              <input className={inputClassName} type="datetime-local" value={values.publishAt} onChange={(event) => handleValue("publishAt", event.target.value)} disabled={isRunning} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClassName}>Content rating</span>
              <CmsSelect
                className={inputClassName}
                value={values.contentRating}
                onChange={(newValue) => handleValue("contentRating", newValue as ContentRating | "")}
                disabled={isRunning}
                placeholderLabel="Unrated"
                options={[
                  { label: "Unrated", value: "" },
                  ...CONTENT_RATINGS.map((rating) => ({ label: rating, value: rating })),
                ]}
              />
            </label>
          </div>

          <fieldset>
            <legend className={labelClassName}>Content descriptors</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {CONTENT_DESCRIPTORS.map((descriptor) => (
                <label key={descriptor} className="flex items-center gap-2 text-sm text-bone/80">
                  <input
                    type="checkbox"
                    checked={values.contentDescriptors.includes(descriptor)}
                    onChange={() => toggleDescriptor(descriptor)}
                    className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                    disabled={isRunning}
                  />
                  {descriptor}
                </label>
              ))}
            </div>
            {hasAttemptedSubmit && validationErrors.contentDescriptors && (
              <p className="mt-1 text-xs text-red-400">{validationErrors.contentDescriptors}</p>
            )}
          </fieldset>
        </section>
      )}

      {video.file && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Artwork</p>
            <p className="text-sm text-bone/60">Select a poster first. Use the same poster as hero unless you want a separate hero image.</p>
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
                onChange={handlePosterChange}
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
                      setHeroFile(null);
                      setHeroUploaded(false);
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
                    onChange={handleHeroChange}
                    disabled={isRunning}
                    className="block w-full text-xs text-bone/70 file:mr-3 file:border file:border-bone/15 file:bg-bone/[0.03] file:px-3 file:py-1.5 file:text-[0.65rem] file:uppercase file:tracking-[0.14em] file:text-bone/80"
                  />
                </>
              )}
            </div>
          </div>

          {hasAttemptedSubmit && validationErrors.poster && <p className="text-xs text-red-400">{validationErrors.poster}</p>}
          {hasAttemptedSubmit && validationErrors.hero && <p className="text-xs text-red-400">{validationErrors.hero}</p>}
        </section>
      )}

      {video.file && (
        <section className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
          <div className="space-y-1">
            <p className={labelClassName}>Chai and ads</p>
            <p className="text-sm text-bone/60">These use the existing short film fields only.</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-bone/80">
            <input
              type="checkbox"
              checked={values.chaiEnabled}
              onChange={(event) => handleValue("chaiEnabled", event.target.checked)}
              className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
              disabled={isRunning}
            />
            Chai enabled
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-bone/80">
              <input
                type="checkbox"
                checked={values.midrollEnabled}
                onChange={(event) => handleValue("midrollEnabled", event.target.checked)}
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                disabled={isRunning}
              />
              Mid-roll enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-bone/80">
              <input
                type="checkbox"
                checked={values.postrollEnabled}
                onChange={(event) => handleValue("postrollEnabled", event.target.checked)}
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                disabled={isRunning}
              />
              Post-roll enabled
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className={labelClassName}>Mid-roll timecodes (comma-separated seconds)</span>
            <input
              className={inputClassName}
              value={values.midrollTimecodes}
              onChange={(event) => handleValue("midrollTimecodes", event.target.value)}
              placeholder="30, 75, 120"
              disabled={isRunning}
            />
            {hasAttemptedSubmit && validationErrors.midrollTimecodes && (
              <span className="text-xs text-red-400">{validationErrors.midrollTimecodes}</span>
            )}
          </label>

          <p className="text-xs text-bone/45">Current allowed coin amounts: {allowedCoinAmountsSummary}</p>
        </section>
      )}

      {video.file && (
        <section className="space-y-2 border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-amber-200/80">Review checklist</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Video is local and metadata is readable before upload.</li>
            <li>Poster is selected before server mutation.</li>
            <li>Chai and ad settings use existing short film fields only.</li>
            <li>No Mux upload has started yet.</li>
          </ul>
        </section>
      )}

      {shortFilmId && (
        <section className="space-y-2 border border-teal/20 bg-teal/5 p-4 text-sm text-bone/80">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-teal">
            {hasFailedVideo ? "Action needed" : isVideoReady ? "Upload complete" : "Upload complete — processing"}
          </p>
          <p>
            Draft short film{shortFilmSlug ? ` “${shortFilmSlug}”` : ""} is ready.
            {" "}
            <Link href={shortFilmEditPath(shortFilmId)} className="text-teal">
              Edit short film
            </Link>
          </p>
        </section>
      )}

      <div className="space-y-3">
        {showRetryButton ? (
          <Button type="button" onClick={handleSubmit} disabled={isRunning || isPreparing || !video.file}>
            {isRunning ? "Working…" : submitLabel}
          </Button>
        ) : showEditPrimary && shortFilmId ? (
          <ButtonLink href={shortFilmEditPath(shortFilmId)}>Edit short film</ButtonLink>
        ) : hasProcessingVideo ? (
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            Video still processing on Mux — refreshing automatically…
          </p>
        ) : null}
        {message && <p className="text-sm text-teal">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
