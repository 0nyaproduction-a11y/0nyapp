import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/profiles";
import type { Subscription, Wallet } from "@/lib/entitlements";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getSafeDisplayName(profile: Profile | null, user: User) {
  return (
    profile?.display_name?.trim() ||
    getMetadataString(user.user_metadata ?? {}, "display_name") ||
    user.email ||
    user.phone ||
    "0nya member"
  );
}

export function getSafeUserIdentifier(user: User) {
  if (user.phone) {
    return user.phone;
  }

  if (user.email) {
    return user.email;
  }

  return "Signed in";
}

export function getSubscriptionSummary(subscription: Subscription | null) {
  if (subscription?.status !== "active") {
    return {
      status: "none" as const,
      label: "No active plan",
      planCode: null,
      endsAt: null,
    };
  }

  return {
    status: "active" as const,
    label: subscription.ends_at
      ? `Active until ${formatDate(subscription.ends_at)}`
      : "Active plan",
    planCode: subscription.plan_code,
    endsAt: subscription.ends_at,
  };
}

export function getWalletSummary(wallet: Wallet | null) {
  return {
    coinBalance: wallet?.coin_balance ?? 0,
  };
}
