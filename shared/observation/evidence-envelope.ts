/**
 * Versioned, dependency-free evidence handoff contract for a future Observation
 * Bridge. It does not perform transport, persistence, retries, or projection.
 */
export const EVIDENCE_ENVELOPE_SCHEMA_VERSION = "onya_evidence_envelope_v1" as const;

export type EvidenceScalar = string | number | boolean | null;

export type EvidenceCorrelation = {
  causation_id?: string | null;
  correlation_id: string;
  request_id?: string | null;
};

export type EvidenceReferences = Record<string, string>;

export type EvidenceEnvelope = {
  schema_version: typeof EVIDENCE_ENVELOPE_SCHEMA_VERSION;
  producer_id: string;
  evidence_id: string;
  occurred_at: string;
  domain: string;
  type: string;
  source: string;
  source_version: string;
  actor_id: string | null;
  session_id: string | null;
  correlation: EvidenceCorrelation;
  references: EvidenceReferences;
  payload: Record<string, EvidenceScalar>;
};

export type EvidenceEnvelopeInput = Omit<EvidenceEnvelope, "schema_version"> & {
  schema_version?: typeof EVIDENCE_ENVELOPE_SCHEMA_VERSION;
};

export type EvidenceIngressDisposition =
  | "ACCEPT"
  | "DUPLICATE"
  | "REJECT_SCHEMA"
  | "REJECT_PRIVACY"
  | "REJECT_IDENTITY"
  | "REJECT_TIMESTAMP"
  | "IDEMPOTENCY_CONFLICT";

export type EvidenceValidationResult =
  | { ok: true; value: EvidenceEnvelope }
  | { ok: false; disposition: EvidenceRejectionDisposition; errors: string[] };

type EvidenceRejectionDisposition =
  | "REJECT_SCHEMA"
  | "REJECT_PRIVACY"
  | "REJECT_IDENTITY"
  | "REJECT_TIMESTAMP";

export type EvidenceIngressResult =
  | { disposition: "ACCEPT"; value: EvidenceEnvelope; idempotency_key: string; content_hash: string }
  | { disposition: "DUPLICATE"; value: EvidenceEnvelope; idempotency_key: string; content_hash: string }
  | { disposition: "IDEMPOTENCY_CONFLICT"; value: EvidenceEnvelope; idempotency_key: string; content_hash: string }
  | { disposition: "REJECT_SCHEMA" | "REJECT_PRIVACY" | "REJECT_IDENTITY" | "REJECT_TIMESTAMP"; errors: string[] };

export type ExistingEvidenceReceipt = {
  idempotency_key: string;
  content_hash: string;
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCER_ID = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const TYPE_IDENTIFIER = /^[A-Z][A-Z0-9_]{0,63}$/;
const SOURCE = /^[a-z0-9][a-z0-9._:/-]{0,99}$/i;
const VERSION = /^[a-z0-9][a-z0-9._:/@-]{0,99}$/i;
const FIELD_KEY = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_REFERENCE = /^[^\u0000-\u001f]{1,200}$/;
const URL_OR_QUERY = /(?:https?:\/\/|www\.|[?&#=]|%[0-9a-f]{2})/i;
const PII_OR_SECRET =
  /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|bearer\s+[A-Z0-9._-]+|(?:access|refresh|purchase|session)?_?token\s*[:=]\s*[^\s]+|(?:secret|password|api[_-]?key|signature)\s*[:=]\s*[^\s]+)/i;
const MAX_PAYLOAD_KEYS = 24;
const MAX_PAYLOAD_BYTES = 2048;
const MAX_STRING_LENGTH = 256;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function hasSensitiveValue(value: unknown): boolean {
  if (typeof value === "string") return !UUID_V4.test(value) && (PII_OR_SECRET.test(value) || URL_OR_QUERY.test(value));
  if (Array.isArray(value)) return value.some(hasSensitiveValue);
  if (isPlainRecord(value)) return Object.entries(value).some(([key, child]) => PII_OR_SECRET.test(key) || hasSensitiveValue(child));
  return false;
}

function isScalar(value: unknown): value is EvidenceScalar {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

function validationFailure(
  disposition: EvidenceRejectionDisposition,
  errors: string[],
): EvidenceValidationResult {
  return { ok: false, disposition, errors };
}

export function evidenceIdempotencyKey(envelope: Pick<EvidenceEnvelope, "producer_id" | "evidence_id" | "schema_version">): string {
  return `${envelope.producer_id}|${envelope.evidence_id}|${envelope.schema_version}`;
}

export function serializeEvidenceEnvelope(envelope: EvidenceEnvelope): string {
  return JSON.stringify(sortKeys(envelope));
}

// Pure SHA-256 keeps the contract portable across Node, Expo, and a future service.
export function evidenceContentHash(envelope: EvidenceEnvelope): string {
  const bytes = new TextEncoder().encode(serializeEvidenceEnvelope(envelope));
  const words: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] = (words[index >> 2] ?? 0) | (bytes[index] << (24 - (index % 4) * 8));
  }
  words[bytes.length >> 2] = (words[bytes.length >> 2] ?? 0) | (0x80 << (24 - (bytes.length % 4) * 8));
  const lengthIndex = (((bytes.length + 9 + 63) >> 6) << 4) - 1;
  words[lengthIndex] = bytes.length * 8;

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let offset = 0; offset < words.length; offset += 16) {
    const schedule = Array.from({ length: 16 }, (_, index) => words[offset + index] ?? 0);
    for (let index = 16; index < 64; index += 1) {
      const left = schedule[index - 15];
      const right = schedule[index - 2];
      const s0 = ((left >>> 7) | (left << 25)) ^ ((left >>> 18) | (left << 14)) ^ (left >>> 3);
      const s1 = ((right >>> 17) | (right << 15)) ^ ((right >>> 19) | (right << 13)) ^ (right >>> 10);
      schedule[index] = (((schedule[index - 16] + s0) | 0) + ((schedule[index - 7] + s1) | 0)) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choice = (e & f) ^ (~e & g);
      const temp1 = (((((h + s1) | 0) + choice) | 0) + constants[index] + schedule[index]) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return hash.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

export function validateEvidenceEnvelope(input: unknown): EvidenceValidationResult {
  if (!isPlainRecord(input)) return validationFailure("REJECT_SCHEMA", ["evidence envelope must be an object."]);
  if (input.schema_version !== undefined && input.schema_version !== EVIDENCE_ENVELOPE_SCHEMA_VERSION) {
    return validationFailure("REJECT_SCHEMA", ["schema_version is unsupported."]);
  }

  const allowed = new Set(["schema_version", "producer_id", "evidence_id", "occurred_at", "domain", "type", "source", "source_version", "actor_id", "session_id", "correlation", "references", "payload"]);
  const schemaErrors = Object.keys(input).filter((key) => !allowed.has(key)).map((key) => `unsupported field ${key}.`);
  if (schemaErrors.length) return validationFailure("REJECT_SCHEMA", schemaErrors);

  const identityErrors: string[] = [];
  if (typeof input.producer_id !== "string" || !PRODUCER_ID.test(input.producer_id)) identityErrors.push("producer_id is invalid.");
  if (typeof input.evidence_id !== "string" || !UUID_V4.test(input.evidence_id)) identityErrors.push("evidence_id must be a producer-owned UUIDv4.");
  for (const field of ["actor_id", "session_id"] as const) {
    if (input[field] != null && (typeof input[field] !== "string" || !UUID_V4.test(input[field]))) identityErrors.push(`${field} must be a UUIDv4 or null.`);
  }
  if (identityErrors.length) return validationFailure("REJECT_IDENTITY", identityErrors);

  if (!isCanonicalUtcTimestamp(input.occurred_at)) {
    return validationFailure("REJECT_TIMESTAMP", ["occurred_at must be canonical ISO-8601 UTC."]);
  }

  const privacyErrors: string[] = [];
  if (typeof input.domain !== "string" || !TYPE_IDENTIFIER.test(input.domain)) privacyErrors.push("domain is invalid.");
  if (typeof input.type !== "string" || !TYPE_IDENTIFIER.test(input.type)) privacyErrors.push("type is invalid.");
  if (typeof input.source !== "string" || !SOURCE.test(input.source)) privacyErrors.push("source is invalid.");
  if (typeof input.source_version !== "string" || !VERSION.test(input.source_version)) privacyErrors.push("source_version is invalid.");
  if (!isPlainRecord(input.correlation)) {
    privacyErrors.push("correlation must be an object.");
  } else {
    const allowedCorrelation = new Set(["correlation_id", "request_id", "causation_id"]);
    for (const key of Object.keys(input.correlation)) if (!allowedCorrelation.has(key)) privacyErrors.push(`correlation field ${key} is not allowed.`);
    for (const field of ["correlation_id", "request_id", "causation_id"] as const) {
      const value = input.correlation[field];
      if (field === "correlation_id" && (typeof value !== "string" || !UUID_V4.test(value))) privacyErrors.push("correlation_id must be a UUIDv4.");
      if (field !== "correlation_id" && value != null && (typeof value !== "string" || !UUID_V4.test(value))) privacyErrors.push(`${field} must be a UUIDv4 or null.`);
    }
  }
  if (!isPlainRecord(input.references)) {
    privacyErrors.push("references must be an object.");
  } else {
    for (const [key, value] of Object.entries(input.references)) {
      if (!FIELD_KEY.test(key) || typeof value !== "string" || !SAFE_REFERENCE.test(value) || URL_OR_QUERY.test(value)) privacyErrors.push(`reference ${key} is invalid.`);
    }
  }
  if (!isPlainRecord(input.payload)) {
    privacyErrors.push("payload must be an object.");
  } else {
    const entries = Object.entries(input.payload);
    if (entries.length > MAX_PAYLOAD_KEYS) privacyErrors.push(`payload exceeds ${MAX_PAYLOAD_KEYS} keys.`);
    for (const [key, value] of entries) {
      if (!FIELD_KEY.test(key)) privacyErrors.push(`payload field ${key} is invalid.`);
      if (!isScalar(value) || (typeof value === "number" && !Number.isFinite(value))) privacyErrors.push(`payload field ${key} must be a finite scalar.`);
      if (typeof value === "string" && value.length > MAX_STRING_LENGTH) privacyErrors.push(`payload field ${key} exceeds ${MAX_STRING_LENGTH} characters.`);
    }
    if (JSON.stringify(input.payload).length > MAX_PAYLOAD_BYTES) privacyErrors.push(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes.`);
  }
  if (hasSensitiveValue({ correlation: input.correlation, references: input.references, payload: input.payload })) privacyErrors.push("evidence contains URL, PII, or secret material.");
  if (privacyErrors.length) return validationFailure("REJECT_PRIVACY", privacyErrors);

  return {
    ok: true,
    value: {
      ...(input as EvidenceEnvelopeInput),
      schema_version: EVIDENCE_ENVELOPE_SCHEMA_VERSION,
      actor_id: input.actor_id == null ? null : input.actor_id as string,
      session_id: input.session_id == null ? null : input.session_id as string,
      correlation: {
        correlation_id: (input.correlation as EvidenceCorrelation).correlation_id,
        request_id: (input.correlation as EvidenceCorrelation).request_id ?? null,
        causation_id: (input.correlation as EvidenceCorrelation).causation_id ?? null,
      },
    },
  };
}

export function evaluateEvidenceIngress(input: unknown, existing?: ExistingEvidenceReceipt): EvidenceIngressResult {
  const validation = validateEvidenceEnvelope(input);
  if (!validation.ok) return validation;
  const idempotency_key = evidenceIdempotencyKey(validation.value);
  const content_hash = evidenceContentHash(validation.value);
  if (!existing) return { disposition: "ACCEPT", value: validation.value, idempotency_key, content_hash };
  if (existing.idempotency_key === idempotency_key && existing.content_hash === content_hash) {
    return { disposition: "DUPLICATE", value: validation.value, idempotency_key, content_hash };
  }
  if (existing.idempotency_key === idempotency_key) {
    return { disposition: "IDEMPOTENCY_CONFLICT", value: validation.value, idempotency_key, content_hash };
  }
  return { disposition: "ACCEPT", value: validation.value, idempotency_key, content_hash };
}
