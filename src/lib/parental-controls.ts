import crypto, { pbkdf2Sync, randomBytes } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const HASH_ITERATIONS = 310_000;
const HASH_LENGTH = 32;
const LOCK_ATTEMPT_LIMIT = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const FRESH_REAUTH_WINDOW_MS = 5 * 60 * 1000;
const PARENTAL_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const PARENTAL_RESTRICTION_THRESHOLDS = ["U/A 13+", "U/A 16+"] as const;
export type ParentalRestrictionThreshold = (typeof PARENTAL_RESTRICTION_THRESHOLDS)[number];

export type ParentalControlRecord =
  Database["public"]["Tables"]["user_parental_controls"]["Row"];
type GuestParentalControlRecord =
  Database["public"]["Tables"]["guest_parental_controls"]["Row"];

export type ParentalControlStatus = {
  failedAttempts: number;
  hasPin: boolean;
  lockedUntil: string | null;
  restrictionsEnabled: boolean;
  restrictionThreshold: ParentalRestrictionThreshold | null;
};

export type ParentalControlMutationStatus =
  | "verified"
  | "setup_complete"
  | "updated"
  | "wrong_pin"
  | "locked"
  | "not_configured"
  | "reauth_required"
  | "invalid_pin"
  | "invalid_threshold";

export type ParentalControlMutationResult = ParentalControlStatus & {
  success: boolean;
  status: ParentalControlMutationStatus;
  parentalSessionToken?: string;
  expiresAt?: string;
  guestCredential?: string;
};

type ParentalRestrictionSettingsInput = {
  restrictionsEnabled: boolean;
  restrictionThreshold?: ParentalRestrictionThreshold | null;
};

async function getSupabase(supabase?: SupabaseClient<Database>) {
  return supabase ?? createAdminClient();
}

function normalizePin(pin: string) {
  return /^\d{4}$/.test(pin) ? pin : null;
}

function normalizeRestrictionThreshold(
  value: string | null | undefined,
): ParentalRestrictionThreshold | null {
  return PARENTAL_RESTRICTION_THRESHOLDS.includes(value as ParentalRestrictionThreshold)
    ? (value as ParentalRestrictionThreshold)
    : null;
}

function formatStatus(record: ParentalControlRecord | GuestParentalControlRecord | null) {
  return {
    failedAttempts: record?.failed_attempts ?? 0,
    hasPin: Boolean(record),
    lockedUntil: record?.locked_until ?? null,
    restrictionsEnabled: record?.restrictions_enabled ?? false,
    restrictionThreshold: normalizeRestrictionThreshold(record?.restriction_threshold),
  };
}

function emptyStatus(): ParentalControlStatus {
  return {
    failedAttempts: 0,
    hasPin: false,
    lockedUntil: null,
    restrictionsEnabled: false,
    restrictionThreshold: null,
  };
}

function createSalt() {
  return randomBytes(16).toString("hex");
}

function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}

function hashOpaqueValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashPin(pin: string, salt: string) {
  return pbkdf2Sync(pin, salt, HASH_ITERATIONS, HASH_LENGTH, "sha256").toString("hex");
}

function isLocked(record: Pick<ParentalControlRecord, "locked_until">) {
  return Boolean(record.locked_until && new Date(record.locked_until).getTime() > Date.now());
}

function isFreshOtpReauth(user: User) {
  if (!user.last_sign_in_at) {
    return false;
  }

  return Date.now() - new Date(user.last_sign_in_at).getTime() <= FRESH_REAUTH_WINDOW_MS;
}

function isExpired(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

async function getRecord(userId: string, supabase?: SupabaseClient<Database>) {
  const client = await getSupabase(supabase);
  const { data, error } = await client
    .from("user_parental_controls")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load parental controls.");
  }

  return data;
}

async function getGuestRecordByCredential(
  guestCredential: string,
  supabase?: SupabaseClient<Database>,
) {
  const client = await getSupabase(supabase);
  const { data, error } = await client
    .from("guest_parental_controls")
    .select("*")
    .eq("credential_hash", hashOpaqueValue(guestCredential))
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load guest parental controls.");
  }

  return data;
}

async function recordFailure(
  userId: string,
  record: ParentalControlRecord,
  supabase?: SupabaseClient<Database>,
) {
  const client = await getSupabase(supabase);
  const nextFailedAttempts = record.failed_attempts + 1;
  const lockedUntil =
    nextFailedAttempts >= LOCK_ATTEMPT_LIMIT
      ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
      : record.locked_until;

  const { error } = await client
    .from("user_parental_controls")
    .update({
      failed_attempts: nextFailedAttempts,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error("Unable to update parental controls.");
  }

  return {
    failedAttempts: nextFailedAttempts,
    hasPin: true,
    lockedUntil,
    restrictionsEnabled: record.restrictions_enabled,
    restrictionThreshold: normalizeRestrictionThreshold(record.restriction_threshold),
  };
}

async function recordGuestFailure(
  record: GuestParentalControlRecord,
  supabase?: SupabaseClient<Database>,
) {
  const client = await getSupabase(supabase);
  const nextFailedAttempts = record.failed_attempts + 1;
  const lockedUntil =
    nextFailedAttempts >= LOCK_ATTEMPT_LIMIT
      ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
      : record.locked_until;

  const { error } = await client
    .from("guest_parental_controls")
    .update({
      failed_attempts: nextFailedAttempts,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  if (error) {
    throw new Error("Unable to update guest parental controls.");
  }

  return {
    failedAttempts: nextFailedAttempts,
    hasPin: true,
    lockedUntil,
    restrictionsEnabled: record.restrictions_enabled,
    restrictionThreshold: normalizeRestrictionThreshold(record.restriction_threshold),
  };
}

async function clearGuestFailures(guestParentalControlId: string, supabase?: SupabaseClient<Database>) {
  const client = await getSupabase(supabase);
  const { error } = await client
    .from("guest_parental_controls")
    .update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guestParentalControlId);

  if (error) {
    throw new Error("Unable to update guest parental controls.");
  }
}

async function revokeParentalSessionsForUser(userId: string, supabase?: SupabaseClient<Database>) {
  const client = await getSupabase(supabase);
  const { error } = await client
    .from("parental_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) {
    throw new Error("Unable to revoke parental sessions.");
  }
}

async function revokeParentalSessionsForGuest(
  guestParentalControlId: string,
  supabase?: SupabaseClient<Database>,
) {
  const client = await getSupabase(supabase);
  const { error } = await client
    .from("parental_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("guest_parental_control_id", guestParentalControlId)
    .is("revoked_at", null);

  if (error) {
    throw new Error("Unable to revoke parental sessions.");
  }
}

async function issueParentalSession(
  input:
    | { userId: string; supabase?: SupabaseClient<Database> }
    | { guestParentalControlId: string; supabase?: SupabaseClient<Database> },
) {
  const client = await getSupabase(input.supabase);
  const parentalSessionToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + PARENTAL_SESSION_TTL_MS).toISOString();
  const payload: Database["public"]["Tables"]["parental_sessions"]["Insert"] = {
    expires_at: expiresAt,
    token_hash: hashOpaqueValue(parentalSessionToken),
  };

  if ("userId" in input) {
    payload.user_id = input.userId;
  } else {
    payload.guest_parental_control_id = input.guestParentalControlId;
  }

  const { error } = await client.from("parental_sessions").insert(payload);

  if (error) {
    throw new Error("Unable to issue parental session.");
  }

  return { parentalSessionToken, expiresAt };
}

async function writePin(
  userId: string,
  pin: string,
  record?: ParentalControlRecord | null,
  supabase?: SupabaseClient<Database>,
) {
  const client = await getSupabase(supabase);
  const salt = createSalt();
  const hashedPin = hashPin(pin, salt);
  const payload = {
    failed_attempts: 0,
    locked_until: null,
    pin_hash: hashedPin,
    pin_salt: salt,
    updated_at: new Date().toISOString(),
  };

  if (record) {
    const { error } = await client
      .from("user_parental_controls")
      .update(payload)
      .eq("user_id", userId);

    if (error) {
      throw new Error("Unable to update parental controls.");
    }

    return {
      failedAttempts: 0,
      hasPin: true,
      lockedUntil: null,
      restrictionsEnabled: record.restrictions_enabled,
      restrictionThreshold: normalizeRestrictionThreshold(record.restriction_threshold),
    };
  }

  const { error } = await client.from("user_parental_controls").insert({
    ...payload,
    user_id: userId,
  });

  if (error) {
    throw new Error("Unable to create parental controls.");
  }

  return {
    failedAttempts: 0,
    hasPin: true,
    lockedUntil: null,
    restrictionsEnabled: false,
    restrictionThreshold: null,
  };
}

async function writeGuestControl(
  guestCredentialHash: string,
  pin: string,
  record?: GuestParentalControlRecord | null,
  supabase?: SupabaseClient<Database>,
) {
  const client = await getSupabase(supabase);
  const salt = createSalt();
  const hashedPin = hashPin(pin, salt);
  const payload = {
    credential_hash: guestCredentialHash,
    failed_attempts: 0,
    locked_until: null,
    pin_hash: hashedPin,
    pin_salt: salt,
    updated_at: new Date().toISOString(),
  };

  if (record) {
    const { error } = await client
      .from("guest_parental_controls")
      .update(payload)
      .eq("id", record.id);

    if (error) {
      throw new Error("Unable to update guest parental controls.");
    }

    return record.id;
  }

  const { data, error } = await client
    .from("guest_parental_controls")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Unable to create guest parental controls.");
  }

  return data.id;
}

export async function getParentalControlStatus(
  userId: string,
  supabase?: SupabaseClient<Database>,
): Promise<ParentalControlStatus> {
  const record = await getRecord(userId, supabase);

  return formatStatus(record);
}

export async function getGuestParentalControlStatus(
  guestCredential: string | null | undefined,
  supabase?: SupabaseClient<Database>,
): Promise<ParentalControlStatus> {
  if (!guestCredential) {
    return {
      failedAttempts: 0,
      hasPin: false,
      lockedUntil: null,
      restrictionsEnabled: false,
      restrictionThreshold: null,
    };
  }

  const record = await getGuestRecordByCredential(guestCredential, supabase);

  return formatStatus(record);
}

export async function updateRegisteredParentalRestrictionSettings(
  userId: string,
  input: ParentalRestrictionSettingsInput,
  supabase?: SupabaseClient<Database>,
): Promise<ParentalControlMutationResult> {
  const client = await getSupabase(supabase);
  const record = await getRecord(userId, client);

  if (!record) {
    return {
      ...emptyStatus(),
      success: false,
      status: "not_configured",
    };
  }

  const restrictionThreshold = input.restrictionsEnabled
    ? normalizeRestrictionThreshold(input.restrictionThreshold)
    : normalizeRestrictionThreshold(input.restrictionThreshold);

  if (input.restrictionsEnabled && !restrictionThreshold) {
    return {
      ...formatStatus(record),
      success: false,
      status: "invalid_threshold",
    };
  }

  const { data, error } = await client
    .from("user_parental_controls")
    .update({
      restriction_threshold: restrictionThreshold,
      restrictions_enabled: input.restrictionsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Unable to update parental restriction settings.");
  }

  return {
    ...formatStatus(data),
    success: true,
    status: "updated",
  };
}

export async function updateGuestParentalRestrictionSettings({
  guestCredential,
  restrictionThreshold,
  restrictionsEnabled,
  supabase,
}: {
  guestCredential?: string | null;
  restrictionThreshold?: ParentalRestrictionThreshold | null;
  restrictionsEnabled: boolean;
  supabase?: SupabaseClient<Database>;
}): Promise<ParentalControlMutationResult> {
  const client = await getSupabase(supabase);
  const credential = guestCredential?.trim() || null;
  const record = credential ? await getGuestRecordByCredential(credential, client) : null;

  if (!record) {
    return {
      ...emptyStatus(),
      success: false,
      status: "not_configured",
    };
  }

  const nextThreshold = restrictionsEnabled
    ? normalizeRestrictionThreshold(restrictionThreshold)
    : normalizeRestrictionThreshold(restrictionThreshold);

  if (restrictionsEnabled && !nextThreshold) {
    return {
      ...formatStatus(record),
      success: false,
      status: "invalid_threshold",
    };
  }

  const { data, error } = await client
    .from("guest_parental_controls")
    .update({
      restriction_threshold: nextThreshold,
      restrictions_enabled: restrictionsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Unable to update guest parental restriction settings.");
  }

  return {
    ...formatStatus(data),
    success: true,
    status: "updated",
  };
}

export async function verifyRegisteredParentalPin(
  userId: string,
  pin: string,
  supabase?: SupabaseClient<Database>,
): Promise<ParentalControlMutationResult> {
  const normalizedPin = normalizePin(pin);

  if (!normalizedPin) {
    return {
      ...emptyStatus(),
      success: false,
      status: "invalid_pin",
    };
  }

  const client = await getSupabase(supabase);
  const record = await getRecord(userId, client);

  if (!record) {
    return {
      ...emptyStatus(),
      success: false,
      status: "not_configured",
    };
  }

  if (isLocked(record)) {
    return {
      ...formatStatus(record),
      success: false,
      status: "locked",
    };
  }

  const matches = hashPin(normalizedPin, record.pin_salt) === record.pin_hash;

  if (!matches) {
    return {
      ...(await recordFailure(userId, record, client)),
      success: false,
      status: "wrong_pin",
    };
  }

  const { error } = await client
    .from("user_parental_controls")
    .update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error("Unable to update parental controls.");
  }

  const parentalSession = await issueParentalSession({ userId, supabase: client });

  return {
    ...formatStatus(record),
    failedAttempts: 0,
    lockedUntil: null,
    expiresAt: parentalSession.expiresAt,
    parentalSessionToken: parentalSession.parentalSessionToken,
    success: true,
    status: "verified",
  };
}

export async function setRegisteredParentalPin(
  user: User,
  pin: string,
  currentPin?: string | null,
  supabase?: SupabaseClient<Database>,
): Promise<ParentalControlMutationResult> {
  const normalizedPin = normalizePin(pin);

  if (!normalizedPin) {
    return {
      ...emptyStatus(),
      success: false,
      status: "invalid_pin",
    };
  }

  const client = await getSupabase(supabase);
  const record = await getRecord(user.id, client);

  if (record && isLocked(record)) {
    return {
      ...formatStatus(record),
      success: false,
      status: "locked",
    };
  }

  if (record) {
    if (currentPin) {
      const currentMatches = hashPin(currentPin, record.pin_salt) === record.pin_hash;

      if (!currentMatches) {
        return {
          ...(await recordFailure(user.id, record, client)),
          success: false,
          status: "wrong_pin",
        };
      }
    } else if (!isFreshOtpReauth(user)) {
      return {
        ...formatStatus(record),
        success: false,
        status: "reauth_required",
      };
    }
  }

  await revokeParentalSessionsForUser(user.id, client);
  const status = await writePin(user.id, normalizedPin, record, client);
  const parentalSession = await issueParentalSession({ userId: user.id, supabase: client });

  return {
    ...status,
    expiresAt: parentalSession.expiresAt,
    parentalSessionToken: parentalSession.parentalSessionToken,
    success: true,
    status: record ? "updated" : "setup_complete",
  };
}

type GuestParentalPinMutationInput = {
  currentPin?: string | null;
  guestCredential?: string | null;
  mode: "set" | "verify";
  pin: string;
  supabase?: SupabaseClient<Database>;
};

export async function setGuestParentalPin({
  currentPin,
  guestCredential,
  mode,
  pin,
  supabase,
}: GuestParentalPinMutationInput): Promise<ParentalControlMutationResult> {
  const normalizedPin = normalizePin(pin);

  if (!normalizedPin) {
    return {
      ...emptyStatus(),
      success: false,
      status: "invalid_pin",
    };
  }

  const client = await getSupabase(supabase);
  const credential = guestCredential?.trim() || null;
  const record = credential ? await getGuestRecordByCredential(credential, client) : null;

  if (mode === "verify") {
    if (!record) {
      return {
        ...emptyStatus(),
        success: false,
        status: "not_configured",
      };
    }

    if (isLocked({ locked_until: record.locked_until })) {
      return {
        ...formatStatus(record),
        success: false,
        status: "locked",
      };
    }

    const matches = hashPin(normalizedPin, record.pin_salt) === record.pin_hash;

    if (!matches) {
      return {
        ...(await recordGuestFailure(record, client)),
        success: false,
        status: "wrong_pin",
      };
    }

    await clearGuestFailures(record.id, client);
    await revokeParentalSessionsForGuest(record.id, client);
    const parentalSession = await issueParentalSession({
      guestParentalControlId: record.id,
      supabase: client,
    });

    return {
      ...formatStatus(record),
      failedAttempts: 0,
      lockedUntil: null,
      expiresAt: parentalSession.expiresAt,
      parentalSessionToken: parentalSession.parentalSessionToken,
      success: true,
      status: "verified",
    };
  }

  if (record) {
    if (!currentPin) {
      return {
        ...formatStatus(record),
        success: false,
        status: "reauth_required",
      };
    }

    if (isLocked({ locked_until: record.locked_until })) {
      return {
        ...formatStatus(record),
        success: false,
        status: "locked",
      };
    }

    const currentMatches = hashPin(currentPin, record.pin_salt) === record.pin_hash;

    if (!currentMatches) {
      return {
        ...(await recordGuestFailure(record, client)),
        success: false,
        status: "wrong_pin",
      };
    }

    await revokeParentalSessionsForGuest(record.id, client);
    const guestParentalControlId = await writeGuestControl(record.credential_hash, normalizedPin, record, client);
    const parentalSession = await issueParentalSession({
      guestParentalControlId,
      supabase: client,
    });

    return {
      ...formatStatus(record),
      failedAttempts: 0,
      lockedUntil: null,
      expiresAt: parentalSession.expiresAt,
      parentalSessionToken: parentalSession.parentalSessionToken,
      success: true,
      status: "updated",
    };
  }

  const guestCredentialValue = credential ?? createOpaqueToken();
  const guestParentalControlId = await writeGuestControl(
    hashOpaqueValue(guestCredentialValue),
    normalizedPin,
    null,
    client,
  );
  const parentalSession = await issueParentalSession({
    guestParentalControlId,
    supabase: client,
  });

  return {
    failedAttempts: 0,
    guestCredential: guestCredentialValue,
    hasPin: true,
    lockedUntil: null,
    restrictionsEnabled: false,
    restrictionThreshold: null,
    expiresAt: parentalSession.expiresAt,
    parentalSessionToken: parentalSession.parentalSessionToken,
    success: true,
    status: "setup_complete",
  };
}

export async function validateParentalSessionProof(input: {
  guestCredential?: string | null;
  parentalSessionToken: string;
  supabase?: SupabaseClient<Database>;
  userId?: string | null;
}) {
  const parentalSessionToken = input.parentalSessionToken.trim();

  if (!parentalSessionToken) {
    return false;
  }

  const client = await getSupabase(input.supabase);
  const { data: session, error } = await client
    .from("parental_sessions")
    .select("*")
    .eq("token_hash", hashOpaqueValue(parentalSessionToken))
    .maybeSingle();

  if (error || !session || session.revoked_at || isExpired(session.expires_at)) {
    return false;
  }

  if (input.userId) {
    return session.user_id === input.userId;
  }

  if (!input.guestCredential) {
    return false;
  }

  const guestRecord = await getGuestRecordByCredential(input.guestCredential, client);

  return Boolean(guestRecord && guestRecord.id === session.guest_parental_control_id);
}
