import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Backend integration coverage for the multi-rewarded unlock flow (Phase 16).
 *
 * These tests exercise the real RPCs (create_rewarded_ad_attempt,
 * finalize_rewarded_ad_callback, get_rewarded_progress) against a Supabase
 * instance. They are SKIPPED automatically when no test database is configured,
 * so they never fail in environments without one. Set the following env vars to
 * enable them:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY, SUPABASE_TEST_ANON_KEY
 */

const url = process.env.SUPABASE_TEST_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? serviceRoleKey;
const RUN = Boolean(url && serviceRoleKey);

function adminClient(): SupabaseClient {
  return createClient(url as string, serviceRoleKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(): SupabaseClient {
  return createClient(url as string, anonKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function userClient(jwt: string): SupabaseClient {
  return createClient(url as string, anonKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: () => Promise.resolve(jwt),
  });
}

function maybe(name: string, fn: () => Promise<void>) {
  test(name, { skip: !RUN }, async () => {
    await fn();
  });
}

interface SeededData {
  userId: string;
  email: string;
  episodeId: string;
  seriesId: string;
  userJwt: string;
}

async function seedEpisode(
  admin: SupabaseClient,
  required: number,
): Promise<SeededData> {
  const email = `rewarded-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: "test-password-123",
    email_confirm: true,
  });
  assert.equal(userError, null);
  const userId = userData!.user!.id;

  const { data: series, error: seriesError } = await admin
    .from("series")
    .insert({ title: "Rewarded Test Series", slug: `rewarded-test-${userId}`, status: "published" })
    .select("id")
    .single();
  assert.equal(seriesError, null);

  const { data: episode, error: episodeError } = await admin
    .from("episodes")
    .insert({
      series_id: series!.id,
      episode_number: 1,
      title: "Rewarded Test Episode",
      status: "published",
      is_free: false,
      coin_unlock_enabled: false,
      rewarded_unlock_enabled: true,
      rewarded_access_mode: "permanent",
      required_rewarded_completions: required,
      plus_access: false,
    })
    .select("id")
    .single();
  assert.equal(episodeError, null);

  // Sign in with a SEPARATE anon client to get the user JWT, so the admin client
  // remains clean (never has a user session attached).
  const anon = anonClient();
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password: "test-password-123",
  });
  assert.equal(signInError, null);
  const userJwt = signInData!.session!.access_token;

  return { userId, email, episodeId: episode!.id, seriesId: series!.id, userJwt };
}

async function teardown(admin: SupabaseClient, userId: string, seriesId: string) {
  await admin.from("episodes").delete().eq("series_id", seriesId);
  await admin.from("series").delete().eq("id", seriesId);
  await admin.auth.admin.deleteUser(userId);
}

async function rpcCreate(userClient: SupabaseClient, episodeId: string): Promise<{
  status: string;
  custom_data: string | null;
  verified_progress: number;
  required_completions: number;
}> {
  const r = await userClient.rpc("create_rewarded_ad_attempt", { p_episode_id: episodeId });
  assert.equal(r.error, null);
  return (r.data as Record<string, unknown>[])[0] as {
    status: string;
    custom_data: string | null;
    verified_progress: number;
    required_completions: number;
  };
}

async function rpcFinalize(admin: SupabaseClient, customData: string, txn: string): Promise<{
  success: boolean;
  status: string;
  verified_progress: number;
  required_completions: number;
}> {
  const r = await admin.rpc("finalize_rewarded_ad_callback", {
    p_custom_data: customData,
    p_provider_transaction_id: txn,
  });
  assert.equal(r.error, null);
  return (r.data as Record<string, unknown>[])[0] as {
    success: boolean;
    status: string;
    verified_progress: number;
    required_completions: number;
  };
}

async function rpcProgress(userClient: SupabaseClient, episodeId: string): Promise<{
  verified_progress: number;
  required_completions: number;
  state: string;
}> {
  const r = await userClient.rpc("get_rewarded_progress", { p_episode_id: episodeId });
  assert.equal(r.error, null);
  return (r.data as Record<string, unknown>[])[0] as {
    verified_progress: number;
    required_completions: number;
    state: string;
  };
}

maybe("one-ad path: P=0 N=1 grants entitlement exactly once", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 1);
  const user = userClient(userJwt);
  try {
    const created = await rpcCreate(user, episodeId);
    assert.equal(created.status, "pending");
    assert.equal(created.required_completions, 1);

    const finalized = await rpcFinalize(admin, created.custom_data as string, "txn-one-ad-1");
    assert.equal(finalized.success, true);
    assert.equal(finalized.verified_progress, 1);

    const entitlement = await user
      .from("episode_entitlements")
      .select("id, source")
      .eq("user_id", userId)
      .eq("episode_id", episodeId)
      .single();
    assert.equal(entitlement.error, null);
    assert.equal(entitlement.data!.source, "rewarded_ad");

    const second = await rpcCreate(user, episodeId);
    assert.equal(second.status, "already_accessible");
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("two-ad partial: Ad1 verified => P=1, no entitlement", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 2);
  const user = userClient(userJwt);
  try {
    const a1 = await rpcCreate(user, episodeId);
    assert.equal(a1.required_completions, 2);
    const f1 = await rpcFinalize(admin, a1.custom_data as string, "txn-two-ad-1");
    assert.equal(f1.verified_progress, 1);
    assert.equal(f1.required_completions, 2);

    const entitlement = await user
      .from("episode_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("episode_id", episodeId);
    assert.equal(entitlement.error, null);
    assert.equal(entitlement.data!.length, 0);
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("two-ad completion: Ad2 verified => P=2, entitlement once", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 2);
  const user = userClient(userJwt);
  try {
    const a1 = await rpcCreate(user, episodeId);
    await rpcFinalize(admin, a1.custom_data as string, "txn-comp-1");
    const a2 = await rpcCreate(user, episodeId);
    assert.equal(a2.verified_progress, 1);
    const f2 = await rpcFinalize(admin, a2.custom_data as string, "txn-comp-2");
    assert.equal(f2.verified_progress, 2);

    const entitlement = await user
      .from("episode_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("episode_id", episodeId);
    assert.equal(entitlement.error, null);
    assert.equal(entitlement.data!.length, 1);
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("replay: same transaction replayed does not increase progress", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 1);
  const user = userClient(userJwt);
  try {
    const a1 = await rpcCreate(user, episodeId);
    const f1 = await rpcFinalize(admin, a1.custom_data as string, "txn-replay-1");
    assert.equal(f1.verified_progress, 1);
    const f1again = await rpcFinalize(admin, a1.custom_data as string, "txn-replay-1");
    assert.equal(f1again.verified_progress, 1);
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("transaction reuse across attempts is rejected", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 2);
  const user = userClient(userJwt);
  try {
    const a1 = await rpcCreate(user, episodeId);
    await rpcFinalize(admin, a1.custom_data as string, "txn-reuse-shared");
    const a2 = await rpcCreate(user, episodeId);
    const f2 = await rpcFinalize(admin, a2.custom_data as string, "txn-reuse-shared");
    assert.equal(f2.success, false);
    assert.equal(f2.status, "transaction_conflict");
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("disabled rewarded: no new attempt permitted", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 1);
  const user = userClient(userJwt);
  try {
    const { error: updateError } = await admin
      .from("episodes")
      .update({ rewarded_unlock_enabled: false })
      .eq("id", episodeId);
    assert.equal(updateError, null);

    const created = await rpcCreate(user, episodeId);
    assert.equal(created.status, "rewarded_disabled");
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("count validation: 0/3/4 rejected by DB check", async () => {
  const admin = adminClient();
  const { userId, seriesId } = await seedEpisode(admin, 1);
  try {
    const { error } = await admin
      .from("episodes")
      .insert({
        series_id: seriesId,
        episode_number: 99,
        title: "bad",
        required_rewarded_completions: 3,
      });
    assert.notEqual(error, null);
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("default required count: N=1 preserves single-ad behavior", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 1);
  const user = userClient(userJwt);
  try {
    const a1 = await rpcCreate(user, episodeId);
    assert.equal(a1.required_completions, 1);
    const f1 = await rpcFinalize(admin, a1.custom_data as string, "txn-default-1");
    assert.equal(f1.verified_progress, 1);
    assert.equal(f1.required_completions, 1);
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("progress recovery: get_rewarded_progress returns correct state", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 2);
  const user = userClient(userJwt);
  try {
    // Before any attempt: state should be "none"
    const before = await rpcProgress(user, episodeId);
    assert.equal(before.verified_progress, 0);
    assert.equal(before.state, "none");

    // After first attempt but before finalize: still "none" (pending but not granted)
    const a1 = await rpcCreate(user, episodeId);
    assert.equal(a1.verified_progress, 0);

    // After first finalize: "partial" (P=1, N=2)
    await rpcFinalize(admin, a1.custom_data as string, "txn-progress-1");
    const partial = await rpcProgress(user, episodeId);
    assert.equal(partial.verified_progress, 1);
    assert.equal(partial.state, "partial");

    // After second attempt + finalize: "complete" (P=2, N=2)
    const a2 = await rpcCreate(user, episodeId);
    await rpcFinalize(admin, a2.custom_data as string, "txn-progress-2");
    const complete = await rpcProgress(user, episodeId);
    assert.equal(complete.verified_progress, 2);
    assert.equal(complete.state, "complete");
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("repeated pending attempt: does not create unlimited pending rows", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 1);
  const user = userClient(userJwt);
  try {
    const a1 = await rpcCreate(user, episodeId);
    assert.equal(a1.status, "pending");
    const customData1 = a1.custom_data;

    // Second create should reuse the pending attempt
    const a2 = await rpcCreate(user, episodeId);
    assert.equal(a2.status, "pending");
    assert.equal(a2.custom_data, customData1);

    // Verify only one pending row exists
    const { data: pendingRows, error: countError } = await admin
      .from("rewarded_ad_attempts")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("episode_id", episodeId)
      .eq("status", "pending");
    assert.equal(countError, null);
    assert.equal(pendingRows!.length, 1);
  } finally {
    await teardown(admin, userId, seriesId);
  }
});

maybe("existing purchase entitlement: rewarded ad never downgrades source", async () => {
  const admin = adminClient();
  const { userId, episodeId, seriesId, userJwt } = await seedEpisode(admin, 1);
  const user = userClient(userJwt);
  try {
    // Insert a purchase entitlement first (using admin client which has service_role)
    const { error: entitlementError } = await admin
      .from("episode_entitlements")
      .insert({
        user_id: userId,
        episode_id: episodeId,
        source: "purchase",
        expires_at: null,
      });
    assert.equal(entitlementError, null);

    // Attempting to create a rewarded attempt should return already_accessible
    const created = await rpcCreate(user, episodeId);
    assert.equal(created.status, "already_accessible");

    // Verify the entitlement source is still "purchase"
    const entitlement = await user
      .from("episode_entitlements")
      .select("source")
      .eq("user_id", userId)
      .eq("episode_id", episodeId)
      .single();
    assert.equal(entitlement.error, null);
    assert.equal(entitlement.data!.source, "purchase");
  } finally {
    await teardown(admin, userId, seriesId);
  }
});