import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getRewardedAdAttemptStatus } from "@/lib/rewarded-ads";

type RewardedAttemptStatusRouteProps = {
  params: Promise<{ customData: string }>;
};

export async function GET(request: Request, { params }: RewardedAttemptStatusRouteProps) {
  const { customData } = await params;
  const auth = await getApiAuth(request);

  if (auth.error || !auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  if (typeof customData !== "string" || customData.trim() === "") {
    return errorResponse("invalid_request", "customData is required.", 400);
  }

  const result = await getRewardedAdAttemptStatus(customData, auth.supabase);

  if (!result) {
    return errorResponse("not_found", "Rewarded ad attempt not found.", 404);
  }

  if (result.status === "not_found") {
    return errorResponse("not_found", "Rewarded ad attempt not found.", 404);
  }

  return dataResponse(result);
}
