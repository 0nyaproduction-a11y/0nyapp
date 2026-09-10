"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export type DangerZoneActionState = {
  blockers?: string[];
  error?: string;
  message?: string;
};

export type DangerZoneConfirmDialogProps = {
  title: string;
  description: string;
  consequenceText?: string;
  action: (state: DangerZoneActionState, formData: FormData) => Promise<DangerZoneActionState>;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  formFields?: ReactNode;
};

export function DangerZoneConfirmDialog({
  title,
  description,
  consequenceText,
  action,
  confirmLabel,
  cancelLabel = "Cancel",
  icon,
  className,
  disabled,
  formFields,
}: DangerZoneConfirmDialogProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || pending}
        className={className}
      >
        {icon}
        {confirmLabel}
      </button>
    );
  }

  return (
    <div className="border border-rose-500/25 bg-rose-500/[0.04] p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-100 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <p className="text-sm text-bone/70">{description}</p>
        {consequenceText && (
          <p className="text-sm text-rose-200 mt-2 border border-rose-500/20 bg-rose-500/10 p-2 rounded">
            {consequenceText}
          </p>
        )}
      </div>

      {state.blockers && state.blockers.length > 0 && (
        <div className="border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-100">
          <p className="font-semibold">Action is blocked until these are resolved:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-100/90">
            {state.blockers.map((blocker, index) => (
              <li key={index}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {formFields}

        {state.error && <p className="text-sm text-rose-200">{state.error}</p>}
        {state.message && <p className="text-sm text-teal">{state.message}</p>}

        <div className="flex gap-3">
          <Button
            type="submit"
            variant="ghost"
            disabled={pending || disabled}
            className="border-rose-500/40 bg-rose-500/10 text-rose-100 hover:border-rose-400 hover:bg-rose-500/20"
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

export type QuarantineConfirmState = {
  error?: string;
  success?: boolean;
};

export type QuarantineConfirmDialogProps = {
  assetId: string;
  assetName?: string;
  onConfirm: (reason?: string) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  actionState?: "idle" | "working";
};

export function QuarantineConfirmDialog({
  assetId,
  assetName,
  onConfirm,
  onCancel,
  disabled,
  actionState = "idle",
}: QuarantineConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || working}
        className="px-3 py-1.5 rounded bg-amber-900/30 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {working ? "Working…" : "Quarantine for review"}
      </button>
    );
  }

  async function handleConfirm() {
    setWorking(true);
    setError(null);
    try {
      await onConfirm(reason || undefined);
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to quarantine asset.");
      setWorking(false);
    }
  }

  function handleCancel() {
    if (!working) {
      setOpen(false);
      setReason("");
      setError(null);
      onCancel?.();
    }
  }

  return (
    <div className="border border-amber-500/25 bg-amber-950/20 p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-100">
          Quarantine Asset
        </h3>
        <p className="text-sm text-bone/70">
          You are about to quarantine asset:
        </p>
        <p className="font-mono text-xs text-amber-200 bg-amber-950/30 p-2 rounded">
          {assetId}
        </p>
        {assetName && (
          <p className="text-xs text-bone/60 mt-1">
            Content: {assetName}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            Reason for quarantine (optional)
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason..."
            className="w-full rounded border border-bone/20 bg-bone/5 px-2 py-1.5 text-xs text-bone/80 placeholder:text-bone/30"
            disabled={working}
          />
        </label>
      </div>

      <div className="border border-amber-500/20 bg-amber-500/10 p-2 rounded text-xs text-amber-200">
        Quarantine will remove this asset from active use. You can release it from quarantine later if needed.
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={working}
          className="px-3 py-1.5 rounded bg-amber-900/50 border border-amber-500/50 text-amber-200 text-xs font-semibold hover:bg-amber-900/70 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {working ? "Working…" : "Confirm quarantine"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={working}
          className="px-3 py-1.5 rounded bg-bone/10 border border-bone/20 text-bone/70 text-xs font-medium hover:bg-bone/20 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export type PublishConfirmDialogProps = {
  title: string;
  targetName: string;
  description: string;
  consequenceText: string;
  onConfirm: () => Promise<{ error?: string } | void>;
  onCancel?: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export function PublishConfirmDialog({
  title,
  targetName,
  description,
  consequenceText,
  onConfirm,
  onCancel,
  disabled,
  children,
}: PublishConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function handleConfirm() {
    setWorking(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result && "error" in result && result.error) {
        setError(result.error);
        setWorking(false);
      } else {
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setWorking(false);
    }
  }

  function handleCancel() {
    if (!working) {
      setOpen(false);
      setError(null);
      onCancel?.();
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {children}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="text-xs text-bone/50 hover:text-bone/70"
        >
          Confirm publish
        </button>
</div>
  );
}


  return (
    <div className="border border-amber-500/25 bg-amber-950/20 p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-100">
          {title}
        </h3>
        <p className="text-sm text-bone/70">
          {description}
        </p>
        <p className="font-mono text-xs text-amber-200 bg-amber-950/30 p-2 rounded mt-2">
          {targetName}
        </p>
      </div>

      <div className="border border-amber-500/20 bg-amber-500/10 p-2 rounded text-xs text-amber-200">
        {consequenceText}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={working}
          className="px-3 py-1.5 rounded bg-teal-900/50 border border-teal-500/50 text-teal-200 text-xs font-semibold hover:bg-teal-900/70 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {working ? "Publishing…" : "Confirm publish"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={working}
          className="px-3 py-1.5 rounded bg-bone/10 border border-bone/20 text-bone/70 text-xs font-medium hover:bg-bone/20 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


export type DangerZoneConfirmButtonProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "danger" | "amber";
};

export function DangerZoneConfirmButton({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  disabled,
  variant = "danger",
}: DangerZoneConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || working}
        className={variant === "danger"
          ? "px-3 py-1.5 rounded bg-red-900/30 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          : "px-3 py-1.5 rounded bg-amber-900/30 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        {confirmLabel}
      </button>
    );
  }

  async function handleConfirm() {
    setWorking(true);
    try {
      onConfirm();
    } finally {
      setWorking(false);
    }
  }

  function handleCancel() {
    if (!working) {
      setOpen(false);
    }
  }

  return (
    <div className={`border ${variant === "danger" ? "border-red-500/25 bg-red-950/20" : "border-amber-500/25 bg-amber-950/20"} p-3 space-y-2`}>
      <p className="text-sm text-bone/70">{description}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={working}
          className={`px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${variant === "danger"
            ? "bg-red-900/50 border border-red-500/50 text-red-200 hover:bg-red-900/70"
            : "bg-amber-900/50 border border-amber-500/50 text-amber-200 hover:bg-amber-900/70"
          }`}
        >
          {working ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={working}
          className="px-3 py-1.5 rounded bg-bone/10 border border-bone/20 text-bone/70 text-xs font-medium hover:bg-bone/20 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}