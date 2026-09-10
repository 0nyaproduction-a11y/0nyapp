import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const url = "https://grxflnpofubqddtltkoe.supabase.co";
const key = execSync("gcloud secrets versions access latest --secret=SUPABASE_SERVICE_ROLE_KEY --project=nya-app-c9823", { encoding: "utf8" }).trim();

async function test() {
  const supabase = createClient(url, key);
  
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: "0@0nya.com",
    password: "Nile-Quartz-74!mR9",
  });
  
  console.log("signin error:", signInError);
  console.log("user id:", signInData?.user?.id);
  
  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_cms_admin");
  console.log("is_cms_admin result:", isAdmin);
  console.log("rpc error:", rpcError);
  
  const { data: admins, error: adminsError } = await supabase
    .from("cms_admins")
    .select("*")
    .eq("user_id", signInData?.user?.id);
  console.log("user in cms_admins:", admins);
  console.log("admins error:", adminsError);
}

test();
