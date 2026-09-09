/**
 * C08B-06: Expandable HomeRowEditor.
 *
 * - Collapsed state shows only the compact RowHeader summary.
 * - Expanded state shows the full row editor (title, kicker, visibility,
 *   assigned titles list/chips, save/discard actions).
 * - One-row focus: opening another row collapses the previous unless
 *   C08B-01 dirty-state safety prevents it.
 * - Content assignment uses a compact chip/list (no giant cards).
 * - No thumbnails introduced (DO NOT introduce thumbnails if not already
 *   required).
 */

"use client";

import { useState, useEffect } from "react";
import type { ContentItem } from "@/data/content";
import type {
  HomeRow,
  HomeRowFormState,
  RowWarning,
} from "@/lib/home/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { isRowDirty, confirmUnsavedChanges } from "@/lib/home/dirty-state";
import { SubmittingButton } from "@/components/home/ui/States";
import { saveHomeRow } from "@/lib/home/actions";

type HomeRowEditorProps = {
  row: HomeRow;
  position: number;
  catalog: ContentItem[];
  items: ContentItem[];
  warnings: RowWarning[];
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onCollapseBlockedByDirty: () => void;
  onSaved: (row: HomeRow) => void;
  /** Returns true if this row can safely collapse (i.e. is clean). */
  canCollapseSafely: () => boolean;
  /** Called when the row's dirty state changes. */
  onDirtyChange: (dirty: boolean) => void;
};

export function HomeRowEditor({
  row,
  position,
  catalog,
  items,
  warnings,
  isExpanded,
  onExpand,
  onCollapse,
  onCollapseBlockedByDirty,
  onSaved,
  canCollapseSafely,
  onDirtyChange,
}: HomeRowEditorProps) {
  // Form state — initialized from the committed row
  const [formState, setFormState] = useState<HomeRowFormState>({
    title: row.title,
    kicker: row.kicker ?? "",
    visible: row.visible,
    assignedSlugs: [...row.assignedSlugs],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // When the row prop changes (e.g. after a save from another context),
  // sync the form state.
  useEffect(() => {
    if (!isExpanded && !isRowDirty(row, formState).dirty) {
      setFormState({
        title: row.title,
        kicker: row.kicker ?? "",
        visible: row.visible,
        assignedSlugs: [...row.assignedSlugs],
      });
    }
  }, [row, isExpanded]);

  const dirtyCheck = isRowDirty(row, formState);
  const isDirty = dirtyCheck.dirty;

  // Report dirty state to parent so HomeComposer can enforce one-row focus
  // C08B-01 safety (don't collapse a dirty row when switching focus).
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  // C08B-01: Dirty collapse safety is enforced by the parent HomeComposer
  // via the onDirtyChange callback, which tracks per-row dirty state.
  // Expanding/collapsing is controlled by the RowHeader's toggle button
  // in the parent component.

  const handleTitleChange = (value: string) => {
    setFormState((prev) => ({ ...prev, title: value }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleKickerChange = (value: string) => {
    setFormState((prev) => ({ ...prev, kicker: value }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleVisibilityToggle = () => {
    setFormState((prev) => ({ ...prev, visible: !prev.visible }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleRemoveTitle = (slug: string) => {
    setFormState((prev) => ({
      ...prev,
      assignedSlugs: prev.assignedSlugs.filter((s) => s !== slug),
    }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleAddTitle = (slug: string) => {
    if (formState.assignedSlugs.includes(slug)) {
      return;
    }

    setFormState((prev) => ({
      ...prev,
      assignedSlugs: [...prev.assignedSlugs, slug],
    }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  async function handleSave() {
    setIsSubmitting(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const result = await saveHomeRow(row.id, formState);

      if (result.success && result.row) {
        // C08B-01: Successful save returns the row to "clean"
        onSaved(result.row);
        setSaveSuccess("Saved");

        // Auto-clear success message
        setTimeout(() => setSaveSuccess(null), 3000);
      } else if (result.error) {
        // C08B-01: Failed save keeps the row dirty
        setSaveError(result.error);
      }
    } catch (error) {
      // C08B-01: Validation failure keeps the row dirty
      setSaveError(
        error instanceof Error ? error.message : "Failed to save row.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (formState.title.trim() === "") {
      errors.push("Title is required.");
    }

    if (new Set(formState.assignedSlugs).size !== formState.assignedSlugs.length) {
      errors.push("Duplicate titles are not allowed.");
    }

    return errors;
  };

  const validationErrors = isDirty ? validateForm() : [];

  return (
    <div
      data-testid={`row-editor-${row.id}`}
      className="overflow-hidden border-l-2 border-bone/10 bg-background transition-all data-expanded:border-l-teal"
    >
      {/* Editor body */}
      <div className="p-4 sm:p-6">
        {/* Validation errors — C08B-01: validation failure keeps row dirty */}
        {validationErrors.length > 0 ? (
          <div className="mb-4 border border-red-500/30 bg-red-500/5 px-3 py-2">
            {validationErrors.map((err) => (
              <p
                key={err}
                className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-red-400"
              >
                {err}
              </p>
            ))}
          </div>
        ) : null}

        {/* Save success */}
        {saveSuccess ? (
          <div className="mb-4 border border-teal/30 bg-teal/5 px-3 py-2">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-teal">
              {saveSuccess}
            </p>
          </div>
        ) : null}

        {/* Save error — C08B-01: failed save keeps row dirty */}
        {saveError ? (
          <div className="mb-4 border border-red-500/30 bg-red-500/5 px-3 py-2">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-red-400">
              {saveError}
            </p>
          </div>
        ) : null}

        {/* Row warnings */}
        {warnings.length > 0 ? (
          <div className="mb-4 border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
            {warnings.map((warning) => (
              <div key={warning.code} className="flex items-start gap-1.5">
                <Icon
                  name="alert-triangle"
                  className="mt-0.5 h-3.5 w-3.5 text-amber-400"
                />
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-amber-400/80">
                  {warning.label}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Editor fields */}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="grid gap-4">
            {/* Title */}
            <label className="grid gap-1">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/60">
                Row title
              </span>
              <input
                type="text"
                value={formState.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className={`
                  w-full border border-bone/10 bg-surface px-3 py-2 text-base text-bone outline-none
                  focus:border-teal
                  ${isDirty ? "border-teal/40" : ""}
                `}
                aria-label="Row title"
                aria-invalid={validationErrors.some((e) =>
                  e.toLowerCase().includes("title"),
                )}
              />
            </label>

            {/* Kicker */}
            <label className="grid gap-1">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/60">
                Kicker (optional)
              </span>
              <input
                type="text"
                value={formState.kicker}
                onChange={(e) => handleKickerChange(e.target.value)}
                className="w-full border border-bone/10 bg-surface px-3 py-2 text-base text-bone outline-none focus:border-teal"
                placeholder="e.g. Tonight in India"
                aria-label="Kicker label"
              />
            </label>

            {/* Visibility toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVisibilityToggle}
                aria-pressed={formState.visible}
                className={`
                  inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.12em] transition
                  ${
                    formState.visible
                      ? "border-teal/40 text-teal"
                      : "border-bone/10 text-bone/50 hover:border-bone/25"
                  }
                `}
              >
                <Icon
                  name={formState.visible ? "eye" : "eye-off"}
                  className="h-3 w-3"
                />
                {formState.visible ? "Visible on Home" : "Hidden from Home"}
              </button>
            </div>

            {/* Content assignment — compact chip list, no giant cards */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/60">
                  Assigned titles ({formState.assignedSlugs.length})
                </label>
              </div>

              {formState.assignedSlugs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {formState.assignedSlugs.map((slug) => {
                    const item = items.find((i) => i.slug === slug);

                    return (
                      <div
                        key={slug}
                        className="inline-flex items-center gap-1 border border-bone/10 bg-surface px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-bone/80"
                      >
                        <span className="truncate max-w-[120px] sm:max-w-xs">
                          {item?.title ?? slug}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTitle(slug)}
                          aria-label={`Remove ${item?.title ?? slug} from row`}
                          className="grid size-5 place-items-center text-bone/50 transition hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                        >
                          <Icon name="x" className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="font-mono text-[0.64rem] text-bone/40">
                  No titles assigned.
                </p>
              )}

              {/* Add title selector — compact, no thumbnails */}
              <AddTitleSelector
                catalog={catalog}
                assignedSlugs={formState.assignedSlugs}
                onSelect={handleAddTitle}
              />
            </div>
          </div>

          {/* Save / Discard actions */}
          <div className="flex flex-col gap-2 sm:items-end">
            <SubmittingButton
              isSubmitting={isSubmitting}
              onClick={handleSave}
              disabled={!isDirty || validationErrors.length > 0}
              ariaLabel="Save row"
            >
              <Icon name="save" className="h-4 w-4" />
              Save
            </SubmittingButton>

            <Button
              variant="ghost"
              onClick={() => {
                if (isDirty) {
                  const confirmed = confirmUnsavedChanges(
                    `Discard changes to "${formState.title}"?`,
                  );

                  if (!confirmed) {
                    return;
                  }
                }

                setFormState({
                  title: row.title,
                  kicker: row.kicker ?? "",
                  visible: row.visible,
                  assignedSlugs: [...row.assignedSlugs],
                });
                setSaveError(null);
                setSaveSuccess(null);
              }}
              aria-label="Discard changes"
            >
              <Icon name="x" className="h-4 w-4" />
              Discard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact title selector — a searchable dropdown that does NOT introduce
 * thumbnails. Preserves content identity via the series slug.
 */
type AddTitleSelectorProps = {
  catalog: ContentItem[];
  assignedSlugs: string[];
  onSelect: (slug: string) => void;
};

function AddTitleSelector({
  catalog,
  assignedSlugs,
  onSelect,
}: AddTitleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const available = catalog.filter(
    (item) => !assignedSlugs.includes(item.slug),
  );

  const filtered = available.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.genre.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search titles..."
          className="flex-1 border border-bone/10 bg-surface px-2 py-1.5 text-sm text-bone outline-none focus:border-teal"
          aria-label="Search titles to add"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close selector" : "Open title selector"}
          className="grid size-8 place-items-center border border-bone/10 bg-surface text-bone/60 hover:border-teal hover:text-teal"
        >
          <Icon name={isOpen ? "x" : "plus"} className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && filtered.length > 0 ? (
        <div className="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-y-auto border border-bone/10 bg-background">
          {filtered.slice(0, 10).map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => {
                onSelect(item.slug);
                setSearch("");
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between border-b border-bone/5 px-2 py-1.5 text-left font-mono text-[0.66rem] uppercase tracking-[0.08em] text-bone/80 last:border-b-0 hover:bg-bone/[0.03]"
            >
              <span className="truncate">{item.title}</span>
              <span className="text-[0.6rem] text-bone/40">
                {item.genre}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {isOpen && filtered.length === 0 && search ? (
        <div className="absolute top-full left-0 z-10 mt-1 border border-bone/10 bg-background px-2 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-bone/50">
          No matching titles
        </div>
      ) : null}
    </div>
  );
}
