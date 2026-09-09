import { createAdminClient } from "@/lib/supabase/admin";
import {
  ExpoPushProviderAdapter,
  isValidExpoPushToken,
  sanitizeNotificationPayload,
  type PushNotificationMessage,
  type PushProviderAdapter,
} from "./push-provider";
import {
  adaptNotificationObservation,
  runNotificationObservationFailOpen,
} from "./observation/notifications";
import type { Database, Json } from "@/types/database";

type NotificationSupabaseClient = ReturnType<typeof createAdminClient>;
type PushDeviceRow = Database["public"]["Tables"]["push_devices"]["Row"];

export interface CreateNotificationInput {
  body: string;
  deepLink?: string | null;
  expiresAt?: string | null;
  imageUrl?: string | null;
  payload?: Record<string, Json | undefined> | null;
  title: string;
  type: string;
  userId: string;
}

export interface NotificationServiceOptions {
  notificationId?: string;
  providerAdapter?: PushProviderAdapter;
  targetPushDeviceId?: string;
}

/**
 * Creates a persistent notification row in public.notifications for a specific user.
 * Row is created before any push delivery attempt.
 */
export async function createNotification(
  input: CreateNotificationInput,
  supabaseClient?: NotificationSupabaseClient
) {
  const client = supabaseClient || createAdminClient();
  if (!input.userId) {
    throw new Error("userId is required for createNotification");
  }

  const sanitized = sanitizeNotificationPayload({
    body: input.body,
    deepLink: input.deepLink,
    imageUrl: input.imageUrl,
    notificationId: "pending",
    payload: input.payload,
    title: input.title,
    type: input.type,
  });

  const { data, error } = await client
    .from("notifications")
    .insert({
      user_id: input.userId,
      type: (input.type || "general").trim(),
      title: sanitized.title,
      body: sanitized.body,
      image_url: input.imageUrl ?? null,
      deep_link: input.deepLink ?? null,
      payload: input.payload ?? {},
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification feed row: ${error.message}`);
  }

  // Emit NOTIFICATION_QUEUED observation event safely
  const obs = adaptNotificationObservation(
    {
      eventType: "NOTIFICATION_QUEUED",
      authority: "provider",
      channel: "push",
      occurredAt: new Date().toISOString(),
      notificationId: data.id,
      correlationId: `notif_queue_${data.id}`,
    },
    {
      observationId: `obs_queue_${data.id}_${Date.now()}`,
      actorId: input.userId,
      source: "notification_service",
    }
  );

  if (obs.ok) {
    runNotificationObservationFailOpen(Promise.resolve(obs.value));
  }

  return data;
}

/**
 * Batch creates persistent notifications for multiple users.
 */
export async function createNotificationsForUsers(
  inputs: CreateNotificationInput[],
  supabaseClient?: NotificationSupabaseClient
) {
  if (!inputs.length) return [];

  const createdList = [];
  for (const input of inputs) {
    const created = await createNotification(input, supabaseClient);
    createdList.push(created);
  }

  return createdList;
}

/**
 * Sends a push notification for an existing persistent notification row to all active,
 * push-token-enabled devices owned by that specific user.
 */
export async function sendNotificationToUser(
  notificationId: string,
  options: NotificationServiceOptions = {},
  supabaseClient?: NotificationSupabaseClient
) {
  const client = supabaseClient || createAdminClient();
  const adapter = options.providerAdapter || new ExpoPushProviderAdapter();

  // 1. Fetch notification
  const { data: notification, error: notifError } = await client
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (notifError || !notification) {
    throw new Error(`Notification not found: ${notificationId}`);
  }

  // 2. Fetch active push devices for this user with valid Expo tokens
  const { data: devices, error: deviceError } = await client
    .from("push_devices")
    .select("*")
    .eq("user_id", notification.user_id)
    .eq("active", true)
    .not("expo_push_token", "is", null);

  if (deviceError) {
    throw new Error(`Failed to fetch push devices: ${deviceError.message}`);
  }

  const validDevices = (devices || [])
    .filter(
    (d: PushDeviceRow) => d.expo_push_token && isValidExpoPushToken(d.expo_push_token)
    )
    .filter((d: PushDeviceRow) => !options.targetPushDeviceId || d.id === options.targetPushDeviceId);

  if (!validDevices.length) {
    return {
      notificationId,
      userId: notification.user_id,
      deliveriesCount: 0,
      status: "no_active_devices",
    };
  }

  if (options.targetPushDeviceId && validDevices.length !== 1) {
    throw new Error(`Expected exactly one target push device for notification ${notificationId}.`);
  }

  // 3. Prepare payload and messages
  const sanitized = sanitizeNotificationPayload({
    notificationId: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    imageUrl: notification.image_url,
    deepLink: notification.deep_link,
    payload: notification.payload as Record<string, unknown>,
  });

  const messages: PushNotificationMessage[] = [];
  const deliveryRows = [];

  for (const device of validDevices) {
    messages.push({
      to: device.expo_push_token!,
      title: sanitized.title,
      body: sanitized.body,
      data: sanitized.data,
      sound: "default",
    });

    deliveryRows.push({
      notification_id: notification.id,
      user_id: notification.user_id,
      push_device_id: device.id,
      provider: "expo",
      status: "PENDING" as const,
      attempted_at: new Date().toISOString(),
    });
  }

  // 4. Create initial PENDING delivery rows (idempotency & audit record)
  const { data: insertedDeliveries, error: deliveryInsertErr } = await client
    .from("notification_deliveries")
    .insert(deliveryRows)
    .select();

  if (deliveryInsertErr || !insertedDeliveries) {
    throw new Error(`Failed to insert delivery records: ${deliveryInsertErr?.message}`);
  }

  // 5. Execute push send via adapter
  let tickets;
  try {
    tickets = await adapter.sendPushNotificationsBatch(messages);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Mark delivery rows as FAILED without deactivating push tokens (transient error)
    for (const del of insertedDeliveries) {
      await client
        .from("notification_deliveries")
        .update({
          status: "FAILED",
          error_code: "PROVIDER_TRANSIENT_ERROR",
          error_message: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", del.id);
    }
    return {
      notificationId,
      userId: notification.user_id,
      deliveriesCount: insertedDeliveries.length,
      status: "provider_error",
      error: errorMsg,
    };
  }

  // 6. Process tickets & update delivery records
  const now = new Date().toISOString();
  let successCount = 0;

  for (let i = 0; i < insertedDeliveries.length; i++) {
    const del = insertedDeliveries[i];
    const ticket = tickets[i];
    const device = validDevices[i];

    if (!ticket) {
      await client
        .from("notification_deliveries")
        .update({
          status: "FAILED",
          error_code: "NO_TICKET_RETURNED",
          updated_at: now,
        })
        .eq("id", del.id);
      continue;
    }

    if (ticket.status === "ok") {
      successCount++;
      await client
        .from("notification_deliveries")
        .update({
          status: "SENT",
          provider_ticket_id: ticket.id || null,
          updated_at: now,
        })
        .eq("id", del.id);

      // Emit provider-confirmed NOTIFICATION_SENT evidence event
      const obs = adaptNotificationObservation(
        {
          eventType: "NOTIFICATION_SENT",
          authority: "provider",
          channel: "push",
          occurredAt: now,
          notificationId: notification.id,
          messageId: ticket.id || del.id,
          correlationId: `notif_sent_${del.id}`,
        },
        {
          observationId: `obs_sent_${del.id}_${Date.now()}`,
          actorId: notification.user_id,
          source: "expo_push_provider",
        }
      );

      if (obs.ok) {
        runNotificationObservationFailOpen(Promise.resolve(obs.value));
      }
    } else {
      // Ticket returned error
      const errorCode = ticket.details?.error || "EXPO_TICKET_ERROR";
      const errorMessage = ticket.message || "Push ticket rejected by Expo";

      if (errorCode === "DeviceNotRegistered") {
        // Terminal token error: mark delivery INVALID_TOKEN & deactivate push_device
        await client
          .from("notification_deliveries")
          .update({
            status: "INVALID_TOKEN",
            error_code: errorCode,
            error_message: errorMessage,
            updated_at: now,
          })
          .eq("id", del.id);

        await client
          .from("push_devices")
          .update({ active: false, updated_at: now })
          .eq("id", device.id);
      } else {
        // Transient/other ticket error: mark FAILED without deactivating push_device
        await client
          .from("notification_deliveries")
          .update({
            status: "FAILED",
            error_code: errorCode,
            error_message: errorMessage,
            updated_at: now,
          })
          .eq("id", del.id);
      }
    }
  }

  return {
    notificationId,
    userId: notification.user_id,
    deliveriesCount: insertedDeliveries.length,
    sentCount: successCount,
    status: "ok",
  };
}

/**
 * Sends a notification batch across multiple notifications.
 */
export async function sendNotificationBatch(
  notificationIds: string[],
  options: NotificationServiceOptions = {},
  supabaseClient?: NotificationSupabaseClient
) {
  const results = [];
  for (const id of notificationIds) {
    const res = await sendNotificationToUser(id, options, supabaseClient);
    results.push(res);
  }
  return results;
}

/**
 * Processes receipts for sent tickets to update delivery status and deactivate invalid tokens.
 * Idempotent.
 */
export async function processPushReceipts(
  options: NotificationServiceOptions = {},
  supabaseClient?: NotificationSupabaseClient
) {
  const client = supabaseClient || createAdminClient();
  const adapter = options.providerAdapter || new ExpoPushProviderAdapter();

  // Fetch pending delivery tickets with status 'SENT' and non-null provider_ticket_id
  let receiptQuery = client
    .from("notification_deliveries")
    .select("*")
    .eq("status", "SENT")
    .not("provider_ticket_id", "is", null);

  if (options.notificationId) {
    receiptQuery = receiptQuery.eq("notification_id", options.notificationId);
  }

  const { data: deliveries, error } = await receiptQuery.limit(500);

  if (error) {
    throw new Error(`Failed to fetch deliveries for receipt processing: ${error.message}`);
  }

  if (!deliveries || !deliveries.length) {
    return { processedCount: 0, updatedCount: 0 };
  }

  const ticketMap = new Map<string, typeof deliveries[0]>();
  for (const d of deliveries) {
    if (d.provider_ticket_id) {
      ticketMap.set(d.provider_ticket_id, d);
    }
  }

  const ticketIds = Array.from(ticketMap.keys());
  const receipts = await adapter.getPushNotificationReceipts(ticketIds);

  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const [ticketId, receipt] of Object.entries(receipts)) {
    const delivery = ticketMap.get(ticketId);
    if (!delivery) continue;

    if (receipt.status === "ok") {
      await client
        .from("notification_deliveries")
        .update({
          status: "DELIVERED",
          receipt_checked_at: now,
          updated_at: now,
        })
        .eq("id", delivery.id);

      updatedCount++;

      // Emit provider-confirmed NOTIFICATION_DELIVERED evidence event
      const obs = adaptNotificationObservation(
        {
          eventType: "NOTIFICATION_DELIVERED",
          authority: "provider",
          channel: "push",
          occurredAt: now,
          notificationId: delivery.notification_id,
          messageId: ticketId,
          correlationId: `notif_del_${delivery.id}`,
        },
        {
          observationId: `obs_del_${delivery.id}_${Date.now()}`,
          actorId: delivery.user_id,
          source: "expo_receipt_processor",
        }
      );

      if (obs.ok) {
        runNotificationObservationFailOpen(Promise.resolve(obs.value));
      }
    } else {
      const errorCode = receipt.details?.error || "EXPO_RECEIPT_ERROR";
      const errorMessage = receipt.message || "Receipt error from Expo";

      if (errorCode === "DeviceNotRegistered") {
        await client
          .from("notification_deliveries")
          .update({
            status: "INVALID_TOKEN",
            error_code: errorCode,
            error_message: errorMessage,
            receipt_checked_at: now,
            updated_at: now,
          })
          .eq("id", delivery.id);

        if (delivery.push_device_id) {
          await client
            .from("push_devices")
            .update({ active: false, updated_at: now })
            .eq("id", delivery.push_device_id);
        }
      } else {
        await client
          .from("notification_deliveries")
          .update({
            status: "FAILED",
            error_code: errorCode,
            error_message: errorMessage,
            receipt_checked_at: now,
            updated_at: now,
          })
          .eq("id", delivery.id);
      }

      updatedCount++;
    }
  }

  return {
    processedCount: ticketIds.length,
    updatedCount,
  };
}
