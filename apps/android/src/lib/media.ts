import { getMobileEnv } from "../config/env";

export function resolveMediaUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }

  const { apiBaseUrl } = getMobileEnv();
  const baseOrigin = apiBaseUrl.replace(/\/+$/, "");
  const relativePath = trimmed.replace(/^\/+/, "");

  return `${baseOrigin}/${relativePath}`;
}
