import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { submitShortFilmChaiTip } from "@/lib/chai";

type ShortFilmChaiRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: ShortFilmChaiRouteProps) {
  const { slug } = await params;
  const auth = await getApiAuth(request);

  if (auth.error || !auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  let body: { coinAmount?: unknown; idempotencyKey?: unknown };

  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "A valid JSON body is required.", 400);
  }

  const coinAmount = body.coinAmount;
  const idempotencyKey = body.idempotencyKey;

  if (
    typeof coinAmount !== "number" ||
    !Number.isInteger(coinAmount) ||
    coinAmount <= 0 ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim() === ""
  ) {
    return errorResponse("invalid_request", "coinAmount and idempotencyKey are required.", 400);
  }

  const result = await submitShortFilmChaiTip(slug, coinAmount, idempotencyKey, auth.supabase);

  return dataResponse({
    success: result.success,
    status: result.status,
    remainingBalance: result.remainingBalance,
  });
}
