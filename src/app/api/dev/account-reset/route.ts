import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Mirrors public.apply_welcome_coin_grant, which the signup trigger applies.
const WELCOME_GRANT_COINS = 100;
const WELCOME_GRANT_REFERENCE = "welcome_100_coins";

// This endpoint deletes monetization state and re-grants the welcome coins, so
// access is restricted to an explicit allowlist of QA accounts. The caller's
// email comes from the verified token, so it cannot be spoofed by the client.
// With no allowlist configured the route is disabled entirely.
function getResetAllowlist() {
  return (process.env.ONYA_DEV_ACCOUNT_RESET_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isResetAllowedForEmail(email: string | undefined) {
  const allowlist = getResetAllowlist();

  if (allowlist.length === 0) {
    return false;
  }

  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

export async function POST(request: Request) {
  const { user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  // Non-allowlisted callers get 404 so the route is indistinguishable from one
  // that does not exist.
  if (!isResetAllowedForEmail(user.email)) {
    return errorResponse("not_found", "Not found.", 404);
  }

  // Callers may only ever reset themselves; the id comes from the verified
  // token rather than from the request body.
  const userId = user.id;
  const supabase = createAdminClient();

  const clearedTables = [
    "episode_entitlements",
    "rewarded_ad_attempts",
    "rewarded_monetization_events",
    "watch_progress",
    "subscriptions",
    "coin_transactions",
  ] as const;

  for (const table of clearedTables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);

    if (error) {
      return errorResponse("server_error", `Unable to clear ${table}.`, 500);
    }
  }

  const { error: walletError } = await supabase
    .from("wallets")
    .upsert({ user_id: userId, coin_balance: 0 }, { onConflict: "user_id" });

  if (walletError) {
    return errorResponse("server_error", "Unable to reset the wallet.", 500);
  }

  // Re-grant the welcome coins by writing the same ledger row and balance the
  // signup trigger produces. apply_welcome_coin_grant is deliberately revoked
  // from service_role (migration 028 restricts it to the internal trigger), so
  // the reset reproduces its effect rather than weakening that hardening.
  const { error: ledgerError } = await supabase.from("coin_transactions").insert({
    user_id: userId,
    amount: WELCOME_GRANT_COINS,
    transaction_type: "promo",
    reference: WELCOME_GRANT_REFERENCE,
  });

  if (ledgerError) {
    return errorResponse("server_error", "Unable to re-apply the welcome grant.", 500);
  }

  const { error: balanceError } = await supabase
    .from("wallets")
    .update({ coin_balance: WELCOME_GRANT_COINS })
    .eq("user_id", userId);

  if (balanceError) {
    return errorResponse("server_error", "Unable to credit the welcome grant.", 500);
  }

  return dataResponse({ reset: true });
}
