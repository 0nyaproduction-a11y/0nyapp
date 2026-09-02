import { getMobileEnv } from "../config/env";

function getCanonicalBaseUrl() {
  return getMobileEnv().canonicalSiteUrl;
}

function buildCanonicalUrl(pathname: string) {
  const baseUrl = getCanonicalBaseUrl();

  return baseUrl ? new URL(pathname, baseUrl).toString() : null;
}

export function buildSeriesUrl(slug: string) {
  return buildCanonicalUrl(`/series/${slug}`);
}

export function buildShortFilmUrl(slug: string) {
  return buildCanonicalUrl(`/short-films/${slug}`);
}

export function buildWatchUrl(seriesSlug: string, episodeNumber: number) {
  return buildCanonicalUrl(`/watch/${seriesSlug}/${episodeNumber}`);
}

export function buildSeriesShareMessage(seriesTitle: string, slug: string) {
  const shareUrl = buildSeriesUrl(slug);

  return shareUrl ? `Watch on 0nya: ${seriesTitle}\n${shareUrl}` : seriesTitle;
}

export function buildEpisodeShareMessage(
  seriesTitle: string,
  episodeNumber: number,
  episodeTitle: string,
  seriesSlug: string,
) {
  const shareUrl = buildWatchUrl(seriesSlug, episodeNumber);

  return shareUrl
    ? `Watch on 0nya: ${seriesTitle} - Episode ${episodeNumber}\n${shareUrl}`
    : `${seriesTitle} - Episode ${episodeNumber}: ${episodeTitle}`;
}

export function buildShortFilmShareMessage(title: string, slug: string) {
  const shareUrl = buildShortFilmUrl(slug);

  return shareUrl ? `Watch on 0nya: ${title}\n${shareUrl}` : title;
}

export function buildPrivacyUrl() {
  return buildCanonicalUrl("/privacy");
}

export function buildTermsUrl() {
  return buildCanonicalUrl("/terms");
}

export function buildHelpUrl() {
  return buildCanonicalUrl("/help");
}

export function buildGrievanceUrl() {
  return buildCanonicalUrl("/grievance");
}

export function buildReportContentUrl() {
  return buildCanonicalUrl("/report-content");
}

export function buildDeleteAccountUrl() {
  return buildCanonicalUrl("/delete-account");
}

export function getAndroidLinkingPrefixes() {
  const baseUrl = getCanonicalBaseUrl();

  return baseUrl ? [baseUrl] : [];
}
