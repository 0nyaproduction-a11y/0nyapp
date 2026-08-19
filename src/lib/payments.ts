import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type CoinProduct = Database["public"]["Tables"]["coin_products"]["Row"];
export type PaymentOrder = Database["public"]["Tables"]["payment_orders"]["Row"];

async function getSupabase(supabase?: SupabaseClient<Database>) {
  return supabase ?? createClient();
}

export function formatOrderStatus(order: PaymentOrder) {
  if (order.status === "completed" && order.verification_status === "verified") {
    return "Completed";
  }

  if (order.verification_status === "rejected") {
    return "Rejected";
  }

  return order.status.replace("_", " ");
}

export function formatPaymentProvider(provider: PaymentOrder["provider"]) {
  if (provider === "google_play") {
    return "Google Play";
  }

  if (provider === "apple_store") {
    return "App Store";
  }

  if (provider === "web") {
    return "Web";
  }

  return "Verified top-up";
}

export async function getActiveCoinProducts(supabaseClient?: SupabaseClient<Database>) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase
    .from("coin_products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("Unable to load coin products.");
    return [];
  }

  return data;
}

export async function getUserPaymentOrders(
  userId: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.warn("Unable to load payment orders.");
    return [];
  }

  return data;
}

export async function getPaymentOrderById(
  userId: string,
  orderId: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load payment order.");
    return null;
  }

  return data;
}
