/**
 * C08B-03: Shared loading / empty / error state components.
 *
 * These are reused across the Home Composer and other CMS surfaces
 * to keep state presentation consistent.
 */

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { ReactNode } from "react";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12 text-center"
      aria-busy="true"
      aria-label={label}
    >
      <div className="size-8 animate-spin rounded-full border-2 border-bone/20 border-t-teal" />
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone/60">
        {label}
      </p>
    </div>
  );
}

type EmptyStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  iconName?: "browse";
};

export function EmptyState({
  title = "Nothing here yet",
  description = "There is nothing to display in this area.",
  actionLabel,
  onAction,
  iconName = "browse",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="grid size-14 place-items-center border border-bone/10 text-bone/50">
        <Icon name={iconName} className="h-5 w-5" />
      </div>
      <h3 className="font-display text-2xl font-light leading-none text-bone/80">
        {title}
      </h3>
      <p className="max-w-sm text-sm leading-6 text-muted">{description}</p>
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction} aria-label={actionLabel}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  message = "There was a problem loading this content.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="grid size-14 place-items-center border border-bone/10 text-bone/50">
        <Icon name="info" className="h-5 w-5" />
      </div>
      <h3 className="font-display text-2xl font-light leading-none text-bone/80">
        {title}
      </h3>
      <p className="max-w-sm text-sm leading-6 text-muted">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} aria-label="Retry">
          Retry
        </Button>
      ) : null}
    </div>
  );
}

type SubmittingButtonProps = {
  isSubmitting?: boolean;
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  ariaLabel?: string;
};

export function SubmittingButton({
  isSubmitting = false,
  children,
  onClick,
  disabled,
  variant = "primary",
  ariaLabel,
}: SubmittingButtonProps) {
  return (
    <Button
      aria-busy={isSubmitting}
      aria-label={ariaLabel}
      disabled={disabled ?? isSubmitting}
      onClick={onClick}
      type="button"
      variant={variant}
    >
      {isSubmitting ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-3.5 animate-spin rounded-full border border-current border-t-transparent" />
          Saving
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
