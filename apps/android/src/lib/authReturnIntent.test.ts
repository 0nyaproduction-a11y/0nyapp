// @ts-expect-error node:test resolves at runtime via tsx; the project tsconfig uses
// bundler resolution without a node lib/types condition, so the `node:` specifier
// is not statically resolvable by tsc here.
import { test } from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import {
  parseAuthReturnIntent,
  resolveReturnRoutes,
  serializeAuthReturnIntent,
  type AuthReturnIntent,
} from "./authReturnIntent";

function makeAccessContext() {
  return {
    access: { canWatch: false },
    episode: { id: "ep_3", number: 3, title: "Third" },
    episodeAccess: { "3": { canWatch: false } },
    resumeAtSeconds: 12,
    seriesSlug: "s1",
    seriesTitle: "Series One",
  };
}

const sampleShortFilm = { slug: "sf-1", title: "Short" } as Record<string, unknown>;

test("serialize + parse round-trips a simple intent", () => {
  const intent: AuthReturnIntent = { kind: "plus" };
  assert.deepEqual(parseAuthReturnIntent(serializeAuthReturnIntent(intent)), intent);
});

test("parse returns null for null/undefined/empty/garbage", () => {
  assert.equal(parseAuthReturnIntent(null), null);
  assert.equal(parseAuthReturnIntent(undefined), null);
  assert.equal(parseAuthReturnIntent(""), null);
  assert.equal(parseAuthReturnIntent("{not json"), null);
  assert.equal(parseAuthReturnIntent(JSON.stringify({ kind: "bogus" })), null);
  assert.equal(parseAuthReturnIntent(JSON.stringify({ kind: "wallet", microDramaAccess: "bad" })), null);
  assert.equal(parseAuthReturnIntent(JSON.stringify({ kind: "chai", shortFilm: null })), null);
});

test("parse validates nested microDramaAccess context", () => {
  const intent: AuthReturnIntent = { kind: "coinUnlock", accessContext: makeAccessContext() as never };
  const reparsed = parseAuthReturnIntent(serializeAuthReturnIntent(intent));
  assert.ok(reparsed, "expected a valid parsed intent");
  assert.equal(reparsed?.kind, "coinUnlock");
});

test("resolveReturnRoutes: profile -> MainTabs / Profile / Account", () => {
  const state = resolveReturnRoutes({ kind: "profile" });
  assert.equal(state.index, 0);
  assert.equal(state.routes[0].name, "MainTabs");
  assert.equal(state.routes[0].params?.screen, "Profile");
  assert.deepEqual(state.routes[0].params?.params, { screen: "Account" });
});

test("resolveReturnRoutes: restoreSync -> MainTabs / Profile / RestoreSync", () => {
  const state = resolveReturnRoutes({ kind: "restoreSync" });
  assert.equal(state.routes[0].name, "MainTabs");
  assert.deepEqual(state.routes[0].params?.params, { screen: "RestoreSync" });
});

test("resolveReturnRoutes: plus -> MainTabs + Plus on top", () => {
  const state = resolveReturnRoutes({ kind: "plus" });
  assert.equal(state.index, 1);
  assert.equal(state.routes[0].name, "MainTabs");
  assert.equal(state.routes[1].name, "Plus");
});

test("resolveReturnRoutes: wallet without access context navigates to Wallet only", () => {
  const state = resolveReturnRoutes({ kind: "wallet", microDramaAccess: null });
  assert.equal(state.index, 1);
  assert.equal(state.routes[1].name, "Wallet");
  assert.equal(state.routes[1].params, undefined);
});

test("resolveReturnRoutes: wallet with access context carries microDramaAccess param", () => {
  const ctx = makeAccessContext();
  const state = resolveReturnRoutes({ kind: "wallet", microDramaAccess: ctx as never });
  assert.equal(state.routes[1].name, "Wallet");
  assert.equal((state.routes[1].params as Record<string, unknown>).microDramaAccess, ctx);
});

test("resolveReturnRoutes: coinUnlock -> EpisodeAccessOptions with access context fields", () => {
  const ctx = makeAccessContext();
  const state = resolveReturnRoutes({ kind: "coinUnlock", accessContext: ctx as never });
  assert.equal(state.index, 1);
  assert.equal(state.routes[1].name, "EpisodeAccessOptions");
  const params = state.routes[1].params as Record<string, unknown>;
  assert.equal(params.seriesSlug, "s1");
  assert.equal(params.seriesTitle, "Series One");
  assert.equal((params.episode as Record<string, unknown>).id, "ep_3");
});

test("resolveReturnRoutes: rewarded resolves to the same EpisodeAccessOptions contract", () => {
  const ctx = makeAccessContext();
  const state = resolveReturnRoutes({ kind: "rewarded", accessContext: ctx as never });
  assert.equal(state.routes[1].name, "EpisodeAccessOptions");
  assert.equal((state.routes[1].params as Record<string, unknown>).seriesSlug, "s1");
});

test("resolveReturnRoutes: chai -> ShortFilmChaiAmount carrying shortFilm and selectedAmount", () => {
  const state = resolveReturnRoutes({ kind: "chai", shortFilm: sampleShortFilm as never, selectedAmount: 5 });
  assert.equal(state.routes[1].name, "ShortFilmChaiAmount");
  const params = state.routes[1].params as Record<string, unknown>;
  assert.equal((params.shortFilm as Record<string, unknown>).slug, "sf-1");
  assert.equal(params.selectedAmount, 5);
});

test("resolveReturnRoutes: chai with null selectedAmount still resolves to ShortFilmChaiAmount", () => {
  const state = resolveReturnRoutes({ kind: "chai", shortFilm: sampleShortFilm as never, selectedAmount: null });
  assert.equal(state.routes[1].name, "ShortFilmChaiAmount");
  assert.equal((state.routes[1].params as Record<string, unknown>).selectedAmount, undefined);
});

test("resolveReturnRoutes: chai without selectedAmount resolves to ShortFilmChaiAmount", () => {
  const parsed = parseAuthReturnIntent(JSON.stringify({ kind: "chai", shortFilm: { slug: "x" } }));
  assert.ok(parsed, "chai with valid slug should parse");
  assert.equal(parsed?.kind, "chai");
  if (parsed && parsed.kind === "chai") {
    assert.equal((parsed.shortFilm as Record<string, unknown>).slug, "x");
    assert.equal(parsed.selectedAmount, undefined);
  }
});

test("resolveReturnRoutes: home -> MainTabs / Home fallback", () => {
  const state = resolveReturnRoutes({ kind: "home" });
  assert.equal(state.index, 0);
  assert.equal(state.routes[0].params?.screen, "Home");
});

test("invalid discriminant falls back through parse as null", () => {
  assert.equal(parseAuthReturnIntent(JSON.stringify({ kind: "coinUnlock" })), null);
});
