import { createClient } from "@supabase/supabase-js";
import { getMobileEnv } from "../config/env";
import { supabaseSecureStorage } from "./secureStorage";

const env = getMobileEnv();

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    storage: supabaseSecureStorage,
  },
});
