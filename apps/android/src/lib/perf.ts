type PerfEventFields = Record<string, boolean | number | string | null | undefined>;

type PerfMeasure = {
  event: string;
  startedAt: number;
};

declare global {
  // Development escape hatch: set this from a debugger console if needed.
  // Example: globalThis.__0NYA_PERF_RUN_ID__ = "P05-001"
  var __0NYA_PERF_RUN_ID__: string | undefined;
}

const PERF_PREFIX = "[0NYA_PERF]";
const RUN_ID_ENV = process.env.EXPO_PUBLIC_ONYA_PERF_RUN_ID;
let generatedRunId: string | null = null;
let autoNextPlaybackPending = false;

export function perfNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function getRunId() {
  if (typeof globalThis.__0NYA_PERF_RUN_ID__ === "string" && globalThis.__0NYA_PERF_RUN_ID__.trim()) {
    return globalThis.__0NYA_PERF_RUN_ID__.trim();
  }

  if (typeof RUN_ID_ENV === "string" && RUN_ID_ENV.trim()) {
    return RUN_ID_ENV.trim();
  }

  if (!generatedRunId) {
    generatedRunId = `DEV-${Date.now().toString(36).toUpperCase()}`;
  }

  return generatedRunId;
}

function sanitizeValue(value: boolean | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }

  return value.replace(/[\s=]+/g, "_").slice(0, 120);
}

function serializeFields(fields: PerfEventFields = {}) {
  return Object.entries(fields)
    .map(([key, value]) => {
      const safeValue = sanitizeValue(value);
      return safeValue === undefined ? null : `${key}=${safeValue}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(" ");
}

export function perfMark(event: string, fields: PerfEventFields = {}) {
  if (!__DEV__) {
    return;
  }

  const serialized = serializeFields(fields);
  const line = `${PERF_PREFIX} run=${getRunId()} event=${event} t=${perfNow().toFixed(1)}${
    serialized ? ` ${serialized}` : ""
  }`;

  console.info(line);
}

export function perfStart(event: string, fields: PerfEventFields = {}): PerfMeasure {
  const startedAt = perfNow();
  perfMark(`${event}_START`, fields);
  return { event, startedAt };
}

export function perfEnd(measure: PerfMeasure, fields: PerfEventFields = {}) {
  perfMark(`${measure.event}_END`, {
    ...fields,
    duration_ms: Math.max(0, perfNow() - measure.startedAt).toFixed(1),
  });
}

export function perfSetRunId(runId: string) {
  if (!__DEV__) {
    return;
  }

  globalThis.__0NYA_PERF_RUN_ID__ = runId.trim();
  perfMark("RUN_ID_SET");
}

export function perfSetAutoNextPlaybackPending() {
  if (__DEV__) {
    autoNextPlaybackPending = true;
  }
}

export function perfConsumeAutoNextPlaybackPending() {
  if (!__DEV__ || !autoNextPlaybackPending) {
    return false;
  }

  autoNextPlaybackPending = false;
  return true;
}
