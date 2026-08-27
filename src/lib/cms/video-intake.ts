export type VideoIntakeStatus = "waiting" | "creating" | "uploading" | "processing" | "ready" | "failed";
export type VideoMetadataStatus = "pending" | "ready" | "failed";

const COMMON_ASPECT_RATIOS = new Set(["1:1", "4:5", "3:4", "9:16", "2:3", "16:9", "5:4", "4:3", "3:2"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".3gp", ".3g2"]);

export type VideoIntakeRow = {
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
  metadataStatus: VideoMetadataStatus;
  mimeType: string;
  orientationLabel: string;
  mediaAssetId: string | null;
  uploadProgress: { loadedBytes: number; percentage: number; totalBytes: number } | null;
  uploadUrl: string | null;
  progress: number;
  relativePath: string | null;
  status: VideoIntakeStatus;
  title: string;
  titleEdited: boolean;
  videoHeight: number | null;
  videoWidth: number | null;
  resolutionLabel: string;
  aspectRatioLabel: string;
  aspectRatioWarning: string | null;
};

export function naturalCompare(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function detectEpisodeNumber(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim();
  const exactMatch = baseName.match(/^(?:ep(?:isode)?[\s._-]*)?0*(\d+)$/i);

  if (exactMatch) {
    return Number(exactMatch[1]);
  }

  const looseMatch = baseName.match(/(?:^|[\s._-])ep(?:isode)?[\s._-]*0*(\d+)(?=$|[\s._-])/i);

  if (!looseMatch) {
    return null;
  }

  return Number(looseMatch[1]);
}

export function buildSlugFromTitle(title: string) {
    return title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
}

export function formatDuration(durationSeconds: number | null) {
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

export function formatFileSize(bytes: number) {
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

export function getOrientationLabel(width: number, height: number) {
  if (width === height) {
    return "square";
  }

  return width < height ? "portrait" : "landscape";
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

export function getAspectRatioLabel(width: number, height: number) {
  const reducedLeftRight = greatestCommonDivisor(width, height);
  const reduced = `${width / reducedLeftRight}:${height / reducedLeftRight}`;

  if (COMMON_ASPECT_RATIOS.has(reduced)) {
    return { label: reduced, warning: null };
  }

  if (width >= height) {
    return { label: `≈ ${(width / height).toFixed(2)}:1`, warning: "Unusual source ratio" };
  }

  return { label: `≈ 1:${(height / width).toFixed(2)}`, warning: "Unusual source ratio" };
}

export function buildResolutionLabel(width: number | null, height: number | null) {
  if (!width || !height) {
    return "—";
  }

  return `${width} x ${height}`;
}

function getRelativePath(file: File) {
  const relativePath = typeof file.webkitRelativePath === "string" ? file.webkitRelativePath.trim() : "";

  return relativePath.length > 0 ? relativePath : null;
}

export function isSupportedVideoFile(file: File) {
  const mimeType = file.type.trim().toLowerCase();

  if (mimeType.startsWith("video/")) {
    return true;
  }

  const lowerName = file.name.trim().toLowerCase();
  for (const extension of VIDEO_EXTENSIONS) {
    if (lowerName.endsWith(extension)) {
      return true;
    }
  }

  return false;
}

export function filterSupportedVideoFiles(files: File[]) {
  const supported: File[] = [];
  let ignoredCount = 0;

  for (const file of files) {
    if (isSupportedVideoFile(file)) {
      supported.push(file);
    } else {
      ignoredCount += 1;
    }
  }

  return { ignoredCount, supported };
}

export function buildVideoIntakeRows(files: File[], startEpisodeNumber: number): VideoIntakeRow[] {
  const sortedFiles = [...files].sort((left, right) =>
    naturalCompare(getRelativePath(left) ?? left.name, getRelativePath(right) ?? right.name),
  );
  const detectedNumbers = sortedFiles.map((file) => detectEpisodeNumber(file.name));
  const hasClearDetectedNumbers =
    detectedNumbers.every((value) => value !== null) &&
    new Set(detectedNumbers.map((value) => value ?? -1)).size === detectedNumbers.length;

  return sortedFiles.map((file, index) => {
    const detectedEpisodeNumber = detectedNumbers[index];
    const episodeNumber =
      hasClearDetectedNumbers && detectedEpisodeNumber !== null ? detectedEpisodeNumber : startEpisodeNumber + index;
    const relativePath = getRelativePath(file);

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
      metadataStatus: "pending",
      mimeType: file.type || "video/*",
      mediaAssetId: null,
      uploadProgress: null,
      uploadUrl: null,
      progress: 0,
      relativePath,
      status: "waiting",
      title: `Episode ${episodeNumber}`,
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

export function buildEpisodeDurationLabel(rows: Array<{ durationSeconds: number | null; metadataStatus: VideoMetadataStatus }>) {
  const durations = rows
    .filter((row) => row.metadataStatus === "ready" && row.durationSeconds !== null)
    .map((row) => Math.max(0, Math.trunc(row.durationSeconds ?? 0)))
    .sort((left, right) => left - right);

  if (durations.length === 0) {
    return null;
  }

  const min = durations[0];
  const max = durations[durations.length - 1];

  if (min === max) {
    return formatDuration(min);
  }

  return `${formatDuration(min)}–${formatDuration(max)}`;
}

export function probeVideoMetadata(file: File) {
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
