import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildProviderTruthSnap,
  classifyMediaAssetWithProvider,
  classifyProviderOnlyMuxAsset,
  deriveMuxConnected,
  indexEpisodeMediaReferences,
  type MediaAssetRow,
  type MediaAssetRefs,
  type ProviderInventorySnapshot,
} from "./media-truth-model";

/**
 * M5A — targeted tests for live-vs-stored disagreement.
 *
 * The Media views classify each stored media_asset from BOTH the stored
 * Supabase row and the single bounded live Mux provider inventory listing.
 * These tests pin the disagreement semantics:
 *
 *   - Supabase ready + Mux reference absent (complete inventory)  -> MISSING
 *   - Supabase ready + live Mux errored                           -> FAILED
 *   - ready + valid live signed playback                          -> READY + connected
 *   - duplicate mapping                                           -> AMBIGUOUS
 *   - Mux-only assets (no stored row)                             -> MUX_ONLY (never imported)
 *   - Supabase-only rows                                          -> SUPABASE_ONLY
 *   - unprovable (paginated/truncated inventory)                  -> UNKNOWN, not MISSING
 *
 * This module is pure and server-only-free, so it runs under the Node test
 * runner (tsx --test) without touching Mux, Supabase, or the network.
 */

function storedRow(overrides: Partial<MediaAssetRow> = {}): MediaAssetRow {
  return {
    id: "asset-1",
    created_at: "2026-09-05T00:00:00Z",
    updated_at: "2026-09-05T00:00:00Z",
    provider_name: "mux",
    status: "ready",
    provider_upload_reference: null,
    provider_asset_reference: "mux-asset-1",
    provider_playback_reference: null,
    failure_code: null,
    failure_message: null,
    source_media_asset_id: null,
    ...overrides,
  } as unknown as MediaAssetRow;
}

function refs(overrides: Partial<MediaAssetRefs> = {}): MediaAssetRefs {
  return {
    episodes: [],
    shortFilms: [],
    derivedChildren: [],
    ...overrides,
  };
}

function inventory(overrides?: Partial<ProviderInventorySnapshot>): ProviderInventorySnapshot {
  return {
    muxAssets: [],
    reconciliation: [],
    pagination: { hasMore: false },
    ...overrides,
  };
}

describe("M5A live-vs-stored disagreement — classification", () => {
  test("Supabase ready + Mux reference absent (complete inventory) => MISSING problem", () => {
    const stored = storedRow({
      status: "ready",
      provider_asset_reference: "mux-gone",
    });
    const inv = inventory({
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: null,
          state: "UNKNOWN",
          muxStatus: null,
          supabaseStatus: "ready",
          providerReference: "mux-gone",
          duplicateCount: 1,
          error: "Provider reference was not found in the live Mux inventory.",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    assert.equal(provider.muxAssetExists, false);
    assert.equal(provider.providerState, "UNKNOWN");
    assert.equal(provider.muxInventoryComplete, true);

    const { classification, flags } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    assert.equal(classification, "MISSING");
    assert.equal(deriveMuxConnected(classification, provider), false);
    assert.equal(flags.includes("READY_WITHOUT_PLAYBACK"), false);
  });

  test("live Mux errored + Supabase ready => FAILED (live wins over stored)", () => {
    const stored = storedRow({ status: "ready", provider_asset_reference: "mux-abc" });
    const inv = inventory({
      muxAssets: [
        {
          id: "mux-abc",
          status: "errored",
          playbackIds: [{ id: "pb", policy: "signed" }],
        },
      ],
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: "mux-abc",
          state: "LINKED",
          muxStatus: "errored",
          supabaseStatus: "ready",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    assert.equal(provider.muxAssetExists, true);
    assert.equal(provider.muxAssetStatus, "errored");

    const { classification } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    assert.equal(classification, "FAILED");
    assert.equal(deriveMuxConnected(classification, provider), false);
  });

  test("ready + valid live signed playback => READY + Mux connected YES", () => {
    const stored = storedRow({ status: "ready", provider_asset_reference: "mux-abc" });
    const inv = inventory({
      muxAssets: [
        {
          id: "mux-abc",
          status: "ready",
          playbackIds: [{ id: "pb-signed", policy: "signed" }],
        },
      ],
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: "mux-abc",
          state: "LINKED",
          muxStatus: "ready",
          supabaseStatus: "ready",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    assert.equal(provider.signedPlaybackId, "pb-signed");

    const { classification, flags } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    assert.equal(classification, "READY");
    assert.equal(flags.includes("READY_WITHOUT_PLAYBACK"), false);
    assert.equal(deriveMuxConnected(classification, provider), true);
  });
test("mux ready but no valid signed playback => READY but NOT connected", () => {
    const stored = storedRow({ status: "ready", provider_asset_reference: "mux-abc" });
    const inv = inventory({
      muxAssets: [{ id: "mux-abc", status: "ready", playbackIds: [] }],
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: "mux-abc",
          state: "LINKED",
          muxStatus: "ready",
          supabaseStatus: "ready",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    const { classification, flags } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    assert.equal(classification, "READY");
    assert.equal(flags.includes("READY_WITHOUT_PLAYBACK"), true);
    assert.equal(deriveMuxConnected(classification, provider), false);
  });

  test("duplicate mapping => AMBIGUOUS, never connected", () => {
    const stored = storedRow({ status: "ready", provider_asset_reference: "mux-shared" });
    const inv = inventory({
      muxAssets: [
        {
          id: "mux-shared",
          status: "ready",
          playbackIds: [{ id: "pb-signed", policy: "signed" }],
        },
      ],
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: "mux-shared",
          state: "AMBIGUOUS",
          muxStatus: "ready",
          supabaseStatus: "ready",
          duplicateCount: 2,
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    assert.equal(provider.providerState, "AMBIGUOUS");
    assert.equal(provider.duplicateCount, 2);

    const { classification, flags } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    assert.equal(flags.includes("PROVIDER_REFERENCE_AMBIGUOUS"), true);
    assert.equal(deriveMuxConnected(classification, provider), false);
  });

  test("SUPABASE_ONLY row (no provider references) => state + no playback claim", () => {
    const stored = storedRow({
      status: "ready",
      provider_upload_reference: null,
      provider_asset_reference: null,
      provider_playback_reference: "stale-stored-playback",
    });
    const inv = inventory({
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: null,
          state: "SUPABASE_ONLY",
          muxStatus: null,
          supabaseStatus: "ready",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    assert.equal(provider.providerState, "SUPABASE_ONLY");
    assert.equal(provider.muxAssetExists, false);

    const { classification, flags } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    // Stored status preserved, but no live playback proof exists.
    assert.equal(classification, "READY");
    assert.equal(flags.includes("READY_WITHOUT_PLAYBACK"), true);
    assert.equal(deriveMuxConnected(classification, provider), false);
  });
test("unprovable (paginated/truncated inventory) => UNKNOWN, NOT MISSING", () => {
    const stored = storedRow({
      status: "ready",
      provider_asset_reference: "mux-maybe-later-page",
    });
    const inv = inventory({
      pagination: { hasMore: true },
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: null,
          state: "UNKNOWN",
          muxStatus: null,
          supabaseStatus: "ready",
          providerReference: "mux-maybe-later-page",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    assert.equal(provider.muxAssetExists, false);
    assert.equal(provider.muxInventoryComplete, false);

    const { classification } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    // Absence is unprovable here: do NOT claim MISSING.
    assert.notEqual(classification, "MISSING");
    assert.equal(classification, "READY");
    assert.equal(deriveMuxConnected(classification, provider), false);
  });

  test("provider-reference mismatch flag is live-aware (stored ref drifts from live Mux)", () => {
    const stored = storedRow({
      status: "ready",
      provider_asset_reference: "mux-old",
      provider_upload_reference: "up-1",
    });
    const inv = inventory({
      muxAssets: [
        {
          id: "mux-new",
          passthrough: "up-1",
          status: "ready",
          playbackIds: [{ id: "pb-signed", policy: "signed" }],
        },
      ],
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: "mux-new",
          state: "LINKED",
          muxStatus: "ready",
          supabaseStatus: "ready",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    // Matched through passthrough; live asset id differs from the stored ref.
    assert.equal(provider.muxAssetId, "mux-new");
    assert.equal(provider.providerAssetReference, "mux-new");

    const { classification, flags } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    assert.equal(flags.includes("PROVIDER_REFERENCE_MISMATCH"), true);
    assert.equal(classification, "READY");
  });

  test("stored failed + live ready => FAILED preserved (no false connected)", () => {
    const stored = storedRow({ status: "failed", provider_asset_reference: "mux-abc" });
    const inv = inventory({
      muxAssets: [
        {
          id: "mux-abc",
          status: "ready",
          playbackIds: [{ id: "pb-signed", policy: "signed" }],
        },
      ],
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: "mux-abc",
          state: "LINKED",
          muxStatus: "ready",
          supabaseStatus: "failed",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    const { classification } = classifyMediaAssetWithProvider({
      stored,
      refs: refs(),
      parentExists: true,
      provider,
    });

    assert.equal(classification, "FAILED");
    assert.equal(deriveMuxConnected(classification, provider), false);
  });

  test("passthrough-only match resolves the live Mux asset + signed playback", () => {
    const stored = storedRow({
      status: "ready",
      provider_asset_reference: null,
      provider_upload_reference: "up-original",
    });
    const inv = inventory({
      muxAssets: [
        {
          id: "mux-from-upload",
          passthrough: "up-original",
          status: "ready",
          playbackIds: [{ id: "pb-signed", policy: "signed" }],
        },
      ],
      reconciliation: [
        {
          mediaAssetId: "asset-1",
          muxAssetId: "mux-from-upload",
          state: "LINKED",
          muxStatus: "ready",
          supabaseStatus: "ready",
        },
      ],
    });

    const provider = buildProviderTruthSnap(stored, inv);
    assert.equal(provider.muxAssetExists, true);
    assert.equal(provider.muxAssetId, "mux-from-upload");
    assert.equal(provider.signedPlaybackId, "pb-signed");
  });
});

describe("M5A MUX_ONLY provider assets", () => {
  test("classifyProviderOnlyMuxAsset maps live Mux status", () => {
    assert.equal(classifyProviderOnlyMuxAsset("ready"), "READY");
    assert.equal(classifyProviderOnlyMuxAsset("errored"), "FAILED");
    assert.equal(classifyProviderOnlyMuxAsset("deleted"), "FAILED");
    assert.equal(classifyProviderOnlyMuxAsset("processing"), "PROCESSING");
    assert.equal(classifyProviderOnlyMuxAsset(null), "PROCESSING");
  });
});

describe("W01 legacy preview database reference compatibility safety", () => {
  const legacyEpisode = (overrides: Record<string, string | null> = {}) => ({
    id: "episode-legacy",
    seriesId: "series-1",
    episodeNumber: 1,
    status: "draft" as const,
    publishedAt: null,
    seriesStatus: "draft" as const,
    seriesPublishedAt: null,
    mediaAssetId: null,
    legacyPreviewMediaAssetId: "legacy-asset",
    ...overrides,
  });

  test("current main media reference is indexed", () => {
    const refs = indexEpisodeMediaReferences([
      legacyEpisode({ mediaAssetId: "main-asset", legacyPreviewMediaAssetId: null }),
    ]);
    assert.equal(refs.get("main-asset")?.length, 1);
  });

  test("legacy-only preview database reference is indexed for deletion protection", () => {
    const refs = indexEpisodeMediaReferences([legacyEpisode()]);
    assert.equal(refs.get("legacy-asset")?.length, 1);
    assert.equal(refs.get("legacy-asset")?.[0].id, "episode-legacy");
  });

  test("null legacy field creates no false reference", () => {
    const refs = indexEpisodeMediaReferences([
      legacyEpisode({ mediaAssetId: null, legacyPreviewMediaAssetId: null }),
    ]);
    assert.equal(refs.size, 0);
  });

  test("main plus legacy reference to the same asset is deduplicated", () => {
    const refs = indexEpisodeMediaReferences([
      legacyEpisode({ mediaAssetId: "shared-asset", legacyPreviewMediaAssetId: "shared-asset" }),
    ]);
    assert.equal(refs.get("shared-asset")?.length, 1);
  });

  test("published legacy-only reference remains visible to published-content delete impact", () => {
    const refs = indexEpisodeMediaReferences([
      legacyEpisode({
        status: "published",
        publishedAt: "2026-01-01T00:00:00.000Z",
        seriesStatus: "published",
        seriesPublishedAt: "2026-01-01T00:00:00.000Z",
      }),
    ]);
    const legacyRefs = refs.get("legacy-asset") ?? [];
    assert.equal(legacyRefs.length, 1);
    assert.equal(legacyRefs[0].status, "published");
    assert.equal(legacyRefs[0].seriesStatus, "published");
  });
});
