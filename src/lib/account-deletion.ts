import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteAuthenticatedAccount(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return {
      success: false,
    } as const;
  }

  return {
    success: true,
  } as const;
}
