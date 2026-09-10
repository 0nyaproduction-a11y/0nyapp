// COMPONENT PLACEHOLDER - React implementation will be created
import React from 'react';
import { MediaAssetRefreshForm } from './MediaAssetRefreshForm';
import { QuarantineConfirmDialog } from './DangerZoneActionForm';
import type { MediaAssetFormState } from '@/lib/cms/media';
import type { MediaViewRow } from '@/lib/cms/media-truth-model';
import type { DeleteImpactReport } from '@/lib/cms/media-delete-impact';
import type { ConfirmDeleteResult, QuarantineStatus } from '@/lib/cms/media-delete-executor';

export function MediaTabContainer({ children, title }: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="bg-deep border border-bone/10 rounded-lg">
      <div className="px-4 py-3 border-b border-bone/10">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
          {title}
        </h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

export function MediaTab({ active, onClick, children }: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium uppercase tracking-[0.14em] border-b-2 transition-colors ${active
          ? 'border-teal text-teal'
          : 'border-transparent text-bone/60 hover:text-bone/80'}`}
    >
      {children}
    </button>
  );
}

export function MediaTable<T extends { key: string; cells: React.ReactNode[] }>({
  headers,
  rows,
  onRowClick,
}: {
  headers: string[];
  rows: T[];
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-hidden border border-bone/10 rounded">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-bone/[0.03] text-xs uppercase tracking-[0.14em] text-bone/50">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="px-4 py-3 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className="border-t border-bone/10 align-top hover:bg-bone/[0.02] cursor-pointer"
              onClick={() => onRowClick?.(row)}
            >
              {row.cells.map((cell, index) => (
                <td key={index} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status, variant = "default" }: {
  status: string;
  variant?: "default" | "processing" | "success" | "error" | "warning";
}) {
  const variantClasses = {
    default: "bg-bone/10 text-bone/70",
    processing: "bg-blue-900/20 text-blue-400",
    success: "bg-green-900/20 text-green-400",
    error: "bg-red-900/20 text-red-400",
    warning: "bg-yellow-900/20 text-yellow-400",
  };

  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-mono uppercase tracking-wider ${variantClasses[variant]}`}>
      {status}
    </span>
  );
}

export function ProviderStateBadge({ state }: {
  state: string;
}) {
  const stateColors: Record<string, string> = {
    LINKED: "bg-green-900/20 text-green-400",
    MUX_ONLY: "bg-blue-900/20 text-blue-400",
    SUPABASE_ONLY: "bg-purple-900/20 text-purple-400",
    AMBIGUOUS: "bg-orange-900/20 text-orange-400",
    UNKNOWN: "bg-gray-900/20 text-gray-400",
  };

  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${stateColors[state] || stateColors.UNKNOWN}`}>
      {state}
    </span>
  );
}

export function IssueBadge({ severity, issue }: {
  severity: string;
  issue: string;
}) {
  const severityColors = {
    high: "bg-red-900/20 text-red-400",
    medium: "bg-yellow-900/20 text-yellow-400",
    low: "bg-blue-900/20 text-blue-400",
  };

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${severityColors[severity as keyof typeof severityColors] || severityColors.medium}`}>
        {severity.toUpperCase()}
      </span>
      {issue && (
        <div className="text-xs text-bone/60 max-w-xs truncate" title={issue}>
          {issue}
        </div>
      )}
    </div>
  );
}

export function PlaybackStatus({ status, mux, supabase }: {
  status: string;
  mux: boolean;
  supabase: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {mux && (
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" title="Mux" />
      )}
      {supabase && (
        <span className="inline-block w-2 h-2 rounded-full bg-purple-500" title="Supabase" />
      )}
      <span className="text-xs text-bone/60 ml-1">{status}</span>
    </div>
  );
}

export function PublishedBadge({ published }: {
  published: boolean;
}) {
  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${published
        ? 'bg-green-900/20 text-green-400'
        : 'bg-bone/10 text-bone/60'}`}>
      {published ? 'YES' : 'NO'}
    </span>
  );
}

export function AssetDetailPanel({
  asset,
  onClose,
  isOpen,
  refreshAction,
  scanAction,
  deleteExecutionAction,
}: {
  asset: MediaViewRow;
  onClose: () => void;
  isOpen: boolean;
  refreshAction?: (state: MediaAssetFormState, formData: FormData) => Promise<MediaAssetFormState>;
  scanAction?: {
    onScan: () => void;
    state: "idle" | "scanning" | "done";
    report: DeleteImpactReport | null;
  };
  deleteExecutionAction?: {
    quarantineStatus: QuarantineStatus;
    quarantineActionState: "idle" | "working";
    quarantineError: string | null;
    onQuarantine: (reason?: string) => void;
    onRelease: () => void;
    deleteActionState: "idle" | "working";
    deleteResult: ConfirmDeleteResult | null;
    deleteError: string | null;
    onConfirmDelete: (confirmationToken: string) => void;
  };
}) {
  if (!isOpen) return null;

  const classificationVariant =
    asset.classification === "READY"
      ? "success"
      : asset.classification === "PROCESSING"
        ? "processing"
        : "error";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-deep border border-bone/10 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-bone">Asset Details</h3>
          <button
            onClick={onClose}
            className="text-bone/60 hover:text-bone"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-bone/60 uppercase tracking-wider">Asset ID</label>
              <div className="text-sm font-mono text-bone/80 mt-1">{asset.assetId}</div>
            </div>
            <div>
              <label className="text-xs text-bone/60 uppercase tracking-wider">Provider State</label>
              <div className="text-sm mt-1">
                <ProviderStateBadge state={asset.providerState || "UNKNOWN"} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-bone/60 uppercase tracking-wider">Classification</label>
              <div className="text-sm mt-1">
                <StatusBadge status={asset.classification} variant={classificationVariant} />
              </div>
            </div>
            <div>
              <label className="text-xs text-bone/60 uppercase tracking-wider">Stored (Supabase)</label>
              <div className="text-sm mt-1">
                <StatusBadge status={asset.storedStatus || "—"} variant="default" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-bone/60 uppercase tracking-wider">Mux Connected</label>
              <div className="text-sm mt-1">
                <StatusBadge status={asset.muxConnected ? "YES" : "NO"} variant={asset.muxConnected ? "success" : "error"} />
              </div>
            </div>
            <div>
              <label className="text-xs text-bone/60 uppercase tracking-wider">Live Mux Status</label>
              <div className="text-sm mt-1 font-mono text-bone/80">
                {asset.muxAssetStatus || "—"}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-bone/60 uppercase tracking-wider">Flags</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {asset.flags && asset.flags.length > 0 ? (
                asset.flags.map((flag, index) => (
                  <span key={index} className="inline-flex px-1 py-0.5 bg-bone/10 rounded text-xs text-bone/70">
                    {flag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-bone/40">None</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-bone/60 uppercase tracking-wider">Advanced/Technical Details</label>
            <div className="bg-bone/5 border border-bone/10 rounded p-3 mt-1 font-mono text-xs text-bone/70 space-y-1">
              <div>Created: {asset.createdAt ? new Date(asset.createdAt).toLocaleString() : "—"}</div>
              <div>Stored Upload: {asset.providerUploadReference || "—"}</div>
              <div>Stored Asset: {asset.providerAssetReference || "—"}</div>
              <div>Stored Playback: {asset.providerPlaybackReference || "—"}</div>
              {asset.muxAssetId && <div>Live Mux Asset: {asset.muxAssetId}</div>}
              {asset.muxUploadStatus && <div>Mux Upload Status: {asset.muxUploadStatus}</div>}
              {asset.maxResolutionTier && <div>Max Resolution Tier: {asset.maxResolutionTier}</div>}
              {asset.resolutionTier && <div>Resolution Tier: {asset.resolutionTier}</div>}
              {asset.failureCode && <div>Failure: {asset.failureCode}</div>}
              {asset.failureMessage && <div>Failure Message: {asset.failureMessage}</div>}
              {asset.sourceMediaAssetId && <div>Source Asset ID: {asset.sourceMediaAssetId}</div>}
              {asset.derivedChildRefs && asset.derivedChildRefs.length > 0 && (
                <div>
                  Derived Children: {asset.derivedChildRefs.map((ref) => ref.id).join(", ")}
                </div>
              )}
            </div>
          </div>

          {scanAction && (
            <div className="border-t border-bone/10 pt-4">
              <label className="text-xs text-bone/60 uppercase tracking-wider">
                Delete Impact (read-only evaluation)
              </label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={scanAction.onScan}
                  disabled={scanAction.state === "scanning"}
                  className="px-3 py-1.5 rounded bg-red-900/30 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scanAction.state === "scanning" ? "Scanning…" : "Evaluate for deletion"}
                </button>
                <span className="text-[0.65rem] text-bone/50">
                  Read-only dependency scan + impact report. No deletion is performed.
                </span>
              </div>

              {scanAction.report && <DeleteImpactReportView report={scanAction.report} />}
            </div>
          )}

          {deleteExecutionAction && (
            <DeleteExecutionPanel
              assetId={asset.assetId}
              latestReport={scanAction?.report ?? null}
              action={deleteExecutionAction}
            />
          )}

          {refreshAction && (
            <div className="border-t border-bone/10 pt-4">
              <label className="text-xs text-bone/60 uppercase tracking-wider">
                Manual provider refresh (explicit — never automatic)
              </label>
              <div className="mt-2">
                <MediaAssetRefreshForm action={refreshAction} mediaAssetId={asset.assetId} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// M6B — quarantine + explicit authorized delete executor (CMS-only). This
// panel NEVER deletes on its own: it only ever calls action.onConfirmDelete
// after the caller has explicitly typed the asset id as confirmation, and
// only when the panel's own local view of the latest scan says SAFE. The
// real authorization gate is server-side (confirmAndDeleteMediaAsset
// re-scans fresh and hard-fails unless still SAFE) — this UI gate is
// defense-in-depth, not the source of truth.
// ---------------------------------------------------------------------------

function DeleteExecutionPanel({
  assetId,
  latestReport,
  action,
}: {
  assetId: string;
  latestReport: DeleteImpactReport | null;
  action: {
    quarantineStatus: QuarantineStatus;
    quarantineActionState: "idle" | "working";
    quarantineError: string | null;
    onQuarantine: (reason?: string) => void;
    onRelease: () => void;
    deleteActionState: "idle" | "working";
    deleteResult: ConfirmDeleteResult | null;
    deleteError: string | null;
    onConfirmDelete: (confirmationToken: string) => void;
  };
}) {
  const [confirmationText, setConfirmationText] = React.useState("");

  const isSafe = latestReport?.classification === "SAFE" && latestReport.deletionEnabled === true;
  const isQuarantined = action.quarantineStatus === "quarantined";
  const canConfirmDelete = isQuarantined && isSafe && confirmationText.trim() === assetId;

  return (
    <div className="border-t border-bone/10 pt-4 space-y-3">
      <label className="text-xs text-bone/60 uppercase tracking-wider">
        Quarantine + Authorized Delete (M6B)
      </label>

      {!latestReport && (
        <p className="text-[0.65rem] text-bone/50">
          Run &ldquo;Evaluate for deletion&rdquo; above first — quarantine and delete are only
          available after a Delete Impact Report has been generated.
        </p>
      )}

      {latestReport && (
        <div className="space-y-3">
          <div className="text-xs text-bone/70">
            Quarantine status:{" "}
            <span className="font-mono">
              {action.quarantineStatus === "quarantined" ? "Quarantined" : "Not quarantined"}
            </span>
          </div>

          {!isQuarantined && (
            <QuarantineConfirmDialog
              assetId={assetId}
              onConfirm={async (reason) => {
                await action.onQuarantine(reason);
              }}
              onCancel={() => {}}
              disabled={action.quarantineActionState === "working"}
              actionState={action.quarantineActionState}
            />
          )}

          {isQuarantined && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={action.onRelease}
                disabled={action.quarantineActionState === "working"}
                className="px-3 py-1.5 rounded bg-bone/10 border border-bone/20 text-bone/70 text-xs font-medium hover:bg-bone/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.quarantineActionState === "working" ? "Working…" : "Release from quarantine"}
              </button>

              <div className="rounded border border-red-500/30 bg-red-950/20 p-3 space-y-2">
                <p className="text-[0.65rem] text-bone/60">
                  {isSafe
                    ? "The last scan classified this asset as SAFE. Execution re-scans fresh at confirm time and will refuse if anything changed."
                    : `Delete is disabled: last scan classification is ${latestReport.classification}, not SAFE. Re-scan and confirm SAFE before deletion can be attempted.`}
                </p>
                <label className="text-[0.65rem] text-bone/60 uppercase tracking-wider block">
                  Type the asset id to confirm deletion
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={assetId}
                  disabled={!isSafe}
                  className="w-full rounded border border-bone/20 bg-bone/5 px-2 py-1 text-xs font-mono text-bone/80 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => action.onConfirmDelete(confirmationText)}
                  disabled={!canConfirmDelete || action.deleteActionState === "working"}
                  className="px-3 py-1.5 rounded bg-red-900/50 border border-red-500/50 text-red-200 text-xs font-semibold hover:bg-red-900/70 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {action.deleteActionState === "working" ? "Deleting…" : "Confirm & delete permanently"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {action.quarantineError && (
        <p className="text-xs text-red-400">{action.quarantineError}</p>
      )}

      {action.deleteError && <p className="text-xs text-red-400">{action.deleteError}</p>}

      {action.deleteResult?.ok && (
        <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300 space-y-1">
          <div>Deleted successfully.</div>
          <div>Supabase row deleted: {action.deleteResult.supabaseDeleted ? "yes" : "no"}</div>
          <div>
            Mux asset deleted: {action.deleteResult.muxDeleted ? "yes" : "no"}
            {action.deleteResult.muxAlreadyMissing ? " (already missing)" : ""}
          </div>
          <div>Post-delete verification: {action.deleteResult.verification}</div>
          <div>Ledger entry: {action.deleteResult.ledgerId}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// M6A — Delete Impact Report view (read-only). Renders the serializable
// report produced by scanMediaAssetForDeletion; contains no actions.
// ---------------------------------------------------------------------------

const IMPACT_BADGE_VARIANTS: Record<string, "success" | "processing" | "error" | "default"> = {
  SAFE: "success",
  REPLACE_FIRST: "processing",
  BLOCKED: "error",
  SHARED: "error",
  RETENTION_PROTECTED: "error",
  UNKNOWN: "default",
};

function impactRefLabel(summary: DeleteImpactReport["details"]["episodeRefs"]): string {
  if (summary.total === null) return "NOT SCANNED";
  const published = summary.published === null ? "" : ` · ${summary.published} published`;
  return `${summary.total}${published}`;
}

export function DeleteImpactReportView({ report }: { report: DeleteImpactReport }) {
  const details = report.details;

  const rows: [string, string][] = [
    ["Episode media refs", impactRefLabel(details.episodeRefs)],
    ["Short-film refs", impactRefLabel(details.shortFilmRefs)],
    ["Derived child assets", impactRefLabel(details.derivedChildren)],
    [
      "Related subtitle tracks",
      details.subtitleTracks.total === null ? "NOT SCANNED" : String(details.subtitleTracks.total),
    ],
    ["Shared provider refs", impactRefLabel(details.sharedProviderRefs)],
    [
      "Retention records",
      details.retention.present === null
        ? "NOT SCANNED"
        : details.retention.present
          ? "PRESENT"
          : "None",
    ],
    [
      "Home row representation",
      details.homeImpact.present === null
        ? "NOT SCANNED"
        : details.homeImpact.present
          ? "Present (enabled rows)"
          : "None (enabled)",
    ],
    ["Live Mux", details.liveMux.state],
    ["Supabase state", details.supabaseState ?? "NOT SCANNED"],
    ["Scan complete", details.scanComplete ? "YES" : "NO"],
  ];

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <StatusBadge
          status={report.classification}
          variant={IMPACT_BADGE_VARIANTS[report.classification] ?? "default"}
        />
        <span className="text-[0.65rem] text-bone/50">
          {report.deletionEnabled
            ? "Eligible (advisory only — M6A never deletes; M6B re-verifies before any execution)."
            : "Deletion disabled."}
        </span>
      </div>

      {report.blockers.length > 0 && (
        <ul className="space-y-1 text-xs text-red-400 list-disc list-inside">
          {report.blockers.map((blocker, index) => (
            <li key={index}>{blocker}</li>
          ))}
        </ul>
      )}

      {report.replacements.length > 0 && (
        <ul className="space-y-1 text-xs text-yellow-400 list-disc list-inside">
          {report.replacements.map((replacement, index) => (
            <li key={index}>{replacement}</li>
          ))}
        </ul>
      )}

      {report.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-bone/60 list-disc list-inside">
          {report.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}

      {details.homeImpact.items.length > 0 && (
        <div className="text-xs text-bone/60">
          Home rows:{" "}
          {details.homeImpact.items
            .map(
              (item) =>
                `${item.rowTitle} (${item.contentType}${item.enabled ? ", enabled" : ", disabled"})`,
            )
            .join("; ")}
        </div>
      )}

      {details.scanErrors.length > 0 && (
        <div className="text-xs text-red-400">
          Scan errors: {details.scanErrors.join(" | ")}
        </div>
      )}

      <div className="bg-bone/5 border border-bone/10 rounded p-3 text-xs text-bone/70 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-bone/50">{label}</span>
            <span className="font-mono text-bone/80 text-right">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-[0.65rem] text-bone/40">
        Report generated {new Date(report.generatedAt).toLocaleString()} · evaluation is read-only;
        M6A performs no deletion.
      </p>
    </div>
  );
}
