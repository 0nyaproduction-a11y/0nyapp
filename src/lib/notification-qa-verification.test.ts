import Module from "node:module";
import assert from "node:assert/strict";
import { before, test } from "node:test";
import type {
  ExpoPushReceipt,
  ExpoPushTicket,
  PushNotificationMessage,
  PushProviderAdapter,
} from "./push-provider";

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

let qaApi: typeof import("./notification-qa-verification");

before(async () => {
  qaApi = await import("./notification-qa-verification");
});

type MockRow = Record<string, unknown>;

class MockProvider implements PushProviderAdapter {
  messages: PushNotificationMessage[] = [];
  tickets: ExpoPushTicket[] = [{ status: "ok", id: "ticket_n04_1" }];
  receipts: Record<string, ExpoPushReceipt> = { ticket_n04_1: { status: "ok" } };

  async sendPushNotificationsBatch(messages: PushNotificationMessage[]) {
    this.messages.push(...messages);
    return this.tickets;
  }

  async getPushNotificationReceipts(ticketIds: string[]) {
    return Object.fromEntries(ticketIds.map((id) => [id, this.receipts[id] ?? { status: "ok" }]));
  }
}

function createMockSupabase(options: { extraActiveDevice?: boolean } = {}) {
  const notifications: MockRow[] = [];
  const deliveries: MockRow[] = [];
  const pushDevices: MockRow[] = [
    {
      id: "push_device_row_qa",
      user_id: "qa_user",
      device_id: "stable_device_qa",
      expo_push_token: "ExponentPushToken[qa_valid]",
      native_push_token: "native_qa",
      platform: "android",
      active: true,
    },
    {
      id: "push_device_row_other",
      user_id: "other_user",
      device_id: "stable_device_other",
      expo_push_token: "ExponentPushToken[other_valid]",
      native_push_token: null,
      platform: "android",
      active: true,
    },
  ];

  if (options.extraActiveDevice) {
    pushDevices.push({
      id: "push_device_row_qa_extra",
      user_id: "qa_user",
      device_id: "stable_device_qa_extra",
      expo_push_token: "ExponentPushToken[qa_extra]",
      native_push_token: null,
      platform: "android",
      active: true,
    });
  }

  const client = {
    from(table: string) {
      if (table === "push_devices") {
        return {
          select() {
            const filters: Array<(row: MockRow) => boolean> = [];
            type PushDevicesSelectQuery = {
              eq(column: string, value: unknown): PushDevicesSelectQuery;
              not(column: string, operator: string, value: unknown): Promise<{ data: MockRow[]; error: null }>;
              then<TResult>(
                resolve: (value: { data: MockRow[]; error: null }) => TResult | PromiseLike<TResult>
              ): Promise<TResult>;
            };
            const query: PushDevicesSelectQuery = {
              eq(column: string, value: unknown) {
                filters.push((row) => row[column] === value);
                return query;
              },
              not(column: string, operator: string, value: unknown) {
                if (operator === "is" && value === null) {
                  filters.push((row) => row[column] !== null);
                }
                return Promise.resolve({ data: pushDevices.filter((row) => filters.every((filter) => filter(row))), error: null });
              },
              then<TResult>(
                resolve: (value: { data: MockRow[]; error: null }) => TResult | PromiseLike<TResult>
              ) {
                return Promise.resolve({
                  data: pushDevices.filter((row) => filters.every((filter) => filter(row))),
                  error: null,
                }).then(resolve);
              },
            };
            return query;
          },
          update(updates: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                const device = pushDevices.find((row) => (row as Record<string, unknown>)[column] === value);
                if (device) Object.assign(device, updates);
                return Promise.resolve({ data: device ? [device] : [], error: null });
              },
            };
          },
        };
      }

      if (table === "notifications") {
        return {
          insert(row: MockRow) {
            const inserted = {
              id: `notification_${notifications.length + 1}`,
              read_at: null,
              created_at: new Date().toISOString(),
              ...row,
            };
            notifications.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  single: async () => ({
                    data: notifications.find((row) => row[column] === value) ?? null,
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === "notification_deliveries") {
        return {
          insert(rows: MockRow[]) {
            const inserted = rows.map((row) => ({
              id: `delivery_${deliveries.length + 1}`,
              provider_ticket_id: null,
              error_code: null,
              error_message: null,
              receipt_checked_at: null,
              ...row,
            }));
            deliveries.push(...inserted);
            return {
              select: async () => ({ data: inserted, error: null }),
            };
          },
          update(updates: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                const row = deliveries.find((delivery) => delivery[column] === value);
                if (row) Object.assign(row, updates);
                return Promise.resolve({ data: row ? [row] : [], error: null });
              },
            };
          },
          select() {
            const filters: Array<(row: MockRow) => boolean> = [];
            type DeliveriesSelectQuery = {
              eq(column: string, value: unknown): DeliveriesSelectQuery;
              not(column: string, operator: string, value: unknown): DeliveriesSelectQuery;
              limit(): Promise<{ data: MockRow[]; error: null }>;
            };
            const query: DeliveriesSelectQuery = {
              eq(column: string, value: unknown) {
                filters.push((row) => row[column] === value);
                return query;
              },
              not(column: string, operator: string, value: unknown) {
                if (operator === "is" && value === null) {
                  filters.push((row) => row[column] !== null);
                }
                return query;
              },
              limit() {
                return Promise.resolve({ data: deliveries.filter((row) => filters.every((filter) => filter(row))), error: null });
              },
            };
            return query;
          },
        };
      }

      throw new Error(`Unsupported table ${table}`);
    },
    state: { deliveries, notifications, pushDevices },
  };

  return client as unknown as typeof client & Parameters<typeof qaApi.precheckQaPushTarget>[1];
}

test("N04 precheck requires exactly one active QA target and matching push device row", async () => {
  const client = createMockSupabase();
  const result = await qaApi.precheckQaPushTarget(
    { qaUserId: "qa_user", pushDeviceId: "push_device_row_qa" },
    client
  );

  assert.equal(result.tokenTargetCount, 1);
  assert.equal(result.pushDeviceId, "push_device_row_qa");
  assert.equal(result.expoPushTokenValid, true);
  assert.equal(result.nativePushTokenPresent, true);
});

test("N04 precheck blocks ambiguous QA user targets before send", async () => {
  const client = createMockSupabase({ extraActiveDevice: true });

  await assert.rejects(
    () => qaApi.precheckQaPushTarget({ qaUserId: "qa_user", pushDeviceId: "push_device_row_qa" }, client),
    /BLOCKED_SAFETY/
  );
});

test("N04 send seam refuses real push without explicit allow flag", async () => {
  const client = createMockSupabase();

  await assert.rejects(
    () =>
      qaApi.sendQaPushVerification(
        { qaUserId: "qa_user", pushDeviceId: "push_device_row_qa", allowRealPushSend: false },
        client
      ),
    /allowRealPushSend=true/
  );
});

test("N04 send seam creates one QA_TEST notification and one delivery only for the QA device", async () => {
  const client = createMockSupabase();
  const provider = new MockProvider();

  const result = await qaApi.sendQaPushVerification(
    {
      qaUserId: "qa_user",
      pushDeviceId: "push_device_row_qa",
      allowRealPushSend: true,
      providerAdapter: provider,
    },
    client
  );

  assert.equal(result.notification.type, "QA_TEST");
  assert.equal(result.notification.title, "0nya notification test");
  assert.equal(result.sendResult.deliveriesCount, 1);
  assert.equal(result.sendResult.sentCount, 1);
  assert.equal(provider.messages.length, 1);
  assert.equal(provider.messages[0].to, "ExponentPushToken[qa_valid]");
  assert.equal(client.state.deliveries.length, 1);
  assert.equal(client.state.deliveries[0].push_device_id, "push_device_row_qa");
  assert.equal(client.state.deliveries[0].provider_ticket_id, "ticket_n04_1");
});

test("N04 receipt processing can be constrained to the QA notification", async () => {
  const client = createMockSupabase();
  const provider = new MockProvider();
  const result = await qaApi.sendQaPushVerification(
    {
      qaUserId: "qa_user",
      pushDeviceId: "push_device_row_qa",
      allowRealPushSend: true,
      providerAdapter: provider,
    },
    client
  );

  const receiptResult = await qaApi.processQaPushReceipt(
    result.notification.id,
    { providerAdapter: provider },
    client
  );

  assert.equal(receiptResult.processedCount, 1);
  assert.equal(receiptResult.updatedCount, 1);
  assert.equal(client.state.deliveries[0].status, "DELIVERED");
  assert.equal(client.state.pushDevices[0].active, true);
});
