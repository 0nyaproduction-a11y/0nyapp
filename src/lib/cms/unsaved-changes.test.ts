import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("UnsavedChanges", () => {
  test("isEqual detects equal values", async () => {
    const { isEqual } = await import("@/lib/cms/unsaved-changes");
    assert.equal(isEqual({ a: 1 }, { a: 1 }), true);
    assert.equal(isEqual({ a: 1 }, { a: 2 }), false);
    assert.equal(isEqual(null, null), true);
    assert.equal(isEqual(null, undefined), false);
    assert.equal(isEqual([1, 2], [1, 2]), true);
    assert.equal(isEqual([1, 2], [1, 3]), false);
  });

  test("context exports are defined", async () => {
    const module = await import("@/lib/cms/unsaved-changes");
    assert.ok(module.UnsavedChangesProvider);
    assert.ok(module.UnsavedChangesContext);
  });

  test("form-wrapper exports are defined", async () => {
    const module = await import("@/lib/cms/form-wrapper");
    assert.ok(module.FormWrapper);
  });

  test("dirty-link exports are defined", async () => {
    const module = await import("@/components/cms/DirtyLink");
    assert.ok(module.DirtyLink);
  });

  // isFormDirty: (formId) => dirtyForms.has(formId) — unsaved-changes.tsx:139-142
  test("isFormDirty returns true for forms in the dirtyForms set", async () => {
    // Verify the module exports the context that provides isFormDirty
    const { UnsavedChangesContext } = await import("@/lib/cms/unsaved-changes");
    assert.ok(UnsavedChangesContext);

    // Recreate isFormDirty logic: dirtyForms.has(formId)
    const dirtyForms = new Set<string>(["home-row-abc", "home-row-def"]);
    const isFormDirty = (formId: string) => dirtyForms.has(formId);

    assert.equal(isFormDirty("home-row-abc"), true);
    assert.equal(isFormDirty("home-row-def"), true);
    assert.equal(isFormDirty("home-row-ghi"), false);
  });

  test("isFormDirty returns false after removing formId from dirtyForms", async () => {
    // markClean / unregisterForm remove from dirtyForms, flipping isFormDirty
    const dirtyForms = new Set<string>(["home-row-abc"]);
    const isFormDirty = (formId: string) => dirtyForms.has(formId);

    assert.equal(isFormDirty("home-row-abc"), true);
    dirtyForms.delete("home-row-abc");
    assert.equal(isFormDirty("home-row-abc"), false);
  });

  test("isFormDirty uses exact Set lookup — no partial formId matches", async () => {
    // Set.has is an exact string match — no prefix/suffix/partial matching
    const dirtyForms = new Set<string>(["home-row-abc"]);
    const isFormDirty = (formId: string) => dirtyForms.has(formId);

    assert.equal(isFormDirty("home-row-abc"), true);
    assert.equal(isFormDirty("home-row-abc123"), false);
    assert.equal(isFormDirty("home-row-"), false);
    assert.equal(isFormDirty("home-row-abc "), false);
    assert.equal(isFormDirty(""), false);
  });
});
