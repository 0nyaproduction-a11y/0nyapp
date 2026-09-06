import "server-only";

// M6B — quarantine + explicit authorized delete executor.
//
// This module NEVER deletes anything on its own initiative. Every mutating
// function requires an explicit actorId (the authenticated CMS admin — the
// caller must have already passed requireCmsAdmin) and, for the destructive
// path, re-invokes the M6A read-only scanner (scanMediaAssetForDeletion) at
// execution time. Deletion proceeds ONLY when the FRESH scan reports
// classification === "SAFE" && deletionEnabled === true. A stale/cached
// client-supplied report is never trusted for the execution decision.
//
// Flow is two-phase, matching the task's separate "quarantine/review state"
// and "explicit owner/admin confirmation" requirements:
//   1. quarantineMediaAsset()  — marks an asset under review. No deletion.
//   2. releaseMediaAssetFromQuarantine() — reverses (1), no deletion.
//   3. confirmAndDeleteMediaAsset() — re-scans fresh, hard-fails unless SAFE,
//      requires the asset to currently be quarantined, requires the caller to
//      pass a confirmation token equal to the literal asset id (the explicit
//      admin confirmation), then performs a coordinated Mux + Supabase delete
//      and writes an append-only ledger row recording the full outcome.
//
// Deletion is unconditionally refused for classifications other than SAFE:
// UNKNOWN, BLOCKED, SHARED, REPLACE_FIRST, RETENTION_PROTECTED. This guard is
// enforced here, independent of any UI-level restriction, and cannot be
// bypassed by a caller.

import { scanMediaAssetForDeletion, type DeleteImpactReport } from "./media-delete-impact";
import { deleteMuxAsset } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

type QuarantineRow = Database["public"]["Tables"]["media_quarantine"]["Row"];
type DeletionLedgerInsert = Database["public"]["Tables"]["media_deletion_ledger"]["Insert"];

export type QuarantineStatus = "quarantined" | "released" | "not_quarantined";

export type QuarantineActionResult =
  | { ok: true; status: QuarantineStatus }
  | { ok: false; error: string };

export type ConfirmDeleteResult =
  | {
      ok: true;
      report: DeleteImpactReport;
      supabaseDeleted: boolean;
      muxDeleted: boolean;
      muxAlreadyMissing: boolean;
      ledgerId: string;
      verification: "verified" | "discrepancy";
    }
  | {
      ok: false;
      error: string;
      report: DeleteImpactReport | null;
      ledgerId: string | null;
    };

function normalizeId(value: string): string {
  return value.trim();
}

// ---------------------------------------------------------------------------
// Phase 1 — quarantine / review state (no deletion)
// ---------------------------------------------------------------------------

export async function getQuarantineStatus(assetId: string): Promise<QuarantineStatus> {
  const admin = createAdminClient();
  const normalized = normalizeId(assetId);
  if (!normalized) {
    return "not_quarantined";
  }

  const { data, error } = await admin
    .from("media_quarantine")
    .select("status")
    .eq("media_asset_id", normalized)
    .maybeSingle<Pick<QuarantineRow, "status">>();

  if (error || !data) {
    return "not_quarantined";
  }

  return data.status;
}

export async function quarantineMediaAsset(
  assetId: string,
  actorId: string,
  reason?: string,
): Promise<QuarantineActionResult> {
  const normalizedAssetId = normalizeId(assetId);
  const normalizedActorId = normalizeId(actorId);

  if (!normalizedAssetId) {
    return { ok: false, error: "Asset id is required." };
  }
  if (!normalizedActorId) {
    return { ok: false, error: "An authenticated admin actor is required to quarantine an asset." };
  }

  const admin = createAdminClient();

  const { error: upsertError } = await admin.from("media_quarantine").upsert(
    {
      media_asset_id: normalizedAssetId,
      status: "quarantined",
      reason: reason?.trim() || null,
      requested_by: normalizedActorId,
      requested_at: new Date().toISOString(),
      released_by: null,
      released_at: null,
    },
    { onConflict: "media_asset_id" },
  );

  if (upsertError) {
    return { ok: false, error: `Failed to quarantine asset: ${upsertError.message}` };
  }

  await admin.from("media_quarantine_log").insert({
    media_asset_id: normalizedAssetId,
    action: "quarantined",
    actor_id: normalizedActorId,
    notes: reason?.trim() || null,
  });

  return { ok: true, status: "quarantined" };
}

export async function releaseMediaAssetFromQuarantine(
  assetId: string,
  actorId: string,
): Promise<QuarantineActionResult> {
  const normalizedAssetId = normalizeId(assetId);
  const normalizedActorId = normalizeId(actorId);

  if (!normalizedAssetId) {
    return { ok: false, error: "Asset id is required." };
  }
  if (!normalizedActorId) {
    return { ok: false, error: "An authenticated admin actor is required to release a quarantine." };
  }

  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("media_quarantine")
    .update({
      status: "released",
      released_by: normalizedActorId,
      released_at: new Date().toISOString(),
    })
    .eq("media_asset_id", normalizedAssetId);

  if (updateError) {
    return { ok: false, error: `Failed to release quarantine: ${updateError.message}` };
  }

  await admin.from("media_quarantine_log").insert({
    media_asset_id: normalizedAssetId,
    action: "released",
    actor_id: normalizedActorId,
    notes: null,
  });

  return { ok: true, status: "released" };
}

// ---------------------------------------------------------------------------
// Phase 2 — explicit authorized delete execution
// ---------------------------------------------------------------------------

// Classifications that must NEVER be deleted, enforced unconditionally here
// regardless of any UI-level restriction or caller intent.
const NEVER_DELETE_CLASSIFICATIONS = new Set([
  "UNKNOWN",
  "BLOCKED",
  "SHARED",
  "REPLACE_FIRST",
  "RETENTION_PROTECTED",
]);

async function insertLedgerRow(
  admin: AdminClient,
  row: DeletionLedgerInsert,
): Promise<string | null> {
  const { data, error } = await admin
    .from("media_deletion_ledger")
    .insert(row)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return null;
  }
  return data.id;
}

/**
 * Re-scans the asset fresh, requires it to be currently quarantined, requires
 * an explicit confirmation token equal to the literal asset id, and only then
 * performs a coordinated Mux + Supabase delete. Writes an append-only ledger
 * row for every attempt (successful, blocked, or failed).
 */
export async function confirmAndDeleteMediaAsset(
  assetId: string,
  actorId: string,
  confirmationToken: string,
): Promise<ConfirmDeleteResult> {
  const normalizedAssetId = normalizeId(assetId);
  const normalizedActorId = normalizeId(actorId);
  const admin = createAdminClient();

  if (!normalizedAssetId) {
    return { ok: false, error: "Asset id is required.", report: null, ledgerId: null };
  }
  if (!normalizedActorId) {
    return {
      ok: false,
      error: "An authenticated admin actor is required to execute a delete.",
      report: null,
      ledgerId: null,
    };
  }
  if (confirmationToken.trim() !== normalizedAssetId) {
    return {
      ok: false,
      error: "Explicit confirmation failed: confirmation text must exactly match the asset id.",
      report: null,
      ledgerId: null,
    };
  }

  const quarantineStatus = await getQuarantineStatus(normalizedAssetId);
  if (quarantineStatus !== "quarantined") {
    return {
      ok: false,
      error: "Asset must be quarantined before an authorized delete can be executed.",
      report: null,
      ledgerId: null,
    };
  }

  // Re-run the M6A scanner fresh. A stale client-supplied report is never
  // trusted for the execution decision — this call cannot be skipped.
  const report = await scanMediaAssetForDeletion(normalizedAssetId);

  if (report.classification !== "SAFE" || !report.deletionEnabled || report.details.failClosed) {
    const ledgerId = await insertLedgerRow(admin, {
      media_asset_id: normalizedAssetId,
      actor_id: normalizedActorId,
      classification_at_execution: report.classification,
      result: "blocked",
      supabase_deleted: false,
      mux_deleted: false,
      error_message: `Delete refused: classification is ${report.classification} (deletionEnabled=${report.deletionEnabled}).`,
    });
    return {
      ok: false,
      error: `Delete refused — fresh re-scan classified this asset as ${report.classification}, not SAFE. No deletion performed.`,
      report,
      ledgerId,
    };
  }

  // Defense in depth: even if the classifier contract ever changes upstream,
  // never proceed for these classifications under any circumstance.
  if (NEVER_DELETE_CLASSIFICATIONS.has(report.classification)) {
    const ledgerId = await insertLedgerRow(admin, {
      media_asset_id: normalizedAssetId,
      actor_id: normalizedActorId,
      classification_at_execution: report.classification,
      result: "blocked",
      supabase_deleted: false,
      mux_deleted: false,
      error_message: "Delete refused by unconditional never-delete guard.",
    });
    return {
      ok: false,
      error: "Delete refused by unconditional never-delete guard.",
      report,
      ledgerId,
    };
  }

  const muxAssetReference = report.details.liveMux.assetStatus !== null ? normalizedAssetId : null;

  // Coordinated delete. Follows the conservative "preserve on any failure"
  // philosophy used by cleanupMediaAsset() in media.ts: if the Mux side
  // fails, do not delete the Supabase row (the asset would become
  // undiscoverable while still consuming Mux storage/billing).
  let muxDeleted = false;
  let muxAlreadyMissing = false;
  let muxError: string | null = null;

  try {
    const { data: assetRow } = await admin
      .from("media_assets")
      .select("provider_asset_reference")
      .eq("id", normalizedAssetId)
      .maybeSingle<{ provider_asset_reference: string | null }>();

    const providerAssetReference = assetRow?.provider_asset_reference?.trim() || null;

    if (providerAssetReference) {
      const muxResult = await deleteMuxAsset(providerAssetReference);
      muxDeleted = true;
      muxAlreadyMissing = muxResult.alreadyMissing;
    } else {
      // Nothing stored to delete on the Mux side — treat as already missing.
      muxDeleted = true;
      muxAlreadyMissing = true;
    }
  } catch (error) {
    muxError = error instanceof Error ? error.message : "Unknown Mux delete failure.";
  }

  if (muxError) {
    const ledgerId = await insertLedgerRow(admin, {
      media_asset_id: normalizedAssetId,
      actor_id: normalizedActorId,
      classification_at_execution: report.classification,
      result: "failed",
      supabase_deleted: false,
      mux_deleted: false,
      mux_asset_reference: muxAssetReference,
      error_message: `Mux delete failed, Supabase row preserved: ${muxError}`,
    });
    return {
      ok: false,
      error: `Mux delete failed — Supabase row preserved for retry: ${muxError}`,
      report,
      ledgerId,
    };
  }

  const { error: deleteError } = await admin
    .from("media_assets")
    .delete()
    .eq("id", normalizedAssetId);

  if (deleteError) {
    const ledgerId = await insertLedgerRow(admin, {
      media_asset_id: normalizedAssetId,
      actor_id: normalizedActorId,
      classification_at_execution: report.classification,
      result: "failed",
      supabase_deleted: false,
      mux_deleted: muxDeleted,
      mux_asset_reference: muxAssetReference,
      error_message: `Mux asset deleted but Supabase row delete failed: ${deleteError.message}`,
    });
    return {
      ok: false,
      error: `Mux asset was deleted, but the Supabase row delete failed — manual reconciliation required: ${deleteError.message}`,
      report,
      ledgerId,
    };
  }

  // Post-delete verification: confirm the Supabase row is actually gone.
  const { data: postDeleteRow } = await admin
    .from("media_assets")
    .select("id")
    .eq("id", normalizedAssetId)
    .maybeSingle<{ id: string }>();

  const verification: "verified" | "discrepancy" = postDeleteRow ? "discrepancy" : "verified";

  const ledgerId = await insertLedgerRow(admin, {
    media_asset_id: normalizedAssetId,
    actor_id: normalizedActorId,
    classification_at_execution: report.classification,
    result: "succeeded",
    supabase_deleted: true,
    mux_deleted: muxDeleted,
    mux_asset_reference: muxAssetReference,
    verified_at: new Date().toISOString(),
    verification_result: verification,
  });

  return {
    ok: true,
    report,
    supabaseDeleted: true,
    muxDeleted,
    muxAlreadyMissing,
    ledgerId: ledgerId ?? "",
    verification,
  };
}
