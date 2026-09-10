# NOTIFICATIONS FOUNDATION & DELIVERY ENGINE (N01 - N03)

## Status

N01 Database Foundation: IMPLEMENTED_UNVERIFIED — backend adapter/service code
(`push-provider.ts`, `notification-service.ts`, observation foundation) is
committed, but the schema migrations `037_notification_foundation.sql` and
`038_notification_deliveries.sql` are UNTRACKED and not committed/applied to
the repository baseline.
N02 Android Push Token Lifecycle: IMPLEMENTED_UNVERIFIED —
`apps/android/src/lib/notifications.ts` is UNTRACKED (not committed); not a
committed-complete surface.
N03 Notification Delivery Engine: IMPLEMENTED_UNVERIFIED — server adapter and
service committed; the QA-verification seam
`src/lib/notification-qa-verification.ts` is UNTRACKED.
N04 Controlled Real Push Verification: SOURCE VERIFIED / BLOCKED_SAFETY for real
send until the authorized physical QA device and exact QA registration are proven.

## Completed Systems

### 1. Database Schema & RLS (Supabase)
- `20260906100000_037_notification_foundation.sql`:
  - `notifications`: User persistent feed (`id`, `user_id`, `type`, `title`, `body`, `image_url`, `deep_link`, `payload`, `read_at`, `created_at`, `expires_at`).
  - `push_devices`: Per-user registered push devices (`id`, `user_id`, `expo_push_token`, `native_push_token`, `platform`, `device_id`, `active`, `last_seen_at`, `created_at`, `updated_at`) with unique constraint on `(user_id, device_id)`.
  - `notification_preferences`: Per-user preference controls (`user_id`, `promotions`, `new_releases`, `account_security`, `updated_at`).
  - RLS policies enabled: strict user ownership for read/update. Client insert to `notifications` blocked.
- `20260906110000_038_notification_deliveries.sql`:
  - `notification_deliveries`: Server/backend-controlled delivery tracking table (`id`, `notification_id`, `user_id`, `push_device_id`, `provider`, `provider_ticket_id`, `status`, `error_code`, `error_message`, `attempted_at`, `receipt_checked_at`, `created_at`, `updated_at`).
  - Status enum: `PENDING`, `SENT`, `ACCEPTED`, `DELIVERED`, `FAILED`, `INVALID_TOKEN`.
  - RLS policies enabled: client select on own user records, client insert/update/delete strictly blocked.

### 2. Android Client Push Token Lifecycle
- `apps/android/package.json` & `app.json`: `expo-notifications` installed and configured.
- `apps/android/src/lib/notifications.ts`:
  - Stable device identity derivation (`getStableDeviceId`).
  - Permission request module (`requestNotificationPermissions` / `hasNotificationPermissions`). Does not cold-boot auto-prompt without consent surface.
  - Push token acquisition (`getExpoPushTokenAsync`, `getDevicePushTokenAsync`).
  - Token refresh listener (`addPushTokenListener`).
  - Foreground & tap response listeners (`addNotificationReceivedListener`, `addNotificationResponseListener`).
  - Device token registration (`registerCurrentPushDevice`) & deactivation on logout (`unregisterCurrentPushDevice`).
- `apps/android/src/lib/authContext.tsx` & `App.tsx`: Wired token registration on auth sign-in and deactivation on sign-out.

### 3. Server Notification Delivery Engine & Provider Adapter
- `src/lib/push-provider.ts`:
  - `ExpoPushProviderAdapter`: Server-only adapter for Expo Push Service.
  - Validates Expo tokens (`ExponentPushToken[...]` or `ExpoPushToken[...]`).
  - Sanitizes and strips untrusted/nested payloads (`sanitizeNotificationPayload`).
  - Safe batching (chunks of 100) with 10s HTTP request timeout.
- `src/lib/notification-service.ts`:
  - `createNotification` & `createNotificationsForUsers`: Persists feed row before send attempt.
  - `sendNotificationToUser`: Fetches active user devices, creates `notification_deliveries` rows, executes batch send via adapter, records tickets, handles `DeviceNotRegistered` terminal token deactivation.
  - `processPushReceipts`: Fetches `SENT` tickets, queries Expo receipts, updates delivery status (`DELIVERED`, `FAILED`, `INVALID_TOKEN`), deactivates invalid devices.
  - Integrated with observation events (`NOTIFICATION_QUEUED`, `NOTIFICATION_SENT`, `NOTIFICATION_DELIVERED`).

### 4. Verification & Testing
- Zero-send unit test suite (`src/lib/notification-service.test.ts` & `src/lib/push-devices.test.ts`) using mock provider adapter and mock Supabase client.
- Root typecheck (`npm run typecheck`) passes on the current tree; Android typecheck
  (`cd apps/android && npm run typecheck`) passes on the current tree.
- Full test suite (`npm test`) on the current tree: 346 pass / 2 fail / 12 skip
  (the 2 failures are unrelated to notifications: commercial-config
  "Plus weekly membership" and playback-w01 legacy-compatibility read).
- The `037`/`038` notification migrations + `notifications.ts` +
  `notification-qa-verification.ts` are UNTRACKED/UNCOMMITTED; they are not
  part of the committed repository baseline. N01–N03 are therefore
  IMPLEMENTED_UNVERIFIED (not `VERIFIED COMPLETE`) pending their commit,
  application to remote QA, and re-verification.

### 5. N04 Controlled Real Push Verification Seam
- `src/lib/notification-qa-verification.ts` provides a server-only direct invocation seam for N04:
  - `precheckQaPushTarget`: requires an exact QA user id and exact push device row id.
  - Safety gate requires exactly one active valid Expo push target for that QA user.
  - Safety gate verifies the Expo token is not shared by multiple active registrations.
  - `sendQaPushVerification`: refuses to run unless `allowRealPushSend=true`; creates exactly one `QA_TEST` notification and targets the exact prechecked push device row.
  - `processQaPushReceipt`: constrains receipt processing to the QA notification id.
- `scripts/notification-qa-send.ts` is a manual CLI wrapper only:
  - default mode is `precheck`.
  - real send mode additionally requires `N04_REAL_PUSH_CONFIRM=SEND_EXACTLY_ONE_QA_PUSH`.
  - no public HTTP send endpoint, no campaign UI, no broadcast capability, no auto-rerun path.
- Source verification:
  - Targeted tests pass: `npx tsx --test src/lib/notification-qa-verification.test.ts src/lib/notification-service.test.ts src/lib/push-devices.test.ts`.
  - Root typecheck passes.
  - Android typecheck passes.
  - Full regression suite passes.
- Runtime status:
  - Real push send was NOT performed in this run because ADB device discovery only showed an emulator (`emulator-5554`), not the explicitly authorized OnePlus physical QA device.
  - N04 remains `BLOCKED_SAFETY` for the real provider/FCM/device/tap/receipt path until physical device, build identity, account, permission, and exact active QA push device row are proven.
