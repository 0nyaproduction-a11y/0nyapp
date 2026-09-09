/**
 * C08B-02: Destructive-action confirmation tests.
 *
 * Verifies that:
 *  - `buildDestructiveMessage` produces a human-readable confirmation string.
 *  - `confirmDestructiveAction` returns true/false based on window.confirm.
 *  - `confirmDestructiveAction` throws when window is unavailable.
 *  - `DestructiveActionCancelledError` can be caught by type.
 */

import {
  confirmDestructiveAction,
  buildDestructiveMessage,
  DestructiveActionCancelledError,
} from "../destructive-action";

describe("buildDestructiveMessage (C08B-02)", () => {
  it("includes the action label and targetLabel in the message", () => {
    const msg = buildDestructiveMessage({
      action: "delete_row",
      targetLabel: "Trending Row",
    });
    expect(msg).toContain("Delete row");
    expect(msg).toContain("Trending Row");
  });

  it("includes the impact when provided", () => {
    const msg = buildDestructiveMessage({
      action: "delete_row",
      targetLabel: "Trending Row",
      impact: "Row will be removed from the Home page layout.",
    });
    expect(msg).toContain("Row will be removed");
  });

  it("includes the detail when impact is not provided", () => {
    const msg = buildDestructiveMessage({
      action: "remove_title",
      targetLabel: "Alpha Series",
      detail: "Title will no longer appear in this row.",
    });
    expect(msg).toContain("Title will no longer appear");
  });

  it("omits impact/detail when neither is provided", () => {
    const msg = buildDestructiveMessage({
      action: "archive_row",
      targetLabel: "Beta Series",
    });
    expect(msg).toContain("Archive row");
    expect(msg).toContain("Beta Series");
    // Should not have extra detail
    expect(msg).not.toContain("—");
  });
});

describe("confirmDestructiveAction (C08B-02)", () => {
  const originalWindow = global.window;

  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      // @ts-expect-error
      delete global.window;
    }
  });

  it("returns true when window.confirm returns true", () => {
    const mockConfirm = jest.fn(() => true);
    // @ts-expect-error mocking
    delete global.window;
    global.window = { confirm: mockConfirm } as unknown as Window;

    const result = confirmDestructiveAction({
      action: "delete_row",
      targetLabel: "Trending Row",
    });
    expect(result).toBe(true);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it("returns false when window.confirm returns false", () => {
    const mockConfirm = jest.fn(() => false);
    // @ts-expect-error mocking
    delete global.window;
    global.window = { confirm: mockConfirm } as unknown as Window;

    const result = confirmDestructiveAction({
      action: "delete_row",
      targetLabel: "Trending Row",
    });
    expect(result).toBe(false);
  });

  it("throws DestructiveActionCancelledError when window is undefined (server context)", () => {
    // @ts-expect-error simulate server
    delete global.window;

    try {
      expect(() =>
        confirmDestructiveAction({
          action: "delete_row",
          targetLabel: "Trending Row",
        }),
      ).toThrow(DestructiveActionCancelledError);
    } finally {
      global.window = originalWindow;
    }
  });

  it("catches DestructiveActionCancelledError by instanceof", () => {
    const mockConfirm = jest.fn(() => false);
    // @ts-expect-error mocking
    delete global.window;
    global.window = { confirm: mockConfirm } as unknown as Window;

    try {
      confirmDestructiveAction({
        action: "delete_row",
        targetLabel: "Trending Row",
      });
      fail("Expected DestructiveActionCancelledError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DestructiveActionCancelledError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
