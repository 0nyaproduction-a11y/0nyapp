export function getCanonicalSiteUrl() {
  const value = process.env.NEXT_PUBLIC_ONYA_CANONICAL_URL?.trim();

  return value ? value.replace(/\/$/, "") : null;
}

export function buildCanonicalUrl(pathname: string) {
  const baseUrl = getCanonicalSiteUrl();

  return baseUrl ? new URL(pathname, baseUrl).toString() : null;
}
