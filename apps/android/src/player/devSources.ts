import type { PlaybackContext, PlaybackSource } from "./types";

const DEV_HLS_SOURCES = {
  landscape: {
    label: "landscape",
    uri: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
  vertical: {
    label: "vertical",
    uri: "https://ik.imagekit.io/highheat/luna_promo.mp4/ik-master.m3u8?tr=sr-360_480_720_1080",
  },
} as const;

const ACTIVE_DEV_HLS_SOURCE = DEV_HLS_SOURCES.vertical;

export function getDevelopmentPlaybackSource(context: PlaybackContext): PlaybackSource {
  return {
    isDevelopmentOnly: true,
    source: {
      uri: ACTIVE_DEV_HLS_SOURCE.uri,
      contentType: "hls",
      metadata: {
        title:
          context.type === "SERIES_EPISODE"
            ? `${context.seriesTitle} - Episode ${context.episodeNumber}`
            : context.title,
        artist: `0nya development playback - ${ACTIVE_DEV_HLS_SOURCE.label}`,
      },
      useCaching: false,
    },
  };
}
