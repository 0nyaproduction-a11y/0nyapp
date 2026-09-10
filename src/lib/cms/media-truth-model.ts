// Framework-free, server-only-free pure media-truth model.
//
// This module holds the normalized classification + mismatch-flag logic and the
// type contract for a media asset truth. It performs NO I/O (no Supabase, no
// Mux), which is what makes classifyMediaAssetWithProvider directly
// unit-testable under the Node test runner (see media-truth-model.test.ts). The
// server-only I/O wrapper (media-truth.ts) imports the classifiers from here
// and feeds them the aggregated provider truth derived from ONE bounded Mux
// provider inventory listing (never per-row Mux probes).

import type { MuxMediaAssetInspectionResult } from "@/lib/mux";
export type { MuxMediaAssetInspectionResult };
import type { Database } from "@/types/database";

export type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];
export type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];
type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
export type MediaAssetStatus = MediaAssetRow["status"];

// Reconciliation states produced by the live M3 provider inventory. This is the
// single source of truth for the provider-state vocabulary used across the
// truth model, the server inventory (media-truth-provider-inventory.ts), and
// the serializable Media view contract.
export type ProviderInventoryState =
  | "LINKED" // Asset has both a Supabase row and a live Mux asset
  | "MUX_ONLY" // Asset exists only in Mux (no matching Supabase row)
  | "SUPABASE_ONLY" // Asset exists only in Supabase (no Mux reference)
  | "AMBIGUOUS" // Multiple Supabase rows share one provider reference
  | "UNKNOWN"; // Cannot determine state (missing data or unpaginated coverage)
export type ProviderTruthState = ProviderInventoryState;

export type MediaTruthClassification =
  | "READY"
  | "PROCESSING"
  | "FAILED"
  | "MISSING";

export type MediaTruthFlag =
  | "READY_WITHOUT_PLAYBACK"
  | "PUBLISHED_BUT_UNPLAYABLE"
  | "UNASSIGNED"
  | "SHARED"
  | "PROVIDER_REFERENCE_MISMATCH"
  | "PROVIDER_REFERENCE_AMBIGUOUS"
  | "DERIVED_ORPHAN";

export const MEDIA_TRUTH_UNPROBED = "UNPROBED" as const;
export type MediaTruthLiveSource =
  | typeof MEDIA_TRUTH_UNPROBED
  | MuxMediaAssetInspectionResult;

export interface EpisodeRef {
  id: string;
  seriesId: string;
  episodeNumber: number;
  status: EpisodeRow["status"];
  publishedAt: string | null;
  seriesStatus: SeriesRow["status"];
  seriesPublishedAt: string | null;
}

export type EpisodeMediaReferenceRow = EpisodeRef & {
  mediaAssetId: string | null;
  legacyPreviewMediaAssetId: string | null;
};

/**
 * COMPATIBILITY_REFERENCE_SAFETY only.
 * The legacy preview column is not playback, provisioning, authoring, or a
 * player contract. It remains physical schema, so destructive media tooling
 * must count it until a separately authorized migration removes it.
 */
export function indexEpisodeMediaReferences(rows: EpisodeMediaReferenceRow[]): Map<string, EpisodeRef[]> {
  const byAsset = new Map<string, EpisodeRef[]>();
  for (const { mediaAssetId, legacyPreviewMediaAssetId, ...ref } of rows) {
    const assetIds = new Set(
      [mediaAssetId, legacyPreviewMediaAssetId]
        .map((assetId) => assetId?.trim() ?? "")
        .filter(Boolean),
    );
    for (const assetId of assetIds) {
      const existing = byAsset.get(assetId);
      if (existing) existing.push(ref);
      else byAsset.set(assetId, [ref]);
    }
  }
  return byAsset;
}

export interface ShortFilmRef {
  id: string;
  status: ShortFilmRow["status"];
  publishAt: string | null;
}

export interface DerivedChildRef {
  id: string;
  status: MediaAssetStatus;
}

export interface MediaAssetRefs {
  episodes: EpisodeRef[];
  shortFilms: ShortFilmRef[];
  derivedChildren: DerivedChildRef[];
}

export interface MediaAssetSubtitles {
  total: number;
  ready: number;
  failed: number;
  processing: number;
  pending: number;
  deleted: number;
}

export interface MediaAssetTruth {
  assetId: string;
  stored: MediaAssetRow;
  refs: MediaAssetRefs;
  subtitles: MediaAssetSubtitles;
  live: MediaTruthLiveSource;
  parentExists: boolean;
  classification: MediaTruthClassification;
  flags: MediaTruthFlag[];
}

export interface ClassifyInput {
  stored: MediaAssetRow;
  refs: MediaAssetRefs;
  live: MediaTruthLiveSource;
  parentExists: boolean;
}

export interface ClassifyResult {
  classification: MediaTruthClassification;
  flags: MediaTruthFlag[];
}

function mapStatus(status: MediaAssetStatus): MediaTruthClassification {
  if (status === "ready") return "READY";
  if (status === "failed") return "FAILED";
  return "PROCESSING";
}

function isReleased(issuedAt: string | null): boolean {
  return !issuedAt || new Date(issuedAt).getTime() <= Date.now();
}

// Exported so downstream consumers (e.g. the M6A delete-impact scanner) reuse
// the exact same published semantics as the media truth model.
export function isPublishedEpisode(ref: EpisodeRef): boolean {
  return (
    ref.status === "published" &&
    ref.seriesStatus === "published" &&
    isReleased(ref.publishedAt)
  );
}

// Exported so downstream consumers (e.g. the M6A delete-impact scanner) reuse
// the exact same published semantics as the media truth model.
export function isPublishedShortFilm(ref: ShortFilmRef): boolean {
  return ref.status === "published" && isReleased(ref.publishAt);
}
function countDirectContentRefs(refs: MediaAssetRefs): number {
  return refs.episodes.length + refs.shortFilms.length;
}

function pushContentFlags(flags: MediaTruthFlag[], refs: MediaAssetRefs): void {
  const directContentRefs = countDirectContentRefs(refs);
  if (directContentRefs === 0) {
    flags.push("UNASSIGNED");
  }
  if (directContentRefs > 1) {
    flags.push("SHARED");
  }
}

function pushPublishedButUnplayable(
  flags: MediaTruthFlag[],
  classification: MediaTruthClassification,
  refs: MediaAssetRefs,
): void {
  if (classification !== "READY") {
    const publishedMainContent =
      refs.episodes.some(isPublishedEpisode) ||
      refs.shortFilms.some(isPublishedShortFilm);
    if (publishedMainContent) {
      flags.push("PUBLISHED_BUT_UNPLAYABLE");
    }
  }
}

function pushDerivedOrphanFlag(
  flags: MediaTruthFlag[],
  stored: MediaAssetRow,
  parentExists: boolean,
): void {
  const isDerived = Boolean(stored.source_media_asset_id?.trim());
  if (isDerived && !parentExists) {
    flags.push("DERIVED_ORPHAN");
  }
}

// ---------------------------------------------------------------------------
// Legacy per-asset inspection classifier (kept for explicit Asset Detail and
// manual diagnostics). Media views classify through classifyMediaAssetWithProvider
// so UI flags reflect BOTH stored Supabase state and the single live Mux
// provider inventory result.
// ---------------------------------------------------------------------------
export function classifyMediaAsset(input: ClassifyInput): ClassifyResult {
  const { stored, refs, live, parentExists } = input;
  const flags: MediaTruthFlag[] = [];

  const probed = live !== MEDIA_TRUTH_UNPROBED;
  const liveResult = probed ? (live as MuxMediaAssetInspectionResult) : null;

  let classification: MediaTruthClassification;
  if (probed && liveResult?.status === "inspected") {
    const hasAssetRef = Boolean(stored.provider_asset_reference?.trim());
    const hasUploadRef = Boolean(stored.provider_upload_reference?.trim());
    const assetMissing = hasAssetRef && liveResult.muxAssetExists === false;
    const uploadOnlyMissing =
      !hasAssetRef && hasUploadRef && liveResult.muxUploadExists === false;
    if (assetMissing || uploadOnlyMissing) {
      classification = "MISSING";
    } else {
      classification = mapStatus(liveResult.mediaStatus);
    }
  } else if (probed && liveResult?.status === "not_found") {
    classification = "MISSING";
  } else {
    classification = mapStatus(stored.status);
  }

  const effectivePlaybackRef =
    probed && liveResult?.status === "inspected"
      ? (liveResult.signedPlaybackId?.trim() || null)
      : (stored.provider_playback_reference?.trim() || null);
  if (classification === "READY" && !effectivePlaybackRef) {
    flags.push("READY_WITHOUT_PLAYBACK");
  }

  pushPublishedButUnplayable(flags, classification, refs);
  pushContentFlags(flags, refs);

  if (probed && liveResult?.status === "inspected") {
    const storedAsset = stored.provider_asset_reference?.trim() || null;
    const liveAsset = liveResult.providerAssetReference?.trim() || null;
    const storedPlayback = stored.provider_playback_reference?.trim() || null;
    const livePlayback = liveResult.providerPlaybackReference?.trim() || null;
    const assetDrift = Boolean(storedAsset && liveAsset && storedAsset !== liveAsset);
    const playbackDrift = Boolean(
      storedPlayback && livePlayback && storedPlayback !== livePlayback,
    );
    if (assetDrift || playbackDrift) {
      flags.push("PROVIDER_REFERENCE_MISMATCH");
    }
  }

  pushDerivedOrphanFlag(flags, stored, parentExists);

  return { classification, flags };
}
// ---------------------------------------------------------------------------
// Provider-truth machinery (M5A). The server-side Media views reconcile every
// stored media_asset against ONE bounded live Mux provider inventory listing
// (getMuxProviderInventory). buildProviderTruthSnap derives the per-asset live
// provider truth from that listing, then classifyMediaAssetWithProvider derives
// the UI classification + flags from BOTH the stored Supabase row and the live
// provider state.
// ---------------------------------------------------------------------------

export interface ProviderTruthSnap {
  providerState: ProviderInventoryState;
  // Live matched Mux asset id (or the stored reference when unproven).
  providerAssetReference: string | null;
  // Live proven signed playback id only (null when not proven). Stored
  // playback stays visible separately through the stored row.
  providerPlaybackReference: string | null;
  muxAssetId: string | null;
  muxAssetStatus: string | null;
  muxUploadStatus: string | null;
  muxAssetExists: boolean;
  signedPlaybackId: string | null;
  duplicateCount: number;
  // false when the inventory listing was paginated/truncated, which makes an
  // absent asset UNPROVABLE rather than MISSING.
  muxInventoryComplete: boolean;
}

// Serializable subset of the server ProviderInventoryResult. The server result
// is structurally assignable to this; tests construct it directly.
export interface ProviderInventorySnapshot {
  muxAssets: Array<{
    id: string;
    passthrough?: string | null;
    playbackIds?: Array<
      { id: string; policy: "public" | "signed" | "drm" } | null
    > | null;
    status?: string | null;
    maxResolutionTier?: string | null;
    resolutionTier?: string | null;
  }>;
  reconciliation: Array<{
    mediaAssetId: string | null;
    muxAssetId?: string | null;
    state: ProviderInventoryState;
    muxStatus?: string | null;
    supabaseStatus?: string | null;
    providerReference?: string | null;
    duplicateCount?: number;
    error?: string | null;
  }>;
  pagination: { hasMore: boolean };
}

export function buildProviderTruthSnap(
  stored: MediaAssetRow,
  inventory: ProviderInventorySnapshot | null | undefined,
): ProviderTruthSnap {
  const storedAssetRef = stored.provider_asset_reference?.trim() || null;
  const storedUploadRef = stored.provider_upload_reference?.trim() || null;

  const muxAssets = inventory?.muxAssets ?? [];
  const reconciliation = inventory?.reconciliation ?? [];
  const muxInventoryComplete = inventory
    ? inventory.pagination.hasMore === false
    : false;

  // Strongest match first: exact provider_asset_reference, then passthrough
  // (the original upload media_asset_id).
  let muxAsset = storedAssetRef
    ? (muxAssets.find((asset) => asset.id === storedAssetRef) ?? null)
    : null;
  if (!muxAsset && storedUploadRef) {
    muxAsset =
      muxAssets.find(
        (asset) => asset.passthrough?.trim() === storedUploadRef,
      ) ?? null;
  }

  const muxAssetExists = Boolean(muxAsset);
  const muxAssetStatus = muxAsset?.status?.trim() || null;
  const signedPlaybackId =
    muxAsset?.playbackIds?.find(
      (playbackId) => playbackId?.policy === "signed",
    )?.id?.trim() ?? null;

  const item =
    reconciliation.find((r) => r.mediaAssetId === stored.id) ?? null;

  let providerState: ProviderInventoryState;
  if (item) {
    providerState = item.state;
  } else if (!storedAssetRef && !storedUploadRef) {
    // Stored row with no provider reference at all.
    providerState = "SUPABASE_ONLY";
  } else {
    // Stored row references provider assets that the live inventory did not
    // surface under this (bounded) listing -> unproven, never auto-assumed.
    providerState = "UNKNOWN";
  }

  return {
    providerState,
    providerAssetReference: muxAsset?.id ?? storedAssetRef,
    providerPlaybackReference: signedPlaybackId,
    muxAssetId: muxAsset?.id ?? null,
    muxAssetStatus,
    muxUploadStatus: null,
    muxAssetExists,
    signedPlaybackId,
    duplicateCount: item?.duplicateCount ?? 1,
    muxInventoryComplete,
  };
}

export interface ClassifyWithProviderInput {
  stored: MediaAssetRow;
  refs: MediaAssetRefs;
  parentExists: boolean;
  provider: ProviderTruthSnap;
}
// Derives the UI classification + flags from BOTH the stored Supabase row and
// the live provider state:
//   - Supabase ready + Mux reference absent (complete inventory) -> MISSING
//   - live Mux errored/deleted/cancelled (even when Supabase says ready) -> FAILED
//   - ready + valid live signed playback -> READY (+ "connected" via deriveMuxConnected)
//   - duplicate mapping -> providerState AMBIGUOUS + PROVIDER_REFERENCE_AMBIGUOUS flag
//   - Mux-only / Supabase-only / unprovable -> providerState-driven, never connected
export function classifyMediaAssetWithProvider(
  input: ClassifyWithProviderInput,
): ClassifyResult {
  const { stored, refs, parentExists, provider } = input;
  const flags: MediaTruthFlag[] = [];

  const storedAssetRef = stored.provider_asset_reference?.trim() || null;
  const storedUploadRef = stored.provider_upload_reference?.trim() || null;
  const expectsProviderRefs = Boolean(storedAssetRef || storedUploadRef);

  const muxReady = provider.muxAssetStatus === "ready";
  const muxErrored =
    provider.muxAssetStatus === "errored" ||
    provider.muxAssetStatus === "deleted" ||
    provider.muxAssetStatus === "cancelled";
  const muxMissing = expectsProviderRefs && !provider.muxAssetExists;

  let classification: MediaTruthClassification;
  if (provider.providerState === "MUX_ONLY") {
    // A Mux-only provider asset has no stored row; this branch is defensive for
    // callers that classify a provider-only snapshot. Classification falls back
    // to stored semantics (Media views surface MUX_ONLY rows separately).
    classification = mapStatus(stored.status);
  } else if (muxMissing && provider.muxInventoryComplete) {
    // Stored row claims a provider reference that the complete live Mux
    // inventory does not contain: the provider asset is MISSING.
    classification = "MISSING";
  } else if (muxErrored) {
    // Live Mux state wins over stored "ready".
    classification = "FAILED";
  } else if (muxReady) {
    // Live asset is ready, but preserve an explicit stored failure.
    classification = stored.status === "failed" ? "FAILED" : "READY";
  } else if (provider.muxAssetExists) {
    // Live asset exists but is still processing/preparing/waiting.
    classification = stored.status === "failed" ? "FAILED" : "PROCESSING";
  } else {
    // No live provider evidence (SUPABASE_ONLY, UNKNOWN, or pagination
    // truncation): classify from stored state but never claim proven playback.
    classification = mapStatus(stored.status);
  }

  if (classification === "READY" && !provider.signedPlaybackId) {
    flags.push("READY_WITHOUT_PLAYBACK");
  }

  pushPublishedButUnplayable(flags, classification, refs);
  pushContentFlags(flags, refs);

  // Duplicate provider mapping (shared provider_asset_reference).
  if (provider.providerState === "AMBIGUOUS") {
    flags.push("PROVIDER_REFERENCE_AMBIGUOUS");
  }

  // Live-aware provider-reference mismatch: only when a live Mux asset was
  // actually matched can drift between stored and live references be proven.
  if (provider.muxAssetExists) {
    const storedAsset = storedAssetRef;
    const liveAsset = provider.providerAssetReference?.trim() || null;
    const storedPlayback =
      stored.provider_playback_reference?.trim() || null;
    const livePlayback = provider.providerPlaybackReference?.trim() || null;
    const assetDrift = Boolean(storedAsset && liveAsset && storedAsset !== liveAsset);
    const playbackDrift = Boolean(
      storedPlayback && livePlayback && storedPlayback !== livePlayback,
    );
    if (assetDrift || playbackDrift) {
      flags.push("PROVIDER_REFERENCE_MISMATCH");
    }
  }

  pushDerivedOrphanFlag(flags, stored, parentExists);

  return { classification, flags };
}

// Whether the Mux provider connection column can truthfully report YES. A Mux
// asset must exist, be ready in the live inventory, carry a valid signed
// playback id, and not be ambiguous/unlinked.
export function deriveMuxConnected(
  classification: MediaTruthClassification,
  provider: ProviderTruthSnap,
): boolean {
  return (
    classification === "READY" &&
    provider.muxAssetExists &&
    provider.muxAssetStatus === "ready" &&
    Boolean(provider.signedPlaybackId) &&
    provider.providerState !== "AMBIGUOUS" &&
    provider.providerState !== "MUX_ONLY" &&
    provider.providerState !== "SUPABASE_ONLY"
  );
}

// Classification for Mux assets that exist only in the provider inventory
// (no stored Supabase row). Never derived through the stored classifier; Media
// views surface these read-only MUX_ONLY entries without importing them.
export function classifyProviderOnlyMuxAsset(
  muxStatus: string | null,
): MediaTruthClassification {
  if (muxStatus === "ready") return "READY";
  if (muxStatus === "errored" || muxStatus === "deleted" || muxStatus === "cancelled") {
    return "FAILED";
  }
  return "PROCESSING";
}
// ---------------------------------------------------------------------------
// Serializable Media view contract. The server page loads rows through the
// server-only views layer and passes this JSON-safe data to the client
// component. Nothing here is server-only, so MediaAdminClient can type its
// props from this module without pulling the server bundle into the client.
// ---------------------------------------------------------------------------
export type MediaViewTab = "all" | "processing" | "problems" | "unassigned";

export interface MediaViewContentRefs {
  episodes: number;
  shortFilms: number;
}

export interface MediaViewRow {
  // Identity + stored (Supabase) state — preserved and separately visible.
  assetId: string;
  storedStatus: string | null;
  createdAt: string;
  provider: string;
  providerUploadReference: string | null;
  providerAssetReference: string | null;
  providerPlaybackReference: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  sourceMediaAssetId: string | null;
  derivedChildRefs: Array<{ id: string; status: string }>;
  contentRefs: MediaViewContentRefs;

  // Derived UI classification + flags (stored state AND live provider state).
  classification: MediaTruthClassification;
  flags: MediaTruthFlag[];

  // Live provider truth (single bounded inventory, never per-row probes).
  providerState: ProviderInventoryState;
  muxAssetId: string | null;
  muxAssetStatus: string | null;
  muxUploadStatus: string | null;
  muxConnected: boolean;
  playbackStatus: string;
  supabaseConnected: boolean;

  // Tab support.
  published: boolean;
  processingAgeSeconds: number;
  lastKnownMuxStatus: string | null;
  lastKnownSupabaseStatus: string | null;
  severity: "high" | "medium" | "low";
  problemFlags: MediaTruthFlag[];
  publicationImpact: boolean;

  // Mux-only marker (row synthesized from the provider inventory, no stored row).
  isMuxOnly: boolean;

  // Explicit Asset Detail diagnostics (populated only by getAssetDetailMedia).
  maxResolutionTier: string | null;
  resolutionTier: string | null;
}

export interface MediaViewListResult {
  rows: MediaViewRow[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
}
