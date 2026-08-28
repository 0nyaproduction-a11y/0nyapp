#!/usr/bin/env node
import { readFileSync } from "node:fs";

const METRICS = [
  ["APP_START_TO_HOME_DATA_READY", "APP_START", "HOME_DATA_READY"],
  ["CONTENT_TAP_TO_WATCH_MOUNT", "CONTENT_TAP", "WATCH_MOUNT"],
  ["WATCH_MOUNT_TO_ACCESS_END", "WATCH_MOUNT", "ACCESS_END"],
  ["ACCESS_END_TO_SOURCE_RESOLVED", "ACCESS_END", "SOURCE_RESOLVED"],
  ["SOURCE_RESOLVED_TO_PLAYBACK_STARTED", "SOURCE_RESOLVED", "PLAYBACK_STARTED"],
  ["CONTENT_TAP_TO_PLAYBACK_STARTED", "CONTENT_TAP", "PLAYBACK_STARTED"],
  ["AUTO_NEXT_START_TO_NEXT_PLAYBACK_STARTED", "AUTO_NEXT_START", "NEXT_PLAYBACK_STARTED"],
];

function parseArgs(argv) {
  const args = { logPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--log") args.logPath = argv[++index] ?? "";
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/android-perf-summary.mjs --log perf/P05-001/logcat.txt");
      process.exit(0);
    }
  }
  if (!args.logPath) {
    throw new Error("Missing --log, for example --log perf/P05-001/logcat.txt");
  }
  return args;
}

function parsePerfLine(line) {
  const markerIndex = line.indexOf("[0NYA_PERF]");
  if (markerIndex < 0) {
    return null;
  }

  const pairs = line.slice(markerIndex + "[0NYA_PERF]".length).trim().split(/\s+/);
  const entry = {};
  for (const pair of pairs) {
    const splitAt = pair.indexOf("=");
    if (splitAt <= 0) continue;
    entry[pair.slice(0, splitAt)] = pair.slice(splitAt + 1);
  }

  if (!entry.run || !entry.event || !entry.t) {
    return null;
  }

  return {
    ...entry,
    t: Number(entry.t),
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function summarizeValues(values) {
  if (values.length === 0) {
    return "NOT CAPTURED";
  }

  return `BEST=${Math.min(...values).toFixed(1)}ms MEDIAN=${median(values).toFixed(1)}ms WORST=${Math.max(...values).toFixed(1)}ms`;
}

function firstEventAfter(events, eventName, afterTime = -Infinity) {
  return events.find((entry) => entry.event === eventName && entry.t >= afterTime);
}

function collectPairDurations(events, startEvent, endEvent) {
  const durations = [];
  for (const start of events.filter((entry) => entry.event === startEvent)) {
    const end = firstEventAfter(events, endEvent, start.t);
    if (end) {
      durations.push(end.t - start.t);
    }
  }
  return durations;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const lines = readFileSync(args.logPath, "utf8").split(/\r?\n/);
  const entries = lines.map(parsePerfLine).filter(Boolean).sort((a, b) => a.t - b.t);
  const runs = new Map();

  for (const entry of entries) {
    const runEntries = runs.get(entry.run) ?? [];
    runEntries.push(entry);
    runs.set(entry.run, runEntries);
  }

  if (runs.size === 0) {
    console.log("No [0NYA_PERF] entries found.");
    return;
  }

  for (const [runId, runEntries] of runs) {
    console.log(`Run ${runId}`);
    for (const [label, startEvent, endEvent] of METRICS) {
      console.log(`${label}: ${summarizeValues(collectPairDurations(runEntries, startEvent, endEvent))}`);
    }

    const bufferDurations = collectPairDurations(runEntries, "BUFFER_START", "BUFFER_END");
    console.log(`BUFFER_DURATION: ${summarizeValues(bufferDurations)}`);

    const explicitProgressDurations = runEntries
      .filter((entry) => entry.event === "PROGRESS_SYNC_END" && entry.duration_ms)
      .map((entry) => Number(entry.duration_ms))
      .filter(Number.isFinite);
    console.log(`PROGRESS_SYNC_DURATION: ${summarizeValues(explicitProgressDurations)}`);

    console.log("");
  }
}

main();
