import { createServerClient } from "@supabase/ssr";

const url = "https://grxflnpofubqddtltkoe.supabase.co";
const key = "sb_publishable_4_5PsKWA78d_J56Dx0jtDg_qXtn9HHN";

async function test() {
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        console.log("Cookies to set:", cookiesToSet.length);
      },
    },
  });

  console.log("Step 1: signInWithPassword");
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: "0@0nya.com",
    password: "Nile-Quartz-74!mR9",
  });
  console.log("signIn error:", signInError);

  console.log("Step 2: getUser");
  const { data: { user } } = await supabase.auth.getUser();
  console.log("user:", user?.email, user?.id);

  console.log("Step 3: is_cms_admin");
  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_cms_admin");
  console.log("is_cms_admin:", isAdmin);
  console.log("rpc error:", rpcError);
}

test().catch(console.error);
