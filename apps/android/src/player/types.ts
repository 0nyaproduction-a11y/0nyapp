import type { VideoSource } from "expo-video";

export type SeriesEpisodePlaybackContext = {
  type: "SERIES_EPISODE";
  seriesSlug: string;
  seriesTitle: string;
  episodeNumber: number;
  episodeTitle: string;
  accessKind: "free" | "owned" | "included";
  accessLabel: string;
  nextEpisode?: {
    episodeNumber: number;
    episodeTitle: string;
    accessKind: "free" | "owned" | "included";
    accessLabel: string;
  };
  hasLockedNextEpisode: boolean;
};

export type ShortFilmPlaybackContext = {
  type: "SHORT_FILM";
  filmSlug: string;
  title: string;
};

export type PlaybackContext = SeriesEpisodePlaybackContext | ShortFilmPlaybackContext;

export type PlaybackSource = {
  source: VideoSource;
  isDevelopmentOnly: boolean;
};

export type PlaybackEndedPayload = {
  context: PlaybackContext;
};
