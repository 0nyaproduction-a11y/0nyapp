"use client";

import { useState, useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ButtonLink } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// CMS-C08B-07 — shared freshness + operator status clarity vocabulary.
//
// Five explicit states. UNKNOWN is fail-closed (never green/success):
//   HEALTHY   data is fresh and verified
//   DEGRADED  data is usable but partially stale or incomplete
//   DELAYED   data is stale beyond the expected refresh window
//   FAILED    data could not be loaded or verified
//   UNKNOWN   state cannot be determined — treated as non-healthy
//
// Components:
//   CmsStatusBadge      the five-state badge (UNKNOWN is amber, never green)
//   CmsFreshnessLabel   "Last refreshed <time>" with live revalidation
//   CmsFreshnessPanel   combined status + freshness for list headers
// ---------------------------------------------------------------------------

export type CmsOperatorStatus = "HEALTHY" | "DEGRADED" | "DELAYED" | "FAILED" | "UNKNOWN";

export interface FreshnessProps {
  /** Epoch milliseconds of the last successful data load. */
  lastRefreshedMs: number;
  /** Optional explicit status; defaults to HEALTHY when freshness is recent. */
  status?: CmsOperatorStatus;
  /** Label prefix. Defaults to "Last refreshed". */
  label?: string;
  /** Accessibility description for the freshness region. */
  ariaLabel?: string;
}

const STATUS_META: Record<CmsOperatorStatus, { label: string; className: string; description: string }> = {
  HEALTHY: {
    label: "HEALTHY",
    className: "bg-teal/10 text-teal border-teal/40",
    description: "Data is fresh and verified.",
  },
  DEGRADED: {
    label: "DEGRADED",
    className: "bg-yellow-900/20 text-yellow-300 border-yellow-700/40",
    description: "Data is usable but partially stale or incomplete.",
  },
  DELAYED: {
    label: "DELAYED",
    className: "bg-amber-900/20 text-amber-300 border-amber-700/40",
    description: "Data is stale beyond the expected refresh window.",
  },
  FAILED: {
    label: "FAILED",
    className: "bg-red-900/20 text-red-300 border-red-700/40",
    description: "Data could not be loaded or verified.",
  },
  UNKNOWN: {
    label: "UNKNOWN",
    className: "bg-amber-900/20 text-amber-300 border-amber-700/40",
    description: "State cannot be determined. Treated as non-healthy.",
  },
};

/** Five-state operator-status badge. UNKNOWN is amber (never green). */
export function CmsStatusBadge({
  status,
  showDescription = false,
}: {
  status: CmsOperatorStatus;
  showDescription?: boolean;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.UNKNOWN;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-label={`Status: ${meta.label}`}
        title={meta.description}
        className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${meta.className}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            status === "HEALTHY"
              ? "bg-teal"
              : status === "DEGRADED" || status === "UNKNOWN" || status === "DELAYED"
                ? "bg-amber-400"
                : "bg-red-400"
          }`}
        />
        {meta.label}
      </span>
      {showDescription && (
        <span className="text-[0.65rem] text-bone/50">{meta.description}</span>
      )}
    </span>
  );
}

function formatRelativeTime(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * "Last refreshed <time>" label. Updates its relative timestamp on an interval
 * so operators can see staleness without manual refresh. The timestamp itself
 * only changes when the parent passes a new lastRefreshedMs (i.e. after a real
 * revalidation) — we never fabricate freshness.
 */
export function CmsFreshnessLabel({
  lastRefreshedMs,
  label = "Last refreshed",
  ariaLabel,
}: FreshnessProps) {
  const [tick, setTick] = useState(0);

  // Re-render the relative label every 15s so "3s ago" becomes "18s ago"
  // without fabricating a new timestamp.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  // tick is read here to trigger re-renders; suppresses unused-var lint.
  void tick;

  const absolute = new Date(lastRefreshedMs).toLocaleString();
  const relative = formatRelativeTime(lastRefreshedMs);

  return (
    <time
      dateTime={new Date(lastRefreshedMs).toISOString()}
      title={absolute}
      aria-label={ariaLabel ?? `${label} ${relative}`}
      className="font-mono text-[0.65rem] text-bone/50"
      // The relative text depends on the client clock at hydration time, so
      // the server and first client render can disagree by a second or two.
      // The timestamp itself (dateTime/title/lastRefreshedMs) is deterministic;
      // suppress only the hydration warning for that cosmetic difference.
      suppressHydrationWarning
    >
      {label} {relative}
    </time>
  );
}

/**
 * Combined status + freshness panel for list headers. Shows the operator
 * status badge alongside the last-refreshed timestamp and a read-only reload
 * button. The reload button calls router.refresh() — it never mutates.
 */
export function CmsFreshnessPanel({
  lastRefreshedMs,
  status = "HEALTHY",
  reloadLabel = "Reload list (read-only)",
  reloadTitle = "Re-fetches data from the server. Performs no writes.",
  onReload,
  className = "",
}: {
  lastRefreshedMs: number;
  status?: CmsOperatorStatus;
  reloadLabel?: string;
  reloadTitle?: string;
  onReload?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleReload() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Read-only: re-render server data without mutations.
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 400));
      onReload?.();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 border border-bone/10 bg-bone/[0.02] px-3 py-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <CmsStatusBadge status={status} />
      <CmsFreshnessLabel lastRefreshedMs={lastRefreshedMs} />
      <div className="ml-auto">
        <button
          type="button"
          onClick={handleReload}
          disabled={refreshing}
          title={reloadTitle}
          aria-busy={refreshing}
          className="inline-flex items-center gap-2 border border-bone/20 bg-bone/[0.03] px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-bone/40 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing && <CmsSpinner className="h-3 w-3" />}
          {refreshing ? "Reloading…" : reloadLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CMS-C08B-03 — shared loading / empty / error / submitting state patterns.
//
// One consistent visual language for every admin surface:
//  - CmsLoading      bounded, labelled loading region (never a blank page)
//  - CmsEmptyState   EMPTY vs ERROR distinction + next action
//  - CmsErrorState   recoverable error with optional safe retry + advanced detail
//  - CmsSubmitButton submit control that disables itself and shows a
//                    submitting label while its own form action is pending
//  - CmsReloadButton read-only refresh (router.refresh — no mutations)
//
// These components render state; they never mutate data or change server
// behaviour. Validation errors remain inline in their owning forms —
// CmsErrorState is for load/server failures.
// ---------------------------------------------------------------------------

const SPINNER_CLASS =
  "inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-bone/30 border-t-teal";

export function CmsSpinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`${SPINNER_CLASS} ${className}`} />;
}

/**
 * Bounded loading region. Stays inside the changing content area — the page
 * around it keeps its shell. Announced to assistive tech via role="status".
 * Never renders a fake progress percentage.
 */
export function CmsLoading({
  label = "Loading…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-3 border border-bone/10 bg-bone/[0.03] px-4 py-8 text-sm text-bone/60 ${className}`}
    >
      <CmsSpinner />
      <span>{label}</span>
    </div>
  );
}

/**
 * Empty-state panel. Distinguishes "no data yet" from a failure, and offers
 * the relevant next action when one exists.
 */
export function CmsEmptyState({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-bone/10 bg-bone/[0.03] px-4 py-8 text-center ${className}`}
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/40">
        Empty
      </p>
      <p className="mt-2 text-sm font-semibold text-bone">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-bone/60">{description}</p>
      )}
      {action && (
        <div className="mt-4 flex justify-center">
          <ButtonLink href={action.href} variant="secondary">
            {action.label}
          </ButtonLink>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Recoverable error state. Human-readable message first; technical detail is
 * hidden behind an "advanced" disclosure and never includes secrets or stack
 * traces (server/console logs stay authoritative).
 */
export function CmsErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Retry",
  detail,
  className = "",
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`border border-rose-500/30 bg-rose-500/[0.06] px-4 py-6 ${className}`}
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rose-200/80">
        Error
      </p>
      <p className="mt-2 text-sm font-semibold text-rose-100">{title}</p>
      <p className="mt-1 text-sm text-bone/75">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            {retryLabel}
          </button>
        </div>
      )}
      {detail && (
        <details className="mt-4 border-t border-bone/10 pt-3">
          <summary className="cursor-pointer text-xs text-bone/40 hover:text-bone/60">
            Technical details (for support — safe to ignore)
          </summary>
          <p className="mt-2 break-words font-mono text-[0.65rem] text-bone/50">
            {detail}
          </p>
        </details>
      )}
    </div>
  );
}

type CmsSubmitButtonProps = {
  children: ReactNode;
  /** Label shown while this button's own form action is pending. */
  pendingLabel?: string;
  /** Override for compact controls (move/reorder arrows). */
  className?: string;
  disabled?: boolean;
  title?: string;
  /** For server forms that submit via a named button value. */
  name?: string;
  value?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "formAction">;

/**
 * Submit control for plain server-action `<form>`s (and client forms).
 * Uses useFormStatus so it only reacts to ITS OWN form — one panel saving
 * never disables unrelated panels. Prevents duplicate submission by
 * disabling while pending, and shows an explicit submitting label.
 */
export function CmsSubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  disabled,
  title,
  name,
  value,
  formAction,
}: CmsSubmitButtonProps) {
  const { pending } = useFormStatus();

  const buttonClassName =
    className ??
    "inline-flex min-h-11 items-center justify-center gap-2 border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      title={title}
      disabled={disabled || pending}
      aria-busy={pending}
      className={buttonClassName}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * READ-ONLY refresh for list views. Calls router.refresh() which re-runs the
 * server component render — it never calls a mutating/reconcile action and
 * never writes to the database or media provider.
 */
export function CmsReloadButton({
  label = "Reload",
  pendingLabel = "Reloading…",
  className = "",
  title,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
  title?: string;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleReload() {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      // Re-render server data without mutating anything.
      router.refresh();
      // Give the transition a tick so the label is perceivable.
      await new Promise((resolve) => setTimeout(resolve, 400));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleReload}
      disabled={refreshing}
      title={title}
      aria-busy={refreshing}
      className={`inline-flex items-center gap-2 border border-bone/20 bg-bone/[0.03] px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-bone/40 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {refreshing && <CmsSpinner className="h-3 w-3" />}
      {refreshing ? pendingLabel : label}
    </button>
  );
}
