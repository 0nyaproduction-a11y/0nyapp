export type ProgressSyncMode = "final" | "lifecycle" | "periodic" | "user";
export type ProgressSample = { positionSeconds: number; durationSeconds: number };

/** Shared across player mounts: an older request for a target must finish first. */
export function createProgressWriteScheduler() {
  const queues = new Map<string, Promise<void>>();
  return (scope: string, write: () => Promise<void>) => {
    const task = (queues.get(scope) ?? Promise.resolve()).catch(() => undefined).then(write);
    queues.set(scope, task);
    void task.finally(() => { if (queues.get(scope) === task) queues.delete(scope); }).catch(() => undefined);
    return task;
  };
}

const scheduleProgressWrite = createProgressWriteScheduler();

export function normalizeProgressPosition(position: number, duration: number) {
  if (!Number.isFinite(position) || position < 0) return null;
  return Number.isFinite(duration) && duration > 0
    ? Math.min(Math.floor(position), Math.floor(duration)) : Math.floor(position);
}

/** A bounded caller wait never releases the underlying persistence ordering. */
export async function waitForProgressFlush(promise: Promise<void>, timeoutMs = 4000) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise, new Promise<void>((resolve) => { timeout = setTimeout(resolve, timeoutMs); })]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function createProgressSaveQueue(options: {
  scope: string;
  isCurrentIdentity: () => boolean;
  save: (sample: ProgressSample, mode: ProgressSyncMode) => Promise<unknown>;
  schedule?: ReturnType<typeof createProgressWriteScheduler>;
}) {
  let attempted: ProgressSample | null = null;
  let persisted: ProgressSample | null = null;
  const pending = new Map<string, { sample: ProgressSample; promise: Promise<void> }>();
  const schedule = options.schedule ?? scheduleProgressWrite;

  function enqueue(sample: ProgressSample, mode: ProgressSyncMode): Promise<void> {
    if (!options.isCurrentIdentity()) return Promise.resolve();
    const position = normalizeProgressPosition(sample.positionSeconds, sample.durationSeconds);
    if (position === null || position <= 0) return Promise.resolve();
    const normalized = { positionSeconds: position, durationSeconds: sample.durationSeconds };
    const key = `${position}:${sample.durationSeconds}`;
    const duplicate = pending.get(key);
    if (duplicate) return duplicate.promise;
    if (persisted?.positionSeconds === position && persisted.durationSeconds === sample.durationSeconds) return Promise.resolve();
    if (mode === "periodic") {
      const latestQueued = Array.from(pending.values()).at(-1)?.sample ?? persisted;
      if (latestQueued ? Math.abs(position - latestQueued.positionSeconds) < 5 : position < 5) return Promise.resolve();
    }
    // Explicit events intentionally bypass the periodic delta threshold.
    const task = schedule(options.scope, async () => {
      if (!options.isCurrentIdentity()) return;
      attempted = normalized;
      try {
        await options.save(normalized, mode);
        if (options.isCurrentIdentity()) persisted = normalized;
      } catch {
        // Failure never advances persisted; the same sample remains retryable.
      }
    });
    pending.set(key, { sample: normalized, promise: task });
    void task.finally(() => {
      if (pending.get(key)?.promise === task) pending.delete(key);
    }).catch(() => undefined);
    return task;
  }

  return { enqueue, getState: () => ({ attempted, persisted, pendingCount: pending.size }) };
}
