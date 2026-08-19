import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PurchaseStatus =
  | "not_authenticated"
  | "invalid_episode"
  | "insufficient_balance"
  | "already_owned"
  | "active_subscription"
  | "already_accessible"
  | "purchase_success"
  | "purchase_failed";

export type CoinTransaction =
  Database["public"]["Tables"]["coin_transactions"]["Row"];

type PurchaseResult = {
  success: boolean;
  status: PurchaseStatus;
  remainingBalance: number | null;
};

async function getSupabase(supabase?: SupabaseClient<Database>) {
  return supabase ?? createClient();
}

function toPurchaseStatus(status: string | undefined): PurchaseStatus {
  switch (status) {
    case "not_authenticated":
    case "invalid_episode":
    case "insufficient_balance":
    case "already_owned":
    case "active_subscription":
    case "already_accessible":
    case "purchase_success":
      return status;
    default:
      return "purchase_failed";
  }
}

export async function purchaseEpisodeWithCoins(episodeId: string): Promise<PurchaseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      status: "not_authenticated",
      remainingBalance: null,
    };
  }

  const { data, error } = await supabase.rpc("purchase_episode_with_coins", {
    p_episode_id: episodeId,
  });

  if (error) {
    console.warn("Unable to purchase episode.");
    return {
      success: false,
      status: "purchase_failed",
      remainingBalance: null,
    };
  }

  const result = data.at(0);

  return {
    success: Boolean(result?.success),
    status: toPurchaseStatus(result?.status),
    remainingBalance: result?.remaining_balance ?? null,
  };
}

export async function getUserCoinTransactions(
  userId: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase
    .from("coin_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Unable to load coin transactions.");
    return [];
  }

  return data;
}
