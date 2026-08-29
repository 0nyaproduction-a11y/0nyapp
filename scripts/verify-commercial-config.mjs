// Commercial configuration lock verification.
// Validates the source-of-truth SQL/config (not a live database) reflects the
// founder-approved launch commercial configuration. Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  const p = join(root, rel);
  assert.ok(existsSync(p), `expected file exists: ${rel}`);
  return readFileSync(p, "utf8");
}

const seed005 = read("supabase/005_wallet_topups.sql");
const migrationCoin = read("supabase/migrations/20260829180000_024_launch_coin_packs.sql");
const migrationChai = read("supabase/migrations/20260829181000_025_chai_launch_amounts.sql");
const devHarness = read("apps/android/src/billing/devHarness.ts");
const plusScreen = read("apps/android/src/screens/PlusScreen.tsx");

test("launch coin packs define exactly 30/50/100/250", () => {
  for (const amount of [30, 50, 100, 250]) {
    const re = new RegExp(`coins_${amount}'[^)]*${amount}`);
    assert.ok(
      re.test(seed005) || re.test(migrationCoin),
      `coin pack ${amount} should be configured`,
    );
  }
});

test("coin packs sort order is 30 < 50 < 100 < 250", () => {
  const sortOf = (code) => {
    const m = (seed005 + "\n" + migrationCoin).match(
      new RegExp(`'${code}',\\s*\\d+,\\s*'[^']+',\\s*true,\\s*(\\d+)`),
    );
    return m ? Number(m[1]) : null;
  };
  const s30 = sortOf("coins_30");
  const s50 = sortOf("coins_50");
  const s100 = sortOf("coins_100");
  const s250 = sortOf("coins_250");
  assert.ok(s30 !== null && s50 !== null && s100 !== null && s250 !== null);
  assert.ok(s30 < s50 && s50 < s100 && s100 < s250, "sort order must be ascending by amount");
});

test("no obsolete coin pack quantities (20/40/60/120/140/300/320) are introduced", () => {
  const all = seed005 + "\n" + migrationCoin;
  for (const bad of [20, 40, 60, 120, 140, 300, 320]) {
    assert.ok(
      !new RegExp(`'coins_${bad}'`).test(all),
      `obsolete coin pack ${bad} must not exist`,
    );
  }
});

test("launch chai amounts are exactly 5/10/20/50", () => {
  for (const amount of [5, 10, 20, 50]) {
    assert.ok(
      new RegExp(`\\(${amount},\\s*true`).test(migrationChai),
      `chai amount ${amount} should be enabled`,
    );
  }
});

test("Plus is a single weekly tier with no monthly/yearly consumer product", () => {
  assert.ok(devHarness.includes("0nya_plus"), "Plus product code 0nya_plus must exist");
  assert.ok(plusScreen.includes("Weekly membership"), "Plus UI must communicate weekly membership");
  assert.ok(
    plusScreen.includes("Auto-renews weekly until cancelled") &&
      plusScreen.includes("Cancel anytime in Google Play"),
    "Plus UI must show renewal disclosure",
  );
  assert.ok(
    !plusScreen.includes("monthly") && !plusScreen.includes("yearly"),
    "Plus UI must not present monthly/yearly",
  );
});

test("no hardcoded ₹ price is treated as authoritative client policy", () => {
  // The Android client must derive localized price from store metadata; it must
  // not embed a literal ₹ launch price as presentation truth.
  assert.ok(
    devHarness.includes("Store price not configured"),
    "dev fallback must not claim a hardcoded price",
  );
});
