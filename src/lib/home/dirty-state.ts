/**
 * C08B-01: Unsaved-changes guard authority.
 *
 * This module is the single source of truth for "is this row dirty?"
 * It is intentionally framework-agnostic so it can be used from both
 * server actions and client components.
 *
 * Rules (C08B-01):
 *  - A row is "dirty" when its local form state differs from the committed row.
 *  - Collapsing a dirty row must NOT silently discard changes.
 *    Either the row stays open, or the authoritative unsaved-change
 *    confirmation is invoked (see `confirmUnsavedChanges`).
 *  - A successful save returns the row to "clean".
 *  - A failed save keeps the row "dirty".
 *  - Validation failures keep the row "dirty" with the error surfaced.
 */

import type { HomeRow, HomeRowFormState } from "@/lib/home/types";

export type DirtyCheckResult = {
  dirty: boolean;
  fields: string[];
};

/**
 * Compares a working form state against the committed row.
 * Returns the list of changed field names so callers can surface
 * a targeted reason for dirtiness.
 */
export function isRowDirty(
  row: HomeRow,
  formState: HomeRowFormState,
): DirtyCheckResult {
  const changed: string[] = [];

  if (formState.title !== row.title) {
    changed.push("title");
  }

  if (formState.kicker !== (row.kicker ?? "")) {
    changed.push("kicker");
  }

  if (formState.visible !== row.visible) {
    changed.push("visible");
  }

  if (
    formState.assignedSlugs.length !== row.assignedSlugs.length ||
    formState.assignedSlugs.some(
      (slug, index) => slug !== row.assignedSlugs[index],
    )
  ) {
    changed.push("assignedSlugs");
  }

  return {
    dirty: changed.length > 0,
    fields: changed,
  };
}

/**
 * Confirms with the operator whether to discard unsaved changes.
 *
 * In a Server Action context (no `window`), this throws a special
 * `UnsavedChangesError` that the route handler can catch and surface
 * as a validation failure, keeping the row dirty.
 *
 * In a client component context, it delegates to `window.confirm`.
 *
 * @returns `true` if the operator chose to discard (proceed).
 *           `false` if the operator cancelled (keep row open / keep dirty).
 */
export function confirmUnsavedChanges(message: string): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    // Server context: cannot prompt. Throw so the caller treats this as
    // a validation failure and keeps the row dirty.
    throw new UnsavedChangesError(message);
  }

  return window.confirm(message);
}

export class UnsavedChangesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsavedChangesError";
  }
}

/**
 * A row-level dirty-state manager intended for client components.
 * Tracks whether the current form state has unsaved changes and
 * provides a safe-collapse guard that respects C08B-01.
 */
export type RowDirtyState = {
  isDirty: boolean;
  dirtyFields: string[];
  markDirty: (dirty: boolean, fields?: string[]) => void;
  canCollapse: (row: HomeRow, formState: HomeRowFormState) => boolean;
};

export function createRowDirtyState(): RowDirtyState {
  let isDirty = false;
  let dirtyFields: string[] = [];

  return {
    get isDirty() {
      return isDirty;
    },
    get dirtyFields() {
      return dirtyFields;
    },
    markDirty(dirty: boolean, fields: string[] = []) {
      isDirty = dirty;
      dirtyFields = fields;
    },
    canCollapse(row: HomeRow, formState: HomeRowFormState) {
      // C08B-01: a dirty row must not collapse silently.
      // If clean, always can collapse.
      // If dirty, return false so the caller keeps it open.
      const result = isRowDirty(row, formState);
      return !result.dirty;
    },
  };
}
