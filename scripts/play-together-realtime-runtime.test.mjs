#!/usr/bin/env node
// PX01-B-RT-B: LOCAL REALTIME RUNTIME TEST (throwaway, local-only).
//
// Verifies against the running local Supabase stack:
//   - apply_play_together_room_command semantics (Host authority, idempotency,
//     stale version, conflict, ordering, seek clamp, ended/expired guards)
//   - private Realtime Broadcast delivery through the DB trigger
//   - realtime.messages RLS authorization (participant allowed; unrelated and
//     anon denied; client broadcast send denied)
//   - room read snapshot extended fields
//
// Creates throwaway users and a throwaway room on the LOCAL dev database and
// deletes them at the end. Refuses to run against any non-local Supabase URL.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const EPISODE_A = "30000000-0000-0000-0000-000000000001";

function getSupabaseCommand() {
  const npmShimPath = path.join(process.env.APPDATA ?? "", "npm", "supabase.cmd");
  return existsSync(npmShimPath) ? npmShimPath : "supabase";
}

function runSupabase(args) {
  return execFileSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/c", getSupabaseCommand(), ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function ensureLocalTarget(apiUrl) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(apiUrl)) {
    throw new Error(`Refusing to run PX01-B-RT-B runtime test against non-local target: ${apiUrl}`);
  }
}

function createBareClient(url, key) {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createThrowawayUser(admin, label) {
  const email = `px01-rt-${label}-${randomBytes(4).toString("hex")}@0nya-test.local`;
  const password = `Px01${randomBytes(8).toString("base64url")}!A9`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (error || !data.user) {
    throw new Error(`createUser(${label}) failed: ${error?.message ?? "no user returned"}`);
  }
  return { email, id: data.user.id, password };
}

async function signIn(url, anonKey, email, password) {
  const client = createBareClient(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`signIn(${email}) failed: ${error?.message ?? "no session"}`);
  }
  client.realtime.setAuth(data.session.access_token);
  return { client, token: data.session.access_token, user: data.user };
}

function subscribePrivate(rt, topic, label) {
  return new Promise((resolve) => {
    const channel = rt.channel(topic, { config: { private: true } });
    const timeout = setTimeout(() => {
      resolve({ status: "TIMEOUT", channel });
    }, 15000);
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
        clearTimeout(timeout);
        resolve({ status, channel, err });
      }
    });
    channel.on("broadcast", { event: "state_changed" }, (payload) => {
      channel._px01LastEvent = payload;
    });
  });
}

function innerBroadcast(evt) {
  return evt && evt.type === "broadcast" && evt.payload ? evt.payload : evt;
}

function describeSub(r) {
  return JSON.stringify({ status: r.status, err: r.err && r.err.message });
}

const state = { admin: null, url: "", anonKey: "", users: [], roomId: null, hostSession: null, guestSession: null, unexpectedSession: null, hostChannel: null, guestChannel: null };

before(async () => {
  const statusJson = JSON.parse(runSupabase(["status", "-o", "json"]));
  const statusEnv = {};
  for (const line of runSupabase(["status", "-o", "env"]).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.includes("=")) {
      const sep = trimmed.indexOf("=");
      statusEnv[trimmed.slice(0, sep).trim()] = trimmed.slice(sep + 1).trim().replace(/^"|"$/g, "");
    }
  }

  const url = statusJson.API_URL;
  const anonKey = statusJson.ANON_KEY;
  const secretKey = statusEnv.SECRET_KEY;

  ensureLocalTarget(url);
  if (!anonKey || !secretKey) {
    throw new Error("Missing local Supabase keys from `supabase status`.");
  }

  state.url = url;
  state.anonKey = anonKey;
  state.admin = createBareClient(url, secretKey);
});

after(async () => {
  for (const channel of [state.hostChannel, state.guestChannel]) {
    if (channel) {
      await channel.unsubscribe().catch(() => {});
    }
  }
  for (const session of [state.hostSession, state.guestSession, state.unexpectedSession]) {
    if (session) {
      session.client.removeAllChannels().catch(() => {});
    }
  }
  // Delete throwaway users (cascades rooms/participants/commands/invites/grants).
  for (const user of state.users) {
    await state.admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
});

function adminRpc(name, args) {
  return state.admin.rpc(name, args);
}

test("runtime: host creates room and guest joins over invite", async () => {
  const host = await createThrowawayUser(state.admin, "host");
  const guest = await createThrowawayUser(state.admin, "guest");
  const stranger = await createThrowawayUser(state.admin, "unrelated");
  state.users.push(host, guest, stranger);

  state.hostSession = await signIn(state.url, state.anonKey, host.email, host.password);
  state.guestSession = await signIn(state.url, state.anonKey, guest.email, guest.password);
  state.unexpectedSession = await signIn(state.url, state.anonKey, stranger.email, stranger.password);

  const created = await adminRpc("create_play_together_room", {
    p_host_user_id: host.id,
    p_episode_id: EPISODE_A,
    p_room_expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  });

  assert.equal(created.error, null, created.error?.message);
  state.roomId = created.data[0].room_id;
  assert.equal(created.data[0].status, "waiting");

  const inviteToken = `t${randomBytes(24).toString("base64url")}`;
  const hashLib = (await import("node:crypto")).createHash;
  const tokenHash = hashLib("sha256").update(inviteToken).digest("hex");

  const invite = await adminRpc("create_play_together_invite", {
    p_actor_user_id: host.id,
    p_room_id: state.roomId,
    p_token_hash: tokenHash,
    p_invite_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  assert.equal(invite.error, null, invite.error?.message);

  const joined = await adminRpc("redeem_play_together_invite", {
    p_joining_user_id: guest.id,
    p_token_hash: tokenHash,
  });
  assert.equal(joined.error, null, joined.error?.message);
  assert.equal(joined.data[0].status, "active");
});

test("runtime: participant (host+guest) subscribes to private room topic; unrelated and anon denied", async () => {
  const topic = `play_together_room:${state.roomId}`;

  const hostResult = await subscribePrivate(state.hostSession.client.realtime, topic, "host");
  const guestResult = await subscribePrivate(state.guestSession.client.realtime, topic, "guest");
  const unexpectedResult = await subscribePrivate(state.unexpectedSession.client.realtime, topic, "unexpected");
  const anonClient = createBareClient(state.url, state.anonKey);
  const anonResult = await subscribePrivate(anonClient.realtime, topic, "anon");
  state.hostChannel = hostResult.channel;
  state.guestChannel = guestResult.channel;

assert.equal(hostResult.status, "SUBSCRIBED", describeSub(hostResult));
  assert.equal(guestResult.status, "SUBSCRIBED", describeSub(guestResult));
  assert.equal(unexpectedResult.status, "CHANNEL_ERROR", describeSub(unexpectedResult));
  assert.equal(anonResult.status, "CHANNEL_ERROR", describeSub(anonResult));
});

test("runtime: Host commands apply, bump version once, and broadcast to participants", async () => {
  const topic = `play_together_room:${state.roomId}`;
  const waiters = [];
  for (const [label, ch] of [["host", state.hostChannel], ["guest", state.guestChannel]]) {
    waiters.push(
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ label, timeout: true }), 8000);
ch.on("broadcast", { event: "state_changed" }, (payload) => {
          clearTimeout(timer);
          resolve({ label, payload: innerBroadcast(payload) });
        });
      }),
    );
  }

  const firstPlay = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-play-00001",
    p_command_type: "play",
    p_expected_version: 1,
  });
  assert.equal(firstPlay.error, null, firstPlay.error?.message);
  assert.equal(firstPlay.data[0].success, true);
  assert.equal(firstPlay.data[0].status, "applied");
  assert.equal(firstPlay.data[0].state_version, 2);
  assert.equal(firstPlay.data[0].playback_state, "playing");

  const events = await Promise.all(waiters);
  for (const evt of events) {
    assert.equal(evt.timeout, undefined, `${evt.label} did not receive broadcast`);
    assert.equal(evt.payload.type, "room_state");
    assert.equal(evt.payload.state_version, 2);
    assert.equal(evt.payload.playback_state, "playing");
    assert.equal(evt.payload.room_id, state.roomId);
    assert.ok(evt.payload.state_server_time, "state_server_time missing");
  }

  // Retry the same command_id: deterministic replay, no version bump.
  const replay = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-play-00001",
    p_command_type: "play",
    p_expected_version: 1,
  });
  assert.equal(replay.data[0].status, "replayed");
  assert.equal(replay.data[0].state_version, 2);

  // Conflicting reuse of the same command_id must fail.
  const conflict = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-play-00001",
    p_command_type: "pause",
  });
  assert.equal(conflict.data[0].status, "transaction_conflict");
});

test("runtime: stale expected_version is rejected; PLAY->SEEK ordering monotonic; seek clamps to duration", async () => {
  const stale = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-stale-00002",
    p_command_type: "pause",
    p_expected_version: 0,
  });
  assert.equal(stale.data[0].status, "stale_version");

  const seek = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-seek-000003",
    p_command_type: "seek",
    p_position_ms: 999999,
  });
  assert.equal(seek.data[0].status, "applied");
  assert.equal(seek.data[0].state_version, 3);
  assert.equal(seek.data[0].host_position_ms, 300000);

  const pause = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-pause-00004",
    p_command_type: "pause",
    p_expected_version: 3,
  });
  assert.equal(pause.data[0].status, "applied");
  assert.equal(pause.data[0].state_version, 4);
  assert.equal(pause.data[0].playback_state, "paused");
});

test("runtime: guest is NOT granted command authority (not_host)", async () => {
  const guestCommand = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[1].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-guest-00005",
    p_command_type: "play",
  });
  assert.equal(guestCommand.data[0].status, "not_host");
  assert.equal(guestCommand.data[0].success, false);
});

test("runtime: episode_change transitions active->waiting_for_access and resets position", async () => {
  const change = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-ep-00000006",
    p_command_type: "episode_change",
    p_target_episode_id: "30000000-0000-0000-0000-000000000002",
  });
  assert.equal(change.data[0].status, "applied");
  assert.equal(change.data[0].status_code, "waiting_for_access");
  assert.equal(change.data[0].episode_id, "30000000-0000-0000-0000-000000000002");
  assert.equal(change.data[0].host_position_ms, 0);

  const invalidEpisode = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-bad-ep-00007",
    p_command_type: "episode_change",
    p_target_episode_id: "00000000-0000-0000-0000-000000000099",
  });
  assert.equal(invalidEpisode.data[0].status, "invalid_episode");
});

test("runtime: clients cannot send broadcasts on the room topic (no INSERT policy)", async () => {
  // A participant's own broadcast must never reach peers: the realtime.messages
  // RLS grants SELECT (receive) only; INSERT (send) is denied by default.
const received = [];
  const listener = (payload) => received.push(innerBroadcast(payload));
  state.guestChannel.on("broadcast", { event: "state_changed" }, listener);

  await state.hostChannel.send({
    type: "broadcast",
    event: "state_changed",
    payload: { type: "room_state", forged: true, room_id: state.roomId },
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));
  assert.equal(received.length, 0, "forged client broadcast reached a peer");
});

test("runtime: end_room is host-only, ends room, broadcasts end; later commands rejected", async () => {
  const guestEnd = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[1].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-guest-end-08",
    p_command_type: "end_room",
  });
  assert.equal(guestEnd.data[0].status, "not_host");

  const endWaiter = new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timeout: true }), 8000);
state.hostChannel.on("broadcast", { event: "state_changed" }, (payload) => {
      clearTimeout(timer);
      resolve({ payload: innerBroadcast(payload) });
    });
  });

  const ended = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-end-0000009",
    p_command_type: "end_room",
  });
  assert.equal(ended.data[0].status, "applied");
  assert.equal(ended.data[0].status_code, "ended");
  assert.ok(ended.data[0].ended_at, "ended_at missing");

  const endEvent = await endWaiter;
  assert.equal(endEvent.timeout, undefined, "end broadcast not received");
  assert.equal(endEvent.payload.status, "ended");

  const afterEnd = await adminRpc("apply_play_together_room_command", {
    p_actor_user_id: state.users[0].id,
    p_room_id: state.roomId,
    p_command_id: "cmd-after-end00",
    p_command_type: "play",
  });
  assert.equal(afterEnd.data[0].status, "room_ended");
});

test("runtime: room read snapshot exposes state-version fields for participants", async () => {
  const supabase = state.hostSession.client;
  const { data, error } = await supabase
    .from("play_together_rooms")
    .select("id, status, episode_id, playback_state, host_position_ms, playback_rate, state_version, state_server_time, ended_at")
    .eq("id", state.roomId)
    .maybeSingle();
  assert.equal(error, null, error?.message);
  assert.equal(data.state_version, 6);
  assert.equal(data.status, "ended");
  assert.ok(data.state_server_time, "state_server_time missing");
  assert.equal(data.ended_at !== null, true);
});
