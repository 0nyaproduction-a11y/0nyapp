/**
 * C08B-06: Compact RowHeader for the Home Composer.
 *
 * Shows a collapsed summary of a Home row:
 * - title
 * - type/status badge
 * - order/position
 * - enabled/visible state
 * - item count
 * - important warning/problem if present
 * - expand/collapse affordance
 *
 * The existing destructive action (delete) routes through C08B-02.
 */

"use client";

import { useTransition } from "react";
import type { HomeRow, RowWarning } from "@/lib/home/types";
import { Icon } from "@/components/ui/Icon";
import { confirmDestructiveAction } from "@/lib/home/destructive-action";
import { deleteHomeRow } from "@/lib/home/actions";

type RowHeaderProps = {
  row: HomeRow;
  position: number;
  itemCount: number;
  warnings: RowWarning[];
  isExpanded: boolean;
  isDirty: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onVisibilityToggle: () => void;
  onDeleted: () => void;
};

const rowTypeLabels: Record<HomeRow["type"], string> = {
  spotlight: "Spotlight",
  "featured-hero": "Featured Hero",
  "continue-watching": "Continue Watching",
  "start-here": "Start Here",
  trending: "Trending",
  "new-releases": "New Releases",
  "curator-choice": "Curator Choice",
  "genre-focus": "Genre Focus",
};

const statusBadgeClasses: Record<HomeRow["type"], string> = {
  spotlight: "border-teal/30 text-teal",
  "featured-hero": "border-bone/10 text-bone/60",
  "continue-watching": "border-bone/10 text-bone/60",
  "start-here": "border-bone/10 text-bone/60",
  trending: "border-bone/10 text-bone/60",
  "new-releases": "border-bone/10 text-bone/60",
  "curator-choice": "border-amber-400/30 text-amber-400",
  "genre-focus": "border-amber-400/30 text-amber-400",
};

function getMostImportantWarning(warnings: RowWarning[]): RowWarning | null {
  return warnings.length > 0 ? warnings[0] : null;
}

export function RowHeader({
  row,
  position,
  itemCount,
  warnings,
  isExpanded,
  isDirty,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onVisibilityToggle,
  onDeleted,
}: RowHeaderProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = confirmDestructiveAction({
      action: "delete_row",
      targetLabel: row.title,
      impact: "Row will be removed from the Home page layout.",
    });

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteHomeRow(row.id);

      if (result.success) {
        onDeleted();
      } else {
        // The row is NOT deleted — keep it open so the operator
        // sees the error. C08B-01 authority: never discard silently.
        console.warn("Failed to delete row:", result.error);
      }
    });
  }

  const warning = getMostImportantWarning(warnings);

  return (
    <div
      className={`
        flex items-center gap-2 border-t border-bone/10 bg-background
        transition-colors
        ${isExpanded ? "border-b-0" : "hover:border-b-teal/20"}
        ${isDirty ? "ring-1 ring-teal/30" : ""}
      `}
    >
      {/* Position / Order indicator */}
      <div className="flex-shrink-0 border-r border-bone/10 px-2.5 py-2 text-center">
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-bone/40">
          #{position}
        </span>
      </div>

      {/* Main header content */}
      <div className="flex flex-1 items-center gap-2 py-2.5">
         {/* Expand / Collapse affordance */}
         <button
           type="button"
           data-testid={`row-expand-${row.id}`}
           onClick={onToggleExpand}
           aria-expanded={isExpanded}
           aria-label={isExpanded ? `Collapse ${row.title}` : `Expand ${row.title}`}
           className="grid size-7 place-items-center text-bone/50 transition hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
         >
          <Icon
            name={isExpanded ? "chevron-down" : "chevron-right"}
            className="h-3.5 w-3.5"
          />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/55 truncate">
              {row.title}
            </span>
            <span
              className={`border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] ${statusBadgeClasses[row.type]}`}
            >
              {rowTypeLabels[row.type]}
            </span>
            {isDirty ? (
              <span className="text-meta text-xs text-teal">•</span>
            ) : null}
          </div>

          <div className="mt-0.5 flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-bone/50">
            <span className="text-bone/40">{itemCount} title{itemCount !== 1 ? "s" : ""}</span>

            <button
              type="button"
              onClick={onVisibilityToggle}
              aria-pressed={row.visible}
              aria-label={row.visible ? "Hide row" : "Show row"}
              className={`inline-flex items-center gap-1 transition ${
                row.visible ? "text-teal/70" : "text-bone/40"
              }`}
            >
              <Icon
                name={row.visible ? "eye" : "eye-off"}
                className="h-3 w-3"
              />
              {row.visible ? "Visible" : "Hidden"}
            </button>
          </div>
        </div>
      </div>

      {/* Warning indicator */}
      {warning ? (
        <div className="flex-shrink-0" title={warning.label}>
          <Icon
            name="alert-triangle"
            data-testid={`row-warning-icon-${row.id}`}
            className="h-4 w-4 text-amber-400"
          />
        </div>
      ) : null}

      {/* Row actions: reorder + delete */}
      <div className="flex flex-shrink-0 items-center gap-0.5 border-l border-bone/10 pl-1">
        <button
          type="button"
          onClick={onMoveUp}
          aria-label={`Move ${row.title} up`}
          className="grid size-7 place-items-center text-bone/40 transition hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <span className="font-mono text-[0.6rem] leading-none">▲</span>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          aria-label={`Move ${row.title} down`}
          className="grid size-7 place-items-center text-bone/40 transition hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <span className="font-mono text-[0.6rem] leading-none">▼</span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          aria-label={`Delete ${row.title}`}
          className="grid size-7 place-items-center text-bone/40 transition hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
