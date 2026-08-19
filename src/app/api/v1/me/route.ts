import { getSafeDisplayName, getSafeUserIdentifier, getSubscriptionSummary, getWalletSummary } from "@/lib/account";
import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getUserSubscription, getUserWallet } from "@/lib/entitlements";
import { getUserProfile } from "@/lib/profiles";

export async function GET(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const [profile, wallet, subscription] = await Promise.all([
    getUserProfile(user.id, supabase),
    getUserWallet(user.id, supabase),
    getUserSubscription(user.id, supabase),
  ]);

  return dataResponse({
    id: user.id,
    displayName: getSafeDisplayName(profile, user),
    identifier: getSafeUserIdentifier(user),
    wallet: getWalletSummary(wallet),
    subscription: getSubscriptionSummary(subscription),
  });
}
