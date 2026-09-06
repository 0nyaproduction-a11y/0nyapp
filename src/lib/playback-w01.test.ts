import { before, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const NodeModule = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const originalLoad = NodeModule._load;

NodeModule._load = function (this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") {
    return { __esModule: true, default: undefined };
  }
  return originalLoad.call(this, request, parent, isMain);
};

type PlaybackApi = {
  authorizeMuxPlayback: typeof import("@/lib/playback").authorizeMuxPlayback;
  authorizeMuxPreviewPlayback: typeof import("@/lib/playback").authorizeMuxPreviewPlayback;
};

let playbackApi: PlaybackApi;

before(async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.MUX_PLAYBACK_SIGNING_KEY_ID = "test-signing-key";
  process.env.MUX_PLAYBACK_SIGNING_PRIVATE_KEY = privateKey
    .export({ type: "pkcs1", format: "pem" })
    .toString();
  playbackApi = (await import("@/lib/playback")) as PlaybackApi;
});

/**
 * W01 locked-preview authorization (architecture correction:
 * "REMOVE PREVIEW-CLIP ARCHITECTURE / USE SAME VIDEO FOR W01").
 *
 * These cases lock the server contract: a locked episode's preview authorizes
 * the SAME main media source (no separate preview clip/asset is required or
 * consulted), never grants full playback, and keeps the content/classification
 * gates identical to full playback.
 */

const MAIN_PLAYBACK_REFERENCE = "main-playback-id-abc123";
const GUEST = { userId: null as string | null };
const TARGET = { targetType: "SERIES_EPISODE" as const, episodeNumber: 1, seriesSlug: "chaadar" };

type FakeRow = Record<string, unknown>;
type FakeTables = { series: FakeRow[]; episodes: FakeRow[]; media_assets: FakeRow[] };

type QueryLike = {
  select: () => QueryLike;
  eq: (field: string, value: unknown) => QueryLike;
  maybeSingle: () => Promise<{ data: FakeRow | null; error: null }>;
};

function buildQuery(
  rows: FakeRow[],
  filters: Array<[string, unknown]>,
  guardPreviewAssetQueries: boolean,
): QueryLike {
  const current = () =>
    rows.filter((row) => filters.every(([field, value]) => row[field] === value));

  const query: QueryLike = {
    select: () => query,
    eq: (field: string, value: unknown) => {
      if (guardPreviewAssetQueries && field === "id" && typeof value === "string" && value.startsWith("preview-asset-")) {
        throw new Error(`Unexpected preview-clip media query for id=${value}; W01 must use the main media source.`);
      }
      filters.push([field, value]);
      return query;
    },
    maybeSingle: async () => ({ data: current()[0] ?? null, error: null }),
  };

  return query;
}

function createFakeSupabase(
  tables: FakeTables,
  guardPreviewAssetQueries = false,
): SupabaseClient<Database> {
  const rowsByTable: Record<string, FakeRow[]> = {
    series: tables.series,
    episodes: tables.episodes,
    media_assets: tables.media_assets,
  };

  const fake = {
    error: null,
    from(table: string) {
      return buildQuery(rowsByTable[table] ?? [], [], guardPreviewAssetQueries);
    },
  };

  return fake as unknown as SupabaseClient<Database>;
}

function seriesRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "series-1",
    status: "published",
    slug: "chaadar",
    title: "Chaadar",
    content_rating: "U/A 13+",
    content_descriptors: [],
    ...overrides,
  };
}

function episodeRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "episode-1",
    series_id: "series-1",
    episode_number: 1,
    status: "published",
    published_at: "2026-01-01T00:00:00.000Z",
    title: "Chapter One",
    synopsis: "Synopsis",
    duration_seconds: 180,
    is_free: false,
    coin_unlock_enabled: true,
    coin_price: 10,
    rewarded_unlock_enabled: false,
    rewarded_access_mode: "completions",
    required_rewarded_completions: 1,
    plus_access: false,
    locked_preview_seconds: 5,
    content_rating_override: null,
    content_descriptors_override: null,
    media_asset_id: "main-asset-1",
    preview_media_asset_id: null,
    ...overrides,
  };
}

function mainMediaAssetRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "main-asset-1",
    status: "ready",
    provider_name: "mux",
    provider_asset_reference: "main-asset-id",
    provider_playback_reference: MAIN_PLAYBACK_REFERENCE,
    source_media_asset_id: null,
    clip_start_seconds: null,
    clip_end_seconds: null,
    ...overrides,
  };
}

function buildTables(overrides: { episode?: Partial<FakeRow>; media?: Partial<FakeRow>; series?: Partial<FakeRow> } = {}): FakeTables {
  return {
    series: [seriesRow(overrides.series)],
    episodes: [episodeRow(overrides.episode)],
    media_assets: [mainMediaAssetRow(overrides.media)],
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const segments = token.split(".");
  assert.ok(segments.length >= 2, "Expected a JWT token.");
  const raw = Buffer.from(segments[1], "base64url").toString("utf8");
  return JSON.parse(raw);
}

test("W01: locked episode preview returns previewSeconds=5 and a URL signed for the SAME main media source", async () => {
  const supabase = createFakeSupabase(buildTables(), true);
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  assert.equal(result.previewSeconds, 5);
  assert.ok(result.previewUrl.startsWith(`https://stream.mux.com/${MAIN_PLAYBACK_REFERENCE}.m3u8?token=`), result.previewUrl);
  assert.ok(result.previewUrl !== MAIN_PLAYBACK_REFERENCE);
  assert.ok(Date.parse(result.expiresAt) > Date.now());

  const token = result.previewUrl.split("token=")[1];
  const payload = decodeJwtPayload(token);
  assert.equal(payload.sub, MAIN_PLAYBACK_REFERENCE);
  assert.equal(payload.aud, "v");
  assert.equal(payload.max_resolution, "720p");
  assert.equal(payload.asset_start_time, 0);
  assert.equal(payload.asset_end_time, 5);
  const remainingTtlSeconds = (payload.exp as number) - Math.floor(Date.now() / 1000);
  assert.ok(remainingTtlSeconds >= 119 && remainingTtlSeconds <= 120);
  assert.deepEqual([...new URL(result.previewUrl).searchParams.keys()], ["token"]);
});

test("W01: caller URL parameters cannot enlarge signed preview claims", async () => {
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, {
    ...GUEST,
    supabase: createFakeSupabase(buildTables()),
  });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  const tampered = new URL(result.previewUrl);
  tampered.searchParams.set("asset_end_time", "180");
  const signedPayload = decodeJwtPayload(tampered.searchParams.get("token") ?? "");
  assert.equal(signedPayload.asset_start_time, 0);
  assert.equal(signedPayload.asset_end_time, 5);
});

test("W01: caller-supplied clip boundaries cannot expand the authoritative episode duration", async () => {
  const callerControlledTarget = {
    ...TARGET,
    assetStartTime: 0,
    assetEndTime: 180,
    previewSeconds: 180,
  };
  const result = await playbackApi.authorizeMuxPreviewPlayback(callerControlledTarget, {
    ...GUEST,
    supabase: createFakeSupabase(buildTables()),
  });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  assert.equal(result.previewSeconds, 5);
  const payload = decodeJwtPayload(new URL(result.previewUrl).searchParams.get("token") ?? "");
  assert.equal(payload.asset_start_time, 0);
  assert.equal(payload.asset_end_time, 5);
});

test("W01: a stale preview_media_asset_id is irrelevant when the main media is ready", async () => {
  const supabase = createFakeSupabase(
    buildTables({ episode: { preview_media_asset_id: "preview-asset-orphan" } }),
    true,
  );
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.previewSeconds, 5);
  assert.ok(result.previewUrl.includes(MAIN_PLAYBACK_REFERENCE));
});

test("W01: a legacy preview clip row (correct config) is never consulted", async () => {
  const supabase = createFakeSupabase(
    {
      series: [seriesRow()],
      episodes: [episodeRow({ preview_media_asset_id: "preview-asset-legacy" })],
      media_assets: [
        mainMediaAssetRow(),
        {
          id: "preview-asset-legacy",
          status: "errored",
          provider_name: "mux",
          provider_asset_reference: "preview-asset-id",
          provider_playback_reference: "preview-playback-id",
          source_media_asset_id: "main-asset-1",
          clip_start_seconds: 0,
          clip_end_seconds: 5,
        },
      ],
    },
    true,
  );
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.ok(!result.previewUrl.includes("preview-playback-id"));
  assert.ok(result.previewUrl.includes(MAIN_PLAYBACK_REFERENCE));
});

test("W01: legacy field exists only in explicit compatibility-reference safety paths", () => {
  const root = process.cwd();
  const prohibitedRuntimeFiles = [
    "src/lib/playback.ts",
    "src/lib/mux/index.ts",
    "src/components/cms/EpisodeMetadataForm.tsx",
    "src/components/cms/EpisodeMediaAssignmentForm.tsx",
    "src/components/cms/BulkEpisodeUploadForm.tsx",
    "apps/android/src/lib/api.ts",
    "apps/android/src/types/api.ts",
  ];

  for (const relativeFile of prohibitedRuntimeFiles) {
    const source = fs.readFileSync(path.join(root, relativeFile), "utf8");
    assert.ok(!source.includes("preview_media_asset_id"), `${relativeFile} must not use the legacy preview field`);
    assert.ok(!source.includes("createMuxPreviewClip"), `${relativeFile} must not create a separate Mux preview clip`);
    assert.ok(!source.includes("provisionEpisodePreviewMediaAsset"), `${relativeFile} must not provision preview media`);
  }

  const compatibilityFiles = [
    "src/lib/cms/episodes.ts",
    "src/lib/cms/media.ts",
    "src/lib/cms/media-truth.ts",
  ];
  for (const relativeFile of compatibilityFiles) {
    const source = fs.readFileSync(path.join(root, relativeFile), "utf8");
    assert.ok(source.includes("preview_media_asset_id"), `${relativeFile} must preserve the legacy DB reference`);
    assert.ok(source.includes("COMPATIBILITY_REFERENCE_SAFETY"), `${relativeFile} must classify the compatibility read`);
    assert.ok(!source.includes("createMuxPreviewClip"), `${relativeFile} must not create a separate Mux preview clip`);
    assert.ok(!source.includes("provisionEpisodePreviewMediaAsset"), `${relativeFile} must not provision preview media`);
  }

  const cmsEpisodeSource = fs.readFileSync(path.join(root, "src/lib/cms/episodes.ts"), "utf8");
  assert.ok(cmsEpisodeSource.includes("locked_preview_seconds: input.lockedPreviewSeconds"));
});

test("W01: free/watchable episodes require no preview", async () => {
  const supabase = createFakeSupabase(buildTables({ episode: { is_free: true } }), true);
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "preview_not_required");
});

test("W01: locked_preview_seconds <= 0 yields preview_unavailable", async () => {
  const supabase = createFakeSupabase(buildTables({ episode: { locked_preview_seconds: 0 } }), true);
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "preview_unavailable");
});

test("W01: an episode with no media_asset_id yields preview_unavailable", async () => {
  const supabase = createFakeSupabase(buildTables({ episode: { media_asset_id: null } }), true);
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "preview_unavailable");
});

test("W01: main media not yet ready yields preview_not_ready", async () => {
  const supabase = createFakeSupabase(buildTables({ media: { status: "processing", provider_playback_reference: null } }), true);
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "preview_not_ready");
});

test("W01: main media without a playback reference yields preview_unavailable", async () => {
  const supabase = createFakeSupabase(buildTables({ media: { provider_playback_reference: "" } }), true);
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "preview_unavailable");
});

test("W01: unknown series or episode yields not_found", async () => {
  const supabase = createFakeSupabase({ series: [], episodes: [], media_assets: [] });
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "not_found");
});

test("W01: full playback (/playback) stays gated for a locked guest (access_required, not public)", async () => {
  const supabase = createFakeSupabase(buildTables(), true);
  const result = await playbackApi.authorizeMuxPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "access_required");
});

test("W01: full playback JWT never inherits preview clipping claims", async () => {
  const supabase = createFakeSupabase(buildTables({ episode: { is_free: true } }));
  const result = await playbackApi.authorizeMuxPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  const payload = decodeJwtPayload(result.playbackUrl.split("token=")[1]);
  assert.equal(payload.asset_start_time, undefined);
  assert.equal(payload.asset_end_time, undefined);
  assert.equal(payload.sub, MAIN_PLAYBACK_REFERENCE);
});

test("W01: preview does not bypass the age gate (age_verification_required)", async () => {
  const supabase = createFakeSupabase(
    buildTables({ series: { content_rating: "A", content_descriptors: [] } }),
    true,
  );
  const result = await playbackApi.authorizeMuxPreviewPlayback(TARGET, { ...GUEST, supabase });

  assert.equal(result.status, "age_verification_required");
});
