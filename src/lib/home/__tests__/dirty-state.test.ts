/**
 * C08B-01: Dirty-state authority tests.
 *
 * These tests verify that:
 *  - A row with no edits is clean.
 *  - Any field change marks the row dirty.
 *  - The authoritative `isRowDirty` function returns accurate changed fields.
 *  - `confirmUnsavedChanges` delegates to `window.confirm` in client context.
 *  - `confirmUnsavedChanges` throws `UnsavedChangesError` in server context.
 */

import { isRowDirty, confirmUnsavedChanges, UnsavedChangesError } from "../dirty-state";
import type { HomeRow, HomeRowFormState } from "../types";

const baseRow: HomeRow = {
  id: "featured-hero",
  title: "Featured",
  type: "featured-hero",
  sortOrder: 0,
  visible: true,
  assignedSlugs: ["slug-1", "slug-2"],
  kicker: null,
};

const cleanFormState: HomeRowFormState = {
  title: "Featured",
  kicker: "",
  visible: true,
  assignedSlugs: ["slug-1", "slug-2"],
};

describe("isRowDirty (C08B-01)", () => {
  it("returns clean when form state matches the row", () => {
    const result = isRowDirty(baseRow, cleanFormState);
    expect(result.dirty).toBe(false);
    expect(result.fields).toEqual([]);
  });

  it("detects title change", () => {
    const form: HomeRowFormState = { ...cleanFormState, title: "New Title" };
    const result = isRowDirty(baseRow, form);
    expect(result.dirty).toBe(true);
    expect(result.fields).toContain("title");
  });

  it("detects kicker change", () => {
    const form: HomeRowFormState = { ...cleanFormState, kicker: "New Kicker" };
    const result = isRowDirty(baseRow, form);
    expect(result.dirty).toBe(true);
    expect(result.fields).toContain("kicker");
  });

  it("detects visible toggle", () => {
    const form: HomeRowFormState = { ...cleanFormState, visible: false };
    const result = isRowDirty(baseRow, form);
    expect(result.dirty).toBe(true);
    expect(result.fields).toContain("visible");
  });

  it("detects assignedSlugs change (added)", () => {
    const form: HomeRowFormState = {
      ...cleanFormState,
      assignedSlugs: ["slug-1", "slug-2", "slug-3"],
    };
    const result = isRowDirty(baseRow, form);
    expect(result.dirty).toBe(true);
    expect(result.fields).toContain("assignedSlugs");
  });

  it("detects assignedSlugs change (reordered)", () => {
    const form: HomeRowFormState = {
      ...cleanFormState,
      assignedSlugs: ["slug-2", "slug-1"],
    };
    const result = isRowDirty(baseRow, form);
    expect(result.dirty).toBe(true);
    expect(result.fields).toContain("assignedSlugs");
  });

  it("detects multiple field changes", () => {
    const form: HomeRowFormState = {
      title: "New",
      kicker: "Kick",
      visible: false,
      assignedSlugs: [],
    };
    const result = isRowDirty(baseRow, form);
    expect(result.dirty).toBe(true);
    expect(result.fields).toHaveLength(4);
  });

  it("treats row.kicker null same as empty form kicker", () => {
    const result = isRowDirty(baseRow, cleanFormState);
    expect(result.fields).not.toContain("kicker");
  });

  it("treats row.kicker set same as matching form kicker", () => {
    const row: HomeRow = { ...baseRow, kicker: "Hello" };
    const form: HomeRowFormState = { ...cleanFormState, kicker: "Hello" };
    const result = isRowDirty(row, form);
    expect(result.dirty).toBe(false);
  });
});

describe("confirmUnsavedChanges (C08B-01)", () => {
  const originalConfirm = global.window?.confirm;
  const originalWindow = global.window;

  afterEach(() => {
    // Restore window.confirm
    if (originalConfirm) {
      Object.defineProperty(global, "window", {
        configurable: true,
        value: originalWindow,
      });
      originalWindow.confirm = originalConfirm;
    }
  });

  it("returns true when window.confirm returns true", () => {
    const mockConfirm = jest.fn(() => true);
    // @ts-expect-error mocking window
    delete global.window;
    global.window = { confirm: mockConfirm } as unknown as Window;

    const result = confirmUnsavedChanges("Discard changes?");
    expect(result).toBe(true);
    expect(mockConfirm).toHaveBeenCalledWith("Discard changes?");
  });

  it("returns false when window.confirm returns false", () => {
    const mockConfirm = jest.fn(() => false);
    // @ts-expect-error mocking window
    delete global.window;
    global.window = { confirm: mockConfirm } as unknown as Window;

    const result = confirmUnsavedChanges("Discard changes?");
    expect(result).toBe(false);
  });

  it("throws UnsavedChangesError when window is undefined (server)", () => {
    const savedWindow = global.window;
    // @ts-expect-error simulate server context
    delete global.window;

    try {
      expect(() => confirmUnsavedChanges("Discard?")).toThrow(UnsavedChangesError);
    } finally {
      global.window = savedWindow;
    }
  });

  it("throws UnsavedChangesError when window.confirm is not a function", () => {
    // @ts-expect-error mocking window without confirm
    delete global.window;
    global.window = {} as unknown as Window;

    try {
      expect(() => confirmUnsavedChanges("Discard?")).toThrow(UnsavedChangesError);
    } finally {
      // Restore
      if (originalWindow) {
        global.window = originalWindow;
      }
    }
  });
});
