import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { SeriesResponse } from "../types/api";
import {
  captureAccessRequest, getConfirmedPlayableEpisode, getConfirmedSeriesAccess,
  invalidateConfirmedSeriesAccess, isCurrentAccessIdentity, isCurrentAccessRequest,
  publishConfirmedSeriesAccess, registerRefreshedAccessToken, setConfirmedAccessIdentity,
  subscribeConfirmedSeriesAccess,
} from "./confirmedSeriesAccess";

const response = (canWatch: boolean): SeriesResponse => ({
  series: { slug: "one", episodes: [{ number: 1 }] },
  episodeAccess: { "1": { canWatch, kind: canWatch ? "owned" : "locked", label: canWatch ? "Owned" : "Locked" } },
} as SeriesResponse);

afterEach(() => { setConfirmedAccessIdentity(null); invalidateConfirmedSeriesAccess(); });

test("guest → A → logout → guest → B cannot inherit or publish each other's access", () => {
  const guest = captureAccessRequest();
  publishConfirmedSeriesAccess(response(false), guest);
  setConfirmedAccessIdentity("A", "token-A");
  assert.equal(getConfirmedSeriesAccess("one"), null);
  assert.equal(publishConfirmedSeriesAccess(response(true), guest), false);
  const accountA = captureAccessRequest("token-A");
  assert.equal(publishConfirmedSeriesAccess(response(true), accountA), true);
  setConfirmedAccessIdentity(null);
  assert.equal(getConfirmedSeriesAccess("one"), null);
  assert.equal(captureAccessRequest("token-A"), null);
  const secondGuest = captureAccessRequest();
  assert.equal(publishConfirmedSeriesAccess(response(true), accountA), false);
  setConfirmedAccessIdentity("B", "token-B");
  assert.equal(publishConfirmedSeriesAccess(response(true), secondGuest), false);
  assert.equal(publishConfirmedSeriesAccess(response(true), accountA), false);
  assert.equal(getConfirmedSeriesAccess("one"), null);
  assert.equal(publishConfirmedSeriesAccess(response(false), captureAccessRequest("token-B")), true);
  assert.equal(getConfirmedSeriesAccess("one")?.episodeAccess["1"].canWatch, false);
});

test("same-user token refresh keeps identity; another user's refresh cannot replay a request", () => {
  setConfirmedAccessIdentity("A", "first-token");
  const scope = captureAccessRequest("first-token");
  publishConfirmedSeriesAccess(response(true), scope);
  assert.equal(registerRefreshedAccessToken(scope, "B", "wrong-token"), false);
  assert.equal(captureAccessRequest("wrong-token"), null);
  assert.equal(registerRefreshedAccessToken(scope, "A", "fresh-token"), true);
  setConfirmedAccessIdentity("A", "fresh-token");
  assert.equal(isCurrentAccessRequest(scope), true);
  assert.equal(getConfirmedSeriesAccess("one")?.episodeAccess["1"].canWatch, true);
  setConfirmedAccessIdentity(null);
  setConfirmedAccessIdentity("A", "new-login-token");
  assert.equal(registerRefreshedAccessToken(scope, "A", "late-token"), false);
});

test("invalidation notifies mounted consumers and obsoletes access reads without changing user identity", () => {
  setConfirmedAccessIdentity("A", "token-A");
  const scope = captureAccessRequest("token-A");
  const events: (SeriesResponse | null)[] = [];
  const unsubscribe = subscribeConfirmedSeriesAccess((value) => events.push(value));
  publishConfirmedSeriesAccess(response(true), scope);
  invalidateConfirmedSeriesAccess();
  assert.equal(events[1], null);
  assert.equal(isCurrentAccessIdentity(scope), true);
  assert.equal(isCurrentAccessRequest(scope), false);
  assert.equal(publishConfirmedSeriesAccess(response(true), scope), false);
  unsubscribe();
});

test("latest server denial replaces owned hints; missing access or missing episode cannot open Watch", () => {
  const scope = captureAccessRequest();
  publishConfirmedSeriesAccess(response(true), scope);
  assert.ok(getConfirmedPlayableEpisode(response(true), 1));
  publishConfirmedSeriesAccess(response(false), scope);
  assert.equal(getConfirmedSeriesAccess("one")?.episodeAccess["1"].canWatch, false);
  assert.equal(getConfirmedPlayableEpisode(response(false), 1), null);
  assert.equal(getConfirmedPlayableEpisode({ ...response(true), episodeAccess: {} }, 1), null);
  assert.equal(getConfirmedPlayableEpisode(response(true), 2), null);
});
