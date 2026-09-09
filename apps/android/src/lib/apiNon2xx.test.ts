// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";

/**
 * Regression tests for S1-02: non-2xx HTTP response handling in requestApi.
 *
 * requestApi is private/unexported. This harness mirrors the exact response-path
 * branching from api.ts to verify all 11 matrix cases without exposing internals
 * or modifying production code.
 *
 * Matrix:
 *  1. 200 + { data: ... }         → returns data
 *  2. 200 + { error: ... }        → ApiError preserving code/message
 *  3. 400 + { error: ... }        → ApiError preserving code/message/status
 *  4. 401 + valid token (first)   → refresh + retry (exactly once)
 *  5. 401 + _isRetry: true        → no second refresh, falls through to non-2xx guard
 *  6. 404 + non-JSON body         → invalid_response preserved
 *  7. 500 + {}                    → generic server_error ApiError
 *  8. 500 + { data: ... }         → generic server_error ApiError
 *  9. 503 + { error: ... }        → structured ApiError preserved
 * 10. network rejection           → network_error preserved
 * 11. JSON parse failure          → invalid_response preserved
 *
 * S1-03 additions (double-refresh fix):
 * 12. 401 + refresh 4xx           → exactly 1 refresh, exactly 1 signOut, throws not_authenticated, Path B skipped
 * 13. 401 + refresh network error → exactly 1 refresh, throws network_error, no signOut, Path B skipped
 * 14. 401 + no session/no error   → exactly 1 refresh, throws not_authenticated, Path B skipped
 * 15. 401 + {} body + refresh 4xx → exactly 1 refresh, signOut, terminates (no body parse path)
 * 16. 200 + not_authenticated     → Path B executes, exactly 1 refresh
 * 17. 403 + not_authenticated     → Path B executes, exactly 1 refresh
 * 18. _isRetry=true + 401         → no refresh at all
 * 19. 401 + refresh 4xx + not_authenticated body → exactly 1 refresh (Path B must NOT add second)
 */

// ─── Minimal ApiError replica matching api.ts ─────────────────────────────────

class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type ApiEnvelope<T> = { data?: T; error?: { code: string; message: string } };

// ─── Harness — mirrors requestApi branching exactly ───────────────────────────

interface HarnessOptions {
  status: number;
  body: unknown;
  networkReject?: boolean;
  jsonThrows?: boolean;
  accessToken?: string;
  _isRetry?: boolean;
  // Called when refresh is triggered; returns new access token, null (4xx auth error), or error type
  onRefresh?: () => Promise<{ token: string | null; authError?: boolean; networkError?: boolean }>;
  // Tracks signOut calls
  signOutCalls?: number[];
  // Tracks retry calls
  retryCalls?: string[];
  // Tracks total refresh invocations
  refreshCalls?: number[];
}

async function runRequestHarness<T>(opts: HarnessOptions): Promise<T> {
  const {
    status,
    body,
    networkReject = false,
    jsonThrows = false,
    accessToken,
    _isRetry = false,
    onRefresh,
    retryCalls,
    signOutCalls,
    refreshCalls,
  } = opts;

  // Step 1: fetch
  if (networkReject) {
    throw new ApiError("network_error", "Could not reach 0nya.", 0);
  }

  const response = {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (jsonThrows) throw new SyntaxError("Unexpected token");
      return body;
    },
  };

  // Step 2: 401 status-based refresh — Path A (mirrors api.ts lines 287-322)
  // S1-03: On 4xx auth failure, throw immediately after signOut (no fallthrough).
  if (response.status === 401 && accessToken && !_isRetry) {
    const refreshResult = await onRefresh?.();
    refreshCalls?.push(1);
    if (refreshResult?.token) {
      // Successful refresh → retry (exactly once)
      retryCalls?.push("retry-with-" + refreshResult.token);
      return { _retried: true, newToken: refreshResult.token } as unknown as T;
    } else if (refreshResult?.networkError) {
      // Non-4xx refresh error → throw network_error, no signOut
      throw new ApiError("network_error", "Could not reach 0nya during session refresh.", 0);
    } else if (refreshResult?.authError) {
      // 4xx refresh error → signOut + throw not_authenticated immediately (S1-03 fix)
      signOutCalls?.push(1);
      throw new ApiError("not_authenticated", "Your session has expired. Please sign in again.", 401);
    } else {
      // No session and no error — unusual; terminate rather than falling through (S1-03 fix)
      throw new ApiError("not_authenticated", "Session could not be established. Please sign in again.", 401);
    }
  }

  // Step 3: parse JSON
  let parsed: ApiEnvelope<T> | T;
  try {
    parsed = (await response.json()) as ApiEnvelope<T> | T;
  } catch {
    throw new ApiError("invalid_response", "The server returned an invalid response.", response.status);
  }

  // Step 4: structured error envelope — Path B (mirrors api.ts lines 342-380)
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const envelope = parsed as { error: { code: string; message: string } };
    // not_authenticated + token + !_isRetry → refresh (Path B, for non-401 responses)
    if (envelope.error.code === "not_authenticated" && accessToken && !_isRetry) {
      const refreshResult = await onRefresh?.();
      refreshCalls?.push(1);
      if (refreshResult?.token) {
        retryCalls?.push("retry-with-" + refreshResult.token);
        return { _retried: true, newToken: refreshResult.token } as unknown as T;
      }
    }
    throw new ApiError(envelope.error.code, envelope.error.message, response.status);
  }

  // Step 5: non-2xx guard — S1-02 (mirrors api.ts lines 382-394)
  if (!response.ok) {
    throw new ApiError("server_error", "The server returned an unexpected error.", response.status);
  }

  // Step 6: success return (mirrors api.ts lines 396-407)
  if (parsed && typeof parsed === "object" && "data" in parsed && (parsed as Record<string, unknown>).data !== undefined) {
    return (parsed as { data: T }).data;
  }

  return parsed as T;
}

// ─── Test cases ───────────────────────────────────────────────────────────────

// 1. 200 + { data: ... } → returns data
test("200 + { data: ... } → returns inner data", async () => {
  const result = await runRequestHarness<{ id: number }>({
    status: 200,
    body: { data: { id: 42 } },
  });
  assert.deepEqual(result, { id: 42 });
});

// 2. 200 + { error: ... } → ApiError preserving code/message
test("200 + { error: ... } → ApiError with code and message", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 200, body: { error: { code: "not_found", message: "Not found" } } }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "not_found");
      assert.equal(err.message, "Not found");
      assert.equal(err.status, 200);
      return true;
    },
  );
});

// 3. 400 + { error: ... } → ApiError preserving code/message/status
test("400 + { error: ... } → ApiError preserving code/message/status", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 400, body: { error: { code: "validation_error", message: "Bad input" } } }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "validation_error");
      assert.equal(err.message, "Bad input");
      assert.equal(err.status, 400);
      return true;
    },
  );
});

// 4. 401 + valid token (first attempt) → refresh + exactly one retry
test("401 + accessToken + !_isRetry → refresh triggered, exactly one retry", async () => {
  const retryCalls: string[] = [];
  const refreshCalls: number[] = [];
  const result = await runRequestHarness({
    status: 401,
    body: {},
    accessToken: "stale-token",
    _isRetry: false,
    retryCalls,
    refreshCalls,
    onRefresh: async () => ({ token: "fresh-token" }),
  });
  assert.deepEqual(result, { _retried: true, newToken: "fresh-token" });
  assert.deepEqual(retryCalls, ["retry-with-fresh-token"]);
  assert.equal(refreshCalls.length, 1, "Exactly one refresh call");
});

// 5. 401 + _isRetry: true → no refresh, falls through to non-2xx server_error guard
test("401 + _isRetry: true → no second refresh, server_error thrown", async () => {
  const retryCalls: string[] = [];
  const refreshCalls: number[] = [];
  await assert.rejects(
    () => runRequestHarness({
      status: 401,
      body: {},
      accessToken: "stale-token",
      _isRetry: true,
      retryCalls,
      refreshCalls,
      onRefresh: async () => ({ token: "should-not-be-called" }),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "server_error");
      assert.equal(err.status, 401);
      return true;
    },
  );
  assert.deepEqual(retryCalls, [], "No retry must occur when _isRetry is true");
  assert.equal(refreshCalls.length, 0, "No refresh must occur when _isRetry is true");
});


// 6. 404 + non-JSON body → invalid_response preserved
test("404 + non-JSON body → invalid_response ApiError", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 404, body: null, jsonThrows: true }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "invalid_response");
      assert.equal(err.status, 404);
      return true;
    },
  );
});

// 7. 500 + {} → generic server_error ApiError (THE KEY REGRESSION CASE)
test("500 + {} → server_error ApiError, not success path", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 500, body: {} }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError, "Must throw ApiError, not silently succeed");
      assert.equal(err.code, "server_error");
      assert.equal(err.message, "The server returned an unexpected error.");
      assert.equal(err.status, 500);
      return true;
    },
  );
});

// 8. 500 + { data: ... } → generic server_error ApiError (THE KEY REGRESSION CASE)
test("500 + { data: ... } → server_error ApiError, data not returned", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 500, body: { data: { secret: "should-not-leak" } } }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError, "Must throw ApiError, not return inner data");
      assert.equal(err.code, "server_error");
      assert.equal(err.status, 500);
      return true;
    },
  );
});

// 9. 503 + { error: ... } → structured ApiError preserved (structured path runs before non-2xx guard)
test("503 + { error: ... } → structured ApiError with server code and status", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 503, body: { error: { code: "service_unavailable", message: "Try again later" } } }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "service_unavailable");
      assert.equal(err.message, "Try again later");
      assert.equal(err.status, 503);
      return true;
    },
  );
});

// 10. Network rejection → network_error preserved
test("Network rejection → network_error ApiError", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 0, body: null, networkReject: true }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "network_error");
      assert.equal(err.status, 0);
      return true;
    },
  );
});

// 11. JSON parse failure → invalid_response preserved
test("JSON parse failure → invalid_response ApiError", async () => {
  await assert.rejects(
    () => runRequestHarness({ status: 200, body: null, jsonThrows: true }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "invalid_response");
      assert.equal(err.status, 200);
      return true;
    },
  );
});

// ─── S1-03: Double-refresh regression tests ───────────────────────────────────

// 12. 401 + refresh 4xx → exactly 1 refresh, exactly 1 signOut, throws not_authenticated, Path B skipped
test("S1-03: 401 + refresh 4xx → 1 refresh, 1 signOut, not_authenticated, Path B skipped", async () => {
  const refreshCalls: number[] = [];
  const signOutCalls: number[] = [];
  await assert.rejects(
    () => runRequestHarness({
      status: 401,
      body: { error: { code: "not_authenticated", message: "auth error" } },
      accessToken: "stale-token",
      refreshCalls,
      signOutCalls,
      onRefresh: async () => ({ token: null, authError: true }),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "not_authenticated");
      assert.equal(err.status, 401);
      return true;
    },
  );
  assert.equal(refreshCalls.length, 1, "Exactly 1 refresh (Path A only — Path B must NOT execute)");
  assert.equal(signOutCalls.length, 1, "Exactly 1 signOut");
});

// 13. 401 + refresh network/non-4xx error → exactly 1 refresh, throws network_error, no signOut, Path B skipped
test("S1-03: 401 + refresh network error → 1 refresh, network_error, no signOut, Path B skipped", async () => {
  const refreshCalls: number[] = [];
  const signOutCalls: number[] = [];
  await assert.rejects(
    () => runRequestHarness({
      status: 401,
      body: { error: { code: "not_authenticated", message: "auth error" } },
      accessToken: "stale-token",
      refreshCalls,
      signOutCalls,
      onRefresh: async () => ({ token: null, networkError: true }),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "network_error");
      return true;
    },
  );
  assert.equal(refreshCalls.length, 1, "Exactly 1 refresh (Path A only — Path B must NOT execute)");
  assert.equal(signOutCalls.length, 0, "No signOut for network error");
});

// 14. 401 + no session and no error → exactly 1 refresh, throws not_authenticated, Path B skipped
test("S1-03: 401 + no session/no error → 1 refresh, not_authenticated, Path B skipped", async () => {
  const refreshCalls: number[] = [];
  const signOutCalls: number[] = [];
  await assert.rejects(
    () => runRequestHarness({
      status: 401,
      body: { error: { code: "not_authenticated", message: "auth error" } },
      accessToken: "stale-token",
      refreshCalls,
      signOutCalls,
      // Simulates Supabase returning neither session nor error
      onRefresh: async () => ({ token: null }),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "not_authenticated");
      assert.equal(err.status, 401);
      return true;
    },
  );
  assert.equal(refreshCalls.length, 1, "Exactly 1 refresh (Path A only — Path B must NOT execute)");
  assert.equal(signOutCalls.length, 0, "No signOut for no-session/no-error case");
});

// 15. 401 + {} body (no error envelope) + refresh 4xx → 1 refresh, signOut, terminates
test("S1-03: 401 + {} body + refresh 4xx → 1 refresh, 1 signOut, terminates", async () => {
  const refreshCalls: number[] = [];
  const signOutCalls: number[] = [];
  await assert.rejects(
    () => runRequestHarness({
      status: 401,
      body: {},
      accessToken: "stale-token",
      refreshCalls,
      signOutCalls,
      onRefresh: async () => ({ token: null, authError: true }),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "not_authenticated");
      assert.equal(err.status, 401);
      return true;
    },
  );
  assert.equal(refreshCalls.length, 1, "Exactly 1 refresh");
  assert.equal(signOutCalls.length, 1, "Exactly 1 signOut");
});

// 16. 200 + not_authenticated → Path B functional, exactly 1 refresh
test("S1-03: 200 + not_authenticated → Path B executes, exactly 1 refresh", async () => {
  const refreshCalls: number[] = [];
  const retryCalls: string[] = [];
  const result = await runRequestHarness({
    status: 200,
    body: { error: { code: "not_authenticated", message: "auth error" } },
    accessToken: "stale-token",
    refreshCalls,
    retryCalls,
    onRefresh: async () => ({ token: "fresh-token" }),
  });
  assert.deepEqual(result, { _retried: true, newToken: "fresh-token" });
  assert.equal(refreshCalls.length, 1, "Exactly 1 refresh from Path B");
  assert.deepEqual(retryCalls, ["retry-with-fresh-token"]);
});

// 17. 403 + not_authenticated → Path B functional, exactly 1 refresh
test("S1-03: 403 + not_authenticated → Path B executes, exactly 1 refresh", async () => {
  const refreshCalls: number[] = [];
  const retryCalls: string[] = [];
  const result = await runRequestHarness({
    status: 403,
    body: { error: { code: "not_authenticated", message: "auth error" } },
    accessToken: "stale-token",
    refreshCalls,
    retryCalls,
    onRefresh: async () => ({ token: "fresh-token" }),
  });
  assert.deepEqual(result, { _retried: true, newToken: "fresh-token" });
  assert.equal(refreshCalls.length, 1, "Exactly 1 refresh from Path B");
  assert.deepEqual(retryCalls, ["retry-with-fresh-token"]);
});

// 18. _isRetry=true + 401 → no refresh at all
test("S1-03: _isRetry=true + 401 → no refresh", async () => {
  const refreshCalls: number[] = [];
  await assert.rejects(
    () => runRequestHarness({
      status: 401,
      body: {},
      accessToken: "stale-token",
      _isRetry: true,
      refreshCalls,
      onRefresh: async () => ({ token: "should-not-be-called" }),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "server_error");
      return true;
    },
  );
  assert.equal(refreshCalls.length, 0, "Zero refresh calls when _isRetry is true");
});

// 19. 401 + refresh 4xx + not_authenticated body → Path A terminates, Path B never runs (total = 1 refresh)
test("S1-03: 401 + refresh 4xx + not_authenticated body → exactly 1 refresh total (no double-refresh)", async () => {
  const refreshCalls: number[] = [];
  const signOutCalls: number[] = [];
  await assert.rejects(
    () => runRequestHarness({
      status: 401,
      body: { error: { code: "not_authenticated", message: "You must be signed in." } },
      accessToken: "stale-token",
      refreshCalls,
      signOutCalls,
      onRefresh: async () => ({ token: null, authError: true }),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "not_authenticated");
      assert.equal(err.status, 401);
      return true;
    },
  );
  // THE KEY ASSERTION: Path A throws immediately after signOut.
  // Path B (not_authenticated body) must never be reached.
  assert.equal(refreshCalls.length, 1, "DOUBLE-REFRESH: Exactly 1 refresh total — Path B must not add a second");
  assert.equal(signOutCalls.length, 1, "Exactly 1 signOut");
});
