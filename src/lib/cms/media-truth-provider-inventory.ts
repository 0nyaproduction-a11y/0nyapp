import "server-only";

import { fetchMuxCollection } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { ProviderInventoryState } from "./media-truth-model";

// The reconciliation-state vocabulary is defined once in the pure
// media-truth-model.ts (shared with the truth model and the serializable Media
// view contract) and re-exported here for existing consumers.
export type { ProviderInventoryState };

export type MuxProviderAsset = {
  id: string;                    // Mux asset ID
  passthrough?: string | null;   // Original media_asset_id from upload reference
  playbackIds?: Array<{ id: string; policy: "public" | "signed" | "drm" } | null>;
  status?: string | null;        // Mux asset status (ready, processing, errored, deleted)
  duration?: number | null;      // Asset duration in seconds
  maxResolutionTier?: string | null; // Mux's ingested delivery tier
  resolutionTier?: string | null;    // Configured ceiling tier
};

// Result from provider inventory reconciliation
export type ProviderInventoryResult = {
  muxAssets: MuxProviderAsset[];               // Raw Mux inventory (paginated)
  supabaseAssets: Database["public"]["Tables"]["media_assets"]["Row"][];  // Supabase media_assets rows
  reconciliation: ProviderInventoryItem[];    // Per-asset reconciliation states
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  duplicateMappings: DuplicateProviderMapping[];  // Detected duplicate references
  refreshSafeguards: RefreshSafeguard[];      // Safety mechanisms in place
};

export type ProviderInventoryItem = {
  mediaAssetId: string | null;         // Supabase media_assets.id (or null for MUX_ONLY)
  muxAssetId: string | null;         // Provider asset reference (or null for SUPABASE_ONLY)
  passthrough: string | null;        // Original upload passthrough reference
  state: ProviderInventoryState;     // Reconciliation state
  muxStatus: string | null;          // Live Mux asset status (if present)
  supabaseStatus: string | null;     // Supabase status (if present)
  providerReference: string | null;  // The provider_asset_reference that matched
  duplicateCount: number;            // Number of conflicting references (for AMBIGUOUS)
  safeToRefresh: boolean;            // Whether this asset can be safely refreshed
  error: string | null;             // Error message if UNKNOWN or cannot reconcile
};

export type DuplicateProviderMapping = {
  providerReference: string;         // The shared provider_asset_reference value
  mediaAssetIds: string[];           // All Supabase media_assets that reference this value
  count: number;                     // Number of assets sharing this reference
  status: "RESOLVED" | "UNRESOLVED";
};

export type RefreshSafeguard =
  | { type: "manual_only" }
  | { type: "bounded_request"; maxAssets?: number }
  | { type: "validation_required" }
  | { type: "audit_log" }
;

// Read-only inventory listing with pagination beyond 100 assets
export async function getMuxProviderInventory(
  page = 1,
  limit = 100,
  safeguards?: RefreshSafeguard[],
): Promise<ProviderInventoryResult> {
  // Enforce bounded requests as safety measure
  const effectiveLimit = Math.min(limit, 200); // Cap at 200 assets per request
  const offset = (page - 1) * effectiveLimit;

  // Fetch Mux assets with pagination (supports beyond 100)
  const muxAssets = await fetchMuxCollection<MuxProviderAsset>(
    `/video/v1/assets?limit=${effectiveLimit}&offset=${offset}`
  );

  // Fetch all Supabase media_assets in one query
  const supabase = createAdminClient();
  const { data: supabaseAssets, error } = await supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !supabaseAssets) {
    throw new Error("Failed to fetch Supabase media_assets for inventory reconciliation");
  }

  // Build lookup maps for efficient reconciliation
  const supabaseByPassthrough = new Map<string, Database["public"]["Tables"]["media_assets"]["Row"][]>();
  const supabaseByProviderAssetRef = new Map<string, Database["public"]["Tables"]["media_assets"]["Row"][]>();

  for (const asset of supabaseAssets) {
    if (asset.provider_upload_reference?.trim()) {
      const key = asset.provider_upload_reference.trim();
      supabaseByPassthrough.set(key, [...(supabaseByPassthrough.get(key) || []), asset]);
    }
    if (asset.provider_asset_reference?.trim()) {
      const key = asset.provider_asset_reference.trim();
      supabaseByProviderAssetRef.set(key, [...(supabaseByProviderAssetRef.get(key) || []), asset]);
    }
  }

  // Reconcile individual assets
  const reconciliation: ProviderInventoryItem[] = [];
  const duplicateMappings: DuplicateProviderMapping[] = [];
  const allProviderRefs = new Map<string, string[]>();

  // Collect all provider references for duplicate detection
  for (const asset of supabaseAssets) {
    if (asset.provider_asset_reference?.trim()) {
      const ref = asset.provider_asset_reference.trim();
      allProviderRefs.set(ref, [...(allProviderRefs.get(ref) || []), asset.id]);
    }
  }

  // Detect duplicates
  for (const [providerRef, mediaAssetIds] of allProviderRefs.entries()) {
    if (mediaAssetIds.length > 1) {
      duplicateMappings.push({
        providerReference: providerRef,
        mediaAssetIds,
        count: mediaAssetIds.length,
        status: "UNRESOLVED",
      });
    }
  }

  // Process each Mux asset for reconciliation
  for (const muxAsset of muxAssets) {
    const mediaAssetId = muxAsset.passthrough?.trim() || null;
    const providerAssetId = muxAsset.id?.trim() || null;
    const providerRef = providerAssetId; // For simplicity, assuming provider_asset_reference == mux asset id

    // Find matching Supabase rows
    const matchedSupabaseByPassthrough = mediaAssetId ? supabaseByPassthrough.get(mediaAssetId) || [] : [];
    const matchedSupabaseByProviderRef = providerRef ? supabaseByProviderAssetRef.get(providerRef) || [] : [];

    // Determine reconciliation state
    let state: ProviderInventoryState = "UNKNOWN";
    let error: string | null = null;
    let providerReference: string | null = null;
    let duplicateCount = 1;

    if (providerAssetId && allProviderRefs.has(providerAssetId) && allProviderRefs.get(providerAssetId)!.length > 1) {
      // AMBIGUOUS: Multiple Supabase assets reference the same provider_asset_reference
      state = "AMBIGUOUS";
      duplicateCount = allProviderRefs.get(providerAssetId)!.length;
      providerReference = providerAssetId;
    } else if (mediaAssetId && matchedSupabaseByPassthrough.length > 0 && providerAssetId) {
      // LINKED: Both Supabase and Mux have matching references
      state = "LINKED";
      providerReference = providerAssetId;
    } else if (providerAssetId && matchedSupabaseByProviderRef.length > 0) {
      // Also LINKED but through different matching
      state = "LINKED";
      providerReference = providerAssetId;
    } else if (providerAssetId) {
      // MUX_ONLY: Asset exists only in Mux
      state = "MUX_ONLY";
      providerReference = providerAssetId;
    } else if (mediaAssetId && matchedSupabaseByPassthrough.length > 0) {
      // SUPABASE_ONLY: Asset exists only in Supabase
      state = "SUPABASE_ONLY";
    } else {
      // UNKNOWN: Cannot reconcile due to missing data
      error = "Provider truth cannot be proven - missing both Mux asset and Supabase row";
      state = "UNKNOWN";
    }

    reconciliation.push({
      mediaAssetId,
      muxAssetId: providerAssetId,
      passthrough: muxAsset.passthrough?.trim() || null,
      state,
      muxStatus: muxAsset.status || null,
      supabaseStatus: mediaAssetId && matchedSupabaseByPassthrough.length > 0
        ? matchedSupabaseByPassthrough[0].status
        : null,
      providerReference,
      duplicateCount,
      safeToRefresh: state !== "AMBIGUOUS" && state !== "UNKNOWN", // Safer to refresh non-ambiguous assets
      error,
    });
  }

  // Process remaining Supabase-only assets (those without Mux counterparts).
  // Rows that DO carry Mux references but are absent from the live inventory
  // also land here so the truth model can see an explicit reconciliation item
  // instead of silently disappearing from the reconciliation list.
  for (const supabaseAsset of supabaseAssets) {
    const existing = reconciliation.find((r) => r.mediaAssetId === supabaseAsset.id);
    if (existing) {
      continue;
    }

    const hasMuxReference = Boolean(supabaseAsset.provider_upload_reference?.trim() || supabaseAsset.provider_asset_reference?.trim());

    if (!hasMuxReference) {
      reconciliation.push({
        mediaAssetId: supabaseAsset.id,
        muxAssetId: null,
        passthrough: supabaseAsset.provider_upload_reference?.trim() || null,
        state: "SUPABASE_ONLY",
        muxStatus: null,
        supabaseStatus: supabaseAsset.status,
        providerReference: null,
        duplicateCount: 1,
        safeToRefresh: false, // Don't refresh assets without provider references
        error: null,
      });
    } else {
      // Stored row references Mux, but this (bounded) live inventory listing
      // contains no matching asset. UNKNOWN keeps this "unprovable" rather than
      // auto-claiming MISSING; the truth model classifies MISSING only when the
      // inventory coverage is proven complete.
      reconciliation.push({
        mediaAssetId: supabaseAsset.id,
        muxAssetId: null,
        passthrough: supabaseAsset.provider_upload_reference?.trim() || null,
        state: "UNKNOWN",
        muxStatus: null,
        supabaseStatus: supabaseAsset.status,
        providerReference:
          supabaseAsset.provider_asset_reference?.trim() ||
          supabaseAsset.provider_upload_reference?.trim() ||
          null,
        duplicateCount: 1,
        safeToRefresh: false,
        error: "Provider reference was not found in the live Mux inventory.",
      });
    }
  }

  return {
    muxAssets,
    supabaseAssets,
    reconciliation,
    pagination: {
      page,
      limit: effectiveLimit,
      total: muxAssets.length,
      hasMore: muxAssets.length === effectiveLimit,
    },
    duplicateMappings,
    refreshSafeguards: safeguards || [
      { type: "manual_only" },
      { type: "bounded_request", maxAssets: 200 },
      { type: "validation_required" },
      { type: "audit_log" },
    ],
  };
}

// Helper function to get state by media asset ID
export function getReconciledState(
  result: ProviderInventoryResult,
  mediaAssetId: string,
): ProviderInventoryItem | null {
  return result.reconciliation.find((item) => item.mediaAssetId === mediaAssetId) || null;
}

// Helper function to get all assets by state
export function getAssetsByState(
  result: ProviderInventoryResult,
  state: ProviderInventoryState,
): ProviderInventoryItem[] {
  return result.reconciliation.filter((item) => item.state === state);
}

// Check if refresh has safety concerns
export function hasRefreshSafetyConcerns(
  result: ProviderInventoryResult,
): boolean {
  return result.refreshSafeguards.some((s) => s.type === "manual_only" || s.type === "validation_required");
}
