/**
 * Home Composer domain types.
 *
 * The Home page is composed of a Spotlight section and a list of Home rows.
 * Each row assembles a subset of published series into an editorial slot.
 *
 * These types describe the operator-facing CMS configuration surface only.
 * They do NOT change catalogue publication/catalog rules or row IDs/types.
 */

import type { ContentItem } from "@/data/content";

/**
 * The fixed, authoritative set of Home row slot types.
 * IDs and types are part of the Home business rules and must not change.
 */
export type HomeRowType =
  | "spotlight"
  | "featured-hero"
  | "continue-watching"
  | "start-here"
  | "trending"
  | "new-releases"
  | "curator-choice"
  | "genre-focus";

/**
 * A Home row in its persisted/saved state.
 * `id` is assigned by the system (not operator-editable in a way that changes
 * the row type semantics).
 */
export type HomeRow = {
  id: string;
  title: string;
  type: HomeRowType;
  sortOrder: number;
  visible: boolean;
  /** Series slugs assigned to this row, in display order. */
  assignedSlugs: string[];
  /** Optional override kicker label displayed above the row title. */
  kicker?: string | null;
};

/**
 * The Spotlight configuration is a single, system-level editorial slot.
 * It is always visually distinct from ordinary Home rows and its controls
 * are never mixed into the row editor hierarchy.
 */
export type SpotlightConfig = {
  /** Whether Spotlight is shown on the Home page. */
  enabled: boolean;
  /** The series slug currently featured in Spotlight. null = auto (first featured). */
  featuredSlug: string | null;
  /** Optional editorial badge/kicker override. */
  badge: string | null;
  /** Optional custom headline override. */
  headline: string | null;
};

/**
 * Form state for a single row editor. This is the in-memory working copy
 * that an operator may edit before saving. Dirty-state logic (C08B-01)
 * compares this against the committed row.
 */
export type HomeRowFormState = {
  title: string;
  kicker: string;
  visible: boolean;
  /** Series slugs in their current drag/drop order within the editor. */
  assignedSlugs: string[];
};

/**
 * Form state for the Spotlight editor.
 */
export type SpotlightFormState = {
  enabled: boolean;
  featuredSlug: string | null;
  badge: string;
  headline: string;
};

/**
 * A problem/warning that may be attached to a row for operator visibility
 * in the collapsed summary.
 */
export type RowWarning =
  | { code: "empty"; label: string }
  | { code: "unpublished_assigned"; label: string; count: number }
  | { code: "duplicate_assignment"; label: string; count: number }
  | { code: "save_failed"; label: string };

/**
 * Enriched row returned by the server that includes the resolved content
 * items and any warnings for the collapsed summary.
 */
export type HomeRowWithContent = HomeRow & {
  items: ContentItem[];
  warnings: RowWarning[];
  /** Whether the row currently has unsaved edits in the client. */
  isDirty: boolean;
};

/**
 * The full Home Composer payload loaded by the page.
 */
export type HomeComposerData = {
  rows: HomeRowWithContent[];
  spotlight: SpotlightConfig & { warnings: RowWarning[] };
  /** All published series available for assignment. */
  catalog: ContentItem[];
};

/**
 * Status values used across row headers and the Spotlight editor.
 * These mirror the status semantics of the catalogue without changing them.
 */
export type HomeRowStatus = "published" | "draft" | "archived" | "curated";
