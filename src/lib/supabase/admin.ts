import "server-only";

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

let cachedDevelopmentSecretKey: string | null | undefined;

function getDevelopmentSupabaseSecretKey() {
  if (cachedDevelopmentSecretKey !== undefined) {
    return cachedDevelopmentSecretKey;
  }

  if (process.env.NODE_ENV !== "development") {
    cachedDevelopmentSecretKey = null;
    return cachedDevelopmentSecretKey;
  }

  try {
    const npmShimPath = path.join(process.env.APPDATA ?? "", "npm", "supabase.cmd");
    const supabaseCommand = existsSync(npmShimPath) ? npmShimPath : "supabase";
    const output = execFileSync(process.env.ComSpec ?? "cmd.exe", ["/c", supabaseCommand, "status"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = output.match(/Secret\s+│\s+(\S+)/);

    cachedDevelopmentSecretKey = match?.[1]?.trim() ?? null;
  } catch {
    cachedDevelopmentSecretKey = null;
  }

  return cachedDevelopmentSecretKey;
}

function getServerSecretKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    getDevelopmentSupabaseSecretKey() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new Error("Missing Supabase server secret key.");
  }

  return key;
}

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const key = getServerSecretKey();

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
