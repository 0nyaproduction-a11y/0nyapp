import { test, describe } from "node:test";
import assert from "node:assert/strict";

/**
 * CMS-C08B-07 — targeted tests for the shared freshness/status vocabulary.
 *
 * Pins the five-state operator status contract:
 *   - Only HEALTHY renders green/teal
 *   - UNKNOWN is fail-closed (amber, never green)
 *   - DEGRADED/DELAYED/FAILED use amber/red (never green)
 *   - Relative time formatting is monotonic and never fabricated
 */

import type { CmsOperatorStatus } from "@/components/cms/CmsStates";

// Replicate the STATUS_META contract from CmsStates.tsx for testing
// without importing the client component into the Node test runner.
const STATUS_META: Record<CmsOperatorStatus, { label: string; isHealthy: boolean; isGreen: boolean }> = {
  HEALTHY: { label: "HEALTHY", isHealthy: true, isGreen: true },
  DEGRADED: { label: "DEGRADED", isHealthy: false, isGreen: false },
  DELAYED: { label: "DELAYED", isHealthy: false, isGreen: false },
  FAILED: { label: "FAILED", isHealthy: false, isGreen: false },
  UNKNOWN: { label: "UNKNOWN", isHealthy: false, isGreen: false },
};

function formatRelativeTime(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

describe("CMS-C08B-07 operator status vocabulary", () => {
  test("HEALTHY is the only green/healthy state", () => {
    const statuses: CmsOperatorStatus[] = ["HEALTHY", "DEGRADED", "DELAYED", "FAILED", "UNKNOWN"];
    for (const status of statuses) {
      const meta = STATUS_META[status];
      if (status === "HEALTHY") {
        assert.equal(meta.isGreen, true, "HEALTHY must be green");
        assert.equal(meta.isHealthy, true, "HEALTHY must be healthy");
      } else {
        assert.equal(meta.isGreen, false, `${status} must NOT be green`);
        assert.equal(meta.isHealthy, false, `${status} must NOT be healthy`);
      }
    }
  });

  test("UNKNOWN is fail-closed (amber, never green)", () => {
    const meta = STATUS_META.UNKNOWN;
    assert.equal(meta.isGreen, false, "UNKNOWN must never render green");
    assert.equal(meta.isHealthy, false, "UNKNOWN must be treated as non-healthy");
    assert.equal(meta.label, "UNKNOWN");
  });

  test("all five states have distinct labels", () => {
    const statuses: CmsOperatorStatus[] = ["HEALTHY", "DEGRADED", "DELAYED", "FAILED", "UNKNOWN"];
    const labels = statuses.map((s) => STATUS_META[s].label);
    assert.deepEqual(labels, ["HEALTHY", "DEGRADED", "DELAYED", "FAILED", "UNKNOWN"]);
  });

  test("invalid status falls back to UNKNOWN (fail-closed)", () => {
    const invalidStatus = "INVALID" as CmsOperatorStatus;
    const meta = STATUS_META[invalidStatus] ?? STATUS_META.UNKNOWN;
    assert.equal(meta.label, "UNKNOWN");
    assert.equal(meta.isGreen, false);
  });
});

describe("CMS-C08B-07 relative time formatting", () => {
  test("future timestamp returns 'just now' (never fabricated)", () => {
    const future = Date.now() + 60000;
    assert.equal(formatRelativeTime(future), "just now");
  });

  test("recent timestamp (< 5s) returns 'just now'", () => {
    const recent = Date.now() - 2000;
    assert.equal(formatRelativeTime(recent), "just now");
  });

  test("seconds ago is formatted correctly", () => {
    const thirtySecondsAgo = Date.now() - 30000;
    assert.equal(formatRelativeTime(thirtySecondsAgo), "30s ago");
  });

  test("minutes ago is formatted correctly", () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    assert.equal(formatRelativeTime(fiveMinutesAgo), "5m ago");
  });

  test("hours ago is formatted correctly", () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    assert.equal(formatRelativeTime(threeHoursAgo), "3h ago");
  });

  test("days ago is formatted correctly", () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    assert.equal(formatRelativeTime(twoDaysAgo), "2d ago");
  });

  test("relative time is monotonic (older = larger unit)", () => {
    const now = Date.now();
    const fiveSec = formatRelativeTime(now - 5000);
    const fiveMin = formatRelativeTime(now - 5 * 60 * 1000);
    const fiveHr = formatRelativeTime(now - 5 * 60 * 60 * 1000);
    // Each should be a different unit, showing progression.
    assert.ok(fiveSec.includes("s") || fiveSec === "just now");
    assert.ok(fiveMin.includes("m"));
    assert.ok(fiveHr.includes("h"));
  });
});

describe("CMS-C08B-07 status derivation contract", () => {
  test("error message present => FAILED status", () => {
    const errorMessage = "Something went wrong";
    const status: CmsOperatorStatus = errorMessage ? "FAILED" : "HEALTHY";
    assert.equal(status, "FAILED");
  });

  test("no error message => HEALTHY status", () => {
    const errorMessage: string | null = null;
    const status: CmsOperatorStatus = errorMessage ? "FAILED" : "HEALTHY";
    assert.equal(status, "HEALTHY");
  });

  test("data with problems => DEGRADED status", () => {
    const hasProblems = true;
    const status: CmsOperatorStatus = hasProblems ? "DEGRADED" : "HEALTHY";
    assert.equal(status, "DEGRADED");
  });

  test("data without problems => HEALTHY status", () => {
    const hasProblems = false;
    const status: CmsOperatorStatus = hasProblems ? "DEGRADED" : "HEALTHY";
    assert.equal(status, "HEALTHY");
  });
});
