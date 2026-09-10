import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type CoinProductRow = Database["public"]["Tables"]["coin_products"]["Row"];

export type CoinProductActionResult =
  | { success: true }
  | { success: false; message: string };

function getAdminClient() {
  return createAdminClient();
}

// CMS/CMS-catalog authority only: coin quantities (coin_amount) are
// config-controlled, but real-money prices live in store (Google Play / App
// Store) product metadata and are NEVER written or read from this table here.
export type CoinProductListResult = {
  rows: CoinProductRow[];
  totalCount: number;
};

export async function listCoinProducts(
  params: { page?: number; pageSize?: number } = {},
): Promise<CoinProductListResult> {
  const supabase = getAdminClient();
  const { page = 1, pageSize = 25 } = params;
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from("coin_products")
    .select("*", { count: "exact" })
    .order("sort_order", { ascending: true })
    .range(offset, offset + pageSize - 1);

  const totalCount = count ?? 0;

  if (error || !data) {
    return { rows: [], totalCount: 0 };
  }

  return { rows: data, totalCount };
}

export async function updateCoinProductActive(
  code: string,
  active: boolean,
): Promise<CoinProductActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("coin_products").update({ active }).eq("code", code);

  if (error) {
    return { success: false, message: "Unable to update coin product." };
  }

  return { success: true };
}

export async function reorderCoinProducts(codes: string[]): Promise<CoinProductActionResult> {
  const supabase = getAdminClient();

  for (const [sortOrder, code] of codes.entries()) {
    const { error } = await supabase.from("coin_products").update({ sort_order: sortOrder }).eq("code", code);

    if (error) {
      return { success: false, message: "Unable to reorder coin products." };
    }
  }

  return { success: true };
}