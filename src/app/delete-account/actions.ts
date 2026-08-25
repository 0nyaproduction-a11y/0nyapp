"use server";

import { redirect } from "next/navigation";
import { deleteAuthenticatedAccount } from "@/lib/account-deletion";
import { createClient } from "@/lib/supabase/server";

export async function deleteWebAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/delete-account");
  }

  const result = await deleteAuthenticatedAccount(user.id);

  if (!result.success) {
    redirect("/delete-account?error=1");
  }

  await supabase.auth.signOut();
  redirect("/delete-account/success");
}
