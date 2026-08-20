import type { VideoSource } from "expo-video";

// Server-derived access summary for one episode in the series; never computed locally.
export type PlaybackEpisodeSummary = {
  number: number;
  title: string;
  runtime?: string;
  accessKind: "free" | "owned" | "included" | "locked";
  canWatch: boolean;
  accessLabel: string;
};

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
  episodes: PlaybackEpisodeSummary[];
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
