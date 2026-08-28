"use server";

import { redirect } from "next/navigation";
import { getCmsAdminContext } from "@/lib/cms/auth";
import { adminLoginPath, adminPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

function getSafeAdminRedirect(next: FormDataEntryValue | null) {
  if (
    typeof next !== "string" ||
    !next.startsWith("/admin") ||
    next.startsWith("//") ||
    next === adminLoginPath
  ) {
    return adminPath;
  }

  return next;
}

function getAdminLoginRedirect(redirectTo: string, message: string) {
  const params = new URLSearchParams();

  if (redirectTo !== adminPath) {
    params.set("next", redirectTo);
  }

  params.set("error", message);

  return `${adminLoginPath}?${params.toString()}`;
}

export async function cmsEmailPasswordLogin(formData: FormData) {
  const redirectTo = getSafeAdminRedirect(formData.get("next"));
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    redirect(getAdminLoginRedirect(redirectTo, "Enter the CMS QA email and password."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(getAdminLoginRedirect(redirectTo, "Invalid CMS QA email or password."));
  }

  const context = await getCmsAdminContext(supabase);

  if (context.status !== "authorized") {
    redirect(adminPath);
  }

  redirect(redirectTo);
}
