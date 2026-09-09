// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import type { Session } from "@supabase/supabase-js";
import { getPlaybackAuthIdentity, isSamePlaybackAuthIdentity } from "./playbackAuthIdentity";

function makeSession(userId: string | null, accessToken: string): Session | null {
  if (userId === null) {
    return null;
  }

  // Minimal structural stand-in: only user.id is read by the identity helper.
  return { user: { id: userId }, access_token: accessToken } as unknown as Session;
}

test("token refresh for the same user keeps playback auth identity stable", () => {
  const beforeRefresh = makeSession("user-1", "token-a");
  const afterRefresh = makeSession("user-1", "token-b");

  assert.equal(getPlaybackAuthIdentity(beforeRefresh), getPlaybackAuthIdentity(afterRefresh));
});

test("user identity change forces a playback auth identity change", () => {
  const userA = makeSession("user-1", "token-a");
  const userB = makeSession("user-2", "token-b");

  assert.notEqual(getPlaybackAuthIdentity(userA), getPlaybackAuthIdentity(userB));
});

test("sign-out (null session) changes the playback auth identity", () => {
  const signedIn = makeSession("user-1", "token-a");

  assert.equal(getPlaybackAuthIdentity(null), null);
  assert.notEqual(getPlaybackAuthIdentity(signedIn), getPlaybackAuthIdentity(null));
});

test("guest and signed-in identities differ", () => {
  assert.notEqual(getPlaybackAuthIdentity(null), getPlaybackAuthIdentity(makeSession("user-1", "token-a")));
});

test("H1: a routine token refresh is the same playback auth identity (no reload/remount)", () => {
  const beforeRefresh = makeSession("user-1", "token-a");
  const afterRefresh = makeSession("user-1", "token-b");

  // Screen-level reload guard: already-resolved identity vs current identity.
  assert.equal(
    isSamePlaybackAuthIdentity(
      getPlaybackAuthIdentity(beforeRefresh),
      getPlaybackAuthIdentity(afterRefresh),
    ),
    true,
  );
  // Source/authorization effect key: stable across refresh.
  assert.equal(getPlaybackAuthIdentity(beforeRefresh), getPlaybackAuthIdentity(afterRefresh));
});

test("H1: a real identity change forces a data/source reload decision", () => {
  const signedInA = makeSession("user-1", "token-a");
  const signedInB = makeSession("user-2", "token-b");
  const guest = null;

  assert.equal(
    isSamePlaybackAuthIdentity(getPlaybackAuthIdentity(signedInA), getPlaybackAuthIdentity(signedInB)),
    false,
  );
  assert.equal(
    isSamePlaybackAuthIdentity(getPlaybackAuthIdentity(signedInA), getPlaybackAuthIdentity(guest)),
    false,
  );
  // Same user is still the same reload decision even when both tokens differ.
  assert.equal(
    isSamePlaybackAuthIdentity(getPlaybackAuthIdentity(signedInA), getPlaybackAuthIdentity(makeSession("user-1", "token-c"))),
    true,
  );
});

test("H1: a null identity only matches another null identity", () => {
  assert.equal(isSamePlaybackAuthIdentity(null, null), true);
  assert.equal(isSamePlaybackAuthIdentity(null, "user-1"), false);
  assert.equal(isSamePlaybackAuthIdentity("user-1", null), false);
});
