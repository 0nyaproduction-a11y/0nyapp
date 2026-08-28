#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function readDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const env = {};
  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function getSupabaseSecret() {
  const npmShimPath = path.join(process.env.APPDATA ?? "", "npm", "supabase.cmd");
  const supabaseCommand = existsSync(npmShimPath) ? npmShimPath : "supabase";
  try {
    const output = execFileSync(process.env.ComSpec ?? "cmd.exe", ["/c", supabaseCommand, "status"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = output.match(/Secret\s+│\s+(\S+)/);
    const secret = match?.[1]?.trim();

    if (secret) {
      return secret;
    }
  } catch {
    // Fall through to the environment-only fallback below.
  }

  if (process.env.SUPABASE_SECRET_KEY?.trim()) {
    return process.env.SUPABASE_SECRET_KEY.trim();
  }

  throw new Error("Unable to read the local Supabase secret key.");
}

const repoRoot = process.cwd();
const localEnv = readDotEnv(path.join(repoRoot, ".env.local"));

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  localEnv.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const email =
  readArg("email") ||
  process.env.DEV_TEST_EMAIL?.trim() ||
  localEnv.DEV_TEST_EMAIL ||
  "androidtest@0nya.com";
const password =
  readArg("password") ||
  process.env.DEV_TEST_PASSWORD?.trim() ||
  localEnv.DEV_TEST_PASSWORD ||
  "";

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
}

if (!password || password.length < 6) {
  throw new Error("Missing a valid DEV_TEST_PASSWORD.");
}

const supabase = createClient(url, getSupabaseSecret(), {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (listError) {
  throw new Error(listError.message);
}

const existingUser = userList.users.find((user) => user.email === email);

if (existingUser) {
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
    email_confirm: true,
    password,
  });

  if (updateError) {
    throw new Error(updateError.message);
  }

  console.log(`dev account ready: ${updatedUser.user.email ?? email} (updated)`);
} else {
  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (createError) {
    throw new Error(createError.message);
  }

  console.log(`dev account ready: ${createdUser.user?.email ?? email} (created)`);
}
