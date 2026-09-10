"use client";

import { useState, useContext, useRef, useEffect } from "react";
import { UnsavedChangesContext } from "@/lib/cms/unsaved-changes";
import { HomeRowForm } from "./HomeRowForm";
import { CmsSubmitButton, CmsEmptyState } from "./CmsStates";
import { CmsSelect } from "./CmsSelect";
import { DangerZoneConfirmButton } from "./DangerZoneActionForm";
import type {
  HomeRowAdminRecord,
  HomeItemAdminRecord,
  HomeContentChoice,
} from "@/lib/cms/home";

const MOVE_BUTTON_CLASS =
  "border border-bone/20 px-2 py-0.5 text-xs text-bone/70 hover:bg-bone/10 disabled:opacity-30 disabled:pointer-events-none";
const INPUT_CLASS =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone";
const SMALL_INPUT_CLASS =
  "w-20 border border-bone/15 bg-bone/[0.03] px-2 py-1.5 text-xs text-bone";
const FIELD_LABEL_CLASS =
  "block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";

type HomeRowActionResult =
  | { success: false; error: string }
  | { success: true };

type HomeRowAction = (formData: FormData) => Promise<HomeRowActionResult | void>;

type HomeRowAccordionProps = {
  rows: HomeRowAdminRecord[];
  updateHomeRowAction: HomeRowAction;
  moveRowAction: HomeRowAction;
  deleteHomeRowAction: HomeRowAction;
  addHomeRowItemAction: HomeRowAction;
  removeHomeRowItemAction: HomeRowAction;
  moveItemAction: HomeRowAction;
  updateHomeRowItemAction: HomeRowAction;
  seriesChoices: HomeContentChoice[];
  shortFilmChoices: HomeContentChoice[];
  error?: string | null;
  flash?: string | null;
};

type HomeRowItemsProps = {
  row: HomeRowAdminRecord;
  addHomeRowItemAction: HomeRowAction;
  removeHomeRowItemAction: HomeRowAction;
  moveItemAction: HomeRowAction;
  updateHomeRowItemAction: HomeRowAction;
  seriesChoices: HomeContentChoice[];
  shortFilmChoices: HomeContentChoice[];
};

function HomeRowItems({
  row,
  addHomeRowItemAction,
  removeHomeRowItemAction,
  moveItemAction,
  updateHomeRowItemAction,
  seriesChoices,
  shortFilmChoices,
}: HomeRowItemsProps) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <form action={addHomeRowItemAction as unknown as (formData: FormData) => Promise<void>} className="space-y-3 border border-bone/10 p-4">
        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
          Add content to row
        </h4>
        <input type="hidden" name="rowId" value={row.id} />
        <label className="block space-y-1.5">
          <span className={FIELD_LABEL_CLASS}>Content</span>
          <CmsSelect
            name="contentRef"
            defaultValue=""
            className={INPUT_CLASS}
            placeholderLabel="Choose content (Series or Short Film)"
            options={[
              { label: "Choose content (Series or Short Film)", value: "" },
              ...seriesChoices.map((choice) => ({
                group: "Series",
                label: choice.label,
                value: choice.value,
              })),
              ...shortFilmChoices.map((choice) => ({
                group: "Short films",
                label: choice.label,
                value: choice.value,
              })),
            ]}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={FIELD_LABEL_CLASS}>Sort order</span>
          <input className={INPUT_CLASS} type="number" name="sortOrder" defaultValue={100} />
        </label>
        <CmsSubmitButton pendingLabel="Adding…">Add item</CmsSubmitButton>
      </form>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
          Row Items ({row.items.length})
        </h4>
        {row.items.length === 0 && (
          <CmsEmptyState
            title="No items in this row"
            description="Use the Add content to row panel to place published series or short films here."
          />
        )}
        {row.items.map((item: HomeItemAdminRecord, itemIndex) => (
          <div key={item.id} className="border border-bone/10 p-3 bg-bone/[0.02]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.contentTitle ?? item.slug ?? item.id}</p>
                <p className="text-xs text-bone/50">
                  {item.content_type} · {item.contentStatus ?? "unknown"}
                  {item.consumerVisible ? " · visible" : " · hidden"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <form action={moveItemAction as unknown as (formData: FormData) => Promise<void>} className="flex">
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="direction" value="up" />
                  <CmsSubmitButton
                    disabled={itemIndex === 0}
                    pendingLabel="Moving…"
                    title="Move up"
                    className={MOVE_BUTTON_CLASS}
                  >
                    ?
                  </CmsSubmitButton>
                </form>
                <form action={moveItemAction as unknown as (formData: FormData) => Promise<void>} className="flex">
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="direction" value="down" />
                  <CmsSubmitButton
                    disabled={itemIndex === row.items.length - 1}
                    pendingLabel="Moving…"
                    title="Move down"
                    className={MOVE_BUTTON_CLASS}
                  >
                    ?
                  </CmsSubmitButton>
                </form>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-bone/40 pl-1">
                  sort: {item.sort_order}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <form action={updateHomeRowItemAction as unknown as (formData: FormData) => Promise<void>} className="flex items-end gap-2">
                <input type="hidden" name="itemId" value={item.id} />
                <label className="block space-y-1">
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-bone/40">
                    Sort
                  </span>
                  <input
                    className={SMALL_INPUT_CLASS}
                    type="number"
                    name="sortOrder"
                    defaultValue={item.sort_order}
                  />
                </label>
                <CmsSubmitButton pendingLabel="Saving…">Save</CmsSubmitButton>
              </form>
              <form
                action={removeHomeRowItemAction as unknown as (formData: FormData) => Promise<void>}
                id={`remove-item-form-${item.id}`}
                className="hidden"
              >
                <input type="hidden" name="itemId" value={item.id} />
              </form>
              <DangerZoneConfirmButton
                title="Remove Home Row Item"
                description={`Remove "${item.contentTitle}" from the home row. This action cannot be undone.`}
                confirmLabel="Remove"
                onConfirm={() => {
                  const el = document.getElementById(
                    `remove-item-form-${item.id}`,
                  ) as HTMLFormElement | null;
                  el?.requestSubmit();
                }}
                variant="amber"
              />
              <p className="text-xs text-bone/40 self-center ml-auto">
                {item.sharePath ? (
                  <>
                    Path: <span className="text-bone/70">{item.sharePath}</span>
                  </>
                ) : (
                  "Orphaned item"
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeRowAccordion({
  rows,
  updateHomeRowAction,
  moveRowAction,
  deleteHomeRowAction,
  addHomeRowItemAction,
  removeHomeRowItemAction,
  moveItemAction,
  updateHomeRowItemAction,
  seriesChoices,
  shortFilmChoices,
  error,
  flash,
}: HomeRowAccordionProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [dirtyMap, setDirtyMap] = useState<Map<string, boolean>>(() => new Map());
  const dirtyMapRef = useRef<Map<string, boolean>>(dirtyMap);
  const pendingSwitchRef = useRef<{ from: string; to: string } | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const { isFormDirty, confirmLeave, cancelLeave } = useContext(UnsavedChangesContext);

  useEffect(() => {
    dirtyMapRef.current = dirtyMap;
  }, [dirtyMap]);

  function rowFormId(rowId: string) {
    return `home-row-${rowId}`;
  }

  function isRowDirty(rowId: string) {
    return dirtyMapRef.current.get(rowId) === true || isFormDirty(rowFormId(rowId));
  }

  function handleDirtyChange(rowId: string) {
    return (isDirty: boolean) => {
      setDirtyMap((prev) => {
        const next = new Map(prev);
        next.set(rowId, isDirty);
        return next;
      });
    };
  }

  function handleHeaderClick(targetId: string) {
    if (expandedRowId === targetId) {
      if (isRowDirty(targetId)) {
        return;
      }
      setExpandedRowId(null);
      return;
    }
    if (expandedRowId !== null && isRowDirty(expandedRowId)) {
      pendingSwitchRef.current = { from: expandedRowId, to: targetId };
      setShowLeaveModal(true);
      return;
    }
    setExpandedRowId(targetId);
  }

  function handleConfirmLeave() {
    confirmLeave();
    const pending = pendingSwitchRef.current;
    pendingSwitchRef.current = null;
    setShowLeaveModal(false);
    if (pending) {
      setDirtyMap((prev) => {
        const next = new Map(prev);
        next.set(pending.from, false);
        return next;
      });
      setExpandedRowId(pending.to);
    }
  }

  function handleCancelLeave() {
    cancelLeave();
    pendingSwitchRef.current = null;
    setShowLeaveModal(false);
  }

  return (
    <section className="space-y-5">
      {flash && (
        <div className="border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">
          {flash}
        </div>
      )}
      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
          Home Rows (Ordered)
        </h2>
        <p className="text-xs text-bone/40">
          Only published items within enabled rows are consumer-visible.
        </p>
      </div>

      {rows.length === 0 && (
        <CmsEmptyState
          title="No home rows"
          description="Create an editorial row above. The canonical Start Here row is provisioned automatically."
        />
      )}

      {rows.map((row, rowIndex) => {
        const isExpanded = expandedRowId === row.id;
        const hasItemIssues =
          row.items.length > 0 && row.items.some((item) => !item.sharePath);

        return (
          <article key={row.id} className="border border-bone/10 bg-bone/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleHeaderClick(row.id)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse row" : "Expand row"}
                className="flex items-center gap-3 text-left outline-none"
              >
                <span className="text-bone/60">{isExpanded ? "?" : "?"}</span>
                <div>
                  <h3 className="text-base font-semibold">{row.title}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-bone/50">
                    <span>
                      role: <span className="text-bone">{row.row_role}</span>
                    </span>
                    <span>•</span>
                    <span className={row.enabled ? "text-teal" : "text-amber-400"}>
                      {row.enabled ? "enabled" : "disabled"}
                    </span>
                    <span>•</span>
                    <span>
                      sort <span className="text-bone">{row.sort_order}</span>
                    </span>
                    <span>•</span>
                    <span>
                      items <span className="text-bone">{row.items.length}</span>
                    </span>
                    {hasItemIssues && (
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400/15 text-amber-400 text-[0.6rem] font-bold"
                        title="One or more items in this row are orphaned"
                      >
                        !
                      </span>
                    )}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1.5">
                <form action={moveRowAction as unknown as (formData: FormData) => Promise<void>} className="flex gap-1">
                  <input type="hidden" name="rowId" value={row.id} />
                  <input type="hidden" name="direction" value="up" />
                  <CmsSubmitButton
                    disabled={rowIndex === 0}
                    pendingLabel="Moving…"
                    title="Move up"
                    className={MOVE_BUTTON_CLASS}
                  >
                    ? Up
                  </CmsSubmitButton>
                </form>
                <form action={moveRowAction as unknown as (formData: FormData) => Promise<void>} className="flex gap-1">
                  <input type="hidden" name="rowId" value={row.id} />
                  <input type="hidden" name="direction" value="down" />
                  <CmsSubmitButton
                    disabled={rowIndex === rows.length - 1}
                    pendingLabel="Moving…"
                    title="Move down"
                    className={MOVE_BUTTON_CLASS}
                  >
                    ? Down
                  </CmsSubmitButton>
                </form>

                {row.row_role === "editorial" && (
                  <>
                    <form
                      action={deleteHomeRowAction as unknown as (formData: FormData) => Promise<void>}
                      id={`delete-row-form-${row.id}`}
                      className="hidden"
                    >
                      <input type="hidden" name="rowId" value={row.id} />
                    </form>
                    <DangerZoneConfirmButton
                      title="Delete Home Row"
                      description={`Permanently delete the row "${row.title}". This action cannot be undone.`}
                      confirmLabel="Delete row"
                      onConfirm={() => {
                        const el = document.getElementById(
                          `delete-row-form-${row.id}`,
                        ) as HTMLFormElement | null;
                        el?.requestSubmit();
                      }}
                      variant="danger"
                    />
                  </>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4">
                <div className="mb-3 border-t border-bone/10 pt-3">
                  <HomeRowForm
                    rowId={row.id}
                    title={row.title}
                    enabled={row.enabled}
                    sortOrder={row.sort_order}
                    action={updateHomeRowAction}
                    onDirtyChange={handleDirtyChange(row.id)}
                  />
                </div>
                <HomeRowItems
                  row={row}
                  addHomeRowItemAction={addHomeRowItemAction}
                  removeHomeRowItemAction={removeHomeRowItemAction}
                  moveItemAction={moveItemAction}
                  updateHomeRowItemAction={updateHomeRowItemAction}
                  seriesChoices={seriesChoices}
                  shortFilmChoices={shortFilmChoices}
                />
              </div>
            )}
          </article>
        );
      })}

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-deep border border-bone/20 p-6 rounded-lg max-w-sm mx-auto">
            <h2 className="text-lg font-semibold mb-4">You have unsaved changes</h2>
            <p className="text-sm text-bone/70 mb-6">Leave without saving?</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelLeave}
                className="px-4 py-2 border border-bone/20 rounded text-sm hover:bg-bone/10"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="px-4 py-2 bg-teal text-bone rounded text-sm hover:bg-teal/80"
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
