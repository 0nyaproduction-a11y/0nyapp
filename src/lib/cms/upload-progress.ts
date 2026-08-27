export type UploadProgressState = {
  loadedBytes: number;
  percentage: number;
  totalBytes: number;
};

export function formatUploadBytes(bytes: number) {
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

export function createUploadProgressState(loadedBytes: number, totalBytes: number): UploadProgressState {
  const safeTotalBytes = Math.max(0, Math.trunc(totalBytes));
  const safeLoadedBytes = Math.min(Math.max(0, Math.trunc(loadedBytes)), safeTotalBytes || Math.max(0, Math.trunc(loadedBytes)));
  const percentage = safeTotalBytes > 0 ? Math.min(100, Math.round((safeLoadedBytes / safeTotalBytes) * 100)) : 0;

  return {
    loadedBytes: safeLoadedBytes,
    percentage,
    totalBytes: safeTotalBytes,
  };
}

export function formatUploadProgressBytes(progress: UploadProgressState) {
  return `${formatUploadBytes(progress.loadedBytes)} / ${formatUploadBytes(progress.totalBytes)}`;
}
