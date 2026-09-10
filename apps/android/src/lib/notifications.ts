let Application: typeof import("expo-application") | null = null;
try {
  Application = require("expo-application");
} catch {
  Application = null;
}
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {
  Notifications = null;
}
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { registerPushDeviceApi, deactivatePushDeviceApi } from "./api";

const DEVICE_ID_STORE_KEY = "0nya_push_device_id";
const DEFAULT_EAS_PROJECT_ID = "6d1467ba-a4db-42cc-b048-8ecc114f87fd";

// Configure default in-app foreground notification presentation behavior
try {
  Notifications?.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Safe fallback if environment does not support notification handler
}

/**
 * Retrieves or creates a stable, persistent device identifier.
 * Uses expo-secure-store and falls back to Application.getAndroidId() where available.
 */
export async function getStableDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_STORE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
  } catch {
    // SecureStore read fallback
  }

  let candidateId: string | null = null;

  if (Platform.OS === "android") {
    try {
      candidateId = Application?.getAndroidId?.() || null;
    } catch {
      candidateId = null;
    }
  }

  if (!candidateId) {
    candidateId = `device_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  try {
    await SecureStore.setItemAsync(DEVICE_ID_STORE_KEY, candidateId);
  } catch {
    // SecureStore write fallback
  }

  return candidateId;
}

import Constants from "expo-constants";

/**
 * Checks current notification permission status without prompting the user.
 */
export async function getNotificationPermissionStatus(): Promise<string> {
  try {
    if (!Notifications?.getPermissionsAsync) {
      return "undetermined";
    }
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  } catch {
    return "undetermined";
  }
}

/**
 * Controlled function to explicitly request notification permission from the user.
 * Do NOT call automatically on cold boot if user has not entered a consent flow.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (!Notifications?.getPermissionsAsync || !Notifications?.requestPermissionsAsync) {
      return false;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    return requested.granted;
  } catch {
    return false;
  }
}

export type NotificationPermissionState = {
  canAskAgain: boolean;
  status: string;
};

/**
 * Reads the current OS notification permission state from ONE Expo read.
 * This is the single bounded helper used by the Settings opt-in control.
 *
 * - never requests permission (read-only)
 * - fail-closed: if the module/API is unavailable or the read throws, the
 *   state is { status: "undetermined", canAskAgain: false } so callers never
 *   auto-retry or loop the OS prompt
 * - does not replace getNotificationPermissionStatus()/requestNotificationPermission()
 */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  try {
    if (!Notifications?.getPermissionsAsync) {
      return { status: "undetermined", canAskAgain: false };
    }
    const settings = await Notifications.getPermissionsAsync();
    return {
      status: settings.status,
      canAskAgain: settings.granted ? true : settings.canAskAgain === true,
    };
  } catch {
    return { status: "undetermined", canAskAgain: false };
  }
}

/**
 * Obtains Expo and native (FCM/APNs) push tokens safely.
 * Returns null tokens if permission is not granted or if push service is unavailable.
 */
export async function getPushTokens(devicePushToken?: import("expo-notifications").DevicePushToken): Promise<{
  expoPushToken: string | null;
  nativePushToken: string | null;
}> {
  const permissionStatus = await getNotificationPermissionStatus();

  if (permissionStatus !== "granted") {
    return { expoPushToken: null, nativePushToken: null };
  }

  let expoPushToken: string | null = null;
  let nativePushToken: string | null = null;

  // 1. Get Expo Push Token
  try {
    if (Notifications?.getExpoPushTokenAsync) {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        DEFAULT_EAS_PROJECT_ID;

      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken });
      if (tokenResult && tokenResult.data) {
        expoPushToken = tokenResult.data;
      }
    }
  } catch (err) {
    // Expected on emulators without FCM/Google Play services or network failure
    if (__DEV__) {
      console.info("[0nya notifications] Expo push token acquisition skipped or failed:", err instanceof Error ? err.message : String(err));
    }
  }

  // 2. Get Native Push Token (FCM/APNs) where supported
  try {
    if (Notifications?.getDevicePushTokenAsync) {
      const nativeTokenResult = devicePushToken ?? await Notifications.getDevicePushTokenAsync();
      if (nativeTokenResult && nativeTokenResult.data) {
        nativePushToken =
          typeof nativeTokenResult.data === "string"
            ? nativeTokenResult.data
            : JSON.stringify(nativeTokenResult.data);
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.info("[0nya notifications] Native push token acquisition skipped or failed:", err instanceof Error ? err.message : String(err));
    }
  }

  return { expoPushToken, nativePushToken };
}

/**
 * Registers / upserts device tokens against the backend for an authenticated user.
 */
export async function registerPushDeviceToken(
  accessToken?: string | null,
  devicePushToken?: import("expo-notifications").DevicePushToken,
): Promise<{
  success: boolean;
  device?: unknown;
  error?: string;
}> {
  if (!accessToken) return { success: false, error: "No access token" };
  const deviceId = await getStableDeviceId();
  const { expoPushToken, nativePushToken } = await getPushTokens(devicePushToken);

  const platform = Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : "web";

  try {
    const device = await registerPushDeviceApi(
      {
        active: true,
        deviceId,
        expoPushToken,
        nativePushToken,
        platform,
      },
      accessToken
    );

    return { success: true, device };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.warn("[0nya notifications] Device registration error:", message);
    }
    return { success: false, error: message };
  }
}

/**
 * Deactivates device token registration on sign-out.
 * Best-effort: failures are caught and returned, never thrown.
 */
export async function deactivatePushDeviceToken(accessToken?: string | null): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const deviceId = await getStableDeviceId();
    await deactivatePushDeviceApi(deviceId, accessToken);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.warn("[0nya notifications] Device deactivation error:", message);
    }
    return { success: false, error: message };
  }
}

/**
 * Tracks the access_token for which registration already succeeded.
 * Set only on success so network failures are retried on the next
 * authenticated-session event. Cleared on sign-out/user-switch.
 */
let lastRegisteredToken: string | null = null;

/**
 * Tracks an in-flight registration to prevent duplicate concurrent
 * calls for the same session (e.g. getSession + onAuthStateChange
 * firing back-to-back on cold start).
 */
let inFlightRegistrationToken: string | null = null;

/**
 * Listens for token refreshes emitted by Expo Push Service.
 * Captures the access_token at listener setup time to avoid stale closures
 * from a previous authenticated session.
 */
export function setupTokenRefreshListener(
  accessToken?: string | null,
  onTokenRefresh?: (token: string) => void
): () => void {
  try {
    if (!accessToken || !Notifications?.addPushTokenListener) {
      return () => {};
    }
    const capturedToken = accessToken ?? null;
    const subscription = Notifications.addPushTokenListener((tokenResult) => {
      if (tokenResult?.data) {
        if (onTokenRefresh) {
          onTokenRefresh(tokenResult.data);
        }
        // Android token reads emit this event too. Reuse the supplied token;
        // fetching it again here recursively triggers registration.
        void registerPushDeviceToken(capturedToken, tokenResult);
      }
    });

    return () => {
      subscription?.remove?.();
    };
  } catch {
    return () => {};
  }
}

/**
 * SINGLE LIFECYCLE OWNER — push device registration.
 *
 * Called when a valid authenticated session becomes active (session restore
 * or fresh sign-in). Requires:
 *   - access_token (authenticated)
 *   - notification permission granted by the user
 *
 * Permission is NOT requested automatically here. It is checked only.
 * The first intentional opt-in action that triggers
 * `requestNotificationPermission()` must come from a consumer UI action
 * (e.g., user taps a notification-toggle in Settings).
 *
 * Deduplication: skips sessions already registered successfully and
 * in-flight concurrent calls for the same session.
 *
 * Tolerates network failure: errors are caught and returned, never thrown,
 * so the app startup/auth flow never crashes.
 */
export async function handleAuthenticatedSession(accessToken?: string | null): Promise<{
  registered: boolean;
  error?: string;
}> {
  if (!accessToken) {
    return { registered: false, error: "No access token" };
  }

  // Deduplication guard: skip if this exact session already registered
  // successfully, or if a registration for it is already in flight.
  if (lastRegisteredToken === accessToken || inFlightRegistrationToken === accessToken) {
    return { registered: false };
  }
  inFlightRegistrationToken = accessToken;

  try {
    // Check permission state — do NOT prompt automatically.
    const permissionStatus = await getNotificationPermissionStatus();

    if (permissionStatus !== "granted") {
      // Registration deferred until user grants permission through an
      // intentional opt-in action. Not an error.
      return { registered: false };
    }

    // Permission granted — register this device.
    const result = await registerPushDeviceToken(accessToken);

    if (result.success) {
      lastRegisteredToken = accessToken;
      return { registered: true };
    }
    return { registered: false, error: result.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.warn("[0nya notifications] handleAuthenticatedSession error:", message);
    }
    return { registered: false, error: message };
  } finally {
    // Release the in-flight marker so failures are retried on the next
    // authenticated-session event and new sessions can register.
    if (inFlightRegistrationToken === accessToken) {
      inFlightRegistrationToken = null;
    }
  }
}

/**
 * SINGLE LIFECYCLE OWNER — push device deactivation.
 *
 * Called during sign-out, BEFORE Supabase destroys the authenticated session.
 * Best-effort deactivation: failures are caught and returned, never thrown,
 * so logout always completes regardless of push deactivation outcome.
 */
export async function handleSignOut(accessToken?: string | null): Promise<{
  deactivated: boolean;
  error?: string;
}> {
  if (!accessToken) {
    // Session already gone (e.g. SIGNED_OUT event from another surface):
    // nothing to deactivate, but the success marker belongs to the prior
    // identity and must be cleared so a later user registers fresh.
    lastRegisteredToken = null;
    return { deactivated: false };
  }

  try {
    const result = await deactivatePushDeviceToken(accessToken);
    // Clear success marker so a subsequent user/session registers fresh.
    if (result.success && lastRegisteredToken === accessToken) {
      lastRegisteredToken = null;
    }
    return { deactivated: result.success, error: result.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.warn("[0nya notifications] handleSignOut deactivation error:", message);
    }
    return { deactivated: false, error: message };
  }
}

/**
 * Resets push-lifecycle registration guards.
 * Test-only seam for deterministic harnesses; not called in production.
 */
export function resetPushLifecycleStateForTests(): void {
  lastRegisteredToken = null;
  inFlightRegistrationToken = null;
}

export type NotificationListenersOptions = {
  onNotificationReceived?: (notification: import("expo-notifications").Notification) => void;
  onNotificationResponseReceived?: (response: import("expo-notifications").NotificationResponse) => void;
};

type NotificationSubscription = { remove(): void };

/**
 * Wires safe foreground and tap listeners.
 * Logs/observes received notification without altering app UI or inventing routes.
 * Provides clean callback/deep-link seam for later N04/N05 work.
 */
export function setupNotificationListeners(options: NotificationListenersOptions = {}): () => void {
  let receivedSub: NotificationSubscription | null = null;
  let responseSub: NotificationSubscription | null = null;

  try {
    if (!Notifications?.addNotificationReceivedListener || !Notifications?.addNotificationResponseReceivedListener) {
      return () => {};
    }

    receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      if (__DEV__) {
        console.info("[0nya notification received in foreground]", {
          id: notification?.request?.identifier,
          title: notification?.request?.content?.title,
          body: notification?.request?.content?.body,
          data: notification?.request?.content?.data,
        });
      }

      if (options.onNotificationReceived) {
        options.onNotificationReceived(notification);
      }
    });

    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      const deepLink = typeof data?.deep_link === "string" ? data.deep_link : null;

      if (__DEV__) {
        console.info("[0nya notification tap response]", {
          actionIdentifier: response?.actionIdentifier,
          deepLink,
          data,
        });
      }

      if (options.onNotificationResponseReceived) {
        options.onNotificationResponseReceived(response);
      }
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[0nya notifications] Failed to register notification listeners:", err);
    }
  }

  return () => {
    receivedSub?.remove?.();
    responseSub?.remove?.();
  };
}
