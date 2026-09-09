/**
 * C08B-02: Normalized destructive-action confirmation.
 *
 * All destructive Home Composer actions (delete row, remove assigned title,
 * archive, etc.) must route through `confirmDestructiveAction` so the
 * confirmation UX is consistent and auditable.
 *
 * The message format is:
 *   "Action: <what> — affected: <target>"
 * e.g. "Delete row 'Continue Watching'? This cannot be undone."
 */

export type DestructiveAction =
  | "delete_row"
  | "remove_title"
  | "archive_row"
  | "unpublish_row";

export type ConfirmOptions = {
  action: DestructiveAction;
  targetLabel: string;
  detail?: string;
  impact?: string;
};

const actionLabels: Record<DestructiveAction, string> = {
  delete_row: "Delete row",
  remove_title: "Remove title",
  archive_row: "Archive row",
  unpublish_row: "Unpublish row",
};

export function buildDestructiveMessage(options: ConfirmOptions): string {
  const label = actionLabels[options.action];
  const parts = [label, options.targetLabel];

  if (options.impact) {
    parts.push(`This cannot be undone: ${options.impact}`);
  } else if (options.detail) {
    parts.push(options.detail);
  }

  return parts.join(" — ");
}

/**
 * Prompts the operator for destructive-action confirmation.
 *
 * In a Server Action context (no `window`), throws a
 * `DestructiveActionCancelledError` so the caller can treat it as a
 * validation failure rather than proceeding.
 *
 * @returns `true` if confirmed, `false` if cancelled.
 */
export function confirmDestructiveAction(options: ConfirmOptions): boolean {
  const message = buildDestructiveMessage(options);

  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    throw new DestructiveActionCancelledError(message);
  }

  return window.confirm(message);
}

export class DestructiveActionCancelledError extends Error {
  readonly action: DestructiveAction;

  constructor(message: string, action?: DestructiveAction) {
    super(message);
    this.name = "DestructiveActionCancelledError";
    this.action = action ?? "delete_row";
  }
}
