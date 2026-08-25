import type { VideoSourceObject } from "expo-video";

export type SeriesEpisodePlaybackContext = {
  type: "SERIES_EPISODE";
  seriesSlug: string;
  seriesTitle: string;
  episodeNumber: number;
  episodeTitle: string;
  accessKind: "free" | "owned" | "included" | "locked";
  accessLabel: string;
  nextEpisode?: {
    episodeNumber: number;
    episodeTitle: string;
    accessKind: "free" | "owned" | "included" | "locked";
    accessLabel: string;
  };
  hasLockedNextEpisode: boolean;
  hasUnreleasedNextEpisode: boolean;
};

export type ShortFilmPlaybackContext = {
  type: "SHORT_FILM";
  filmSlug: string;
  title: string;
};

export type PlaybackContext = SeriesEpisodePlaybackContext | ShortFilmPlaybackContext;

export type PlaybackMode = "full" | "preview";

export type PlaybackSource = {
  playbackUri: string;
  source: VideoSourceObject;
  isDevelopmentOnly: boolean;
};

export type PlaybackEndedPayload = {
  context: PlaybackContext;
};
