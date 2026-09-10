#!/usr/bin/env node

// Resets a QA/dev test account back to its "first login" monetization state:
// 100 coins, every episode locked, no rewarded-ad history, no watch progress.
//
// Runs scripts/reset-dev-test-account-state.sql against the linked Supabase
// project via the Supabase CLI, so no service-role key needs to live in the repo.
//
//   npm run reset:test-account
//   npm run reset:test-account -- --email someone@0nya.com

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

// The email is interpolated into a SQL string literal, so reject anything that
// could break out of it rather than trusting the caller.
if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
  throw new Error(`Refusing to run: ${email} is not a plain email address.`);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(scriptDir, "reset-dev-test-account-state.sql"), "utf8").replaceAll(
  "__TARGET_EMAIL__",
  email,
);

console.log(`Resetting ${email} on the linked Supabase project...`);

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
  throw new Error("Reset failed; the account was left unchanged.");
}

console.log(output.trim());
