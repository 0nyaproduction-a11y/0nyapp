import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const url = "https://grxflnpofubqddtltkoe.supabase.co";
const key = execSync("gcloud secrets versions access latest --secret=SUPABASE_SERVICE_ROLE_KEY --project=nya-app-c9823", { encoding: "utf8" }).trim();

const supabase = createClient(url, key);

async function test() {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: "0@0nya.com",
    password: "Nile-Quartz-74!mR9",
  });
  console.log("signin error:", signInError?.message || null);
  console.log("user email:", signInData?.user?.email);
  console.log("user id:", signInData?.user?.id);
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log("user:", user?.email, user?.id);
  
  const { data: isAdmin, error } = await supabase.rpc("is_cms_admin");
  console.log("is_cms_admin:", isAdmin);
  console.log("rpc error:", error);
}

test().catch(console.error);
