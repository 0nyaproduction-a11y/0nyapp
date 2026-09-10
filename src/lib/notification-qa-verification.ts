import { createAdminClient } from "@/lib/supabase/admin";
import {
  createNotification,
  processPushReceipts,
  sendNotificationToUser,
} from "@/lib/notification-service";
import { isValidExpoPushToken, type PushProviderAdapter } from "@/lib/push-provider";

const QA_TEST_TYPE = "QA_TEST";
const QA_TEST_TITLE = "0nya notification test";
const QA_TEST_BODY = "QA push delivery verified.";

type SupabaseLike = ReturnType<typeof createAdminClient>;

type QaPushDeviceRow = {
  active: boolean;
  device_id: string | null;
  expo_push_token: string | null;
  id: string;
  native_push_token: string | null;
  platform: string | null;
  user_id: string;
};

export type QaPushPrecheckInput = {
  qaUserId: string;
  pushDeviceId: string;
};

export type QaPushSendInput = QaPushPrecheckInput & {
  allowRealPushSend: boolean;
  providerAdapter?: PushProviderAdapter;
};

export type QaPushPrecheckResult = {
  active: boolean;
  deviceId: string | null;
  expoPushTokenValid: boolean;
  nativePushTokenPresent: boolean;
  platform: string | null;
  pushDeviceId: string;
  tokenTargetCount: number;
  userId: string;
};

function requireBoundedId(value: string, label: string) {
  const normalized = value.trim();
  if (!/^[0-9A-Za-z._:-]{1,200}$/.test(normalized)) {
    throw new Error(`${label} must be a bounded identifier.`);
  }
  return normalized;
}

export async function precheckQaPushTarget(
  input: QaPushPrecheckInput,
  supabaseClient: SupabaseLike = createAdminClient()
): Promise<QaPushPrecheckResult> {
  const qaUserId = requireBoundedId(input.qaUserId, "qaUserId");
  const pushDeviceId = requireBoundedId(input.pushDeviceId, "pushDeviceId");

  const { data: activeDevices, error } = await supabaseClient
    .from("push_devices")
    .select("id,user_id,device_id,expo_push_token,native_push_token,platform,active")
    .eq("user_id", qaUserId)
    .eq("active", true)
    .not("expo_push_token", "is", null);

  if (error) {
    throw new Error(`Failed to precheck QA push devices: ${error.message}`);
  }

  const validActiveDevices = ((activeDevices ?? []) as QaPushDeviceRow[]).filter((device) =>
    isValidExpoPushToken(device.expo_push_token)
  );

  const target = validActiveDevices.find((device) => device.id === pushDeviceId);
  if (validActiveDevices.length !== 1 || !target) {
    throw new Error(
      `BLOCKED_SAFETY: expected exactly one active valid Expo push target for QA user and row ${pushDeviceId}; found ${validActiveDevices.length}.`
    );
  }
  const targetExpoPushToken = target.expo_push_token;
  if (!targetExpoPushToken) {
    throw new Error("BLOCKED_SAFETY: QA target has no Expo push token.");
  }

  const { data: tokenMatches, error: tokenError } = await supabaseClient
    .from("push_devices")
    .select("id,user_id,active")
    .eq("expo_push_token", targetExpoPushToken)
    .eq("active", true);

  if (tokenError) {
    throw new Error(`Failed to verify QA push token isolation: ${tokenError.message}`);
  }

  if ((tokenMatches ?? []).length !== 1 || tokenMatches[0]?.id !== pushDeviceId) {
    throw new Error(
      `BLOCKED_SAFETY: QA Expo push token is shared by ${(tokenMatches ?? []).length} active registrations.`
    );
  }

  return {
    active: target.active === true,
    deviceId: target.device_id ?? null,
    expoPushTokenValid: true,
    nativePushTokenPresent: typeof target.native_push_token === "string" && target.native_push_token.length > 0,
    platform: target.platform ?? null,
    pushDeviceId,
    tokenTargetCount: validActiveDevices.length,
    userId: qaUserId,
  };
}

export async function sendQaPushVerification(
  input: QaPushSendInput,
  supabaseClient: SupabaseLike = createAdminClient()
) {
  if (!input.allowRealPushSend) {
    throw new Error("BLOCKED_SAFETY: real QA push send requires allowRealPushSend=true.");
  }

  const precheck = await precheckQaPushTarget(input, supabaseClient);
  const notification = await createNotification(
    {
      userId: precheck.userId,
      type: QA_TEST_TYPE,
      title: QA_TEST_TITLE,
      body: QA_TEST_BODY,
      deepLink: null,
      payload: {
        qa: true,
        seam: "n04",
      },
    },
    supabaseClient
  );

  const sendResult = await sendNotificationToUser(
    notification.id,
    { providerAdapter: input.providerAdapter, targetPushDeviceId: precheck.pushDeviceId },
    supabaseClient
  );

  if (sendResult.deliveriesCount !== 1 || sendResult.sentCount !== 1) {
    throw new Error(
      `BLOCKED_SAFETY: expected exactly one sent delivery; got deliveries=${sendResult.deliveriesCount}, sent=${sendResult.sentCount}.`
    );
  }

  return {
    notification,
    precheck,
    sendResult,
  };
}

export async function processQaPushReceipt(
  notificationId: string,
  options: { providerAdapter?: PushProviderAdapter } = {},
  supabaseClient: SupabaseLike = createAdminClient()
) {
  const boundedNotificationId = requireBoundedId(notificationId, "notificationId");
  return processPushReceipts(
    {
      ...options,
      notificationId: boundedNotificationId,
    },
    supabaseClient
  );
}
