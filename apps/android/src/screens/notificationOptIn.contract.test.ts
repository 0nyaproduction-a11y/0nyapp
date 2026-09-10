// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";

/**
 * NOTIFICATION OPT-IN UX contract tests (STATIC_CONTRACT).
 *
 * Classification: STATIC_CONTRACT. These tests statically verify the
 * production wiring contract in the touched source files:
 *
 *   apps/android/src/lib/notifications.ts        — permission state helper
 *   apps/android/src/screens/SettingsScreen.tsx  — Settings opt-in control
 *
 * The Expo push stack (expo-notifications, SecureStore, react-native) is not
 * importable in a Node harness, so these do NOT execute Expo/push code. They
 * prove the integration contract against current source only and must not be
 * overstated as runtime proof.
 */
// @ts-expect-error see note above for node:fs
import { readFileSync } from "node:fs";
// @ts-expect-error see note above for node:path
import { dirname, join } from "node:path";
// @ts-expect-error see note above for node:url
import { fileURLToPath } from "node:url";

// @ts-expect-error runtime value from node:url
const here = dirname(fileURLToPath(import.meta.url));
const settingsSource = readFileSync(join(here, "SettingsScreen.tsx"), "utf8");
const notificationsSource = readFileSync(join(here, "..", "lib", "notifications.ts"), "utf8");
const authContextSource = readFileSync(join(here, "..", "lib", "authContext.tsx"), "utf8");
const pushLifecycleContractSource = readFileSync(
  join(here, "..", "lib", "pushLifecycle.contract.test.ts"),
  "utf8",
);

test("startup/session lifecycle never requests permission (contract)", () => {
  assert.ok(
    !authContextSource.includes("requestNotificationPermission"),
    "authContext must never request notification permission",
  );
  assert.ok(
    !notificationsSource.includes("void requestNotificationPermission()"),
    "lifecycle owner must not auto-request permission",
  );
    assert.ok(
    notificationsSource.includes("export async function handleAuthenticatedSession"),
    "handleAuthenticatedSession must remain the single lifecycle owner",
  );
});

test("explicit signed-in user action can request permission (contract)", () => {
  assert.ok(
    settingsSource.includes("handleEnableNotifications"),
    "Settings must expose a single explicit user tap handler",
  );
  assert.ok(
    settingsSource.includes("requestNotificationPermission()"),
    "the explicit handler must be able to request permission once",
  );
  assert.ok(
    settingsSource.includes("if (isRequestingNotificationPermission)"),
    "the handler must be re-entry guarded",
  );
});

test("guest action does NOT request OS permission (contract)", () => {
  const guestRow = settingsSource.slice(
    settingsSource.indexOf("settings.notifications_guest_detail"),
    settingsSource.indexOf("settings.notifications_guest_value") + 60,
  );
  assert.ok(
    settingsSource.includes('"Sign in to enable notifications"'),
    "guest row must say Sign in to enable notifications",
  );
  assert.ok(
    !guestRow.includes("requestPermission"),
    "guest row must not invoke requestPermission within its own branch",
  );
});
test("guest action does NOT register a push device (contract)", () => {
  const handler = settingsSource.slice(
    settingsSource.indexOf("const handleEnableNotifications"),
    settingsSource.indexOf("const handleMissingDestination"),
  );
  assert.ok(
    handler.includes("if (!currentAccessToken)"),
    "handler must branch on the absence of a live access token",
  );
  assert.ok(
    handler.includes("navigateToSignIn"),
    "guest path must use the existing sign-in navigation helper",
  );
  assert.ok(
    !handler.slice(0, handler.indexOf("if (notificationOsState")).includes(
      "handleAuthenticatedSession",
    ),
    "guest path must not route into registration",
  );
});

test("blocked path routes to device settings and never re-requests (contract)", () => {
  const handler = settingsSource.slice(
    settingsSource.indexOf("const handleEnableNotifications"),
    settingsSource.indexOf("const handleMissingDestination"),
  );
  assert.ok(
    handler.includes("handleOpenDeviceSettings"),
    "blocked path must route to the existing device settings opener",
  );
  assert.ok(
    handler.includes("canAskAgain"),
    "blocked state must be derived from canAskAgain via the bounded helper",
  );
});

test("permission state helper is a single bounded read that fails closed (contract)", () => {
  assert.ok(
    notificationsSource.includes("export async function getNotificationPermissionState"),
    "a single bounded permission state helper must exist",
  );
  const helper = notificationsSource.slice(
    notificationsSource.indexOf("export async function getNotificationPermissionState"),
    notificationsSource.indexOf("export type NotificationListenersOptions"),
  );
  assert.ok(helper.includes("canAskAgain:"), "helper must return canAskAgain");
  assert.ok(
    helper.includes('"undetermined", canAskAgain: false'),
    "helper must fail closed on missing module / exception",
  );
  assert.ok(!helper.includes("requestPermissionsAsync"), "state read must never request permission");
});


test("granted status routes through the existing lifecycle owner and dedupes (contract)", () => {
  const handler = settingsSource.slice(
    settingsSource.indexOf("const handleEnableNotifications"),
    settingsSource.indexOf("const handleMissingDestination"),
  );
  assert.ok(
    handler.includes("handleAuthenticatedSession(currentAccessToken)"),
    "granted refresh must call the existing lifecycle owner",
  );
  assert.ok(
    notificationsSource.includes("lastRegisteredToken === accessToken"),
    "registration dedupe guard must remain intact",
  );
  assert.ok(
    notificationsSource.includes("inFlightRegistrationToken === accessToken"),
    "in-flight dedupe guard must remain intact",
  );
});

test("denied permission does not register (contract)", () => {
  const owner = notificationsSource.slice(
    notificationsSource.indexOf("export async function handleAuthenticatedSession"),
    notificationsSource.indexOf("export async function handleSignOut"),
  );
    assert.ok(
    owner.includes('permissionStatus !== "granted"'),
    "registration must be gated on granted permission",
  );
  const handler = settingsSource.slice(
    settingsSource.indexOf("const handleEnableNotifications"),
    settingsSource.indexOf("const handleMissingDestination"),
  );
  assert.ok(
    handler.includes("requestNotificationPermission()"),
    "handler must be able to request permission on explicit intent",
  );
});

test("no stale auth token stored in Settings state (contract)", () => {
  assert.ok(
    settingsSource.includes("session?.access_token"),
    "Settings must read the live session access token only",
  );
});

test("push lifecycle contract remains intact (contract)", () => {
  assert.ok(
    pushLifecycleContractSource.includes("sign-out attempts deactivation before auth loss"),
    "push lifecycle contract tests must still be present",
  );
  assert.ok(
    notificationsSource.includes("export async function handleSignOut"),
    "handleSignOut must remain exported",
  );
});
