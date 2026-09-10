import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type NotificationWriteClient = SupabaseClient<Database>;

export type PushDevicePlatform = "android" | "ios" | "web";

export type RegisterPushDeviceInput = {
  deviceId: string;
  expoPushToken?: string | null;
  nativePushToken?: string | null;
  platform: PushDevicePlatform;
};

export type NotificationPreferencesInput = {
  account_security?: boolean;
  new_releases?: boolean;
  promotions?: boolean;
};

export function validatePushDeviceInput(input: unknown): {
  valid: boolean;
  error?: string;
  data?: RegisterPushDeviceInput;
} {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Request body must be an object." };
  }

  const raw = input as Record<string, unknown>;

  if (typeof raw.deviceId !== "string" || !raw.deviceId.trim()) {
    return { valid: false, error: "deviceId is required and must be a non-empty string." };
  }

  if (raw.deviceId.length > 256) {
    return { valid: false, error: "deviceId exceeds maximum length." };
  }

  const platform = String(raw.platform || "").toLowerCase() as PushDevicePlatform;
  if (!["android", "ios", "web"].includes(platform)) {
    return { valid: false, error: "platform must be 'android', 'ios', or 'web'." };
  }

  const expoPushToken =
    typeof raw.expoPushToken === "string" && raw.expoPushToken.trim()
      ? raw.expoPushToken.trim()
      : null;

  if (expoPushToken && expoPushToken.length > 512) {
    return { valid: false, error: "expoPushToken exceeds maximum length." };
  }

  const nativePushToken =
    typeof raw.nativePushToken === "string" && raw.nativePushToken.trim()
      ? raw.nativePushToken.trim()
      : null;

  if (nativePushToken && nativePushToken.length > 2048) {
    return { valid: false, error: "nativePushToken exceeds maximum length." };
  }

  return {
    valid: true,
    data: {
      deviceId: raw.deviceId.trim(),
      expoPushToken,
      nativePushToken,
      platform,
    },
  };
}

export function buildPushDeviceWrite(
  authenticatedUserId: string,
  input: RegisterPushDeviceInput,
  now: string,
) {
  return {
    user_id: authenticatedUserId,
    device_id: input.deviceId,
    platform: input.platform,
    expo_push_token: input.expoPushToken ?? null,
    native_push_token: input.nativePushToken ?? null,
    active: true,
    last_seen_at: now,
    updated_at: now,
  };
}

export function buildNotificationPreferencesWrite(
  authenticatedUserId: string,
  current: {
    account_security: boolean;
    new_releases: boolean;
    promotions: boolean;
  },
  input: NotificationPreferencesInput,
  now: string,
) {
  return {
    user_id: authenticatedUserId,
    promotions: input.promotions ?? current.promotions,
    new_releases: input.new_releases ?? current.new_releases,
    account_security: input.account_security ?? current.account_security,
    updated_at: now,
  };
}

export async function registerPushDevice(
  supabase: NotificationWriteClient,
  userId: string,
  input: RegisterPushDeviceInput
) {
  const now = new Date().toISOString();

  // 1. Deactivate a prior user's registration only when the caller presents a
  // matching provider token for the same device. device_id alone is client
  // supplied and must not authorize cross-user mutation.
  const presentedTokens = [
    ["expo_push_token", input.expoPushToken],
    ["native_push_token", input.nativePushToken],
  ] as const;
  for (const [column, token] of presentedTokens) {
    if (!token) continue;
    const { error } = await supabase
      .from("push_devices")
      .update({ active: false, updated_at: now })
      .eq("device_id", input.deviceId)
      .eq(column, token)
      .neq("user_id", userId);
    if (error) {
      throw new Error(`Failed to reconcile prior push device ownership: ${error.message}`);
    }
  }

  // 2. Upsert device registration for current user
  const { data, error } = await supabase
    .from("push_devices")
    .upsert(
      buildPushDeviceWrite(userId, input, now),
      { onConflict: "user_id,device_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to register push device: ${error.message}`);
  }

  return data;
}

export async function deactivatePushDevice(
  supabase: NotificationWriteClient,
  userId: string,
  deviceId: string
) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("push_devices")
    .update({ active: false, updated_at: now })
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .select();

  if (error) {
    throw new Error(`Failed to deactivate push device: ${error.message}`);
  }

  return { success: true, count: data?.length ?? 0 };
}

export async function getNotificationPreferences(
  supabase: NotificationWriteClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch notification preferences: ${error.message}`);
  }

  if (!data) {
    return {
      user_id: userId,
      promotions: true,
      new_releases: true,
      account_security: true,
      updated_at: new Date().toISOString(),
    };
  }

  return data;
}

export async function updateNotificationPreferences(
  supabase: NotificationWriteClient,
  userId: string,
  input: NotificationPreferencesInput
) {
  const current = await getNotificationPreferences(supabase, userId);
  const now = new Date().toISOString();

  const updated = buildNotificationPreferencesWrite(userId, current, input, now);

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(updated, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update notification preferences: ${error.message}`);
  }

  return data;
}
