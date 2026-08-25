import type { Session } from "@supabase/supabase-js";
import {
  getParentalControlStatus,
  saveParentalControlPin,
} from "./api";
import { supabaseSecureStorage } from "./secureStorage";

const GUEST_STORAGE_KEY = "0nya.guest-parental-controls.v2";
const UNLOCKED_SCOPE_PREFIX = "0nya:parental-unlocked:";

type GuestCredentialRecord = {
  guestCredential: string;
  updatedAt: string;
};

type ParentalSessionProof = {
  expiresAt: string;
  parentalSessionToken: string;
};

export type ParentalControlScope = {
  key: string;
  kind: "guest" | "registered";
  userId: string | null;
};

export type ParentalControlState = {
  failedAttempts: number;
  hasPin: boolean;
  lockedUntil: string | null;
  source: "guest" | "registered";
};

export type ParentalControlActionResult = ParentalControlState & {
  success: boolean;
  status:
    | "verified"
    | "setup_complete"
    | "updated"
    | "wrong_pin"
    | "locked"
    | "not_configured"
    | "reauth_required"
    | "invalid_pin";
  parentalSessionToken?: string;
  expiresAt?: string;
  guestCredential?: string;
};

function normalizePin(value: string) {
  return /^\d{4}$/.test(value) ? value : null;
}

function getScopeKey(scope: ParentalControlScope) {
  return `${UNLOCKED_SCOPE_PREFIX}${scope.key}`;
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

async function readStoredGuestCredential() {
  const raw = await supabaseSecureStorage.getItem(GUEST_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as GuestCredentialRecord;
}

export async function getPlaybackAuthorizationCredentials(session: Session | null) {
  const scope = getParentalScope(session);
  const proof = getParentalSessionProof(scope);

  if (scope.kind === "registered") {
    return {
      guestCredential: null,
      parentalSessionToken: proof?.parentalSessionToken ?? null,
    };
  }

  const credentialRecord = await readStoredGuestCredential();

  return {
    guestCredential: credentialRecord?.guestCredential ?? null,
    parentalSessionToken: proof?.parentalSessionToken ?? null,
  };
}

async function writeStoredGuestCredential(guestCredential: string) {
  await supabaseSecureStorage.setItem(
    GUEST_STORAGE_KEY,
    JSON.stringify({
      guestCredential,
      updatedAt: new Date().toISOString(),
    } satisfies GuestCredentialRecord),
  );
}

async function getGuestState(): Promise<ParentalControlState> {
  const credentialRecord = await readStoredGuestCredential();

  if (credentialRecord?.guestCredential) {
    const status = await getParentalControlStatus(undefined, credentialRecord.guestCredential);
    return { ...status, source: "guest" };
  }
  return {
    failedAttempts: 0,
    hasPin: false,
    lockedUntil: null,
    source: "guest",
  };
}

export function getParentalScope(session: Session | null): ParentalControlScope {
  if (session?.user?.id) {
    return {
      kind: "registered",
      key: `user:${session.user.id}`,
      userId: session.user.id,
    };
  }

  return {
    kind: "guest",
    key: "guest",
    userId: null,
  };
}

const unlockedScopes = new Set<string>();
const parentalSessionProofs = new Map<string, ParentalSessionProof>();

export function isParentalSessionUnlocked(scope: ParentalControlScope) {
  const proof = parentalSessionProofs.get(getScopeKey(scope));

  if (proof && isExpired(proof.expiresAt)) {
    parentalSessionProofs.delete(getScopeKey(scope));
    unlockedScopes.delete(getScopeKey(scope));
    return false;
  }

  return unlockedScopes.has(getScopeKey(scope));
}

export function getParentalSessionProof(scope: ParentalControlScope) {
  const proof = parentalSessionProofs.get(getScopeKey(scope));

  if (!proof || isExpired(proof.expiresAt)) {
    parentalSessionProofs.delete(getScopeKey(scope));
    unlockedScopes.delete(getScopeKey(scope));
    return null;
  }

  return proof;
}

export function markParentalSessionUnlocked(
  scope: ParentalControlScope,
  proof?: ParentalSessionProof | null,
) {
  unlockedScopes.add(getScopeKey(scope));

  if (proof?.parentalSessionToken) {
    parentalSessionProofs.set(getScopeKey(scope), proof);
  }
}

export function clearParentalSessionUnlock(scope?: ParentalControlScope) {
  if (scope) {
    unlockedScopes.delete(getScopeKey(scope));
    parentalSessionProofs.delete(getScopeKey(scope));
    return;
  }

  unlockedScopes.clear();
  parentalSessionProofs.clear();
}

export async function loadParentalControls(session: Session | null): Promise<ParentalControlState> {
  if (!session?.access_token) {
    return getGuestState();
  }

  const status = await getParentalControlStatus(session.access_token);

  return {
    ...status,
    source: "registered",
  };
}

async function setGuestCredentialAndUnlock(
  scope: ParentalControlScope,
  result: {
    expiresAt?: string;
    guestCredential?: string;
    parentalSessionToken?: string;
  },
) {
  if (result.guestCredential) {
    await writeStoredGuestCredential(result.guestCredential);
  }

  if (result.parentalSessionToken && result.expiresAt) {
    markParentalSessionUnlocked(scope, {
      expiresAt: result.expiresAt,
      parentalSessionToken: result.parentalSessionToken,
    });
  }
}

export async function verifyParentalPin(
  session: Session | null,
  pin: string,
): Promise<ParentalControlActionResult> {
  const normalizedPin = normalizePin(pin);

  if (!normalizedPin) {
    return {
      failedAttempts: 0,
      hasPin: false,
      lockedUntil: null,
      source: session?.access_token ? "registered" : "guest",
      success: false,
      status: "invalid_pin",
    };
  }

  if (session?.access_token) {
    const result = await saveParentalControlPin(session.access_token, {
      mode: "verify",
      pin: normalizedPin,
    });

    return {
      ...result,
      source: "registered",
    };
  }

  const guestCredentialRecord = await readStoredGuestCredential();

  if (guestCredentialRecord?.guestCredential) {
    const result = await saveParentalControlPin(null, {
      guestCredential: guestCredentialRecord.guestCredential,
      mode: "verify",
      pin: normalizedPin,
    });

    if (result.success) {
      await setGuestCredentialAndUnlock(getParentalScope(session), result);
    }

    return {
      ...result,
      source: "guest",
    };
  }

  const result = await saveParentalControlPin(null, {
    mode: "set",
    pin: normalizedPin,
  });

  if (result.success) {
    await setGuestCredentialAndUnlock(getParentalScope(session), result);
  }

  return {
    ...result,
    source: "guest",
  };
}

export async function setParentalPin(
  session: Session | null,
  pin: string,
  currentPin?: string | null,
): Promise<ParentalControlActionResult> {
  const normalizedPin = normalizePin(pin);

  if (!normalizedPin) {
    return {
      failedAttempts: 0,
      hasPin: false,
      lockedUntil: null,
      source: session?.access_token ? "registered" : "guest",
      success: false,
      status: "invalid_pin",
    };
  }

  if (session?.access_token) {
    const result = await saveParentalControlPin(session.access_token, {
      currentPin: currentPin ?? undefined,
      mode: "set",
      pin: normalizedPin,
    });

    return {
      ...result,
      source: "registered",
    };
  }

  const guestCredentialRecord = await readStoredGuestCredential();

  if (guestCredentialRecord?.guestCredential) {
    const result = await saveParentalControlPin(null, {
      currentPin: currentPin ?? undefined,
      guestCredential: guestCredentialRecord.guestCredential,
      mode: "set",
      pin: normalizedPin,
    });

    if (result.success) {
      await setGuestCredentialAndUnlock(getParentalScope(session), result);
    }

    return {
      ...result,
      source: "guest",
    };
  }

  const result = await saveParentalControlPin(null, {
    mode: "set",
    pin: normalizedPin,
  });

  if (result.success) {
    await setGuestCredentialAndUnlock(getParentalScope(session), result);
  }

  return {
    ...result,
    source: "guest",
  };
}
