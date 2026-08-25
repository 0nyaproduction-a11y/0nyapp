import "server-only";

export function getMuxApiCredentials() {
  const tokenId = process.env.MUX_TOKEN_ID?.trim();
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();

  if (!tokenId || !tokenSecret) {
    throw new Error("Missing Mux API credentials.");
  }

  return { tokenId, tokenSecret };
}

export function getMuxWebhookSigningSecret() {
  const signingSecret = process.env.MUX_WEBHOOK_SIGNING_SECRET?.trim();

  if (!signingSecret) {
    throw new Error("Missing Mux webhook signing secret.");
  }

  return signingSecret;
}

export function getMuxDirectUploadCorsOrigin() {
  const corsOrigin = process.env.MUX_DIRECT_UPLOAD_CORS_ORIGIN?.trim();

  return corsOrigin ? corsOrigin.replace(/\/$/, "") : null;
}

function normalizeMuxPlaybackPrivateKey(rawKey: string) {
  if (rawKey.includes("BEGIN")) {
    return rawKey;
  }

  const decoded = Buffer.from(rawKey, "base64").toString("utf8").trim();

  return decoded.includes("BEGIN") ? decoded : rawKey;
}

export function getMuxPlaybackSigningCredentials() {
  const keyId = process.env.MUX_PLAYBACK_SIGNING_KEY_ID?.trim();
  const privateKey = process.env.MUX_PLAYBACK_SIGNING_PRIVATE_KEY?.trim();

  if (!keyId || !privateKey) {
    throw new Error("Missing Mux playback signing credentials.");
  }

  return {
    keyId,
    privateKey: normalizeMuxPlaybackPrivateKey(privateKey),
  };
}
