import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  classifyDeleteImpact,
  type DeleteClassificationInput,
} from "./media-delete-impact-classifier";

/**
 * M6A — Smart Delete classifier tests.
 *
 * The classifier is pure (no Supabase, no Mux, no network), so these run under
 * the Node test runner. They pin:
 *
 *   - every classification: SAFE / REPLACE_FIRST / BLOCKED / SHARED /
 *     RETENTION_PROTECTED / UNKNOWN
 *   - precedence: BLOCKED > RETENTION_PROTECTED > SHARED > REPLACE_FIRST
 *   - fail-closed: incomplete scan or missing asset => UNKNOWN, deletion off
 *   - runtime states: stale row (Mux missing), failed historical upload,
 *     READY unassigned, linked healthy — none of which auto-clear to SAFE
 *     unless the full zero-dependency proof passes
 */

function input(overrides: Partial<DeleteClassificationInput> = {}): DeleteClassificationInput {
  return {
    assetExists: true,
    supabaseState: "ready",
    hasPublishedEpisodeRefs: false,
    hasPublishedShortFilmRefs: false,
    hasAnyEpisodeRefs: false,
    hasAnyPreviewRefs: false,
    hasAnyShortFilmRefs: false,
    hasDerivedChildren: false,
    hasSubtitleTracks: false,
    hasSharedProviderRef: false,
    hasRetentionHistory: false,
    hasHomePublishingImpact: false,
    liveMuxState: "READY",
    scanComplete: true,
    retentionProvenance: "scanned",
    ...overrides,
  };
}

describe("M6A delete impact classifier — SAFE", () => {
  test("zero refs + no retention + complete scan + live READY => SAFE, deletion enabled", () => {
    const verdict = classifyDeleteImpact(input());
    assert.equal(verdict.primary, "SAFE");
    assert.equal(verdict.safeForDeletion, true);
    assert.equal(verdict.blockers.length, 0);
    assert.equal(verdict.replacements.length, 0);
  });

  test("enabled Home representation of referencing content is a warning, not a blocker", () => {
    const verdict = classifyDeleteImpact(input({ hasHomePublishingImpact: true }));
    assert.equal(verdict.primary, "SAFE");
    assert.ok(verdict.warnings.some((warning) => warning.includes("Home")));
  });
});

describe("M6A delete impact classifier — fail closed", () => {
  test("incomplete scan => UNKNOWN, deletion disabled", () => {
    const verdict = classifyDeleteImpact(input({ scanComplete: false }));
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
    assert.ok(verdict.blockers.some((blocker) => blocker.toLowerCase().includes("incomplete")));
  });

  test("missing asset row => UNKNOWN, deletion disabled", () => {
    const verdict = classifyDeleteImpact(input({ assetExists: false }));
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
  });

  test("live Mux still PROCESSING (unsettled provider state) => UNKNOWN even with zero refs", () => {
    const verdict = classifyDeleteImpact(input({ liveMuxState: "PROCESSING" }));
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
    assert.ok(verdict.blockers.some((blocker) => blocker.includes("processing")));
  });

  test("live Mux UNPROVEN with a complete-scan flag => SAFE + warning (the scanner itself flips UNPROVEN to fail-closed)", () => {
    const verdict = classifyDeleteImpact(
      input({ liveMuxState: "UNPROVEN", hasHomePublishingImpact: false }),
    );
    assert.equal(verdict.primary, "SAFE");
    assert.ok(verdict.warnings.some((warning) => warning.includes("could not be verified")));
    assert.equal(verdict.safeForDeletion, true);
  });
});

describe("M6A delete impact classifier — BLOCKED (published)", () => {
  test("published episode ref => BLOCKED", () => {
    const verdict = classifyDeleteImpact(
      input({ hasAnyEpisodeRefs: true, hasPublishedEpisodeRefs: true }),
    );
    assert.equal(verdict.primary, "BLOCKED");
    assert.equal(verdict.safeForDeletion, false);
    assert.ok(verdict.blockers.length > 0);
  });

  test("published short-film ref => BLOCKED", () => {
    const verdict = classifyDeleteImpact(
      input({ hasAnyShortFilmRefs: true, hasPublishedShortFilmRefs: true }),
    );
    assert.equal(verdict.primary, "BLOCKED");
  });

  test("published outranks shared and retention", () => {
    const verdict = classifyDeleteImpact(
      input({
        hasPublishedEpisodeRefs: true,
        hasAnyEpisodeRefs: true,
        hasSharedProviderRef: true,
        hasRetentionHistory: true,
      }),
    );
    assert.equal(verdict.primary, "BLOCKED");
  });
});

describe("M6A delete impact classifier — RETENTION_PROTECTED", () => {
  test("retention records with zero refs => RETENTION_PROTECTED", () => {
    const verdict = classifyDeleteImpact(input({ hasRetentionHistory: true }));
    assert.equal(verdict.primary, "RETENTION_PROTECTED");
    assert.equal(verdict.safeForDeletion, false);
  });

  test("retention outranks shared", () => {
    const verdict = classifyDeleteImpact(
      input({ hasRetentionHistory: true, hasSharedProviderRef: true }),
    );
    assert.equal(verdict.primary, "RETENTION_PROTECTED");
  });
});

describe("M6A delete impact classifier — SHARED", () => {
  test("shared provider reference => SHARED, deletion disabled", () => {
    const verdict = classifyDeleteImpact(input({ hasSharedProviderRef: true }));
    assert.equal(verdict.primary, "SHARED");
    assert.equal(verdict.safeForDeletion, false);
    assert.ok(verdict.warnings.some((warning) => warning.toLowerCase().includes("shared")));
  });

  test("shared outranks replace-first (draft refs present too)", () => {
    const verdict = classifyDeleteImpact(
      input({ hasSharedProviderRef: true, hasAnyEpisodeRefs: true }),
    );
    assert.equal(verdict.primary, "SHARED");
  });
});

describe("M6A delete impact classifier — REPLACE_FIRST", () => {
  test("draft episode media ref => REPLACE_FIRST", () => {
    const verdict = classifyDeleteImpact(input({ hasAnyEpisodeRefs: true }));
    assert.equal(verdict.primary, "REPLACE_FIRST");
    assert.equal(verdict.safeForDeletion, false);
    assert.ok(verdict.replacements[0].includes("episode media references"));
  });

  test("episode preview ref => REPLACE_FIRST", () => {
    const verdict = classifyDeleteImpact(input({ hasAnyPreviewRefs: true }));
    assert.equal(verdict.primary, "REPLACE_FIRST");
    assert.ok(verdict.replacements[0].includes("episode preview references"));
  });

  test("draft short-film ref => REPLACE_FIRST", () => {
    const verdict = classifyDeleteImpact(input({ hasAnyShortFilmRefs: true }));
    assert.equal(verdict.primary, "REPLACE_FIRST");
    assert.ok(verdict.replacements[0].includes("short-film references"));
  });

  test("derived child asset => REPLACE_FIRST", () => {
    const verdict = classifyDeleteImpact(input({ hasDerivedChildren: true }));
    assert.equal(verdict.primary, "REPLACE_FIRST");
    assert.ok(verdict.replacements[0].includes("derived child assets"));
  });

  test("related subtitle tracks => REPLACE_FIRST", () => {
    const verdict = classifyDeleteImpact(input({ hasSubtitleTracks: true }));
    assert.equal(verdict.primary, "REPLACE_FIRST");
    assert.ok(verdict.replacements[0].includes("subtitle tracks"));
  });

  test("all replacement sources listed together", () => {
    const verdict = classifyDeleteImpact(
      input({
        hasAnyEpisodeRefs: true,
        hasAnyPreviewRefs: true,
        hasAnyShortFilmRefs: true,
        hasDerivedChildren: true,
        hasSubtitleTracks: true,
      }),
    );
    assert.equal(verdict.primary, "REPLACE_FIRST");
    assert.ok(verdict.replacements[0].includes("episode media references"));
    assert.ok(verdict.replacements[0].includes("episode preview references"));
    assert.ok(verdict.replacements[0].includes("short-film references"));
    assert.ok(verdict.replacements[0].includes("derived child assets"));
    assert.ok(verdict.replacements[0].includes("subtitle tracks"));
  });
});

describe("M6A delete impact classifier — runtime states", () => {
  test("stale Supabase row (Mux missing) + zero refs + complete scan => SAFE with missing warning", () => {
    const verdict = classifyDeleteImpact(input({ liveMuxState: "MISSING" }));
    assert.equal(verdict.primary, "SAFE");
    assert.equal(verdict.safeForDeletion, true);
    assert.ok(verdict.warnings.some((warning) => warning.includes("missing")));
  });

  test("stale Supabase row (Mux missing) + draft episode ref => REPLACE_FIRST (Mux missing never auto-SAFE)", () => {
    const verdict = classifyDeleteImpact(
      input({ liveMuxState: "MISSING", hasAnyEpisodeRefs: true }),
    );
    assert.equal(verdict.primary, "REPLACE_FIRST");
    assert.equal(verdict.safeForDeletion, false);
  });

  test("failed historical upload + zero refs + complete scan => SAFE with failed warning", () => {
    const verdict = classifyDeleteImpact(
      input({ supabaseState: "failed", liveMuxState: "FAILED" }),
    );
    assert.equal(verdict.primary, "SAFE");
    assert.ok(verdict.warnings.some((warning) => warning.includes("failed")));
  });

  test("failed historical upload + subtitle relation => REPLACE_FIRST", () => {
    const verdict = classifyDeleteImpact(
      input({ supabaseState: "failed", liveMuxState: "FAILED", hasSubtitleTracks: true }),
    );
    assert.equal(verdict.primary, "REPLACE_FIRST");
  });

  test("READY unassigned + complete scan => SAFE, but incomplete scan keeps UNKNOWN", () => {
    const safeVerdict = classifyDeleteImpact(input());
    assert.equal(safeVerdict.primary, "SAFE");

    const unknownVerdict = classifyDeleteImpact(input({ scanComplete: false }));
    assert.equal(unknownVerdict.primary, "UNKNOWN");
    assert.equal(unknownVerdict.safeForDeletion, false);
  });

  test("READY unassigned + derived child => REPLACE_FIRST (READY never auto-deletes)", () => {
    const verdict = classifyDeleteImpact(input({ hasDerivedChildren: true }));
    assert.equal(verdict.primary, "REPLACE_FIRST");
  });

  test("linked healthy asset + published episode => BLOCKED", () => {
    const verdict = classifyDeleteImpact(
      input({ hasAnyEpisodeRefs: true, hasPublishedEpisodeRefs: true }),
    );
    assert.equal(verdict.primary, "BLOCKED");
  });

  test("linked healthy asset + draft episode => REPLACE_FIRST", () => {
    const verdict = classifyDeleteImpact(input({ hasAnyEpisodeRefs: true }));
    assert.equal(verdict.primary, "REPLACE_FIRST");
  });

  test("linked healthy asset shared across rows => SHARED", () => {
    const verdict = classifyDeleteImpact(input({ hasSharedProviderRef: true }));
    assert.equal(verdict.primary, "SHARED");
  });
});

describe("M6A.1 retention fail-closed", () => {
  test("retention source absent (table not installed) => UNKNOWN, deletion disabled", () => {
    const verdict = classifyDeleteImpact(
      input({ retentionProvenance: "absent" }),
    );
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
    assert.ok(verdict.blockers.some((b) => b.toLowerCase().includes("absent")));
  });

  test("retention source query failed (any other error) => UNKNOWN, deletion disabled", () => {
    const verdict = classifyDeleteImpact(
      input({ retentionProvenance: "failed" }),
    );
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
    assert.ok(verdict.blockers.some((b) => b.toLowerCase().includes("failed")));
  });

  test("retention successfully scanned, count=0 => SAFE allowed to continue (other deps clear)", () => {
    const verdict = classifyDeleteImpact(
      input({ retentionProvenance: "scanned", hasRetentionHistory: false }),
    );
    assert.equal(verdict.primary, "SAFE");
    assert.equal(verdict.safeForDeletion, true);
  });

  test("retention successfully scanned, count>0 => RETENTION_PROTECTED", () => {
    const verdict = classifyDeleteImpact(
      input({ retentionProvenance: "scanned", hasRetentionHistory: true }),
    );
    assert.equal(verdict.primary, "RETENTION_PROTECTED");
    assert.equal(verdict.safeForDeletion, false);
  });

  test("retention absent + zero refs + no live/shared issue => UNKNOWN (never SAFE)", () => {
    const verdict = classifyDeleteImpact(
      input({ retentionProvenance: "absent" }),
    );
    assert.notEqual(verdict.primary, "SAFE");
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
  });

  test("retention failed + zero refs + READY unassigned => UNKNOWN (never SAFE)", () => {
    const verdict = classifyDeleteImpact(
      input({ retentionProvenance: "failed" }),
    );
    assert.notEqual(verdict.primary, "SAFE");
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
  });

  test("retention absent + published ref => UNKNOWN (retention failure outranks BLOCKED path)", () => {
    const verdict = classifyDeleteImpact(
      input({
        retentionProvenance: "absent",
        hasAnyEpisodeRefs: true,
        hasPublishedEpisodeRefs: true,
      }),
    );
    assert.equal(verdict.primary, "UNKNOWN");
    assert.equal(verdict.safeForDeletion, false);
  });

  test("retention scanned + published ref => BLOCKED (retention is fine, published outranks)", () => {
    const verdict = classifyDeleteImpact(
      input({
        retentionProvenance: "scanned",
        hasAnyEpisodeRefs: true,
        hasPublishedEpisodeRefs: true,
      }),
    );
    assert.equal(verdict.primary, "BLOCKED");
  });
});
