"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getSafeRedirect(next: FormDataEntryValue | null) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

function getLoginRedirect(redirectTo: string, message: string) {
  const params = new URLSearchParams();

  if (redirectTo !== "/") {
    params.set("next", redirectTo);
  }

  params.set("devError", message);

  return `/login?${params.toString()}`;
}

function isInvalidCredentialsError(error: { message: string; status?: number }) {
  const message = error.message.toLowerCase();

  return error.status === 400 || message.includes("invalid login credentials");
}

export async function devTestLogin(formData: FormData) {
  const redirectTo = getSafeRedirect(formData.get("next"));

  if (process.env.NODE_ENV !== "development") {
    redirect(getLoginRedirect(redirectTo, "Development login is not available."));
  }

  const email = process.env.DEV_TEST_EMAIL;
  const password = process.env.DEV_TEST_PASSWORD;

  if (!email || !password) {
    redirect(
      getLoginRedirect(
        redirectTo,
        "Set DEV_TEST_EMAIL and DEV_TEST_PASSWORD locally to use dev login.",
      ),
    );
  }

  const supabase = await createClient();
  const signInResult = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInResult.error) {
    redirect(redirectTo);
  }

  if (!isInvalidCredentialsError(signInResult.error)) {
    redirect(getLoginRedirect(redirectTo, "Development login could not start."));
  }

  const signUpResult = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: "0nya Dev Test",
      },
    },
  });

  if (signUpResult.error) {
    redirect(getLoginRedirect(redirectTo, "Development test account could not be created."));
  }

  if (!signUpResult.data.session) {
    redirect(
      getLoginRedirect(
        redirectTo,
        "Development test account created. Disable email confirmation locally, then try again.",
      ),
    );
  }

  redirect(redirectTo);
}
