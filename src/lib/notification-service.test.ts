import Module from "node:module";
import assert from "node:assert/strict";
import { before, test } from "node:test";

const NodeModule = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const originalLoad = NodeModule._load;

NodeModule._load = function (this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") {
    return { __esModule: true, default: undefined };
  }
  return originalLoad.call(this, request, parent, isMain);
};

import {
  ExpoPushProviderAdapter,
  isValidExpoPushToken,
  sanitizeNotificationPayload,
  type ExpoPushReceipt,
  type ExpoPushTicket,
  type PushNotificationMessage,
  type PushProviderAdapter,
} from "./push-provider";
let notificationServiceApi: typeof import("./notification-service");

before(async () => {
  notificationServiceApi = await import("./notification-service");
});

// Mock PushProviderAdapter for zero-send unit testing
class MockPushProviderAdapter implements PushProviderAdapter {
  sentMessages: PushNotificationMessage[] = [];
  mockTickets: ExpoPushTicket[] = [];
  mockReceipts: { [ticketId: string]: ExpoPushReceipt } = {};

  async sendPushNotificationsBatch(
    messages: PushNotificationMessage[]
  ): Promise<ExpoPushTicket[]> {
    this.sentMessages.push(...messages);
    if (this.mockTickets.length) {
      return this.mockTickets;
    }
    return messages.map((m, idx) => ({
      status: "ok",
      id: `ticket_mock_${idx + 1}`,
    }));
  }

  async getPushNotificationReceipts(
    ticketIds: string[]
  ): Promise<{ [ticketId: string]: ExpoPushReceipt }> {
    const result: { [ticketId: string]: ExpoPushReceipt } = {};
    for (const id of ticketIds) {
      if (this.mockReceipts[id]) {
        result[id] = this.mockReceipts[id];
      } else {
        result[id] = { status: "ok" };
      }
    }
    return result;
  }
}

test("isValidExpoPushToken validates token format strictly", () => {
  assert.equal(isValidExpoPushToken("ExponentPushToken[1234567890]"), true);
  assert.equal(isValidExpoPushToken("ExpoPushToken[abcdefghijk]"), true);
  assert.equal(isValidExpoPushToken("invalid_token_string"), false);
  assert.equal(isValidExpoPushToken("ExponentPushToken[]"), true); // minimal valid format
  assert.equal(isValidExpoPushToken(""), false);
  assert.equal(isValidExpoPushToken(null), false);
  assert.equal(isValidExpoPushToken(undefined), false);
});

test("sanitizeNotificationPayload strips untrusted/oversized content safely", () => {
  const result = sanitizeNotificationPayload({
    notificationId: "notif_123",
    type: "promotion",
    title: "  New Release Out Now!  ",
    body: "Check out Episode 5 today",
    deepLink: "/series/test-series",
    imageUrl: "https://cdn.example.com/poster.jpg",
    payload: {
      promoCode: "SUMMER2026",
      discount: 50,
      nestedObj: { invalid: true }, // nested non-primitive should be excluded
      trustedFlag: true,
    },
  });

  assert.equal(result.title, "New Release Out Now!");
  assert.equal(result.body, "Check out Episode 5 today");
  assert.equal(result.data.notificationId, "notif_123");
  assert.equal(result.data.type, "promotion");
  assert.equal(result.data.deepLink, "/series/test-series");
  assert.equal(result.data.imageUrl, "https://cdn.example.com/poster.jpg");
  assert.equal(result.data.promoCode, "SUMMER2026");
  assert.equal(result.data.discount, 50);
  assert.equal(result.data.trustedFlag, true);
  assert.equal("nestedObj" in result.data, false);
});

test("createNotification & sendNotificationToUser full lifecycle unit flow with mock adapter", async () => {
  // In-memory mock databases
  type NotificationRow = {
    body: string;
    created_at: string;
    deep_link: string | null;
    expires_at: string | null;
    id: string;
    image_url: string | null;
    payload: any;
    read_at: string | null;
    title: string;
    type: string;
    user_id: string;
  };

  type PushDeviceRow = {
    active: boolean;
    device_id: string;
    expo_push_token: string | null;
    id: string;
    last_seen_at: string;
    native_push_token: string | null;
    platform: string;
    user_id: string;
  };

  type DeliveryRow = {
    attempted_at: string;
    error_code: string | null;
    error_message: string | null;
    id: string;
    notification_id: string;
    provider: string;
    provider_ticket_id: string | null;
    push_device_id: string | null;
    receipt_checked_at: string | null;
    status: "PENDING" | "SENT" | "ACCEPTED" | "DELIVERED" | "FAILED" | "INVALID_TOKEN";
    user_id: string;
  };

  const notificationsDb: NotificationRow[] = [];
  const pushDevicesDb: PushDeviceRow[] = [
    {
      id: "dev_user1_active",
      user_id: "user_1",
      expo_push_token: "ExponentPushToken[valid_token_user1]",
      native_push_token: "fcm_token_1",
      platform: "android",
      device_id: "device_user1_1",
      active: true,
      last_seen_at: new Date().toISOString(),
    },
    {
      id: "dev_user1_inactive",
      user_id: "user_1",
      expo_push_token: "ExponentPushToken[inactive_token_user1]",
      native_push_token: null,
      platform: "android",
      device_id: "device_user1_2",
      active: false, // inactive device
      last_seen_at: new Date().toISOString(),
    },
    {
      id: "dev_user2_active",
      user_id: "user_2",
      expo_push_token: "ExponentPushToken[valid_token_user2]",
      native_push_token: null,
      platform: "android",
      device_id: "device_user2_1",
      active: true,
      last_seen_at: new Date().toISOString(),
    },
  ];
  const deliveriesDb: DeliveryRow[] = [];

  // Mock Supabase Client for tests
  const createMockSupabase = () => {
    return {
      from: (table: string) => {
        if (table === "notifications") {
          return {
            insert: (row: any) => {
              const newRow: NotificationRow = {
                id: `notif_${notificationsDb.length + 1}`,
                user_id: row.user_id,
                type: row.type,
                title: row.title,
                body: row.body,
                image_url: row.image_url ?? null,
                deep_link: row.deep_link ?? null,
                payload: row.payload ?? {},
                read_at: null,
                created_at: new Date().toISOString(),
                expires_at: row.expires_at ?? null,
              };
              notificationsDb.push(newRow);
              return {
                select: () => ({
                  single: async () => ({ data: newRow, error: null }),
                }),
              };
            },
            select: (cols: string) => ({
              eq: (col: string, val: any) => ({
                single: async () => {
                  const found = notificationsDb.find((n) => n.id === val);
                  return { data: found || null, error: found ? null : { message: "Not found" } };
                },
              }),
            }),
          };
        }

        if (table === "push_devices") {
          return {
            select: (cols: string) => ({
              eq: (col1: string, val1: any) => ({
                eq: (col2: string, val2: any) => ({
                  not: (col3: string, op: string, val3: any) => {
                    const filtered = pushDevicesDb.filter(
                      (d) =>
                        d.user_id === val1 &&
                        d.active === val2 &&
                        d.expo_push_token !== val3
                    );
                    return Promise.resolve({ data: filtered, error: null });
                  },
                }),
              }),
            }),
            update: (updates: any) => ({
              eq: (col: string, val: any) => {
                const device = pushDevicesDb.find((d) => d.id === val);
                if (device) {
                  Object.assign(device, updates);
                }
                return Promise.resolve({ data: device || null, error: null });
              },
            }),
          };
        }

        if (table === "notification_deliveries") {
          return {
            insert: (rows: any[]) => {
              const inserted: DeliveryRow[] = rows.map((r, idx) => {
                const delRow: DeliveryRow = {
                  id: `del_${deliveriesDb.length + idx + 1}`,
                  notification_id: r.notification_id,
                  user_id: r.user_id,
                  push_device_id: r.push_device_id,
                  provider: r.provider || "expo",
                  provider_ticket_id: null,
                  status: r.status || "PENDING",
                  error_code: null,
                  error_message: null,
                  attempted_at: r.attempted_at || new Date().toISOString(),
                  receipt_checked_at: null,
                };
                deliveriesDb.push(delRow);
                return delRow;
              });
              return {
                select: async () => ({ data: inserted, error: null }),
              };
            },
            update: (updates: any) => ({
              eq: (col: string, val: any) => {
                const del = deliveriesDb.find((d) => d.id === val);
                if (del) {
                  Object.assign(del, updates);
                }
                return Promise.resolve({ data: del || null, error: null });
              },
            }),
            select: (cols: string) => ({
              eq: (col: string, val: any) => ({
                not: (col2: string, op: string, val2: any) => ({
                  limit: (num: number) => {
                    const filtered = deliveriesDb.filter(
                      (d) => d.status === val && d.provider_ticket_id !== val2
                    );
                    return Promise.resolve({ data: filtered, error: null });
                  },
                }),
              }),
            }),
          };
        }

        throw new Error(`Unsupported mock table: ${table}`);
      },
    } as any;
  };

  const mockSupabase = createMockSupabase();
  const mockAdapter = new MockPushProviderAdapter();

  // 1. Create Notification for User 1
  const notification = await notificationServiceApi.createNotification(
    {
      userId: "user_1",
      type: "new_release",
      title: "New Episode Available",
      body: "Watch Episode 10 of Secret Romance now!",
      deepLink: "/series/secret-romance?ep=10",
    },
    mockSupabase
  );

  assert.equal(notification.user_id, "user_1");
  assert.equal(notificationsDb.length, 1);
  assert.equal(notificationsDb[0].title, "New Episode Available");

  // 2. Send Notification to User 1 (Only User 1's ACTIVE push devices are targeted)
  const sendResult = await notificationServiceApi.sendNotificationToUser(
    notification.id,
    { providerAdapter: mockAdapter },
    mockSupabase
  );

  assert.equal(sendResult.status, "ok");
  assert.equal(sendResult.deliveriesCount, 1);
  assert.equal(sendResult.sentCount, 1);

  // Verify only active device for user_1 was targeted (user_2 and inactive user_1 devices excluded)
  assert.equal(mockAdapter.sentMessages.length, 1);
  assert.equal(mockAdapter.sentMessages[0].to, "ExponentPushToken[valid_token_user1]");

  // Verify delivery record updated to SENT
  assert.equal(deliveriesDb.length, 1);
  assert.equal(deliveriesDb[0].status, "SENT");
  assert.equal(deliveriesDb[0].user_id, "user_1");
  assert.equal(deliveriesDb[0].provider_ticket_id, "ticket_mock_1");

  // 3. Process Receipts (DeviceNotRegistered terminal error scenario)
  mockAdapter.mockReceipts = {
    ticket_mock_1: {
      status: "error",
      message: "The device is no longer registered",
      details: { error: "DeviceNotRegistered" },
    },
  };

  const receiptResult = await notificationServiceApi.processPushReceipts(
    { providerAdapter: mockAdapter },
    mockSupabase
  );

  assert.equal(receiptResult.processedCount, 1);
  assert.equal(receiptResult.updatedCount, 1);

  // Delivery marked INVALID_TOKEN
  assert.equal(deliveriesDb[0].status, "INVALID_TOKEN");
  assert.equal(deliveriesDb[0].error_code, "DeviceNotRegistered");

  // Corresponding push_device deactivated automatically
  const targetDevice = pushDevicesDb.find((d) => d.id === "dev_user1_active");
  assert.equal(targetDevice?.active, false);

  // Notification feed row remains intact (never deleted on push failure)
  assert.equal(notificationsDb.length, 1);
});
