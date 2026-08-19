import type { Episode } from "@/data/content";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

type WatchableEpisode = Episode & {
  id?: string;
};

type WatchAccessInput = {
  userId: string | null;
  episode: WatchableEpisode;
};

function hasCurrentTimeWindow(row: { ends_at?: string | null; expires_at?: string | null }) {
  const end = row.ends_at ?? row.expires_at;

  return !end || new Date(end).getTime() > Date.now();
}

export async function getUserWallet(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load wallet.");
    return null;
  }

  return data;
}

export async function getUserSubscription(userId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const activeResult = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeResult.error) {
    console.warn("Unable to load subscription.");
    return null;
  }

  if (activeResult.data) {
    return activeResult.data;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load subscription.");
    return null;
  }

  return data;
}

export async function hasActiveSubscription(userId: string) {
  const subscription = await getUserSubscription(userId);

  return Boolean(
    subscription &&
      subscription.status === "active" &&
      hasCurrentTimeWindow(subscription),
  );
}

export async function hasValidEpisodeEntitlement(userId: string, episodeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episode_entitlements")
    .select("*")
    .eq("user_id", userId)
    .eq("episode_id", episodeId)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load episode entitlement.");
    return false;
  }

  return Boolean(data && hasCurrentTimeWindow(data));
}

export async function userOwnsEpisode(userId: string, episodeId: string) {
  return hasValidEpisodeEntitlement(userId, episodeId);
}

export async function canUserWatchEpisode({ userId, episode }: WatchAccessInput) {
  if (episode.isFree) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (await hasActiveSubscription(userId)) {
    return true;
  }

  if (!episode.id) {
    return false;
  }

  return hasValidEpisodeEntitlement(userId, episode.id);
}
