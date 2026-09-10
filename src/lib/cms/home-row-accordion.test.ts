import { test, describe } from "node:test";
import assert from "node:assert/strict";

/**
 * Test suite for HomeRowAccordion collapse/expand and one-row-focus logic.
 *
 * The HomeRowAccordion component (src/components/cms/HomeRowAccordion.tsx)
 * bundles its collapse/expand state machine with React hooks, making direct
 * unit testing against the live component difficult without a DOM. These tests
 * recreate the same pure logic functions in this file to verify behavior,
 * then also verify the real module exports.
 *
 * Logic source: src/components/cms/HomeRowAccordion.tsx lines 225-278.
 */

// ---------------------------------------------------------------------------
// Recreated logic — mirrors HomeRowAccordion.tsx exactly
// ---------------------------------------------------------------------------

type FormDirtyChecker = (formId: string) => boolean;

/** Mirrors rowFormId (HomeRowAccordion.tsx:225-227) */
function rowFormId(rowId: string): string {
  return `home-row-${rowId}`;
}

/**
 * Mirrors the state machine in HomeRowAccordion (HomeRowAccordion.tsx:199-278).
 * Recreates expandedRowId, dirtyMap, showLeaveModal, pendingSwitch state
 * alongside the handler functions so the core logic can be tested without
 * React rendering or a DOM.
 */
class AccordionLogic {
  expandedRowId: string | null = null;
  dirtyMap: Map<string, boolean> = new Map();
  showLeaveModal = false;
  pendingSwitch: { from: string; to: string } | null = null;
  isFormDirty: FormDirtyChecker;

  constructor(isFormDirty: FormDirtyChecker = () => false) {
    this.isFormDirty = isFormDirty;
  }

  /** Mirrors isRowDirty (HomeRowAccordion.tsx:229-231) */
  isRowDirty(rowId: string): boolean {
    return this.dirtyMap.get(rowId) === true || this.isFormDirty(rowFormId(rowId));
  }

  /** Mirrors handleDirtyChange (HomeRowAccordion.tsx:233-241) */
  handleDirtyChange(rowId: string): (isDirty: boolean) => void {
    return (isDirty: boolean) => {
      const next = new Map(this.dirtyMap);
      next.set(rowId, isDirty);
      this.dirtyMap = next;
    };
  }

  /** Mirrors handleHeaderClick (HomeRowAccordion.tsx:243-257) */
  handleHeaderClick(targetId: string): void {
    if (this.expandedRowId === targetId) {
      if (this.isRowDirty(targetId)) {
        return; // block: cannot collapse a dirty row
      }
      this.expandedRowId = null; // collapse clean same row
      return;
    }
    if (this.expandedRowId !== null && this.isRowDirty(this.expandedRowId)) {
      this.pendingSwitch = { from: this.expandedRowId, to: targetId };
      this.showLeaveModal = true; // prompt for dirty row switch
      return;
    }
    this.expandedRowId = targetId; // expand / switch when current is clean
  }

  /** Mirrors handleConfirmLeave (HomeRowAccordion.tsx:259-272) */
  handleConfirmLeave(): void {
    this.showLeaveModal = false;
    const pending = this.pendingSwitch;
    this.pendingSwitch = null;
    if (pending) {
      const next = new Map(this.dirtyMap);
      next.set(pending.from, false);
      this.dirtyMap = next;
      this.expandedRowId = pending.to;
    }
  }

  /** Mirrors handleCancelLeave (HomeRowAccordion.tsx:274-278) */
  handleCancelLeave(): void {
    this.pendingSwitch = null;
    this.showLeaveModal = false;
  }
}

// ---------------------------------------------------------------------------
// Data fixture — 25 home rows, all collapsed initially
// ---------------------------------------------------------------------------

type RowFixture = {
  id: string;
  title: string;
  row_role: "editorial";
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  items: unknown[];
};

function createRowFixture(count: number): RowFixture[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    title: `Home Row ${i}`,
    row_role: "editorial" as const,
    enabled: i % 3 !== 0, // every third row disabled
    sort_order: i,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    items: [],
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomeRowAccordion", () => {
  describe("rowFormId + isFormDirty pattern", () => {
    test("rowFormId produces home-row-<id> pattern", () => {
      assert.equal(rowFormId("abc"), "home-row-abc");
      assert.equal(rowFormId("row-5"), "home-row-row-5");
      assert.equal(rowFormId(""), "home-row-");
    });

    test("isFormDirty checks the correct form ID pattern home-row-<rowId>", () => {
      const checkedIds: string[] = [];
      const mockIsFormDirty: FormDirtyChecker = (formId: string) => {
        checkedIds.push(formId);
        return formId === "home-row-row-3";
      };

      const logic = new AccordionLogic(mockIsFormDirty);

      // isRowDirty("row-3") should call isFormDirty("home-row-row-3")
      assert.equal(logic.isRowDirty("row-3"), true);
      assert.equal(checkedIds[0], "home-row-row-3");

      // isRowDirty("row-7") should call isFormDirty("home-row-row-7")
      checkedIds.length = 0;
      assert.equal(logic.isRowDirty("row-7"), false);
      assert.equal(checkedIds[0], "home-row-row-7");
    });
  });

  describe("isRowDirty — combines local dirtyMap + context isFormDirty", () => {
    test("returns true when dirtyMap marks the row dirty", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleDirtyChange("row-1")(true);
      assert.equal(logic.isRowDirty("row-1"), true);
    });

    test("returns true when context isFormDirty reports dirty", () => {
      const logic = new AccordionLogic((formId) => formId === "home-row-row-2");
      assert.equal(logic.isRowDirty("row-2"), true);
    });

    test("returns true when both sources report dirty", () => {
      const logic = new AccordionLogic((formId) => formId === "home-row-row-3");
      logic.handleDirtyChange("row-3")(true);
      assert.equal(logic.isRowDirty("row-3"), true);
    });

    test("returns false when neither source reports dirty", () => {
      const logic = new AccordionLogic(() => false);
      assert.equal(logic.isRowDirty("row-99"), false);
    });

    test("returns false when dirtyMap has the row set to false", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleDirtyChange("row-4")(true);
      logic.handleDirtyChange("row-4")(false);
      assert.equal(logic.isRowDirty("row-4"), false);
    });
  });

  describe("handleDirtyChange", () => {
    test("sets dirty state true for the specified row", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleDirtyChange("row-1")(true);
      assert.equal(logic.dirtyMap.get("row-1"), true);
      assert.equal(logic.isRowDirty("row-1"), true);
    });

    test("sets dirty state false for the specified row", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleDirtyChange("row-1")(true);
      logic.handleDirtyChange("row-1")(false);
      assert.equal(logic.dirtyMap.get("row-1"), false);
      assert.equal(logic.isRowDirty("row-1"), false);
    });

    test("does not affect dirty state of other rows", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleDirtyChange("row-1")(true);
      logic.handleDirtyChange("row-2")(true);
      assert.equal(logic.dirtyMap.get("row-1"), true);
      assert.equal(logic.dirtyMap.get("row-2"), true);
      assert.equal(logic.dirtyMap.get("row-3"), undefined);
    });

    test("returns a new function each call (closure per rowId)", () => {
      const logic = new AccordionLogic(() => false);
      const fn1 = logic.handleDirtyChange("row-1");
      const fn2 = logic.handleDirtyChange("row-1");
      assert.notEqual(fn1, fn2);
    });
  });

  describe("handleHeaderClick", () => {
    test("expands a collapsed row", () => {
      const logic = new AccordionLogic(() => false);
      assert.equal(logic.expandedRowId, null);
      logic.handleHeaderClick("row-1");
      assert.equal(logic.expandedRowId, "row-1");
      assert.equal(logic.showLeaveModal, false);
    });

    test("collapses a clean row when clicking its header again", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleHeaderClick("row-1");
      assert.equal(logic.expandedRowId, "row-1");
      logic.handleHeaderClick("row-1");
      assert.equal(logic.expandedRowId, null);
      assert.equal(logic.showLeaveModal, false);
    });

    test("blocks collapse of a dirty row (dirtyMap)", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleHeaderClick("row-1");
      logic.handleDirtyChange("row-1")(true);
      assert.equal(logic.expandedRowId, "row-1");

      // Click same row header — should be blocked
      logic.handleHeaderClick("row-1");
      assert.equal(logic.expandedRowId, "row-1"); // still expanded
      assert.equal(logic.showLeaveModal, false); // no modal
    });

    test("prompts for dirty row switch instead of switching", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleHeaderClick("row-1");
      logic.handleDirtyChange("row-1")(true);

      logic.handleHeaderClick("row-2");
      assert.equal(logic.showLeaveModal, true);
      assert.equal(logic.expandedRowId, "row-1"); // still on dirty row
      assert.deepEqual(logic.pendingSwitch, { from: "row-1", to: "row-2" });
    });

    test("switches to a different row when current is clean", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleHeaderClick("row-1");
      assert.equal(logic.expandedRowId, "row-1");

      // Switch to row-2 (row-1 is clean)
      logic.handleHeaderClick("row-2");
      assert.equal(logic.expandedRowId, "row-2");
      assert.equal(logic.showLeaveModal, false);
    });

    test("blocks collapse of a row dirty via context isFormDirty", () => {
      const logic = new AccordionLogic((formId) => formId === "home-row-row-1");
      logic.handleHeaderClick("row-1");
      // isRowDirty("row-1") is true because isFormDirty("home-row-row-1") is true
      logic.handleHeaderClick("row-1");
      assert.equal(logic.expandedRowId, "row-1"); // still expanded
      assert.equal(logic.showLeaveModal, false);
    });

    test("prompts for switch when current is dirty via context isFormDirty", () => {
      const logic = new AccordionLogic((formId) => formId === "home-row-row-1");
      logic.handleHeaderClick("row-1");
      // isRowDirty("row-1") is true, so switching to row-2 should prompt
      logic.handleHeaderClick("row-2");
      assert.equal(logic.showLeaveModal, true);
      assert.equal(logic.expandedRowId, "row-1"); // still on dirty row
      assert.deepEqual(logic.pendingSwitch, { from: "row-1", to: "row-2" });
    });

    test("switching with no row expanded simply expands the target", () => {
      const logic = new AccordionLogic(() => false);
      assert.equal(logic.expandedRowId, null);

      logic.handleHeaderClick("row-1");
      assert.equal(logic.expandedRowId, "row-1");
      assert.equal(logic.showLeaveModal, false);
    });
  });

  describe("handleConfirmLeave / handleCancelLeave", () => {
    test("confirmLeave switches to target and marks old row clean", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleHeaderClick("row-1");
      logic.handleDirtyChange("row-1")(true);
      logic.handleHeaderClick("row-2");
      assert.equal(logic.showLeaveModal, true);

      logic.handleConfirmLeave();
      assert.equal(logic.showLeaveModal, false);
      assert.equal(logic.pendingSwitch, null);
      assert.equal(logic.expandedRowId, "row-2");
      // old row should be marked clean
      assert.equal(logic.isRowDirty("row-1"), false);
    });

    test("cancelLeave does not switch rows and clears modal state", () => {
      const logic = new AccordionLogic(() => false);
      logic.handleHeaderClick("row-1");
      logic.handleDirtyChange("row-1")(true);
      logic.handleHeaderClick("row-2");
      assert.equal(logic.showLeaveModal, true);

      logic.handleCancelLeave();
      assert.equal(logic.showLeaveModal, false);
      assert.equal(logic.pendingSwitch, null);
      assert.equal(logic.expandedRowId, "row-1"); // still on original row
    });
  });

  describe("20+ rows — all collapsed with data fixture", () => {
    test("fixture contains 25 rows", () => {
      const rows = createRowFixture(25);
      assert.equal(rows.length, 25);
    });

    test("initial state has no row expanded (all collapsed)", () => {
      const rows = createRowFixture(25);
      const logic = new AccordionLogic(() => false);

      assert.equal(logic.expandedRowId, null);
      assert.equal(logic.showLeaveModal, false);

      // isExpanded = expandedRowId === row.id (HomeRowAccordion.tsx:310)
      for (const row of rows) {
        assert.equal(logic.expandedRowId === row.id, false);
      }
    });

    test("expanding any single row only expands that row — 25 rows", () => {
      const rows = createRowFixture(25);
      const logic = new AccordionLogic(() => false);

      logic.handleHeaderClick(rows[10].id);
      assert.equal(logic.expandedRowId, rows[10].id);

      let expandedCount = 0;
      for (const row of rows) {
        if (row.id === logic.expandedRowId) expandedCount++;
      }
      assert.equal(expandedCount, 1);

      // Switch to a different row — should change
      logic.handleHeaderClick(rows[15].id);
      assert.equal(logic.expandedRowId, rows[15].id);
    });

    test("collapsing the expanded row returns to all-collapsed state", () => {
      const rows = createRowFixture(25);
      const logic = new AccordionLogic(() => false);

      logic.handleHeaderClick(rows[5].id);
      assert.equal(logic.expandedRowId, rows[5].id);

      // Click again to collapse (row is clean)
      logic.handleHeaderClick(rows[5].id);
      assert.equal(logic.expandedRowId, null);
    });

    test("expanding then collapsing each of 25 rows sequentially", () => {
      const rows = createRowFixture(25);
      const logic = new AccordionLogic(() => false);

      for (const row of rows) {
        logic.handleHeaderClick(row.id);
        assert.equal(logic.expandedRowId, row.id);
        logic.handleHeaderClick(row.id);
        assert.equal(logic.expandedRowId, null);
      }
    });

    test("no row is dirty initially across 25-row fixture", () => {
      const rows = createRowFixture(25);
      const logic = new AccordionLogic(() => false);

      for (const row of rows) {
        assert.equal(logic.isRowDirty(row.id), false);
      }
    });
  });

  describe("module exports", () => {
    test("HomeRowAccordion module exports HomeRowAccordion function", async () => {
      const mod = await import("@/components/cms/HomeRowAccordion");
      assert.ok(mod.HomeRowAccordion, "HomeRowAccordion should be exported");
      assert.equal(typeof mod.HomeRowAccordion, "function");
    });
  });
});
