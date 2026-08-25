import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ChaiAvailability = {
  available: boolean;
  allowedCoinAmounts: number[];
};

export type ChaiTipResult = {
  success: boolean;
  status: string;
  remainingBalance: number | null;
};

async function getSupabase(supabase?: SupabaseClient<Database>) {
  return supabase ?? createClient();
}

export async function getShortFilmChaiDetails(
  shortFilmSlug: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<ChaiAvailability> {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase.rpc("get_short_film_chai_details", {
    p_short_film_slug: shortFilmSlug,
  });

  if (error) {
    console.warn("Unable to load short film Chai details.");
    return { available: false, allowedCoinAmounts: [] };
  }

  const result = data.at(0);

  return {
    available: Boolean(result?.available),
    allowedCoinAmounts: result?.allowed_coin_amounts ?? [],
  };
}

export async function submitShortFilmChaiTip(
  shortFilmSlug: string,
  coinAmount: number,
  idempotencyKey: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<ChaiTipResult> {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase.rpc("submit_short_film_chai_tip", {
    p_short_film_slug: shortFilmSlug,
    p_coin_amount: coinAmount,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.warn("Unable to submit short film Chai tip.");
    return {
      success: false,
      status: "tip_failed",
      remainingBalance: null,
    };
  }

  const result = data.at(0);

  return {
    success: Boolean(result?.success),
    status: result?.status ?? "tip_failed",
    remainingBalance: result?.remaining_balance ?? null,
  };
}
