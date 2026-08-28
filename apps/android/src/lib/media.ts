import { getMobileEnv } from "../config/env";

function isLoopbackHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function rewriteLoopbackUrlForMobile(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return value;
  }

  if (!isLoopbackHost(parsed.hostname)) {
    return value;
  }

  const { apiBaseUrl, supabaseUrl } = getMobileEnv();
  const replacementBase = parsed.pathname.startsWith("/storage/v1/")
    ? supabaseUrl
    : apiBaseUrl;

  try {
    const replacement = new URL(replacementBase);
    parsed.protocol = replacement.protocol;
    parsed.hostname = replacement.hostname;
    parsed.port = replacement.port;
    return parsed.toString();
  } catch {
    return value;
  }
}

export function resolveMediaUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return rewriteLoopbackUrlForMobile(trimmed);
  }

  if (trimmed.startsWith("//")) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }

  const { apiBaseUrl, supabaseUrl } = getMobileEnv();

  if (trimmed.startsWith("/storage/v1/object/public/")) {
    const supabaseOrigin = supabaseUrl.replace(/\/+$/, "");
    return `${supabaseOrigin}${trimmed}`;
  }

  const baseOrigin = apiBaseUrl.replace(/\/+$/, "");
  const relativePath = trimmed.replace(/^\/+/, "");

  return `${baseOrigin}/${relativePath}`;
}
