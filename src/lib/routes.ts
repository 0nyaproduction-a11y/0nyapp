export function seriesPath(slug: string) {
  return `/series/${slug}`;
}

export function watchEpisodePath(seriesSlug: string, episodeNumber: number) {
  return `/watch/${seriesSlug}/${episodeNumber}`;
}

export function purchaseEpisodePath(seriesSlug: string, episodeNumber: number) {
  return `/purchase/${seriesSlug}/${episodeNumber}`;
}

export const accountPath = "/account";
export const walletPath = "/wallet";
export const plansPath = "/plans";
export const loginPath = "/login";
