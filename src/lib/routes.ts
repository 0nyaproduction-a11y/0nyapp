export function seriesPath(slug: string) {
  return `/series/${slug}`;
}

export function watchEpisodePath(seriesSlug: string, episodeNumber: number) {
  return `/watch/${seriesSlug}/${episodeNumber}`;
}

export function shortFilmPath(slug: string) {
  return `/short-films/${slug}`;
}

export function purchaseEpisodePath(seriesSlug: string, episodeNumber: number) {
  return `/purchase/${seriesSlug}/${episodeNumber}`;
}

export const accountPath = "/account";
export const deleteAccountPath = "/delete-account";
export const walletPath = "/wallet";
export const plansPath = "/plans";
export const loginPath = "/login";
export const adminPath = "/admin";

export const seriesListPath = "/admin/series";
export const seriesNewPath = "/admin/series/new";
export const mediaListPath = "/admin/media";

export function seriesEditPath(seriesId: string) {
  return `/admin/series/${seriesId}`;
}

export function episodeNewPath(seriesId: string) {
  return `/admin/series/${seriesId}/episodes/new`;
}

export function episodeEditPath(seriesId: string, episodeId: string) {
  return `/admin/series/${seriesId}/episodes/${episodeId}`;
}
