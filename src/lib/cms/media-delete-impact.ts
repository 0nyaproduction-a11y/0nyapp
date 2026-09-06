import "server-only";

import {
  classifyDeleteImpact,
  type DeleteClassificationInput,
  type DeleteImpactLiveMuxState,
  type DeleteImpactReport,
  type DeleteImpactRefItem,
  type DeleteImpactRefSummary,
  type DeleteImpactReportDetails,
} from "./media-delete-impact-classifier";

// Re-export the report contract for CMS consumers (Media Asset Detail).
export type {
  DeleteImpactClassification,
  DeleteImpactLiveMuxState,
  DeleteImpactReport,
  DeleteImpactReportDetails,
  DeleteImpactRefItem,
  DeleteImpactRefSummary,
} from "./media-delete-impact-classifier";
import { buildMediaTruth } from "./media-truth";
import {
  isPublishedEpisode,
  isPublishedShortFilm,
  MEDIA_TRUTH_UNPROBED,
  type MediaAssetTruth,
} from "./media-truth-model";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

// ============================================================================
// M6A — Smart Delete dependency scanner + Delete Impact Report (READ-ONLY).
//
// Hard contract:
// - NO Supabase mutations, NO Mux mutations, NO cleanup, NO quarantine, and no
//   automatic anything. This module only reads and classifies.
// - Fail closed: any dependency domain that cannot be fully scanned flips the
//   report to UNKNOWN and disables deletion.
// - SAFE requires ALL of: asset row exists, complete scan, zero episode media
//   refs, zero episode preview refs, zero short-film refs, zero derived
//   children, zero related subtitle tracks, no shared provider reference, no
//   retention records, and no unsettled provider state (live Mux PROCESSING
//   defers the verdict to UNKNOWN).
// - Runtime states handled WITHOUT auto-SAFE: stale Supabase row with missing
//   Mux asset, failed historical upload, READY unassigned asset, linked
//   healthy asset. Mux-missing / failed / READY-unassigned states only ever
//   reach SAFE after the full zero-dependency proof above passes.
//
// Retention tables (media_quarantine, media_deletion_ledger, ...) are owned by
// M6B and may not exist yet. Their provable absence ("relation does not
// exist") is treated as proof of zero records — not as an incomplete scan.
// Any other retention-query failure fails closed. M6B must keep the
// media_asset_id column contract assumed below.
// ============================================================================

const RETENTION_TABLES = [
  "media_quarantine",
  "media_quarantine_log",
  "media_deletion_ledger",
  "media_retention_log",
] as const;

type ScanCursor = {
  errors: string[];
  notes: string[];
  providerVerified: boolean;
};

type AdminClient = ReturnType<typeof createAdminClient>;

type LooseQueryError = { code?: string | null; message?: string | null } | null;

// ---------------------------------------------------------------------------
// Fail-closed report factory: UNKNOWN / deletion-disabled with null totals for
// every unscanned domain.
// ---------------------------------------------------------------------------

function failClosedReport(
  assetId: string | null,
  errors: string[],
  failClosed = true,
): DeleteImpactReport {
  return {
    assetId,
    generatedAt: new Date().toISOString(),
    classification: "UNKNOWN",
    deletionEnabled: false,
    blockers: [...errors],
    warnings: [],
    replacements: [],
    details: {
      episodeRefs: { total: null, published: null, items: [] },
      shortFilmRefs: { total: null, published: null, items: [] },
      derivedChildren: { total: null, published: null, items: [] },
      subtitleTracks: {
        total: null,
        breakdown: { ready: null, processing: null, pending: null, failed: null, deleted: null },
      },
      sharedProviderRefs: { total: null, published: null, items: [] },
      retention: { present: null, scanned: false, items: [], sources: [] },
      homeImpact: { present: null, items: [] },
      liveMux: {
        state: "UNPROVEN",
        assetStatus: null,
        uploadStatus: null,
        assetExists: null,
        uploadExists: null,
        failureMessage: null,
      },
      supabaseState: null,
      scanComplete: false,
      scanErrors: [...errors],
      failClosed,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function refSummary(items: DeleteImpactRefItem[]): DeleteImpactRefSummary {
  return {
    total: items.length,
    published: items.reduce((acc, item) => acc + (item.published === true ? 1 : 0), 0),
    items,
  };
}

function isTableMissingError(error: LooseQueryError): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("does not exist")
  );
}

// Retention tables are not part of the generated Database types yet (M6B).
// Access them through a minimal structural adapter so the scanner compiles and
// stays strictly read-only (head:true exact-count queries only).
async function countRetentionRecords(
  admin: AdminClient,
  table: string,
  assetId: string,
): Promise<{ count: number | null; error: LooseQueryError }> {
  const looselyTyped = admin as unknown as {
    from: (relation: string) => {
      select: (
        columns: string,
        options?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
      ) => {
        eq: (column: string, value: unknown) => Promise<{
          count: number | null;
          error: LooseQueryError;
        }>;
      };
    };
  };

  const { count, error } = await looselyTyped
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("media_asset_id", assetId);

  return { count, error };
}

// Retention scan result: the result of scanning a single retention source.
// `provenance: "scanned"` = the source was successfully queried.
// `provenance: "absent"` = the source does not exist yet (M6B pre-deploy).
// `provenance: "failed"` = the source could not be queried (any other error).
// Only `scanned` counts as authoritative proof of zero records.
type RetentionSourceProvenance = "scanned" | "absent" | "failed";

type RetentionScan = {
  table: string;
  count: number | null;
  provenance: RetentionSourceProvenance;
  error: string | null;
};

async function scanRetentionRecords(
  admin: AdminClient,
  assetId: string,
  cursor: ScanCursor,
): Promise<DeleteImpactReportDetails["retention"]> {
  const scans: RetentionScan[] = [];

  for (const table of RETENTION_TABLES) {
    const { count, error } = await countRetentionRecords(admin, table, assetId);

    if (error) {
      if (isTableMissingError(error)) {
        scans.push({
          table,
          count: null,
          provenance: "absent",
          error: error.message ?? "table not found",
        });
        cursor.errors.push(
          `Retention source ${table} is absent when expected by policy — scan incomplete (fail-closed).`,
        );
        continue;
      }
      scans.push({
        table,
        count: null,
        provenance: "failed",
        error: error.message ?? "unknown error",
      });
      cursor.errors.push(
        `Failed to scan retention source ${table}: ${error.message ?? "unknown error"} — scan incomplete (fail-closed).`,
      );
      continue;
    }

    scans.push({
      table,
      count,
      provenance: "scanned",
      error: null,
    });
  }

  const hasRecords = scans.some((scan) => scan.provenance === "scanned" && (scan.count ?? 0) > 0);
  const allScanned = scans.length > 0 && scans.every((scan) => scan.provenance === "scanned");

  // Provenance: only when every authoritative retention source was successfully
  // scanned do we know the count is authoritative.
  return {
    present: hasRecords,
    scanned: allScanned,
    items: scans
      .filter((scan) => scan.provenance === "scanned" && (scan.count ?? 0) > 0)
      .map((scan) => ({ table: scan.table })),
    sources: scans.map((scan) => ({
      table: scan.table,
      provenance: scan.provenance,
      count: scan.count,
      error: scan.error,
    })),
  };
}

// Home/publishing impact: does the content that references this asset appear
// in Home rows? Only ENABLED rows are consumer-visible, so `present` is true
// only for enabled rows; disabled rows are still listed for transparency.
async function scanHomeImpact(
  admin: AdminClient,
  truth: MediaAssetTruth,
  cursor: ScanCursor,
): Promise<DeleteImpactReportDetails["homeImpact"]> {
  const seriesIds = [
    ...new Set(
      truth.refs.episodes
        .map((ref) => ref.seriesId)
        .filter((id) => Boolean(id)),
    ),
  ];
  const shortFilmIds = [...new Set(truth.refs.shortFilms.map((ref) => ref.id))];

  if (seriesIds.length === 0 && shortFilmIds.length === 0) {
    return { present: false, items: [] };
  }

  type HomeRowItemRow = Database["public"]["Tables"]["home_row_items"]["Row"];
  const itemRows: HomeRowItemRow[] = [];

  const queries: PromiseLike<{ rows: HomeRowItemRow[]; error: LooseQueryError; label: string }>[] = [];

  if (seriesIds.length > 0) {
    queries.push(
      admin
        .from("home_row_items")
        .select("*")
        .eq("content_type", "series")
        .in("series_id", seriesIds)
        .then(({ data, error }) => ({ rows: (data ?? []) as HomeRowItemRow[], error, label: "home_row_items (series)" })),
    );
  }

  if (shortFilmIds.length > 0) {
    queries.push(
      admin
        .from("home_row_items")
        .select("*")
        .eq("content_type", "short_film")
        .in("short_film_id", shortFilmIds)
        .then(({ data, error }) => ({
          rows: (data ?? []) as HomeRowItemRow[],
          error,
          label: "home_row_items (short films)",
        })),
    );
  }

  for (const result of await Promise.all(queries)) {
    if (result.error) {
      if (isTableMissingError(result.error)) {
        cursor.notes.push("home_row_items table not present — Home publishing is not installed.");
        continue;
      }
      cursor.errors.push(`Failed to scan ${result.label}: ${result.error.message ?? "unknown error"}`);
      continue;
    }
    itemRows.push(...result.rows);
  }

  if (itemRows.length === 0) {
    return { present: false, items: [] };
  }

  const rowIds = [...new Set(itemRows.map((item) => item.row_id))];
  const { data: homeRows, error: rowsError } = await admin
    .from("home_rows")
    .select("id,title,row_role,enabled")
    .in("id", rowIds);

  if (rowsError) {
    if (isTableMissingError(rowsError)) {
      cursor.notes.push("home_rows table not present — Home publishing is not installed.");
      return { present: false, items: [] };
    }
    cursor.errors.push(`Failed to scan home rows: ${rowsError.message}`);
    return { present: false, items: [] };
  }

  const rowById = new Map((homeRows ?? []).map((row) => [row.id, row]));
  const items = itemRows.map((item) => {
    const row = rowById.get(item.row_id);
    return {
      rowId: item.row_id,
      rowTitle: row?.title ?? item.row_id,
      rowRole: row?.row_role ?? "unknown",
      enabled: row?.enabled ?? false,
      contentType: item.content_type,
    };
  });

  return { present: items.some((item) => item.enabled), items };
}

// Shared provider references: other media asset rows pointing at the SAME
// provider upload/asset references. Deleting while shared would break those
// rows, so this is a hard SHARED classification.
async function scanSharedProviderRefs(
  admin: AdminClient,
  assetId: string,
  uploadRef: string,
  assetRef: string,
  cursor: ScanCursor,
): Promise<DeleteImpactRefItem[]> {
  if (!uploadRef && !assetRef) {
    return [];
  }

  const orFilter = [
    uploadRef ? `provider_upload_reference.eq.${uploadRef}` : null,
    assetRef ? `provider_asset_reference.eq.${assetRef}` : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data, error } = await admin
    .from("media_assets")
    .select("id,status,provider_upload_reference,provider_asset_reference")
    .neq("id", assetId)
    .or(orFilter);

  if (error) {
    cursor.errors.push(`Failed to scan shared provider references: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    label: `media asset ${row.id} (status: ${row.status})`,
    published: null,
  }));
}

// Live Mux mapping. Absence is only claimed when PROVEN: no stored provider
// references at all, a proven asset-reference miss, or a proven upload-only
// miss. A provider that could not be consulted is UNPROVEN (fail closed).
function mapLiveMuxState(truth: MediaAssetTruth): DeleteImpactReportDetails["liveMux"] {
  const live = truth.live;

  if (live === MEDIA_TRUTH_UNPROBED) {
    return {
      state: "UNPROVEN",
      assetStatus: null,
      uploadStatus: null,
      assetExists: null,
      uploadExists: null,
      failureMessage: null,
    };
  }

  if (live.status === "not_found") {
    return {
      state: "MISSING",
      assetStatus: null,
      uploadStatus: null,
      assetExists: false,
      uploadExists: false,
      failureMessage: "Stored media asset row disappeared during the dependency scan.",
    };
  }

  const hasAssetRef = Boolean(truth.stored.provider_asset_reference?.trim());
  const hasUploadRef = Boolean(truth.stored.provider_upload_reference?.trim());

  let state: DeleteImpactLiveMuxState;
  if (!hasAssetRef && !hasUploadRef) {
    state = "MISSING"; // no provider references stored — nothing can exist
  } else if (hasAssetRef && !live.muxAssetExists) {
    state = "MISSING"; // proven asset-reference miss (stale row)
  } else if (!hasAssetRef && hasUploadRef && !live.muxUploadExists) {
    state = "MISSING"; // proven upload-only miss (failed historical upload)
  } else if (live.mediaStatus === "ready") {
    state = "READY";
  } else if (live.mediaStatus === "failed") {
    state = "FAILED";
  } else {
    state = "PROCESSING";
  }

  return {
    state,
    assetStatus: live.muxAssetStatus,
    uploadStatus: live.muxUploadStatus,
    assetExists: live.muxAssetExists,
    uploadExists: live.muxUploadExists,
    failureMessage: live.failureMessage,
  };
}

// ---------------------------------------------------------------------------
// Public entry point (read-only)
// ---------------------------------------------------------------------------

export async function scanMediaAssetForDeletion(assetId: string): Promise<DeleteImpactReport> {
  const normalizedAssetId = assetId.trim();
  const cursor: ScanCursor = { errors: [], notes: [], providerVerified: true };

  if (!normalizedAssetId) {
    return failClosedReport(null, ["Asset id is required for a delete impact evaluation."]);
  }

  const admin = createAdminClient();

  // Step 1 — load the stored row directly so a missing row is distinguishable
  // from a failed truth build (buildMediaTruth returns [] for both).
  const { data: assetRow, error: assetError } = await admin
    .from("media_assets")
    .select("*")
    .eq("id", normalizedAssetId)
    .maybeSingle();

  if (assetError) {
    return failClosedReport(normalizedAssetId, [
      `Failed to load the media asset row: ${assetError.message}`,
    ]);
  }

  if (!assetRow) {
    return failClosedReport(
      normalizedAssetId,
      ["Asset row was not found in Supabase — nothing to evaluate."],
      false,
    );
  }

  // Step 2 — reuse the existing bounded media-truth pipeline for refs
  // (episodes, previews, short films, derived children), subtitle relations,
  // and the single live Mux provider inventory. Never per-row Mux probes.
  let truths: MediaAssetTruth[];
  try {
    truths = await buildMediaTruth(admin, { assetIds: [normalizedAssetId], probeMux: true });
  } catch (err) {
    return failClosedReport(normalizedAssetId, [
      `Media truth pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
    ]);
  }

  const truth = truths.find((candidate) => candidate.assetId === normalizedAssetId);
  if (!truth) {
    return failClosedReport(normalizedAssetId, [
      "Media truth pipeline returned no truth for this asset — dependency scan is incomplete.",
    ]);
  }

  if (truth.live === MEDIA_TRUTH_UNPROBED) {
    cursor.providerVerified = false;
    cursor.errors.push(
      "Live Mux provider state could not be verified (provider inventory unavailable) — failing closed.",
    );
  }

  // Step 3 — episode/preview/short-film/derived reference summaries. Published
  // semantics are reused from the media truth model.
  const episodeItems: DeleteImpactRefItem[] = truth.refs.episodes.map((ref) => ({
    id: ref.id,
    label: `episode #${ref.episodeNumber} (series ${ref.seriesId}) — ${ref.status}`,
    published: isPublishedEpisode(ref),
  }));
  const shortFilmItems: DeleteImpactRefItem[] = truth.refs.shortFilms.map((ref) => ({
    id: ref.id,
    label: `short film — ${ref.status}`,
    published: isPublishedShortFilm(ref),
  }));
  const derivedItems: DeleteImpactRefItem[] = truth.refs.derivedChildren.map((ref) => ({
    id: ref.id,
    label: `derived asset — ${ref.status}`,
    published: null,
  }));

  // Step 4 — shared provider references (other rows on the same Mux refs).
  const sharedItems = await scanSharedProviderRefs(
    admin,
    normalizedAssetId,
    truth.stored.provider_upload_reference?.trim() ?? "",
    truth.stored.provider_asset_reference?.trim() ?? "",
    cursor,
  );

  // Step 5 — retention records (tolerant of M6B tables not existing yet).
  const retention = await scanRetentionRecords(admin, normalizedAssetId, cursor);

  // Step 6 — Home/publishing representation of the referencing content.
  const homeImpact = await scanHomeImpact(admin, truth, cursor);

  // Step 7 — live Mux existence/state mapping.
  const liveMux = mapLiveMuxState(truth);

  // Step 8 — classify. Preview refs to published episodes count as published
  // consumer surface (the locked-preview path plays them).
  const input: DeleteClassificationInput = {
    assetExists: true,
    supabaseState: truth.stored.status,
    hasPublishedEpisodeRefs: episodeItems.some((item) => item.published === true),
    hasPublishedShortFilmRefs: shortFilmItems.some((item) => item.published === true),
    hasAnyEpisodeRefs: episodeItems.length > 0,
    hasAnyShortFilmRefs: shortFilmItems.length > 0,
    hasDerivedChildren: derivedItems.length > 0,
    hasSubtitleTracks: truth.subtitles.total > 0,
    hasSharedProviderRef: sharedItems.length > 0,
    hasRetentionHistory: retention.present === true,
    retentionProvenance: retention.scanned
      ? "scanned"
      : (retention.sources ?? []).some((source) => source.provenance === "failed")
        ? "failed"
        : "absent",
    hasHomePublishingImpact: homeImpact.present === true,
    liveMuxState: liveMux.state,
    scanComplete: cursor.errors.length === 0 && cursor.providerVerified,
  };

  const verdict = classifyDeleteImpact(input);

  const details: DeleteImpactReportDetails = {
    episodeRefs: refSummary(episodeItems),
    shortFilmRefs: refSummary(shortFilmItems),
    derivedChildren: refSummary(derivedItems),
    subtitleTracks: {
      total: truth.subtitles.total,
      breakdown: {
        ready: truth.subtitles.ready,
        processing: truth.subtitles.processing,
        pending: truth.subtitles.pending,
        failed: truth.subtitles.failed,
        deleted: truth.subtitles.deleted,
      },
    },
    sharedProviderRefs: refSummary(sharedItems),
    retention,
    homeImpact,
    liveMux,
    supabaseState: truth.stored.status,
    scanComplete: input.scanComplete,
    scanErrors: [...cursor.errors],
    failClosed: !input.scanComplete,
  };

  return {
    assetId: normalizedAssetId,
    generatedAt: new Date().toISOString(),
    classification: verdict.primary,
    deletionEnabled: verdict.primary === "SAFE" && verdict.safeForDeletion,
    blockers: verdict.blockers,
    warnings: [...cursor.notes, ...verdict.warnings],
    replacements: verdict.replacements,
    details,
  };
}
