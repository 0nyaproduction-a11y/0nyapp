import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getUserSubscription, getUserWallet } from "@/lib/entitlements";

type GooglePlayBillingBody = {
  googleProductId?: unknown;
  kind?: unknown;
  mode?: unknown;
  productCode?: unknown;
  scenario?: unknown;
  testOnly?: unknown;
};

function readBody(value: unknown): GooglePlayBillingBody {
  return value && typeof value === "object" ? (value as GooglePlayBillingBody) : {};
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKind(value: unknown) {
  return value === "coin_pack" || value === "subscription" ? value : null;
}

export async function POST(request: Request) {
  const auth = await getApiAuth(request);

  if (auth.error || !auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return errorResponse("invalid_request", "A valid JSON body is required.", 400);
  }

  const body = readBody(parsedBody);
  const mode = body.mode === "purchase" || body.mode === "restore" ? body.mode : null;
  const kind = normalizeKind(body.kind);
  const productCode = normalizeString(body.productCode);
  const googleProductId = normalizeString(body.googleProductId);
  const isDevelopmentTest = process.env.NODE_ENV === "development" && body.testOnly === true;

  if (!mode) {
    return errorResponse("invalid_request", "mode is required.", 400);
  }

  if (mode === "purchase" && (!kind || !productCode)) {
    return errorResponse("invalid_request", "kind and productCode are required.", 400);
  }

  const [wallet, subscription] = await Promise.all([
    getUserWallet(auth.user.id, auth.supabase),
    getUserSubscription(auth.user.id, auth.supabase),
  ]);

  return dataResponse({
    backendStatus: isDevelopmentTest
      ? "DEVELOPMENT_TEST_BOUNDARY"
      : "EXTERNALLY_BLOCKED_NOT_CONFIGURED",
    entitlementChanged: false,
    googleProductConfigured: Boolean(googleProductId),
    mode,
    productCode: productCode || null,
    kind,
    scenario: normalizeString(body.scenario) || null,
    subscription: {
      endsAt: subscription?.ends_at ?? null,
      planCode: subscription?.plan_code ?? null,
      status: subscription?.status === "active" ? "active" : "none",
    },
    testOnly: isDevelopmentTest,
    verificationStatus: isDevelopmentTest ? "test_only_not_google_verified" : "not_configured",
    wallet: {
      coinBalance: wallet?.coin_balance ?? 0,
    },
  });
}
