import type { SubtitleSourceFormat } from "@/lib/subtitles";
import { buildSlugFromTitle, detectEpisodeNumber, naturalCompare } from "@/lib/cms/video-intake";

export type SubtitleIntakeTargetType = "SERIES_EPISODE" | "SHORT_FILM";

export type SubtitleIntakeRow = {
  clientId: string;
  closedCaptions: boolean;
  detectedEpisodeNumber: number | null;
  error: string | null;
  file: File;
  fileName: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  isDefault: boolean;
  label: string;
  languageCode: string;
  mediaAssetId: string | null;
  mimeType: string;
  progress: number;
  relativePath: string | null;
  sourceFormat: SubtitleSourceFormat;
  status: "waiting" | "uploading" | "processing" | "ready" | "failed";
  subtitleTrackId: string | null;
  targetEpisodeNumber: number | null;
  titleEdited: boolean;
};

const COMMON_SUBTITLE_LANGUAGES = new Map([
  ["en", "English"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["mr", "Marathi"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["pa", "Punjabi"],
  ["ur", "Urdu"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
]);

function getRelativePath(file: File) {
  const relativePath = typeof file.webkitRelativePath === "string" ? file.webkitRelativePath.trim() : "";
  return relativePath.length > 0 ? relativePath : null;
}

function getBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim();
}

function getFileSizeLabel(bytes: number) {
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

function getSourceFormat(fileName: string): SubtitleSourceFormat | null {
  const lowerName = fileName.trim().toLowerCase();

  if (lowerName.endsWith(".vtt")) {
    return "vtt";
  }

  if (lowerName.endsWith(".srt")) {
    return "srt";
  }

  return null;
}

function getSubtitleLanguageCode(fileName: string) {
  const segments = getBaseName(fileName)
    .split(/[._-]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const lowerSegment = segment.toLowerCase();

    if (lowerSegment === "sdh" || lowerSegment === "cc" || lowerSegment === "caption") {
      continue;
    }

    try {
      const [canonical] = Intl.getCanonicalLocales(segment);
      if (canonical) {
        return canonical.toLowerCase();
      }
    } catch {
      // Ignore non-locale suffixes and keep scanning.
    }
  }

  return "";
}

function getSubtitleLabel(languageCode: string, fileName: string) {
  const normalized = languageCode.trim().toLowerCase();

  if (COMMON_SUBTITLE_LANGUAGES.has(normalized)) {
    return COMMON_SUBTITLE_LANGUAGES.get(normalized) ?? fileName;
  }

  if (normalized) {
    return normalized.toUpperCase();
  }

  return buildSlugFromTitle(getBaseName(fileName)).replace(/-/g, " ") || fileName;
}

function getSubtitleMimeType(sourceFormat: SubtitleSourceFormat, mimeType: string) {
  const normalizedMimeType = mimeType.trim().toLowerCase().split(";", 1)[0];

  if (sourceFormat === "vtt") {
    return normalizedMimeType === "text/vtt" ? normalizedMimeType : "text/vtt";
  }

  if (normalizedMimeType === "application/x-subrip" || normalizedMimeType === "text/plain") {
    return normalizedMimeType;
  }

  return "application/x-subrip";
}

export function filterSupportedSubtitleFiles(files: File[]) {
  const supported: File[] = [];
  let ignoredCount = 0;

  for (const file of files) {
    const sourceFormat = getSourceFormat(file.name);
    if (sourceFormat) {
      supported.push(file);
    } else {
      ignoredCount += 1;
    }
  }

  return { ignoredCount, supported };
}

export function buildSubtitleIntakeRows(files: File[]): SubtitleIntakeRow[] {
  return [...files]
    .sort((left, right) => naturalCompare(getRelativePath(left) ?? left.name, getRelativePath(right) ?? right.name))
    .map((file, index) => {
      const sourceFormat = getSourceFormat(file.name);
      if (!sourceFormat) {
        throw new Error("Unsupported subtitle file.");
      }

      const languageCode = getSubtitleLanguageCode(file.name);
      const detectedEpisodeNumber = detectEpisodeNumber(file.name);

      return {
        clientId: crypto.randomUUID(),
        closedCaptions: false,
        detectedEpisodeNumber,
        error: null,
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        fileSizeLabel: getFileSizeLabel(file.size),
        isDefault: index === 0,
        label: getSubtitleLabel(languageCode, file.name),
        languageCode,
        mediaAssetId: null,
        mimeType: getSubtitleMimeType(sourceFormat, file.type || (sourceFormat === "vtt" ? "text/vtt" : "application/x-subrip")),
        progress: 0,
        relativePath: getRelativePath(file),
        sourceFormat,
        status: "waiting",
        subtitleTrackId: null,
        targetEpisodeNumber: detectedEpisodeNumber,
        titleEdited: false,
      } satisfies SubtitleIntakeRow;
    });
}

export function formatSubtitleTargetLabel(targetEpisodeNumber: number | null, index: number) {
  if (targetEpisodeNumber !== null) {
    return `Episode ${targetEpisodeNumber}`;
  }

  return `Track ${index + 1}`;
}
