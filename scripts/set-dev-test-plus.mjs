#!/usr/bin/env node

// Grants (or revokes) an active 0nya Plus subscription for a QA/dev test account
// so the Plus screen and Plus-gated episode access can be exercised without
// Google Play Billing.
//
// Runs scripts/set-dev-test-plus.sql against the linked Supabase project via the
// Supabase CLI, so no service-role key needs to live in the repo.
//
//   npm run plus:grant
//   npm run plus:grant -- --email someone@0nya.com --plan monthly --days 30
//   npm run plus:revoke

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));

  if (match) {
    return match.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1] ?? "";
  }

  return "";
}

const email = readArg("email") || process.env.DEV_TEST_EMAIL?.trim() || "0@0nya.com";
const plan = readArg("plan") || "0nya_plus_weekly";
const days = readArg("days") || "7";
const revoke = process.argv.includes("--revoke");

// These values are interpolated into SQL literals, so reject anything that could
// break out of them rather than trusting the caller.
if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
  throw new Error(`Refusing to run: ${email} is not a plain email address.`);
}

if (!/^[A-Za-z0-9_-]+$/.test(plan)) {
  throw new Error(`Refusing to run: ${plan} is not a plain plan code.`);
}

if (!/^[1-9][0-9]{0,3}$/.test(days)) {
  throw new Error(`Refusing to run: ${days} is not a positive whole number of days.`);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(scriptDir, "set-dev-test-plus.sql"), "utf8")
  .replaceAll("__TARGET_EMAIL__", email)
  .replaceAll("__PLAN_CODE__", plan)
  .replaceAll("__DURATION_DAYS__", days)
  .replaceAll("__REVOKE__", revoke ? "true" : "false");

console.log(
  revoke
    ? `Revoking 0nya Plus for ${email} on the linked Supabase project...`
    : `Granting 0nya Plus (${plan}, ${days} days) to ${email} on the linked Supabase project...`,
);

// Node 24 refuses to spawn .cmd shims directly (EINVAL), so on Windows the
// Supabase CLI is launched through cmd.exe, matching ensure-dev-test-account.mjs.
const isWindows = process.platform === "win32";
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npx";
const args = isWindows
  ? ["/c", "npx", "--yes", "supabase@latest", "db", "query", "--linked"]
  : ["--yes", "supabase@latest", "db", "query", "--linked"];

const result = spawnSync(command, args, {
  input: sql,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"],
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.error || result.status !== 0) {
  console.error((result.error?.message ?? output).trim());
  throw new Error("Plus update failed; the account was left unchanged.");
}

console.log(output.trim());
