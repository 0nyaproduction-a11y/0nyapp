import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminPath, loginPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type CmsSupabaseClient = SupabaseClient<Database>;

export type CmsAdminContext =
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: User }
  | { status: "authorized"; user: User; supabase: CmsSupabaseClient };

/**
 * Verifies CMS admin access for the CURRENT authenticated Supabase session
 * only. Authorization is re-checked server-side against public.cms_admins
 * on every call via the is_cms_admin() RPC (SECURITY DEFINER, scoped to
 * auth.uid()) — it never trusts a client-supplied user id or role.
 *
 * Reuse this (or requireCmsAdmin below) instead of duplicating the
 * authentication + authorization check in every future CMS route.
 */
export async function getCmsAdminContext(
  supabaseClient?: CmsSupabaseClient,
): Promise<CmsAdminContext> {
  const supabase = supabaseClient ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: isAdmin, error } = await supabase.rpc("is_cms_admin");

  if (error) {
    console.warn("Unable to verify CMS admin authorization.");
  }

  if (error || !isAdmin) {
    return { status: "forbidden", user };
  }

  return { status: "authorized", user, supabase };
}

/**
 * Server Component / page guard. Redirects unauthenticated visitors to
 * login (preserving `next`), then returns the resolved context so the
 * caller can render an access-denied state for authenticated non-admins
 * or the real admin surface for authorized admins.
 */
export async function requireCmsAdmin(
  nextPath: string = adminPath,
): Promise<Exclude<CmsAdminContext, { status: "unauthenticated" }>> {
  const context = await getCmsAdminContext();

  if (context.status === "unauthenticated") {
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
  }

  return context;
}
