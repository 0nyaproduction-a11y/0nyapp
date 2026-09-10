"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ButtonLink } from "@/components/ui/Button";

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
