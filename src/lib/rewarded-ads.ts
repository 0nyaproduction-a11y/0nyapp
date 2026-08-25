import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RewardedAdAttemptResponse } from "@/types/rewarded-ads";

type RewardedAdAttemptRow = {
  custom_data: string | null;
  expires_at: string | null;
  status: string | null;
};

type RewardedAdCallbackRow = {
  custom_data: string | null;
  expires_at: string | null;
  status: string | null;
  success: boolean | null;
};

async function getSupabase(supabase?: SupabaseClient<Database>) {
  return supabase ?? createClient();
}

function toAttemptResponse(row: RewardedAdAttemptRow | RewardedAdCallbackRow | null): RewardedAdAttemptResponse {
  const status = row?.status;

  return {
    customData: row?.custom_data ?? null,
    expiresAt: row?.expires_at ?? null,
    status:
      status === "pending" ||
      status === "granted" ||
      status === "expired" ||
      status === "failed" ||
      status === "unsupported_pending_policy" ||
      status === "already_accessible" ||
      status === "rewarded_disabled" ||
      status === "not_found"
        ? status
        : "failed",
  };
}

export async function createRewardedAdAttempt(
  episodeId: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase.rpc("create_rewarded_ad_attempt", {
    p_episode_id: episodeId,
  });

  if (error) {
    console.warn("Unable to create rewarded ad attempt.");
    return null;
  }

  return toAttemptResponse(data.at(0) ?? null);
}

export async function getRewardedAdAttemptStatus(
  customData: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase.rpc("get_rewarded_ad_attempt_status", {
    p_custom_data: customData,
  });

  if (error) {
    console.warn("Unable to load rewarded ad attempt.");
    return null;
  }

  const result = data.at(0) as RewardedAdAttemptRow | undefined;

  if (!result || !result.custom_data) {
    return null;
  }

  return toAttemptResponse(result);
}

export async function finalizeRewardedAdCallback(
  customData: string,
  providerTransactionId: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase.rpc("finalize_rewarded_ad_callback", {
    p_custom_data: customData,
    p_provider_transaction_id: providerTransactionId,
  });

  if (error) {
    console.warn("Unable to finalize rewarded ad callback.");
    return null;
  }

  const result = data.at(0) as RewardedAdCallbackRow | undefined;

  if (!result) {
    return null;
  }

  return {
    customData: result.custom_data ?? null,
    expiresAt: result.expires_at ?? null,
    status: result.status ?? "failed",
    success: Boolean(result.success),
  };
}
