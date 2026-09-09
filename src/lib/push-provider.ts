export interface PushNotificationMessage {
  to: string; // Validated Expo push token (ExponentPushToken[...])
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
  expiration?: number;
}

export interface ExpoPushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: "DeviceNotRegistered" | "MessageTooLarge" | "MessageRateExceeded" | "InvalidCredentials" | string;
    [key: string]: unknown;
  };
}

export interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: "DeviceNotRegistered" | "MessageTooLarge" | "MessageRateExceeded" | "InvalidCredentials" | string;
    [key: string]: unknown;
  };
}

export interface ExpoPushReceiptsResponse {
  data: {
    [ticketId: string]: ExpoPushReceipt;
  };
}

export interface PushProviderAdapter {
  sendPushNotificationsBatch(
    messages: PushNotificationMessage[]
  ): Promise<ExpoPushTicket[]>;
  getPushNotificationReceipts(
    ticketIds: string[]
  ): Promise<{ [ticketId: string]: ExpoPushReceipt }>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const EXPO_CHUNK_LIMIT = 100;
const HTTP_TIMEOUT_MS = 10000;

export function isValidExpoPushToken(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return (
    (trimmed.startsWith("ExponentPushToken[") ||
      trimmed.startsWith("ExpoPushToken[")) &&
    trimmed.endsWith("]") &&
    trimmed.length <= 512
  );
}

export function sanitizeNotificationPayload(input: {
  body: string;
  deepLink?: string | null;
  imageUrl?: string | null;
  notificationId: string;
  payload?: Record<string, unknown> | null;
  title: string;
  type: string;
}): {
  body: string;
  data: Record<string, unknown>;
  title: string;
} {
  const safeTitle = (input.title || "").trim().substring(0, 200);
  const safeBody = (input.body || "").trim().substring(0, 1000);

  const safeData: Record<string, unknown> = {
    notificationId: input.notificationId,
    type: (input.type || "general").trim(),
  };

  if (input.deepLink && typeof input.deepLink === "string") {
    safeData.deepLink = input.deepLink.trim().substring(0, 500);
  }

  if (input.imageUrl && typeof input.imageUrl === "string") {
    safeData.imageUrl = input.imageUrl.trim().substring(0, 500);
  }

  if (input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)) {
    // Whitelist scalar & plain primitive fields only
    for (const [key, val] of Object.entries(input.payload)) {
      if (
        key !== "notificationId" &&
        key !== "type" &&
        key !== "deepLink" &&
        key !== "imageUrl"
      ) {
        if (
          typeof val === "string" ||
          typeof val === "number" ||
          typeof val === "boolean"
        ) {
          safeData[key] = val;
        }
      }
    }
  }

  return {
    title: safeTitle,
    body: safeBody,
    data: safeData,
  };
}

export class ExpoPushProviderAdapter implements PushProviderAdapter {
  async sendPushNotificationsBatch(
    messages: PushNotificationMessage[]
  ): Promise<ExpoPushTicket[]> {
    if (!messages.length) return [];

    const tickets: ExpoPushTicket[] = [];

    // Process in chunks of 100
    for (let i = 0; i < messages.length; i += EXPO_CHUNK_LIMIT) {
      const chunk = messages.slice(i, i + EXPO_CHUNK_LIMIT);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Expo Push API returned status ${response.status}: ${text}`);
        }

        const json = (await response.json()) as { data: ExpoPushTicket[] };
        if (Array.isArray(json.data)) {
          tickets.push(...json.data);
        } else {
          throw new Error("Invalid response format from Expo Push Service");
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Map entire chunk to error tickets for caller handling
        for (let j = 0; j < chunk.length; j++) {
          tickets.push({
            status: "error",
            message: `Expo Push HTTP request failed: ${errorMessage}`,
            details: { error: "ExpoPushFetchError" },
          });
        }
      }
    }

    return tickets;
  }

  async getPushNotificationReceipts(
    ticketIds: string[]
  ): Promise<{ [ticketId: string]: ExpoPushReceipt }> {
    if (!ticketIds.length) return {};

    const filteredIds = ticketIds.filter((id) => id && id.trim());
    if (!filteredIds.length) return {};

    const receipts: { [ticketId: string]: ExpoPushReceipt } = {};

    for (let i = 0; i < filteredIds.length; i += EXPO_CHUNK_LIMIT) {
      const chunk = filteredIds.slice(i, i + EXPO_CHUNK_LIMIT);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      try {
        const response = await fetch(EXPO_RECEIPTS_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: chunk }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Expo Push Receipts API returned status ${response.status}: ${text}`);
        }

        const json = (await response.json()) as ExpoPushReceiptsResponse;
        if (json.data && typeof json.data === "object") {
          Object.assign(receipts, json.data);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        // Fail open safely on network errors during receipt fetching
      }
    }

    return receipts;
  }
}
