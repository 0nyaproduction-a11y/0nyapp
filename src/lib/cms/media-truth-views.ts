import "server-only";

import { inspectMuxMediaAssetState } from "@/lib/mux";
import { buildMediaTruth } from "./media-truth";
import {
  getAssetsByState,
  getMuxProviderInventory,
  type ProviderInventoryResult,
} from "./media-truth-provider-inventory";
import {
  buildProviderTruthSnap,
  classifyProviderOnlyMuxAsset,
  deriveMuxConnected,
  type MediaAssetTruth,
  type MediaTruthClassification,
  type MediaTruthFlag,
  type MediaViewRow,
  type MediaViewTab,
  type ProviderInventoryState,
} from "./media-truth-model";

export type { MediaViewRow, MediaViewTab, MediaTruthClassification, MediaTruthFlag } from "./media-truth-model";

export type MediaViewSortField =
  | "created_at"
  | "updated_at"
  | "classification"
  | "refs"
  | "status";

export type MediaViewSortOrder = "asc" | "desc";

export interface MediaViewOptions {
  probeMux?: boolean;
  assetIds?: string[];
  sortBy?: MediaViewSortField;
  sortOrder?: MediaViewSortOrder;
  classificationFilter?: MediaTruthClassification[];
  flagFilter?: MediaTruthFlag[];
  search?: string;
  status?: string;
  tab?: MediaViewTab;
  page?: number;
  pageSize?: number;
}

// Deterministic tab filter shared by the server view and the client (which
// filters the preloaded "all" rows locally for instant tab switching).
function matchesTab(tab: MediaViewTab, row: MediaViewRow): boolean {
  switch (tab) {
    case "processing":
      return row.classification === "PROCESSING";
    case "problems":
      return (
        row.classification === "FAILED" ||
        row.classification === "MISSING" ||
        row.flags.includes("PUBLISHED_BUT_UNPLAYABLE") ||
        row.flags.includes("PROVIDER_REFERENCE_MISMATCH") ||
        row.flags.includes("PROVIDER_REFERENCE_AMBIGUOUS") ||
        row.isMuxOnly
      );
    case "unassigned":
      return (
        row.classification === "READY" &&
        !row.isMuxOnly &&
        row.contentRefs.episodes === 0 &&
        row.contentRefs.shortFilms === 0
      );
    default:
      return true;
  }
}

function toSeverity(
  classification: MediaTruthClassification,
  flags: MediaTruthFlag[],
): "high" | "medium" | "low" {
  if (classification === "FAILED" || classification === "MISSING") {
    return "high";
  }
  if (
    flags.includes("PROVIDER_REFERENCE_MISMATCH") ||
    flags.includes("PROVIDER_REFERENCE_AMBIGUOUS")
  ) {
    return "high";
  }
  if (flags.includes("PUBLISHED_BUT_UNPLAYABLE")) {
    return "medium";
  }
  return "low";
}

function toPlaybackStatus(classification: MediaTruthClassification): string {
  if (classification === "READY") return "READY";
  if (classification === "PROCESSING") return "PROCESSING";
  if (classification === "FAILED" || classification === "MISSING") return "FAILED";
  return "UNKNOWN";
}

function truthToViewRow(
  truth: MediaAssetTruth,
  providerInventory: ProviderInventoryResult,
): MediaViewRow {
  const provider = buildProviderTruthSnap(truth.stored, providerInventory);
  const classification = truth.classification;
  const flags = truth.flags;
  const muxConnected = deriveMuxConnected(classification, provider);
  const storedPlayback = truth.stored.provider_playback_reference?.trim() || null;

  const hasPublishedContent =
    truth.refs.episodes.some((ep) => ep.status === "published") ||
    truth.refs.shortFilms.some((sf) => sf.status === "published");

  const processingAgeSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(truth.stored.created_at).getTime()) / 1000),
  );

  return {
    assetId: truth.assetId,
    storedStatus: truth.stored.status,
    createdAt: truth.stored.created_at,
    provider: truth.stored.provider_name ?? "mux",
    providerUploadReference: truth.stored.provider_upload_reference,
    providerAssetReference: truth.stored.provider_asset_reference,
    providerPlaybackReference: truth.stored.provider_playback_reference,
    failureCode: truth.stored.failure_code ?? null,
    failureMessage: truth.stored.failure_message ?? null,
    sourceMediaAssetId: truth.stored.source_media_asset_id ?? null,
    derivedChildRefs: truth.refs.derivedChildren,
    contentRefs: {
      episodes: truth.refs.episodes.length,
      shortFilms: truth.refs.shortFilms.length,
    },
    classification,
    flags,
    providerState: provider.providerState,
    muxAssetId: provider.muxAssetId,
    muxAssetStatus: provider.muxAssetStatus,
    muxUploadStatus: provider.muxUploadStatus,
    muxConnected,
    playbackStatus: toPlaybackStatus(classification),
    supabaseConnected: Boolean(storedPlayback),
    published: hasPublishedContent,
    processingAgeSeconds,
    lastKnownMuxStatus: provider.muxAssetStatus,
    lastKnownSupabaseStatus: truth.stored.status,
    severity: toSeverity(classification, flags),
    problemFlags: flags,
    publicationImpact: flags.includes("PUBLISHED_BUT_UNPLAYABLE"),
    isMuxOnly: false,
    maxResolutionTier: null,
    resolutionTier: null,
  };
}

// Read-only MUX_ONLY row: a Mux asset with no Supabase media_assets row. It is
// surfaced for visibility only — never auto-imported into Supabase.
function muxOnlyToViewRow(
  item: {
    mediaAssetId: string | null;
    muxAssetId: string | null;
    passthrough: string | null;
    state: ProviderInventoryState;
    muxStatus: string | null;
  },
  muxAssetPlayback: string | null,
  index: number,
): MediaViewRow {
  const classification = classifyProviderOnlyMuxAsset(item.muxStatus);
  return {
    assetId: item.muxAssetId ?? `mux-only-${index}`,
    storedStatus: null,
    createdAt: "",
    provider: "mux",
    providerUploadReference: item.passthrough,
    providerAssetReference: item.muxAssetId,
    providerPlaybackReference: muxAssetPlayback,
    failureCode: null,
    failureMessage: null,
    sourceMediaAssetId: null,
    derivedChildRefs: [],
    contentRefs: { episodes: 0, shortFilms: 0 },
    classification,
    flags: ["UNASSIGNED"],
    providerState: "MUX_ONLY",
    muxAssetId: item.muxAssetId,
    muxAssetStatus: item.muxStatus,
    muxUploadStatus: null,
    muxConnected: false,
    playbackStatus: "NO DATA",
    supabaseConnected: false,
    published: false,
    processingAgeSeconds: 0,
    lastKnownMuxStatus: item.muxStatus,
    lastKnownSupabaseStatus: null,
    severity: classification === "FAILED" ? "medium" : "low",
    problemFlags: ["UNASSIGNED"],
    publicationImpact: false,
    isMuxOnly: true,
    maxResolutionTier: null,
    resolutionTier: null,
  };
}

export type MediaViewListResult = {
  rows: MediaViewRow[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export async function getMediaViewRows(
  options: MediaViewOptions = {},
): Promise<MediaViewListResult> {
  const { search, page = 1, pageSize = 25, tab = "all" } = options;
  const providerInventory = await getMuxProviderInventory();
  const truths = await buildMediaTruth(undefined, {
    providerInventory,
    assetIds: options.assetIds,
  });
  const rows: MediaViewRow[] = truths.map((truth) =>
    truthToViewRow(truth, providerInventory),
  );
  const muxOnlyItems = getAssetsByState(providerInventory, "MUX_ONLY");
  muxOnlyItems.forEach((item, index) => {
    const muxAsset = providerInventory.muxAssets.find(
      (asset) => asset.id === item.muxAssetId,
    );
    const signedPlaybackId =
      muxAsset?.playbackIds?.find(
        (playbackId) => playbackId?.policy === "signed",
      )?.id?.trim() ?? null;
    rows.push(muxOnlyToViewRow(item, signedPlaybackId, index));
  });

  let filtered = rows.filter((row) => matchesTab(tab, row));
  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    filtered = filtered.filter(
      (row) =>
        row.assetId.toLowerCase().includes(term) ||
        row.providerUploadReference?.toLowerCase().includes(term) ||
        row.providerAssetReference?.toLowerCase().includes(term),
    );
  }

  const totalCount = rows.length;
  const filteredCount = filtered.length;
  const safePage = Math.max(1, Math.min(page, Math.max(1, Math.ceil(filteredCount / pageSize))));
  const start = (safePage - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return {
    rows: paged,
    totalCount,
    filteredCount,
    page: safePage,
    pageSize,
    hasPrevious: safePage > 1,
    hasNext: start + pageSize < filteredCount,
  };
}

// Explicit Asset Detail / manual diagnostics. Fetches a single stored asset's
// truth from the one bounded inventory listing AND performs a read-only
// per-asset Mux inspection (never writes to Mux or Supabase, never runs on
// page load — only when the admin explicitly opens Asset Detail).
export async function getAssetDetailMedia(
  assetId: string,
): Promise<MediaViewRow | null> {
  const providerInventory = await getMuxProviderInventory();

  const truths = await buildMediaTruth(undefined, {
    providerInventory,
    assetIds: [assetId],
  });
  if (truths.length === 0) return null;

  const row = truthToViewRow(truths[0], providerInventory);

  // Focused live diagnostics for the explicit detail view.
  const live = await inspectMuxMediaAssetState(assetId);
  if (live.status === "inspected") {
    row.muxUploadStatus = live.muxUploadStatus;
    row.maxResolutionTier = live.maxResolutionTier;
    row.resolutionTier = live.resolutionTier;
    if (live.failureCode) row.failureCode = live.failureCode;
    if (live.failureMessage) row.failureMessage = live.failureMessage;
    if (live.providerPlaybackReference) {
      row.providerPlaybackReference = live.providerPlaybackReference;
    }
  } else {
    row.failureMessage = row.failureMessage ?? "Media asset was not found.";
  }

  return row;
}
