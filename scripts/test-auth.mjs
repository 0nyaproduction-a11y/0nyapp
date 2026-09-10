import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const url = "https://grxflnpofubqddtltkoe.supabase.co";
const key = execSync("gcloud secrets versions access latest --secret=SUPABASE_SERVICE_ROLE_KEY --project=nya-app-c9823", { encoding: "utf8" }).trim();

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "0@0nya.com",
    password: "Nile-Quartz-74!mR9",
  });
  console.log("signin error:", error);
  console.log("user email:", data?.user?.email);
  console.log("user id:", data?.user?.id);
}

test();
