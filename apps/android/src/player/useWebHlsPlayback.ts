import type { WebHlsPlaybackOptions } from "./webHlsPlaybackTypes";

/**
 * Native platforms play HLS through expo-video directly; no browser shim is required.
 */
export function useWebHlsPlayback(options: WebHlsPlaybackOptions) {
  void options;
}
