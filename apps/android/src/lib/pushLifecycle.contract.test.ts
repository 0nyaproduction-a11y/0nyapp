// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";

/**
 * PUSH-INTEGRATION-01 lifecycle contract tests (STATIC_CONTRACT).
 *
 * The Expo push stack (expo-notifications, SecureStore, react-native) is
 * not importable in a Node test harness, so these tests statically verify
 * the production wiring contract in the touched source files:
 *
 *   apps/android/src/lib/notifications.ts — single lifecycle owner
 *   apps/android/src/lib/authContext.tsx — session/sign-out wiring
 *   apps/android/src/lib/api.ts — established device contract
 *
 * Classification: STATIC_CONTRACT — they prove the integration contract
 * against current source; they do not execute Expo or React code.
 */
// @ts-expect-error see note above for node:fs
import { readFileSync } from "node:fs";
// @ts-expect-error see note above for node:path
import { dirname, join } from "node:path";
// @ts-expect-error see note above for node:url
import { fileURLToPath } from "node:url";

// @ts-expect-error runtime value from node:url
const here = dirname(fileURLToPath(import.meta.url));
const notificationsSource = readFileSync(join(here, "notifications.ts"), "utf8");
const authContextSource = readFileSync(join(here, "authContext.tsx"), "utf8");
const apiSource = readFileSync(join(here, "api.ts"), "utf8");

test("authenticated restored session registers device (contract)", () => {
  assert.ok(
    authContextSource.includes("void handleAuthenticatedSession(data.session.access_token)"),
    "session restoration must call handleAuthenticatedSession with the restored access token",
  );
  assert.ok(
    notificationsSource.includes("export async function handleAuthenticatedSession"),
    "handleAuthenticatedSession must be the lifecycle owner",
  );
  assert.ok(
    notificationsSource.includes("await registerPushDeviceToken(accessToken)"),
    "authenticated session must register via registerPushDeviceToken",
  );
});

test("authenticated sign-in registers device (contract)", () => {
  const signInBlock = authContextSource.slice(
    authContextSource.indexOf("async signIn("),
    authContextSource.indexOf("async signOut("),
  );
  assert.ok(signInBlock.length > 0, "signIn block must exist");
  assert.ok(
    signInBlock.includes("void handleAuthenticatedSession(accessToken)"),
    "signIn must call handleAuthenticatedSession with the fresh session token",
  );
  assert.ok(
    authContextSource.includes("if (nextSession?.access_token)"),
    "onAuthStateChange must route new sessions into registration",
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
  assert.ok(
    !owner.includes("requestNotificationPermission()"),
    "lifecycle owner must check permission, never auto-request it",
  );
});

test("token refresh re-registers current user (contract)", () => {
  const listener = notificationsSource.slice(
    notificationsSource.indexOf("export function setupTokenRefreshListener"),
    notificationsSource.indexOf("export async function handleAuthenticatedSession"),
  );
  assert.ok(
    listener.includes("const capturedToken = accessToken ?? null"),
    "refresh listener must capture the access token at setup time",
  );
  assert.ok(
    listener.includes("void registerPushDeviceToken(capturedToken, tokenResult)"),
    "refresh callback must re-register with the captured (current-session) token",
  );
});

test("sign-out attempts deactivation before auth loss (contract)", () => {
  const signOutBlock = authContextSource.slice(authContextSource.indexOf("async signOut()"));
  const handleCall = signOutBlock.indexOf("await handleSignOut(session.access_token)");
  const destroyCall = signOutBlock.indexOf("supabase.auth.signOut()");
  assert.ok(handleCall >= 0, "signOut must call handleSignOut");
  assert.ok(destroyCall >= 0, "signOut must destroy the session");
  assert.ok(
    handleCall < destroyCall,
    "deactivation must be attempted BEFORE the session is destroyed",
  );
});

test("failed deactivation does not block logout (contract)", () => {
  const deactivator = notificationsSource.slice(
    notificationsSource.indexOf("export async function deactivatePushDeviceToken"),
    notificationsSource.indexOf("let lastRegisteredToken"),
  );
  assert.ok(
    deactivator.includes("return { success: false, error: message }"),
    "deactivation failure must be returned, never thrown",
  );
  assert.ok(
    !deactivator.includes("throw "),
    "deactivation path must never throw into the logout flow",
  );
});

test("session/user switch cannot reuse stale user token (contract)", () => {
  const owner = notificationsSource.slice(
    notificationsSource.indexOf("let lastRegisteredToken"),
    notificationsSource.indexOf("export type NotificationListenersOptions"),
  );
  assert.ok(
    owner.includes("lastRegisteredToken === accessToken"),
    "guard must compare per-session access tokens",
  );
  assert.ok(
    owner.includes("lastRegisteredToken = null"),
    "sign-out must reset the success marker so a new user registers fresh",
  );
  assert.ok(
    authContextSource.includes("handleSignOut(null)"),
    "cleared-session events must route through handleSignOut so guards reset",
  );
});

test("duplicate registration is guarded (contract)", () => {
  const owner = notificationsSource.slice(
    notificationsSource.indexOf("export async function handleAuthenticatedSession"),
    notificationsSource.indexOf("export async function handleSignOut"),
  );
  assert.ok(
    owner.includes("inFlightRegistrationToken === accessToken"),
    "concurrent calls for the same session must be deduped",
  );
  assert.ok(
    owner.includes("lastRegisteredToken = accessToken"),
    "success marker must only be set on successful registration (failures retry)",
  );
});

test("push device API uses the established production contract (contract)", () => {
  assert.ok(
    apiSource.includes('"/api/v1/push/devices"'),
    "client must use the established /api/v1/push/devices contract",
  );
  const deactivator = apiSource.slice(apiSource.indexOf("export function deactivatePushDeviceApi"));
  assert.ok(
    deactivator.includes('method: "DELETE"'),
    "deactivation must use DELETE with body (established production contract)",
  );
  assert.ok(
    deactivator.includes("body: { deviceId }"),
    "deactivation must send deviceId in the body",
  );
});
