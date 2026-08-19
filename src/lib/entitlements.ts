import type { Episode } from "@/data/content";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type EpisodeEntitlement =
  Database["public"]["Tables"]["episode_entitlements"]["Row"];

type WatchableEpisode = Episode & {
  id?: string;
};

type WatchAccessInput = {
  userId: string | null;
  episode: WatchableEpisode;
};

export type EpisodeAccessKind = "free" | "owned" | "subscription" | "locked";

export type EpisodeAccessState = {
  canWatch: boolean;
  kind: EpisodeAccessKind;
  label: "Free" | "Owned" | "Included" | "Locked";
};

function hasCurrentTimeWindow(row: { ends_at?: string | null; expires_at?: string | null }) {
  const end = row.ends_at ?? row.expires_at;

  return !end || new Date(end).getTime() > Date.now();
}

function hasStarted(row: { starts_at?: string | null }) {
  return !row.starts_at || new Date(row.starts_at).getTime() <= Date.now();
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
  const activeResult = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  if (activeResult.error) {
    console.warn("Unable to load subscription.");
    return null;
  }

  const currentActiveSubscription = activeResult.data.find(
    (subscription) =>
      hasStarted(subscription) && hasCurrentTimeWindow(subscription),
  );

  if (currentActiveSubscription) {
    return currentActiveSubscription;
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
      hasStarted(subscription) &&
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

export async function getValidEpisodeEntitlementIds(
  userId: string,
  episodeIds: string[],
) {
  if (!episodeIds.length) {
    return new Set<string>();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episode_entitlements")
    .select("episode_id, expires_at")
    .eq("user_id", userId)
    .in("episode_id", episodeIds);

  if (error) {
    console.warn("Unable to load episode entitlements.");
    return new Set<string>();
  }

  return new Set(
    data
      .filter((entitlement) => hasCurrentTimeWindow(entitlement))
      .map((entitlement) => entitlement.episode_id),
  );
}

export async function getEpisodeAccessStates(
  userId: string | null,
  episodes: WatchableEpisode[],
) {
  const accessByEpisodeNumber = new Map<number, EpisodeAccessState>();
  const hasSubscription = userId ? await hasActiveSubscription(userId) : false;
  const episodeIds = episodes
    .map((episode) => episode.id)
    .filter((episodeId): episodeId is string => Boolean(episodeId));
  const entitledEpisodeIds = userId
    ? await getValidEpisodeEntitlementIds(userId, episodeIds)
    : new Set<string>();

  for (const episode of episodes) {
    if (episode.isFree) {
      accessByEpisodeNumber.set(episode.number, {
        canWatch: true,
        kind: "free",
        label: "Free",
      });
      continue;
    }

    if (episode.id && entitledEpisodeIds.has(episode.id)) {
      accessByEpisodeNumber.set(episode.number, {
        canWatch: true,
        kind: "owned",
        label: "Owned",
      });
      continue;
    }

    if (hasSubscription) {
      accessByEpisodeNumber.set(episode.number, {
        canWatch: true,
        kind: "subscription",
        label: "Included",
      });
      continue;
    }

    accessByEpisodeNumber.set(episode.number, {
      canWatch: false,
      kind: "locked",
      label: "Locked",
    });
  }

  return accessByEpisodeNumber;
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
