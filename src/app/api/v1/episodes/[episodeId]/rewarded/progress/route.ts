import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getRewardedProgress } from "@/lib/rewarded-ads";

type RewardedProgressRouteProps = {
  params: Promise<{ episodeId: string }>;
};

export async function GET(request: Request, { params }: RewardedProgressRouteProps) {
  const { episodeId } = await params;
  const auth = await getApiAuth(request);

  if (auth.error || !auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  if (typeof episodeId !== "string" || episodeId.trim() === "") {
    return errorResponse("invalid_request", "episodeId is required.", 400);
  }

  const result = await getRewardedProgress(episodeId, auth.supabase);

  if (!result) {
    return errorResponse("server_error", "Unable to load rewarded progress.", 500);
  }

  if (result.state === "not_found") {
    return errorResponse("not_found", "Episode not found.", 404);
  }

  return dataResponse(result);
}
