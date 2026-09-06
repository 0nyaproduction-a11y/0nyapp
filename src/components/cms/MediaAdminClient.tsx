"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AssetDetailPanel,
  IssueBadge,
  MediaTab,
  MediaTabContainer,
  MediaTable,
  PlaybackStatus,
  ProviderStateBadge,
  PublishedBadge,
  StatusBadge,
} from "@/components/cms/MediaTabComponents";
import { MediaDirectUploadField, type MediaUploadIntent } from "@/components/cms/MediaDirectUploadField";
import type { MediaAssetFormState } from "@/lib/cms/media";
import type { MediaViewRow, MediaViewTab } from "@/lib/cms/media-truth-model";
import type { DeleteImpactReport } from "@/lib/cms/media-delete-impact";
import type {
  ConfirmDeleteResult,
  QuarantineStatus,
} from "@/lib/cms/media-delete-executor";
import { mediaListPath } from "@/lib/routes";

type MediaAdminClientProps = {
  initialRows: MediaViewRow[];
  initialTab: MediaViewTab;
  requestUploadAction: (
    mimeType: string,
    corsOriginOverride?: string | null,
  ) => Promise<MediaUploadIntent | { error: string }>;
  refreshAction: (
    state: MediaAssetFormState,
    formData: FormData,
  ) => Promise<MediaAssetFormState>;
  loadAssetDetailAction: (assetId: string) => Promise<MediaViewRow | null>;
  loadAssetDetailAndImpactAction: (assetId: string) => Promise<{ detail: MediaViewRow | null, impact: DeleteImpactReport | null }>;
  loadQuarantineStatusAction: (assetId: string) => Promise<QuarantineStatus>;
  quarantineMediaAssetAction: (
    assetId: string,
    reason?: string,
  ) => Promise<{ error?: string; status?: QuarantineStatus }>;
  releaseQuarantineAction: (
    assetId: string,
  ) => Promise<{ error?: string; status?: QuarantineStatus }>;
  confirmDeleteMediaAssetAction: (
    assetId: string,
    confirmationToken: string,
  ) => Promise<ConfirmDeleteResult>;
};

const TABS: MediaViewTab[] = ["all", "processing", "problems", "unassigned"];

// Mirrors the server-side tab predicate so the client can filter the preloaded
// "all" rows locally for instant tab switching (no per-tab server round trip).
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
        row.contentRefs.previews === 0 &&
        row.contentRefs.shortFilms === 0
      );
    default:
      return true;
  }
}

function classificationVariant(
  classification: MediaViewRow["classification"],
): "success" | "processing" | "error" {
  if (classification === "READY") return "success";
  if (classification === "PROCESSING") return "processing";
  return "error";
}

function storedStatusVariant(
  storedStatus: string | null,
): "success" | "processing" | "error" | "default" {
  if (storedStatus === "ready") return "success";
  if (storedStatus === "failed") return "error";
  if (storedStatus === "pending" || storedStatus === "processing") return "processing";
  return "default";
}

function formatAge(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getTabTitle(tab: MediaViewTab): string {
  switch (tab) {
    case "processing":
      return "Processing";
    case "problems":
      return "Problems";
    case "unassigned":
      return "Unassigned";
    default:
      return "All Media";
  }
}

function getTableHeaders(tab: MediaViewTab): string[] {
  switch (tab) {
    case "processing":
      return ["Status", "Asset", "Content", "State", "Processing Age", "Last Known Status", "Issue"];
    case "problems":
      return ["Status", "Asset/Content", "Severity", "Problem Flags", "Publication Impact"];
    case "unassigned":
      return ["Status", "Asset", "Content"];
    default:
      return ["Status", "Content", "Type", "Mux", "Supabase", "Playback", "Published", "Issue"];
  }
}
function buildCells(tab: MediaViewTab, row: MediaViewRow): ReactNode[] {
  const cells: ReactNode[] = [];

  switch (tab) {
    case "processing":
      cells.push(<StatusBadge key="status" status={row.classification} variant={classificationVariant(row.classification)} />);
      cells.push(
        <div key="asset" className="font-mono text-xs truncate" title={row.assetId}>
          {row.assetId}
        </div>,
      );
      cells.push(
        <div key="content" className="text-xs text-bone/70">
          {row.failureMessage || "Active"}
        </div>,
      );
      cells.push(
        <StatusBadge
          key="state"
          status={row.storedStatus ?? "—"}
          variant={storedStatusVariant(row.storedStatus)}
        />,
      );
      cells.push(
        <span key="age" className="text-xs text-bone/60">
          {row.processingAgeSeconds ? formatAge(row.processingAgeSeconds) : "—"}
        </span>,
      );
      cells.push(
        <div key="last-known" className="text-xs">
          <div>Mux: {row.lastKnownMuxStatus || "—"}</div>
          <div>Supabase: {row.lastKnownSupabaseStatus || "—"}</div>
        </div>,
      );
      cells.push(
        <IssueBadge
          key="issue"
          severity={row.severity || "low"}
          issue={row.failureMessage || ""}
        />,
      );
      break;

    case "problems":
      cells.push(<StatusBadge key="status" status={row.classification} variant={classificationVariant(row.classification)} />);
      cells.push(
        <div key="asset-content">
          <div className="font-mono text-xs truncate" title={row.assetId}>
            Asset: {row.assetId}
          </div>
          {row.isMuxOnly && (
            <div className="text-xs text-blue-400">Mux-only — no Supabase media asset row</div>
          )}
          {row.failureMessage && (
            <div className="text-xs text-bone/70 truncate" title={row.failureMessage}>
              Issue: {row.failureMessage}
            </div>
          )}
        </div>,
      );
      cells.push(<IssueBadge key="severity" severity={row.severity || "low"} issue="" />);
      cells.push(
        <div key="flags" className="flex flex-wrap gap-1">
          {(row.problemFlags || []).map((flag, index) => (
            <span
              key={index}
              className="inline-flex px-1 py-0.5 bg-bone/10 rounded text-xs text-bone/70"
            >
              {flag}
            </span>
          ))}
        </div>,
      );
      cells.push(
        <span key="impact">
          {row.publicationImpact ? (
            <StatusBadge status="YES" variant="error" />
          ) : (
            <StatusBadge status="NO" variant="default" />
          )}
        </span>,
      );
      break;

    case "unassigned":
      cells.push(<StatusBadge key="status" status={row.classification} variant={classificationVariant(row.classification)} />);
      cells.push(
        <div key="asset" className="font-mono text-xs truncate" title={row.assetId}>
          {row.assetId}
        </div>,
      );
      cells.push(
        <div key="content" className="text-xs text-bone/70">
          READY - No references
        </div>,
      );
      break;

    default: {
      cells.push(<StatusBadge key="status" status={row.classification} variant={classificationVariant(row.classification)} />);
      cells.push(
        <div
          key="content"
          className="flex flex-col gap-1 min-w-0"
          title={row.providerUploadReference || row.providerAssetReference || "—"}
        >
          <span className="max-w-xs truncate font-mono text-[0.68rem] text-bone/70">
            {row.providerUploadReference || row.providerAssetReference || "—"}
          </span>
          <span>
            <ProviderStateBadge state={row.providerState} />
          </span>
        </div>,
      );
      cells.push(
        <span key="type" className="text-xs text-bone/60">
          {row.provider}
        </span>,
      );
      cells.push(
        <div key="mux" className="flex flex-col gap-1" title={row.muxAssetStatus || "no live Mux state"}>
          <StatusBadge status={row.muxConnected ? "YES" : "NO"} variant={row.muxConnected ? "success" : "error"} />
          {row.muxAssetId && (
            <span className="font-mono text-[0.6rem] text-bone/40 truncate max-w-24">
              {row.muxAssetId}
            </span>
          )}
        </div>,
      );
      cells.push(
        <div key="supabase" className="flex flex-col gap-1">
          <StatusBadge status={row.storedStatus ?? "—"} variant={storedStatusVariant(row.storedStatus)} />
          {row.storedStatus === "ready" && (
            <span className="text-[0.6rem] text-bone/40">stored in Supabase</span>
          )}
        </div>,
      );
      cells.push(
        <PlaybackStatus
          key="playback"
          status={row.playbackStatus || "UNKNOWN"}
          mux={row.muxConnected || false}
          supabase={row.supabaseConnected || false}
        />,
      );
      cells.push(<PublishedBadge key="published" published={row.published || false} />);
      cells.push(
        <IssueBadge
          key="issue"
          severity={row.severity || "low"}
          issue={row.failureMessage || (row.flags.length > 0 ? row.flags[0] : "")}
        />,
      );
      break;
    }
  }

  return cells;
}
export function MediaAdminClient({
  initialRows,
  initialTab,
  requestUploadAction,
  refreshAction,
  loadAssetDetailAction,
  loadAssetDetailAndImpactAction,
  loadQuarantineStatusAction,
  quarantineMediaAssetAction,
  releaseQuarantineAction,
  confirmDeleteMediaAssetAction,
}: MediaAdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MediaViewTab>(initialTab);
  const [selectedAsset, setSelectedAsset] = useState<MediaViewRow | null>(null);
  const [showAssetDetail, setShowAssetDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const rows = initialRows;
  const filteredRows = rows.filter((row) => matchesTab(activeTab, row));

  function handleTabChange(tab: MediaViewTab) {
    setActiveTab(tab);
    router.push(`${mediaListPath}?tab=${tab}`, { scroll: false });
  }

  async function handleRowClick(row: MediaViewRow) {
    if (row.isMuxOnly) {
      // Mux-only rows have no Supabase media_asset row to inspect; the detail
      // panel is only meaningful for stored assets. Stay in the table.
      return;
    }
    setDetailError(null);
    try {
      const detail = await loadAssetDetailAction(row.assetId);
      if (detail) {
        setSelectedAsset(detail);
        setShowAssetDetail(true);
      } else {
        setDetailError("Could not load asset detail.");
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load asset detail.");
    }
  }

  function closeAssetDetail() {
    setShowAssetDetail(false);
    setSelectedAsset(null);
    setQuarantineStatus("not_quarantined");
    setQuarantineError(null);
    setDeleteResult(null);
    setDeleteError(null);
  }

  const [scanActionState, setScanActionState] = useState<"idle" | "scanning" | "done">("idle");
  const [scanReport, setScanReport] = useState<DeleteImpactReport | null>(null);

  async function handleScanAssetDetail(asset: MediaViewRow) {
    if (asset.isMuxOnly) {
      return;
    }

    setScanActionState("scanning");
    setScanReport(null);

    try {
      const result = await loadAssetDetailAndImpactAction(asset.assetId);
      setScanReport(result.impact);
      setScanActionState("done");
      // A fresh scan invalidates any previously displayed delete outcome —
      // re-read the current quarantine state too, since nothing here is
      // authoritative until re-confirmed at execution time.
      const status = await loadQuarantineStatusAction(asset.assetId);
      setQuarantineStatus(status);
    } catch (err) {
      console.error("Error scanning asset for deletion:", err);
      setScanActionState("idle");
    }
  }

  // ---------------------------------------------------------------------
  // M6B — quarantine + explicit authorized delete (CMS-only, no auto-run).
  // ---------------------------------------------------------------------
  const [quarantineStatus, setQuarantineStatus] = useState<QuarantineStatus>("not_quarantined");
  const [quarantineActionState, setQuarantineActionState] = useState<"idle" | "working">("idle");
  const [quarantineError, setQuarantineError] = useState<string | null>(null);
  const [deleteActionState, setDeleteActionState] = useState<"idle" | "working">("idle");
  const [deleteResult, setDeleteResult] = useState<ConfirmDeleteResult | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleQuarantineAsset(asset: MediaViewRow, reason?: string) {
    setQuarantineActionState("working");
    setQuarantineError(null);
    try {
      const result = await quarantineMediaAssetAction(asset.assetId, reason);
      if (result.error) {
        setQuarantineError(result.error);
      } else if (result.status) {
        setQuarantineStatus(result.status);
      }
    } catch (err) {
      setQuarantineError(err instanceof Error ? err.message : "Failed to quarantine asset.");
    } finally {
      setQuarantineActionState("idle");
    }
  }

  async function handleReleaseQuarantine(asset: MediaViewRow) {
    setQuarantineActionState("working");
    setQuarantineError(null);
    try {
      const result = await releaseQuarantineAction(asset.assetId);
      if (result.error) {
        setQuarantineError(result.error);
      } else if (result.status) {
        setQuarantineStatus(result.status);
      }
    } catch (err) {
      setQuarantineError(err instanceof Error ? err.message : "Failed to release quarantine.");
    } finally {
      setQuarantineActionState("idle");
    }
  }

  async function handleConfirmDelete(asset: MediaViewRow, confirmationToken: string) {
    setDeleteActionState("working");
    setDeleteError(null);
    setDeleteResult(null);
    try {
      const result = await confirmDeleteMediaAssetAction(asset.assetId, confirmationToken);
      setDeleteResult(result);
      if (!result.ok) {
        setDeleteError(result.error);
      } else {
        // Row is gone — reflect it locally without waiting for a full reload.
        router.refresh();
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to execute delete.");
    } finally {
      setDeleteActionState("idle");
    }
  }

  const tableRows = filteredRows.map((row) => ({
    ...row,
    key: `${row.isMuxOnly ? "mux-only" : "asset"}:${row.assetId}`,
    cells: buildCells(activeTab, row),
  }));

  return (
    <div className="space-y-8">
      <MediaDirectUploadField requestUploadAction={requestUploadAction} />

      <div className="flex border-b border-bone/10">
        {TABS.map((tab) => (
          <MediaTab key={tab} active={activeTab === tab} onClick={() => handleTabChange(tab)}>
            {tab === "all" ? `All Media (${rows.length})` : getTabTitle(tab)}
          </MediaTab>
        ))}
      </div>

      {detailError && <p className="text-xs text-red-400">{detailError}</p>}

      <MediaTabContainer title={getTabTitle(activeTab)}>
        {tableRows.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-bone/60">No media assets in this view.</p>
          </div>
        ) : (
          <MediaTable headers={getTableHeaders(activeTab)} rows={tableRows} onRowClick={handleRowClick} />
        )}
      </MediaTabContainer>

      {showAssetDetail && selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          onClose={closeAssetDetail}
          isOpen={showAssetDetail}
          refreshAction={refreshAction}
          scanAction={{
            onScan: () => handleScanAssetDetail(selectedAsset),
            state: scanActionState,
            report: scanReport,
          }}
          deleteExecutionAction={{
            quarantineStatus,
            quarantineActionState,
            quarantineError,
            onQuarantine: (reason) => handleQuarantineAsset(selectedAsset, reason),
            onRelease: () => handleReleaseQuarantine(selectedAsset),
            deleteActionState,
            deleteResult,
            deleteError,
            onConfirmDelete: (confirmationToken) =>
              handleConfirmDelete(selectedAsset, confirmationToken),
          }}
        />
      )}
    </div>
  );
}