import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type ChaiAllowedCoinAmountRow = Database["public"]["Tables"]["chai_allowed_coin_amounts"]["Row"];

function getAdminClient() {
  return createAdminClient();
}

export async function listChaiAllowedCoinAmountsForAdmin(): Promise<ChaiAllowedCoinAmountRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("chai_allowed_coin_amounts")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function updateChaiAllowedCoinAmount(
  id: string,
  input: { coinAmount: number; enabled: boolean; sortOrder: number },
) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("chai_allowed_coin_amounts")
    .update({
      coin_amount: input.coinAmount,
      enabled: input.enabled,
      sort_order: input.sortOrder,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function updateShortFilmChaiEnabled(shortFilmId: string, enabled: boolean) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("short_films")
    .update({ chai_enabled: enabled })
    .eq("id", shortFilmId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
