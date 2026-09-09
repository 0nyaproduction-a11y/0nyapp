export type PollingOptions<T> = {
  read: (signal: AbortSignal) => Promise<T>;
  onValue: (value: T, isActive: () => boolean) => Promise<boolean> | boolean;
  onError: (error: unknown) => boolean;
  onTimeout: () => void;
  timeoutMs: number;
  intervalMs: number;
};

// A deadline independent of request completion; at most one request at a time.
// Returning true from a handler finishes polling. Cleanup cancels queued/in-flight work.
export function startBoundedPolling<T>(options: PollingOptions<T>) {
  const controller = new AbortController();
  let active = true;
  let next: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    active = false;
    controller.abort();
    clearTimeout(deadline);
    if (next) clearTimeout(next);
  };
  const deadline = setTimeout(() => {
    if (!active) return;
    stop();
    options.onTimeout();
  }, options.timeoutMs);
  const poll = async () => {
    try {
      const value = await options.read(controller.signal);
      if (!active) return;
      if (await options.onValue(value, () => active)) { stop(); return; }
    } catch (error) {
      if (!active) return;
      if (options.onError(error)) { stop(); return; }
    }
    if (active) next = setTimeout(() => { void poll(); }, options.intervalMs);
  };
  void poll();
  return stop;
}
