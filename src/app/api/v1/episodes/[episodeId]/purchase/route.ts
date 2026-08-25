import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { purchaseEpisodeWithCoins } from "@/lib/purchases";

type EpisodePurchaseRouteProps = {
  params: Promise<{ episodeId: string }>;
};

export async function POST(request: Request, { params }: EpisodePurchaseRouteProps) {
  const { episodeId } = await params;
  const auth = await getApiAuth(request);

  if (auth.error) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  if (!auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  if (typeof episodeId !== "string" || episodeId.trim() === "") {
    return errorResponse("invalid_request", "episodeId is required.", 400);
  }

  const result = await purchaseEpisodeWithCoins(episodeId, auth.supabase);

  return dataResponse({
    success: result.success,
    status: result.status,
    remainingBalance: result.remainingBalance,
  });
}
