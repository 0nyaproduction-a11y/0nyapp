// Bounded timeout for playback authorization fetch calls.
//
// A stalled /api/v1/playback call must terminate deterministically instead of
// hanging the player forever. This pure helper combines a caller-supplied
// AbortSignal with an optional bounded timeout into a single AbortSignal for a
// fetch call. It returns the merged signal plus a cleanup function that clears
// the timeout and detaches the listener.
//
// Key design property: the timeout abort is intentionally NOT reflected on the
// caller's signal. This lets requestApi distinguish a genuine caller
// cancellation (obsolete_request) from a timeout (network_error → recoverable).

export type BoundedFetchSignal = {
  signal: AbortSignal | undefined;
  cleanup: () => void;
};

export function createBoundedFetchSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): BoundedFetchSignal {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return { signal: callerSignal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let callerAbortListener: (() => void) | undefined;

  const cleanup = () => {
    clearTimeout(timeoutId);
    if (callerAbortListener) {
      callerSignal?.removeEventListener("abort", callerAbortListener);
    }
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerAbortListener = () => controller.abort();
      callerSignal.addEventListener("abort", callerAbortListener, { once: true });
    }
  }

  return { signal: controller.signal, cleanup };
}

export class PlaybackTimeoutError extends Error {
  readonly code = "playback_timeout";
  constructor(message = "Playback authorization timed out.") {
    super(message);
    this.name = "PlaybackTimeoutError";
  }
}
