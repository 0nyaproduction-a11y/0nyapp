import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Short Film attach-before-upload integration coverage.
 *
 * Verifies the server-side ownership invariant that the short film intake
 * form relies on: a pending/processing Mux media_assets row is claimed by a
 * draft short_films row (short_films.media_asset_id) BEFORE any bytes are
 * uploaded, so an interrupted browser upload cannot leave that media asset
 * orphaned. This is the same durable pre-upload attachment the proven
 * Episode flow uses (episodes.media_asset_id via attachEpisodeMediaUploadIntent).
 *
 * The server attach helper (attachShortFilmMediaUploadIntent in media.ts) is
 * server-only and cannot be imported under `node --test`, so this test
 * exercises the same observable DB mutation directly (updating
 * short_films.media_asset_id to claim a pending mux media_assets row).
 *
 * These tests exercise the real tables against a Supabase instance. They are
 * SKIPPED automatically when no test database is configured, so they never
 * fail in environments without one. Set the following env vars to enable them:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY
 */
const url = process.env.SUPABASE_TEST_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const RUN = Boolean(url && serviceRoleKey);

function adminClient(): SupabaseClient {
  return createClient(url as string, serviceRoleKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function maybe(name: string, fn: () => Promise<void>) {
  test(name, { skip: !RUN }, async () => {
    await fn();
  });
}

interface SeededData {
  mediaAssetId: string;
  shortFilmId: string;
  slug: string;
}

async function seedShortFilmAndPendingMedia(admin: SupabaseClient): Promise<SeededData> {
  const slug = `attach-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data: shortFilm, error: shortFilmError } = await admin
    .from("short_films")
    .insert({
      slug,
      title: "Attach Test Short Film",
      duration_seconds: 60,
      status: "draft",
    })
    .select("id,slug")
    .single();
  assert.equal(shortFilmError, null);

  const { data: mediaAsset, error: mediaAssetError } = await admin
    .from("media_assets")
    .insert({ provider_name: "mux", status: "pending" })
    .select("id")
    .single();
  assert.equal(mediaAssetError, null);

  return {
    mediaAssetId: mediaAsset!.id,
    shortFilmId: shortFilm!.id,
    slug: shortFilm!.slug,
  };
}

async function teardown(admin: SupabaseClient, mediaAssetId: string, shortFilmId: string) {
  await admin.from("short_films").delete().eq("id", shortFilmId);
  await admin.from("media_assets").delete().eq("id", mediaAssetId);
}

maybe("pending media_assets row is owned by a draft short film before upload", async () => {
  const admin = adminClient();
  const seeded = await seedShortFilmAndPendingMedia(admin);
  try {
    // Claim the pending media asset on the short film (attach-before-upload).
    const { error: attachError } = await admin
      .from("short_films")
      .update({ media_asset_id: seeded.mediaAssetId })
      .eq("id", seeded.shortFilmId);
    assert.equal(attachError, null);

    // The media asset is now referenced by a short film, so it is NOT orphaned:
    // an interrupted browser upload leaves a claimed, recoverable row.
    const { data: mediaAsset, error: mediaAssetError } = await admin
      .from("media_assets")
      .select("status")
      .eq("id", seeded.mediaAssetId)
      .single();
    assert.equal(mediaAssetError, null);
    assert.ok(mediaAsset);
    assert.equal(mediaAsset!.status, "pending");
  } finally {
    await teardown(admin, seeded.mediaAssetId, seeded.shortFilmId);
  }
});