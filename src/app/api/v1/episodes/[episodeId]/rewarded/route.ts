import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { createRewardedAdAttempt } from "@/lib/rewarded-ads";

type RewardedAttemptRouteProps = {
  params: Promise<{ episodeId: string }>;
};

export async function POST(request: Request, { params }: RewardedAttemptRouteProps) {
  const { episodeId } = await params;
  const auth = await getApiAuth(request);

  if (auth.error || !auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  if (typeof episodeId !== "string" || episodeId.trim() === "") {
    return errorResponse("invalid_request", "episodeId is required.", 400);
  }

  const result = await createRewardedAdAttempt(episodeId, auth.supabase);

  if (!result) {
    return errorResponse("server_error", "Unable to create rewarded ad attempt.", 500);
  }

  if (result.status === "not_found") {
    return errorResponse("not_found", "Episode not found.", 404);
  }

  return dataResponse(result);
}
