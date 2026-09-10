import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNotificationPreferencesWrite,
  buildPushDeviceWrite,
  validatePushDeviceInput,
  type RegisterPushDeviceInput,
} from "./push-devices";

test("validatePushDeviceInput validates required fields correctly", () => {
  // Invalid inputs
  assert.equal(validatePushDeviceInput(null).valid, false);
  assert.equal(validatePushDeviceInput({}).valid, false);
  assert.equal(validatePushDeviceInput({ deviceId: "" }).valid, false);
  assert.equal(validatePushDeviceInput({ deviceId: "  " }).valid, false);
  assert.equal(validatePushDeviceInput({ deviceId: "dev1", platform: "invalid" }).valid, false);

  // Oversized deviceId
  const longDeviceId = "a".repeat(257);
  assert.equal(validatePushDeviceInput({ deviceId: longDeviceId, platform: "android" }).valid, false);

  // Oversized token
  const longExpoToken = "b".repeat(513);
  assert.equal(
    validatePushDeviceInput({
      deviceId: "dev1",
      platform: "android",
      expoPushToken: longExpoToken,
    }).valid,
    false
  );

  // Valid android payload
  const validAndroid = validatePushDeviceInput({
    deviceId: "android_device_123",
    platform: "android",
    expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    nativePushToken: "fcm_token_sample",
  });
  assert.equal(validAndroid.valid, true);
  assert.deepEqual(validAndroid.data, {
    deviceId: "android_device_123",
    expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    nativePushToken: "fcm_token_sample",
    platform: "android",
  });

  // Valid iOS payload
  const validIos = validatePushDeviceInput({
    active: false,
    deviceId: "ios_device_456",
    platform: "iOS",
    expoPushToken: "ExponentPushToken[yyyy]",
  });
  assert.equal(validIos.valid, true);
  assert.equal(validIos.data?.platform, "ios");
  assert.equal("active" in (validIos.data ?? {}), false);
});

test("server-owned builders discard identity, timestamp, and field tampering", () => {
  const now = "2026-09-10T12:00:00.000Z";
  const deviceValidation = validatePushDeviceInput({
    active: false,
    created_at: "1900-01-01T00:00:00.000Z",
    deviceId: "device-safe",
    id: "attacker-id",
    platform: "android",
    status: "DELIVERED",
    updated_at: "1900-01-01T00:00:00.000Z",
    user_id: "attacker-user",
  });
  assert.equal(deviceValidation.valid, true);
  const deviceWrite = buildPushDeviceWrite("authenticated-user", deviceValidation.data!, now);
  assert.equal(deviceWrite.user_id, "authenticated-user");
  assert.equal(deviceWrite.active, true);
  assert.equal(deviceWrite.updated_at, now);
  assert.equal("id" in deviceWrite, false);
  assert.equal("created_at" in deviceWrite, false);
  assert.equal("status" in deviceWrite, false);

  const preferenceWrite = buildNotificationPreferencesWrite(
    "authenticated-user",
    { account_security: true, new_releases: true, promotions: true },
    { promotions: false },
    now,
  );
  assert.deepEqual(preferenceWrite, {
    account_security: true,
    new_releases: true,
    promotions: false,
    updated_at: now,
    user_id: "authenticated-user",
  });
});

test("registerPushDevice enforces server-side user_id and updates idempotently mock logic", () => {
  type DeviceRow = {
    active: boolean;
    device_id: string;
    expo_push_token: string | null;
    id: string;
    native_push_token: string | null;
    platform: string;
    user_id: string;
  };

  const db: DeviceRow[] = [];

  function mockRegisterDevice(
    authenticatedUserId: string,
    input: RegisterPushDeviceInput
  ) {
    // Transfer only when the same device also presents a matching provider token.
    for (const row of db) {
      const tokenMatches =
        (input.expoPushToken && row.expo_push_token === input.expoPushToken) ||
        (input.nativePushToken && row.native_push_token === input.nativePushToken);
      if (row.device_id === input.deviceId && row.user_id !== authenticatedUserId && tokenMatches) {
        row.active = false;
      }
    }

    // Upsert on (user_id, device_id)
    const existingIndex = db.findIndex(
      (r) => r.user_id === authenticatedUserId && r.device_id === input.deviceId
    );

    if (existingIndex >= 0) {
      db[existingIndex] = {
        ...db[existingIndex],
        active: true,
        expo_push_token: input.expoPushToken ?? null,
        native_push_token: input.nativePushToken ?? null,
        platform: input.platform,
      };
      return db[existingIndex];
    } else {
      const newRow: DeviceRow = {
        active: true,
        device_id: input.deviceId,
        expo_push_token: input.expoPushToken ?? null,
        id: `uuid_${db.length + 1}`,
        native_push_token: input.nativePushToken ?? null,
        platform: input.platform,
        user_id: authenticatedUserId,
      };
      db.push(newRow);
      return newRow;
    }
  }

  // User 1 registers device
  const reg1 = mockRegisterDevice("user_111", {
    deviceId: "device_abc",
    expoPushToken: "ExponentPushToken[token1]",
    platform: "android",
  });

  assert.equal(reg1.user_id, "user_111");
  assert.equal(reg1.active, true);
  assert.equal(db.length, 1);

  // Idempotent re-registration by User 1 (e.g. token refresh or cold boot)
  const reg1Refresh = mockRegisterDevice("user_111", {
    deviceId: "device_abc",
    expoPushToken: "ExponentPushToken[token1_refreshed]",
    platform: "android",
  });

  assert.equal(db.length, 1);
  assert.equal(reg1Refresh.expo_push_token, "ExponentPushToken[token1_refreshed]");

  // User 2 signs in on the same physical device_abc
  const reg2 = mockRegisterDevice("user_222", {
    deviceId: "device_abc",
    expoPushToken: "ExponentPushToken[token1_refreshed]",
    platform: "android",
  });

  assert.equal(db.length, 2);
  assert.equal(reg2.user_id, "user_222");
  assert.equal(reg2.active, true);

  // Check that User 1's registration for device_abc is now inactive
  const user1Device = db.find((r) => r.user_id === "user_111" && r.device_id === "device_abc");
  assert.equal(user1Device?.active, false);

  // A guessed device_id without the matching provider token cannot deactivate
  // another user's registration.
  mockRegisterDevice("attacker", {
    deviceId: "device_abc",
    expoPushToken: "ExponentPushToken[attacker-token]",
    platform: "android",
  });
  assert.equal(reg2.active, true);
});

test("notification preferences default and ownership mock logic", () => {
  type PrefsRow = {
    account_security: boolean;
    new_releases: boolean;
    promotions: boolean;
    user_id: string;
  };

  const prefsDb: PrefsRow[] = [];

  function getPrefs(userId: string): PrefsRow {
    const found = prefsDb.find((p) => p.user_id === userId);
    if (found) return found;
    return {
      account_security: true,
      new_releases: true,
      promotions: true,
      user_id: userId,
    };
  }

  function updatePrefs(
    userId: string,
    updates: Partial<Omit<PrefsRow, "user_id">>
  ): PrefsRow {
    const current = getPrefs(userId);
    const updated: PrefsRow = {
      account_security: updates.account_security ?? current.account_security,
      new_releases: updates.new_releases ?? current.new_releases,
      promotions: updates.promotions ?? current.promotions,
      user_id: userId,
    };

    const idx = prefsDb.findIndex((p) => p.user_id === userId);
    if (idx >= 0) {
      prefsDb[idx] = updated;
    } else {
      prefsDb.push(updated);
    }
    return updated;
  }

  // Default values
  const defaultUser1 = getPrefs("user_100");
  assert.equal(defaultUser1.promotions, true);
  assert.equal(defaultUser1.new_releases, true);
  assert.equal(defaultUser1.account_security, true);

  // Update promotions for user_100
  const updatedUser1 = updatePrefs("user_100", { promotions: false });
  assert.equal(updatedUser1.promotions, false);
  assert.equal(updatedUser1.new_releases, true);

  // Ensure user_200 preferences are unaffected
  const defaultUser2 = getPrefs("user_200");
  assert.equal(defaultUser2.promotions, true);
});
