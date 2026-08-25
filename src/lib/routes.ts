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
