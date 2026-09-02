import { createVerify } from "node:crypto";
import { errorResponse } from "@/lib/api/responses";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeRewardedAdCallback } from "@/lib/rewarded-ads";

export const runtime = "nodejs";

const ADMOB_VERIFIER_KEYS_URL = "https://gstatic.com/admob/reward/verifier-keys.json";
const ADMOB_VERIFIER_KEYS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type VerifierKey = {
  keyId: number;
  pem: string;
};

type VerifierKeysResponse = {
  keys?: VerifierKey[];
};

type CachedVerifierKeys = {
  fetchedAt: number;
  keys: Map<number, string>;
};

let cachedVerifierKeys: CachedVerifierKeys | null = null;
let cachedVerifierKeysPromise: Promise<Map<number, string>> | null = null;

function noStoreResponse(status = 200) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function getExpectedAdUnitId() {
  const value = process.env.ADMOB_REWARDED_AD_UNIT_ID?.trim();

  return value || null;
}

function parseRewardedSsvQuery(url: string) {
  const queryIndex = url.indexOf("?");

  if (queryIndex === -1) {
    throw new Error("needs a query string");
  }

  const queryString = url.slice(queryIndex + 1);
  const signatureIndex = queryString.lastIndexOf("&signature=");

  if (signatureIndex === -1) {
    throw new Error("needs a signature query parameter");
  }

  const verificationContent = queryString.slice(0, signatureIndex);
  const signatureAndKeyId = queryString.slice(signatureIndex + 1);
  const keyIdIndex = signatureAndKeyId.indexOf("&key_id=");

  if (keyIdIndex === -1) {
    throw new Error("needs a key_id query parameter");
  }

  if (signatureAndKeyId.slice(0, "signature=".length) !== "signature=") {
    throw new Error("malformed signature query parameter");
  }

  const signature = signatureAndKeyId.slice(
    "signature=".length,
    keyIdIndex,
  );
  const keyIdValue = signatureAndKeyId.slice(keyIdIndex + "&key_id=".length);

  if (!signature || !keyIdValue || keyIdValue.includes("&")) {
    throw new Error("malformed key_id query parameter");
  }

  return {
    customData: new URLSearchParams(queryString).get("custom_data"),
    keyId: Number.parseInt(keyIdValue, 10),
    queryString,
    signature,
    verificationContent,
  };
}

async function fetchVerifierKeys() {
  const response = await fetch(ADMOB_VERIFIER_KEYS_URL);

  if (!response.ok) {
    throw new Error(`Unexpected status code = ${response.status}`);
  }

  const body = (await response.json()) as VerifierKeysResponse;
  const keys = new Map<number, string>();

  for (const key of body.keys ?? []) {
    if (typeof key.keyId === "number" && typeof key.pem === "string" && key.pem.trim()) {
      keys.set(key.keyId, key.pem);
    }
  }

  if (!keys.size) {
    throw new Error("No trusted keys are available.");
  }

  return keys;
}

async function getVerifierKeys() {
  if (cachedVerifierKeys && Date.now() - cachedVerifierKeys.fetchedAt < ADMOB_VERIFIER_KEYS_CACHE_TTL_MS) {
    return cachedVerifierKeys.keys;
  }

  if (!cachedVerifierKeysPromise) {
    cachedVerifierKeysPromise = fetchVerifierKeys();
  }

  try {
    const keys = await cachedVerifierKeysPromise;
    cachedVerifierKeys = {
      fetchedAt: Date.now(),
      keys,
    };
    return keys;
  } finally {
    cachedVerifierKeysPromise = null;
  }
}

function verifySignature(verificationContent: string, signature: string, pem: string) {
  const verifier = createVerify("sha256");
  verifier.update(verificationContent, "utf8");
  verifier.end();

  return verifier.verify(pem, Buffer.from(signature, "base64url"));
}

export async function POST(request: Request) {
  const parsed = (() => {
    try {
      return parseRewardedSsvQuery(request.url);
    } catch {
      return null;
    }
  })();

  if (!parsed || !parsed.customData || !Number.isInteger(parsed.keyId) || parsed.keyId <= 0) {
    return errorResponse("invalid_request", "A valid rewarded SSV callback is required.", 400);
  }

  let keys: Map<number, string>;

  try {
    keys = await getVerifierKeys();
  } catch {
    return errorResponse("server_error", "Unable to verify rewarded SSV callback.", 500);
  }

  const pem = keys.get(parsed.keyId);

  if (!pem) {
    return errorResponse("forbidden", "Invalid rewarded SSV signature.", 403);
  }

  let signatureValid = false;

  try {
    signatureValid = verifySignature(parsed.verificationContent, parsed.signature, pem);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return errorResponse("forbidden", "Invalid rewarded SSV signature.", 403);
  }

  const query = new URL(request.url).searchParams;
  const expectedAdUnitId = getExpectedAdUnitId();
  const adUnit = query.get("ad_unit");

  // Phase 7: production rewarded requires a pinned, configured ad unit. Fail
  // closed — do NOT silently accept any Google-signed rewarded ad unit.
  const production = process.env.NODE_ENV === "production";

  if (production) {
    if (!expectedAdUnitId) {
      return errorResponse("server_error", "Rewarded ads are not configured for production.", 503);
    }
    if (adUnit !== expectedAdUnitId) {
      return errorResponse("forbidden", "Unexpected rewarded SSV ad unit.", 403);
    }
  } else if (expectedAdUnitId && adUnit !== expectedAdUnitId) {
    return errorResponse("forbidden", "Unexpected rewarded SSV ad unit.", 403);
  }

  const providerTransactionId = query.get("transaction_id");

  if (!providerTransactionId) {
    return errorResponse("invalid_request", "A transaction_id query parameter is required.", 400);
  }

  const result = await finalizeRewardedAdCallback(parsed.customData, providerTransactionId, createAdminClient());

  if (!result) {
    return errorResponse("server_error", "Unable to process rewarded SSV callback.", 500);
  }

  return noStoreResponse();
}
