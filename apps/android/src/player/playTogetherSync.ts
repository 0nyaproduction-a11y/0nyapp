import type { PlayTogetherSyncConfig } from "../types/playTogether";

// PX01-D — Play Together playback-synchronization pure helpers.
//
// Time-base notes (all values are milliseconds unless stated otherwise):
//   - `position` values (hostPositionMs, expected, currentTime) are in the
//     wall-clock domain of the device that owns them.
//   - `stateServerTimeMs` is the DB timestamp of the last applied command,
//     expressed in the SERVER clock. To compare "where the Host should be now"
//     against a local position, the server clock is mapped into the local
//     clock using the rolling clock-offset estimate fed by heartbeat samples:
//         elapsedMs = localNowMs + offsetMs - stateServerTimeMs
//   - Drift is `expectedPositionMs - myPositionMs`: positive means the device
//     is BEHIND the Host (must speed up), negative means it is AHEAD (must slow
//     down). Drift within `smallDriftIgnoredMs` is ignored; beyond
//     `largeDriftCorrectionMs` a direct seek replaces gentle rate correction.
//
// These functions never import React or react-native; adapter policies and
// buffering-presence handling live in usePlayTogetherPlaybackSync.ts.

export const DEFAULT_PLAY_TOGETHER_SYNC: PlayTogetherSyncConfig = {
  heartbeatSeconds: 10,
  largeDriftCorrectionMs: 1200,
  rateMaxFactor: 1.03,
  rateMinFactor: 0.97,
  smallDriftIgnoredMs: 300,
};

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const MAX_OFFSET_SAMPLE_ABS_MS = 5000;

export function clampPositionMs(positionMs: number, durationMs: number | null): number {
  const floored = Number.isFinite(positionMs) ? Math.max(0, Math.floor(positionMs)) : 0;

  if (durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
    return Math.min(floored, durationMs);
  }

  return floored;
}

export function parseStateServerTimeMs(stateServerTime: string | null | undefined): number | null {
  if (!stateServerTime) {
    return null;
  }

  const parsed = Date.parse(stateServerTime);

  return Number.isFinite(parsed) ? parsed : null;
}

// One clock-offset sample from a heartbeat round trip:
//   offset = serverTimeMs - round((requestStartMs + requestEndMs) / 2)
// Samples with a non-finite input, or a magnitude beyond the safety band, are
// discarded (null) so a single slow/jammed round trip cannot poison the
// rolling estimate.
export function offsetSampleMs(options: {
  requestEndMs: number;
  requestStartMs: number;
  serverTimeMs: number | null;
}): number | null {
  if (
    !Number.isFinite(options.requestStartMs) ||
    !Number.isFinite(options.requestEndMs) ||
    options.serverTimeMs === null
  ) {
    return null;
  }

  const midpointMs = Math.round((options.requestStartMs + options.requestEndMs) / 2);
  const sample = options.serverTimeMs - midpointMs;

  return Math.abs(sample) > MAX_OFFSET_SAMPLE_ABS_MS ? null : sample;
}

// Rolling median over the most recent `windowSize` samples. A median resists
// up to ~50% outliers; empty/invalid windows report 0 (no correction yet).
export function estimateClockOffsetMs(samples: number[], windowSize = 8): number {
  const windowed = samples.slice(-windowSize).filter((sample) => Number.isFinite(sample));

  if (windowed.length === 0) {
    return 0;
  }

  const sorted = [...windowed].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}

// Where the Host should be right now, in the local clock domain. When the room
// is not playing (or the anchor timestamp is unavailable) the expected position
// is the anchored Host position — the guest must hold still rather than guess.
export function expectedPositionMs(options: {
  durationMs: number | null;
  hostPositionMs: number;
  nowMs: number;
  offsetMs: number;
  playbackRate: number;
  playbackState: string;
  stateServerTimeMs: number | null;
}): number {
  const base = clampPositionMs(options.hostPositionMs, options.durationMs);

  if (
    options.playbackState !== "playing" ||
    options.stateServerTimeMs === null ||
    !Number.isFinite(options.playbackRate) ||
    options.playbackRate <= 0
  ) {
    return base;
  }

  const elapsedMs = options.nowMs + options.offsetMs - options.stateServerTimeMs;

  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return base;
  }

  return clampPositionMs(base + elapsedMs * options.playbackRate, options.durationMs);
}

export type DriftResolution = "ignore" | "rate" | "seek";

export function classifyDrift(
  driftMs: number,
  config: Pick<PlayTogetherSyncConfig, "largeDriftCorrectionMs" | "smallDriftIgnoredMs">,
): DriftResolution {
  const magnitude = Math.abs(driftMs);

  if (magnitude > config.largeDriftCorrectionMs) {
    return "seek";
  }

  if (magnitude > config.smallDriftIgnoredMs) {
    return "rate";
  }

  return "ignore";
}

export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 1;
  }

  return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
}

// Gentle rate-correction factor bounded by the backend-controlled
// rateMinFactor / rateMaxFactor relative to the canonical rate:
//   behind (driftMs > 0) -> speed up toward canonicalRate * rateMaxFactor
//   ahead (driftMs < 0) -> slow down toward canonicalRate * rateMinFactor
export function correctionRateForDrift(options: {
  canonicalRate: number;
  config: PlayTogetherSyncConfig;
  driftMs: number;
}): { drift: DriftResolution; rate: number } {
  const drift = classifyDrift(options.driftMs, options.config);

  if (drift === "ignore") {
    return { drift, rate: clampPlaybackRate(options.canonicalRate) };
  }

  const factor = options.driftMs > 0 ? options.config.rateMaxFactor : options.config.rateMinFactor;

  return { drift, rate: clampPlaybackRate(options.canonicalRate * factor) };
}

export function isNewerStateVersion(nextVersion: number, currentVersion: number): boolean {
  return nextVersion > currentVersion;
}

// Matches the backend normalizeCommandId contract (\x21-\x7e, 8..160 chars).
export function createPlayTogetherCommandId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}