#!/usr/bin/env node

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));

  if (match) {
    return match.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1] ?? "";
  }

  return "";
}

const baseUrl = readArg("base-url") || process.env.MUX_LOCAL_OPERATOR_BASE_URL || "http://127.0.0.1:3000";
const seriesSlug = readArg("series-slug");
const episodeNumber = Number(readArg("episode-number"));
const shortFilmSlug = readArg("short-film-slug");
const filePath = readArg("file");
const mediaAssetId = readArg("media-asset-id");
const rehydrate = process.argv.includes("--rehydrate") || readArg("mode") === "rehydrate";
const targetType = shortFilmSlug ? "SHORT_FILM" : "SERIES_EPISODE";

if (!rehydrate) {
  if (targetType === "SHORT_FILM") {
    if (!shortFilmSlug) {
      console.error("Missing --short-film-slug.");
      process.exit(1);
    }
  } else if (!seriesSlug || !Number.isInteger(episodeNumber) || episodeNumber <= 0) {
    console.error("Missing --series-slug or --episode-number.");
    process.exit(1);
  }

  if (!filePath && !mediaAssetId) {
    console.error("Provide --file for a fresh upload or --media-asset-id to reconcile an existing test asset.");
    process.exit(1);
  }
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/dev/mux/local-operator`, {
  body: JSON.stringify({
    episodeNumber,
    filePath: filePath || undefined,
    mediaAssetId: mediaAssetId || undefined,
    mode: rehydrate ? "rehydrate" : undefined,
    seriesSlug,
    shortFilmSlug: shortFilmSlug || undefined,
    targetType,
  }),
  headers: {
    "Content-Type": "application/json",
  },
  method: "POST",
});

const payload = await response.text();

if (!response.ok) {
  console.error(payload);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(payload);
} catch {
  console.log(payload);
  process.exit(0);
}

const lines = Array.isArray(data.targets)
  ? [
      `provider matching strategy: ${data.providerMatchingStrategy ?? "unknown"}`,
      `files changed: ${(data.filesChanged ?? []).join(", ")}`,
      ...data.targets.map((target) => {
        const detail = target.reason ? ` (${target.reason})` : "";
        const playback = target.playbackAuthorizationStatus ? `; playback authorization: ${target.playbackAuthorizationStatus}` : "";

        return `${target.label} = ${target.status}${detail}${playback}`;
      }),
      `security check: ${data.securityCheck ?? "unknown"}`,
      `STATUS / exact next action: ${data.status ?? "unknown"} / ${data.nextAction ?? "unknown"}`,
    ]
  : [
      `operator mechanism: ${data.operatorMechanism ?? "unknown"}`,
      `files changed: ${(data.filesChanged ?? []).join(", ")}`,
      `media row creation result: ${data.mediaRowCreationResult ?? "unknown"}`,
      `direct upload result: ${data.directUploadResult ?? "unknown"}`,
      `Mux upload state: ${data.muxUploadState ?? "unknown"}`,
      `Mux asset state: ${data.muxAssetState ?? "unknown"}`,
      `reconciliation result: ${data.reconciliationResult ?? "unknown"}`,
      `media_assets status: ${data.mediaAssetsStatus ?? "unknown"}`,
      `DB association: ${data.shortFilmAssociation ?? data.episodeAssociation ?? "unknown"}`,
      `signed playback authorization: ${data.signedPlaybackAuthorization ?? "unknown"}`,
      `security check: ${data.securityCheck ?? "unknown"}`,
      `STATUS / exact next action: ${data.status ?? "unknown"} / ${data.nextAction ?? "unknown"}`,
    ];

console.log(lines.join("\n"));
