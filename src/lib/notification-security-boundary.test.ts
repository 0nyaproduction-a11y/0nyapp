import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const deviceRoute = readFileSync(join(root, "app/api/v1/push/devices/route.ts"), "utf8");
const deviceIdRoute = readFileSync(
  join(root, "app/api/v1/push/devices/[deviceId]/route.ts"),
  "utf8",
);
const preferencesRoute = readFileSync(
  join(root, "app/api/v1/push/preferences/route.ts"),
  "utf8",
);
const deviceService = readFileSync(join(root, "lib/push-devices.ts"), "utf8");

test("notification mutation routes authenticate before creating an admin client", () => {
  for (const source of [deviceRoute, deviceIdRoute, preferencesRoute]) {
    const authIndex = source.indexOf("await getApiAuth(request)");
    const adminIndex = source.indexOf("createAdminClient()");
    assert.ok(authIndex >= 0, "route must authenticate the request");
    assert.ok(adminIndex > authIndex, "admin client must only be created after authentication");
  }
});

test("routes force authenticated ownership and expose no notification-content mutation endpoint", () => {
  assert.ok(deviceRoute.includes("user.id, validation.data"));
  assert.ok(deviceRoute.includes("user.id, deviceId.trim()"));
  assert.ok(deviceIdRoute.includes("user.id, deviceId.trim()"));
  assert.ok(preferencesRoute.includes("user.id, input"));
  for (const source of [deviceRoute, deviceIdRoute, preferencesRoute]) {
    assert.equal(source.includes('.from("notifications")'), false);
    assert.equal(source.includes('.from("notification_deliveries")'), false);
  }
});

test("server-owned writes pin ownership and timestamps", () => {
  assert.ok(deviceService.includes("user_id: authenticatedUserId"));
  assert.ok(deviceService.includes("active: true"));
  assert.ok(deviceService.includes("last_seen_at: now"));
  assert.ok(deviceService.includes("updated_at: now"));
  assert.ok(deviceService.includes('.eq("user_id", userId)'));
  assert.ok(deviceService.includes('.eq("device_id", input.deviceId)'));
  assert.ok(deviceService.includes(".eq(column, token)"));
  assert.ok(deviceService.includes('.neq("user_id", userId)'));
  assert.equal(deviceService.includes("raw.user_id"), false);
  assert.equal(deviceService.includes("raw.updated_at"), false);
  assert.equal(deviceService.includes("raw.created_at"), false);
});
