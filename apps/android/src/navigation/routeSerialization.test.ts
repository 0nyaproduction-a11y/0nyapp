// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import {
  isValidEpisodeAccessRouteParams,
  stripNonUrlRouteParams,
  stringifyEpisodeAccessParam,
  getWatchRouteParams,
  getWatchEpisodeTransitionParams,
  watchPathConfig,
} from "./routeSerialization";
// @ts-expect-error Import the installed router's pure implementation without native UI modules.
import { getPathFromState } from "../../node_modules/@react-navigation/core/lib/module/getPathFromState.js";
// @ts-expect-error Import the installed router's pure implementation without native UI modules.
import { getStateFromPath } from "../../node_modules/@react-navigation/core/lib/module/getStateFromPath.js";

test("Episode Access route values remain primitive and URL-safe", () => {
  assert.equal(stringifyEpisodeAccessParam("funeral-procession"), "funeral-procession");
  assert.equal(stringifyEpisodeAccessParam(3), "3");
  assert.doesNotMatch(
    `${stringifyEpisodeAccessParam("funeral-procession")}/${stringifyEpisodeAccessParam(3)}`,
    /\[object Object\]/,
  );
});

test("malformed Episode Access route values fail closed", () => {
  assert.equal(
    isValidEpisodeAccessRouteParams({
      episodeNumber: "[object Object]",
      seriesSlug: "[object Object]",
    }),
    false,
  );
  assert.equal(
    isValidEpisodeAccessRouteParams({ episodeNumber: 3, seriesSlug: "funeral-procession" }),
    true,
  );
});

test("rich Episode Access params are excluded from URL state", () => {
  const state = stripNonUrlRouteParams({
    key: "root",
    index: 0,
    routeNames: ["EpisodeAccessOptions"],
    type: "stack",
    stale: false,
    routes: [
      {
        key: "episode-access",
        name: "EpisodeAccessOptions",
        params: {
          access: { canWatch: false },
          episode: { number: 5 },
          episodeAccess: { "5": { kind: "coins" } },
          episodeNumber: 5,
          seriesSlug: "aadha-takiya",
        },
      },
    ],
  });

  assert.deepEqual(state.routes[0]?.params, {
    episodeNumber: 5,
    seriesSlug: "aadha-takiya",
  });
  assert.doesNotMatch(JSON.stringify(state), /\[object Object\]/);
});

test("rich Short Film End params are excluded from URL state", () => {
  const state = stripNonUrlRouteParams({
    key: "root",
    index: 0,
    routeNames: ["ShortFilmEnd"],
    type: "stack",
    stale: false,
    routes: [
      {
        key: "short-film-end",
        name: "ShortFilmEnd",
        params: {
          chai: { allowedCoinAmounts: [11, 21], available: true },
          hasSentChaiThisPlayback: false,
          shortFilm: {
            chaiEnabled: true,
            heroImage: "https://example.com/hero.jpg",
            slug: "ek-raat",
            title: "Ek Raat",
          },
        },
      },
    ],
  });

  assert.deepEqual(state.routes[0]?.params, {
    hasSentChaiThisPlayback: false,
    slug: "ek-raat",
  });
  assert.doesNotMatch(JSON.stringify(state), /\[object Object\]/);
});

test("nested MainTabs params are excluded from URL state", () => {
  const state = stripNonUrlRouteParams({
    key: "root",
    index: 0,
    routeNames: ["MainTabs"],
    type: "stack",
    stale: false,
    routes: [
      {
        key: "main-tabs",
        name: "MainTabs",
        params: { params: { screen: "Profile" } },
        state: {
          key: "tabs",
          index: 0,
          routeNames: ["Profile"],
          type: "tab",
          stale: false,
          routes: [{ key: "profile", name: "Profile", params: { params: { screen: "Account" } } }],
        },
      },
    ],
  });

  assert.equal(state.routes[0]?.params, undefined);
  assert.doesNotMatch(JSON.stringify(state), /\[object Object\]/);
});

test("private Search attribution context is excluded from URL state", () => {
  const state = stripNonUrlRouteParams({
    key: "root",
    index: 0,
    routeNames: ["ShortFilm"],
    type: "stack",
    stale: false,
    routes: [
      {
        key: "short-film",
        name: "ShortFilm",
        params: {
          searchContext: {
            contentId: "film-id",
            contentSlug: "a-film",
            contentType: "SHORT_FILM",
            searchQueryContext: "private query",
            searchResultPosition: 1,
            sourceSurface: "search",
          },
          slug: "a-film",
        },
      },
    ],
  });

  assert.deepEqual(state.routes[0]?.params, { slug: "a-film" });
  assert.doesNotMatch(JSON.stringify(state), /private query/);
});

const watchConfig = { screens: { MainTabs: "", Series: "series/:slug", Watch: watchPathConfig } };

test("active Watch path config round-trips canonical identity and explicit resume through the real router", () => {
  const state = { routes: [{ name: "Watch", params: {
    seriesSlug: "aadha-takiya", episodeNumber: 3, resumeAtSeconds: 48,
    series: { slug: "wrong-series" }, episode: { number: 99 }, access: { canWatch: true },
    episodeAccess: { 3: { canWatch: true } }, searchContext: { private: "value" },
  } }] };
  const path = getPathFromState(stripNonUrlRouteParams(state), watchConfig);
  assert.equal(path, "/watch/aadha-takiya/3?resumeAtSeconds=48");
  assert.doesNotMatch(path, /undefined|object|access|private/);
  const refreshed = getStateFromPath(path, watchConfig);
  assert.deepEqual(getWatchRouteParams(refreshed.routes[0].params), {
    seriesSlug: "aadha-takiya", episodeNumber: 3, resumeAtSeconds: 48,
  });
});

test("Watch preserves originating routes while the current episode URL changes", () => {
  const state = { index: 1, routes: [
    { key: "series-origin", name: "Series", params: { slug: "aadha-takiya" } },
    { key: "watch", name: "Watch", params: { seriesSlug: "aadha-takiya", episodeNumber: 4 } },
  ] };
  const clean = stripNonUrlRouteParams(state);
  assert.equal(getPathFromState(clean, watchConfig), "/watch/aadha-takiya/4");
  assert.deepEqual(clean.routes[0], state.routes[0]);
  assert.equal(getPathFromState({ routes: clean.routes.slice(0, 1) }, watchConfig), "/series/aadha-takiya");
});

test("malformed Watch identities cannot generate undefined URLs or reconstruct a target", () => {
  for (const params of [
    {}, { seriesSlug: "undefined", episodeNumber: 1 },
    { seriesSlug: "[object Object]", episodeNumber: 1 },
    { seriesSlug: "a/b", episodeNumber: 1 }, { seriesSlug: "a", episodeNumber: 0 },
    { seriesSlug: "a", episodeNumber: Number.NaN }, { seriesSlug: "a", episodeNumber: 1.5 },
    { seriesSlug: "a", episodeNumber: "2" },
  ]) {
    assert.equal(getWatchRouteParams(params), null);
    assert.equal(getPathFromState(stripNonUrlRouteParams({ routes: [{ name: "Watch", params }] }), watchConfig), "/");
  }
  for (const path of ["/watch/undefined/undefined", "/watch/a/NaN", "/watch/a/0", "/watch/a/1.5"]) {
    const state = getStateFromPath(path, watchConfig);
    assert.equal(state ? getWatchRouteParams(state.routes[0].params) : null, null);
  }
});

test("replay intent survives reload and invalid resume values do not become seeks", () => {
  const params = { seriesSlug: "a", episodeNumber: 2, startFromBeginning: true, resumeAtSeconds: Number.POSITIVE_INFINITY };
  const path = getPathFromState(stripNonUrlRouteParams({ routes: [{ name: "Watch", params }] }), watchConfig);
  assert.equal(path, "/watch/a/2?startFromBeginning=true");
  assert.deepEqual(getWatchRouteParams(getStateFromPath(path, watchConfig).routes[0].params), {
    seriesSlug: "a", episodeNumber: 2, startFromBeginning: true,
  });
});

test("the production manual/auto-next transition consumes A's explicit resume and preload before B", () => {
  const fromA = { seriesSlug: "a", episodeNumber: 1, resumeAtSeconds: 48, startFromBeginning: true, series: { slug: "a" }, episode: { number: 1 }, access: { canWatch: true } };
  const onB = { ...fromA, ...getWatchEpisodeTransitionParams("a", 2) };
  assert.deepEqual(getWatchRouteParams(onB), { seriesSlug: "a", episodeNumber: 2 });
  assert.equal(onB.episode, undefined);
  assert.equal(onB.access, undefined);
  assert.equal(getPathFromState(stripNonUrlRouteParams({ routes: [{ name: "Watch", params: onB }] }), watchConfig), "/watch/a/2");
});
