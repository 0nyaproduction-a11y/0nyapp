import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  normalizeUuid,
  purchasePlayTogether0chatWithCoins,
} from "@/lib/play-together";

type CoinAcquisitionRouteProps = {
  params: Promise<{ intentId: string }>;
};

export async function POST(request: Request, { params }: CoinAcquisitionRouteProps) {
  const auth = await getApiAuth(request);

  if (!auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const { intentId: rawIntentId } = await params;
  const intentId = normalizeUuid(rawIntentId);

  if (!intentId) {
    return errorResponse("invalid_request", "intentId is required.", 400);
  }

  const result = await purchasePlayTogether0chatWithCoins({
    intentId,
    userId: auth.user.id,
  });

  if (!result.ok) {
    const status =
      result.reason === "intent_not_found"
        ? 404
        : result.reason === "forbidden"
          ? 403
          : result.reason === "insufficient_balance"
            ? 409
            : 400;

    return errorResponse("invalid_request", "Unable to complete Play Together Coin acquisition.", status);
  }

  return dataResponse({ acquisition: result.data });
}
