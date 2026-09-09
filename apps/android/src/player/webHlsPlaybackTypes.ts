export type WebHlsPlaybackOptions = {
  /** Signed HLS manifest URL produced by server-side playback authorization. */
  uri: string | null | undefined;
  /** Called once the browser media element is able to render frames. */
  onReady?: (durationSeconds: number) => void;
  /** Called when the browser media pipeline fails irrecoverably. */
  onError?: (message: string) => void;
};
