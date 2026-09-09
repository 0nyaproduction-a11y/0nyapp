/**
 * C08B-06: HomeComposer — the main container for the Home Composer UI.
 *
 * Hierarchy:
 *   PAGE
 *   → SPOTLIGHT (SpotlightComposer, visually distinct, separate hierarchy)
 *   → ROWS (collapsible list)
 *     → ROW (RowHeader + HomeRowEditor)
 *       → ITEMS / CONFIG / ACTIONS (inside HomeRowEditor)
 *
 * One-row focus: only one row editor is expanded at a time.
 * Opening another row collapses the previous one — but only if the
 * previous row is clean (C08B-01 dirty-state authority).
 *
 * C08B-05: Breadcrumb remains "Admin → Home".
 */

"use client";

import { useState, useCallback } from "react";
import type {
  HomeRow,
  HomeRowFormState,
  HomeRowWithContent,
  HomeComposerData,
} from "@/lib/home/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState, ErrorState } from "@/components/home/ui/States";
import { RowHeader } from "@/components/admin/home/RowHeader";
import { HomeRowEditor } from "@/components/admin/home/HomeRowEditor";
import { SpotlightComposer } from "@/components/admin/home/SpotlightComposer";
import { isRowDirty } from "@/lib/home/dirty-state";
import {
  updateRowOrder,
  toggleRowVisibility,
} from "@/lib/home/actions";

type HomeComposerProps = {
  data: HomeComposerData | null;
  error: string | null;
  onRetry: () => void;
};

export function HomeComposer({ data, error, onRetry }: HomeComposerProps) {
  // C08B-06: One-row focus — only one expanded row at a time.
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isSpotlightExpanded, setIsSpotlightExpanded] = useState(false);

  // Enriched row state with content + warnings
  const [rows, setRows] = useState<HomeRowWithContent[]>(
    (data?.rows ?? []).map((row) => ({
      ...row,
      items: row.items ?? [],
      warnings: row.warnings ?? [],
      isDirty: false,
    })),
  );

  const catalog = data?.catalog ?? [];
  const spotlightData = data?.spotlight;

  // C08B-06: Dirty collapse safety.
  const [dirtyCollapseBlocked, setDirtyCollapseBlocked] = useState(false);

  // Handle expanding a row — one-row focus.
  const handleToggleExpand = useCallback(
    (rowId: string) => {
      const wasExpanded = expandedRowId === rowId;

      if (wasExpanded) {
        // Attempting to collapse the currently expanded row
        const row = rows.find((r) => r.id === rowId);

        if (!row) {
          return;
        }

        const formSnapshot: HomeRowFormState = {
          title: row.title,
          kicker: row.kicker ?? "",
          visible: row.visible,
          assignedSlugs: [...row.assignedSlugs],
        };

        if (isRowDirty(row, formSnapshot).dirty) {
          // C08B-01: Don't collapse a dirty row silently
          setDirtyCollapseBlocked(true);
          setTimeout(() => setDirtyCollapseBlocked(false), 4000);
          return;
        }

        setExpandedRowId(null);
      } else {
        // Expanding a new row — collapse the previous one first
        // (unless it's dirty, in which case C08B-01 prevents it)
        const currentRow = rows.find((r) => r.id === expandedRowId);

        if (currentRow) {
          const formSnapshot: HomeRowFormState = {
            title: currentRow.title,
            kicker: currentRow.kicker ?? "",
            visible: currentRow.visible,
            assignedSlugs: [...currentRow.assignedSlugs],
          };

          if (isRowDirty(currentRow, formSnapshot).dirty) {
            // C08B-01: Previous row is dirty — don't switch focus
            setDirtyCollapseBlocked(true);
            setTimeout(() => setDirtyCollapseBlocked(false), 4000);
            return;
          }
        }

        setExpandedRowId(rowId);
      }
    },
    [rows, expandedRowId],
  );

  // Can the row collapse? (C08B-01 authority)
  function canCollapseRow(row: HomeRow): boolean {
    const formSnapshot: HomeRowFormState = {
      title: row.title,
      kicker: row.kicker ?? "",
      visible: row.visible,
      assignedSlugs: [...row.assignedSlugs],
    };

    return !isRowDirty(row, formSnapshot).dirty;
  }

  // After a successful save, update the row's committed state
  const handleSaved = useCallback(
    (rowId: string, updatedRow: HomeRow) => {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                ...updatedRow,
                items: row.items,
                warnings: row.warnings,
                isDirty: false,
              }
            : row,
        ),
      );
      setExpandedRowId(null);
    },
    [],
  );

  // Reorder handlers
  const handleMoveUp = useCallback(
    (rowId: string) => {
      const index = rows.findIndex((r) => r.id === rowId);

      if (index <= 0) {
        return;
      }

      const newRows = [...rows];
      const [moved] = newRows.splice(index, 1);
      newRows.splice(index - 1, 0, moved);
      setRows(newRows);

      void updateRowOrder(newRows.map((r) => r.id));
    },
    [rows],
  );

  const handleMoveDown = useCallback(
    (rowId: string) => {
      const index = rows.findIndex((r) => r.id === rowId);

      if (index === -1 || index >= rows.length - 1) {
        return;
      }

      const newRows = [...rows];
      const [moved] = newRows.splice(index, 1);
      newRows.splice(index + 1, 0, moved);
      setRows(newRows);

      void updateRowOrder(newRows.map((r) => r.id));
    },
    [rows],
  );

  // Visibility toggle
  const handleVisibilityToggle = useCallback(
    (rowId: string) => {
      const row = rows.find((r) => r.id === rowId);

      if (!row) {
        return;
      }

      void toggleRowVisibility(rowId, !row.visible);

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, visible: !r.visible } : r,
        ),
      );
    },
    [rows],
  );

  // Delete handler
  const handleDeleted = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setExpandedRowId((prev) => (prev === rowId ? null : prev));
  }, []);

  // C08B-06: Dirty state change from child editor
  const handleDirtyChange = useCallback(
    (rowId: string, dirty: boolean) => {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, isDirty: dirty } : row,
        ),
      );
    },
    [],
  );

  // Spotlight toggle
  const handleToggleSpotlight = () => {
    if (isSpotlightExpanded) {
      if (spotlightHasUnsavedChanges()) {
        alert("Spotlight has unsaved changes. Save or discard before collapsing.");
        return;
      }
    }

    setIsSpotlightExpanded(!isSpotlightExpanded);
  };

  function spotlightHasUnsavedChanges(): boolean {
    if (!spotlightData) {
      return false;
    }

    return !!(
      spotlightData.enabled !== true ||
      !spotlightData.featuredSlug ||
      spotlightData.badge !== "Vertical original" ||
      spotlightData.headline !== null
    );
  }

  // Loading state (C08B-03)
  if (!data && !error) {
    return <LoadingState label="Loading Home Composer" />;
  }

  // Error state (C08B-03)
  if (error || !data) {
    return (
      <ErrorState
        title="Unable to load Home"
        message={error ?? "There was a problem loading the Home Composer."}
        onRetry={onRetry}
      />
    );
  }

  // Empty state (C08B-03)
  if (!data.catalog.length) {
    return (
      <div className="p-6">
        <nav aria-label="Breadcrumb" className="sr-only">
          <ol>
            <li>
              <a href="/admin">Admin</a>
            </li>
            <li>
              <span aria-current="page">Home</span>
            </li>
          </ol>
        </nav>
        <EmptyState
          title="No published content"
          description="No published series are available to build Home rows. Publish series in the catalogue first."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb (C08B-05: Admin → Home, no navigation regression) */}
      <nav
        aria-label="Breadcrumb"
        className="sr-only"
      >
        <ol>
          <li>
            <a href="/admin">Admin</a>
          </li>
          <li>
            <span aria-current="page">Home</span>
          </li>
        </ol>
      </nav>

      {/* Visible breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/50">
        <span className="text-bone/30">Admin</span>
        <Icon name="next" className="h-3 w-3 text-bone/30" />
        <span className="text-bone/80">Home</span>
      </div>

      {/* Dirty-collapse warning (C08B-01 safety) */}
      {dirtyCollapseBlocked ? (
        <div className="border border-teal/30 bg-teal/5 px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-teal">
          Row has unsaved changes — save or discard before collapsing.
        </div>
      ) : null}

      {/* SPOTLIGHT — visually distinct, separate from row hierarchy */}
      {spotlightData ? (
        <SpotlightComposer
          spotlight={spotlightData}
          catalog={catalog}
          isSpotlightExpanded={isSpotlightExpanded}
          onToggleSpotlightExpand={handleToggleSpotlight}
          onSpotlightSaved={() => {
            setRows((prev) =>
              prev.map((r) => (r.type === "spotlight" ? { ...r, isDirty: false } : r)),
            );
          }}
          onSpotlightCollapseBlocked={() => {
            setDirtyCollapseBlocked(true);
            setTimeout(() => setDirtyCollapseBlocked(false), 4000);
          }}
        />
      ) : null}

      {/* ROWS section */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-bone/10 px-1 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/55">
          <span>Home rows ({rows.length})</span>
          <Button
            variant="ghost"
            onClick={() => {
              const firstRowId = rows.find((r) => r.type !== "spotlight")?.id;

              if (firstRowId) {
                setExpandedRowId(firstRowId);
              }
            }}
            aria-label="Expand first row"
          >
            Expand one
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No Home rows"
            description="There are no Home rows to configure."
          />
        ) : (
          <div className="divide-y divide-bone/10 border border-bone/10 bg-background">
            {rows.map((row, index) => {
              const isExpanded = expandedRowId === row.id;
              const isFirst = index === 0;
              const isLast = index === rows.length - 1;

              return (
                <div
                  key={row.id}
                  className={`
                    ${isFirst ? "rounded-t-none" : ""}
                    ${isLast ? "rounded-b-none" : ""}
                  `}
                >
                  {/* Collapsed summary (RowHeader) */}
                  <RowHeader
                    row={row}
                    position={index + 1}
                    itemCount={row.items.length}
                    warnings={row.warnings}
                    isExpanded={isExpanded}
                    isDirty={row.isDirty}
                    onToggleExpand={() => handleToggleExpand(row.id)}
                    onMoveUp={() => handleMoveUp(row.id)}
                    onMoveDown={() => handleMoveDown(row.id)}
                    onVisibilityToggle={() => handleVisibilityToggle(row.id)}
                    onDeleted={() => handleDeleted(row.id)}
                  />

                  {/* Expanded editor */}
                  {isExpanded ? (
                    <HomeRowEditor
                      row={row}
                      position={index + 1}
                      catalog={catalog}
                      items={row.items}
                      warnings={row.warnings}
                      isExpanded={isExpanded}
                      onExpand={() => setExpandedRowId(row.id)}
                      onCollapse={() => setExpandedRowId(null)}
                      onCollapseBlockedByDirty={() => {
                        setDirtyCollapseBlocked(true);
                        setTimeout(() => setDirtyCollapseBlocked(false), 4000);
                      }}
                      onSaved={(updatedRow) =>
                        handleSaved(row.id, updatedRow)
                      }
                      canCollapseSafely={() => canCollapseRow(row)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
