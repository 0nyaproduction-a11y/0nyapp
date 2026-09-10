import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let listener;
  let reads = 0;
  const writes = [];
  const native = { type: 'android', data: 'test-native-token' };
  const notifications = {
    setNotificationHandler() {},
    getPermissionsAsync: async () => ({ status: 'granted' }),
    addPushTokenListener(callback) {
      listener = callback;
      return { remove() { listener = undefined; } };
    },
    async getDevicePushTokenAsync() {
      reads++;
      assert.ok(reads < 10, 'native token reads must not recurse');
      listener?.(native);
      return native;
    },
    async getExpoPushTokenAsync(options) {
      if (!options.devicePushToken) await notifications.getDevicePushTokenAsync();
      return { data: 'ExpoPushToken[test]' };
    },
  };
  const mocks = {
    'expo-application': { getAndroidId: () => 'physical-test-device' },
    'expo-notifications': notifications,
    'expo-secure-store': { getItemAsync: async () => 'physical-test-device' },
    'react-native': { Platform: { OS: 'android' } },
    'expo-constants': { expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
    './api': {
      registerPushDeviceApi: async (body, auth) => { writes.push({ body, auth }); return {}; },
      deactivatePushDeviceApi: async () => ({}),
    },
  };
  const exports = {};
  const source = readFileSync(new URL('../apps/android/src/lib/notifications.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => mocks[name], __DEV__: false, console });
  return { api: exports, writes, emit: (token) => listener?.(token), reads: () => reads };
}

test('native refresh reuses event token without another native read', async () => {
  const h = harness();
  h.api.setupTokenRefreshListener('test-session');
  h.emit({ type: 'android', data: 'rotated-native-token' });
  await new Promise(setImmediate);
  assert.equal(h.reads(), 0);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].body.nativePushToken, 'rotated-native-token');
  assert.equal(h.writes[0].auth, 'test-session');
});

test('guest listener and direct registration make no request', async () => {
  const h = harness();
  h.api.setupTokenRefreshListener(null);
  h.emit({ type: 'android', data: 'test-native-token' });
  assert.equal((await h.api.registerPushDeviceToken(null)).success, false);
  assert.equal(h.reads(), 0);
  assert.equal(h.writes.length, 0);
});

test('Android token-read events produce bounded registration, not a loop', async () => {
  const h = harness();
  h.api.setupTokenRefreshListener('test-session');
  await h.api.handleAuthenticatedSession('test-session');
  await new Promise(setImmediate);
  assert.equal(h.reads(), 2);
  assert.equal(h.writes.length, 3);
  await h.api.handleAuthenticatedSession('test-session');
  assert.equal(h.writes.length, 3);
});
