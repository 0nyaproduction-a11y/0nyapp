// Combines a caller-supplied AbortSignal with an optional bounded timeout into a
// single AbortSignal for a fetch call. Returns the merged signal plus a cleanup
// function that clears the timeout and detaches the listener. When the caller's
// signal already aborted, the merged signal is aborted immediately. The timeout
// abort is intentionally NOT reflected on the caller's original signal, so the
// caller can distinguish a genuine cancellation (caller's signal aborts) from a
// timeout (only the merged signal aborts).
//
// Extracted from api.ts so the timeout/abort merging logic is unit testable
// without pulling in react-native via the api module.
export function resolveFetchSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): { signal: AbortSignal | undefined; cleanup: () => void } {
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
