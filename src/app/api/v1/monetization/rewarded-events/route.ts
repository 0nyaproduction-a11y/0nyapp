import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  validateClientRewardedEvent,
} from "@/lib/rewarded-analytics";

export async function POST(request: Request) {
  const auth = await getApiAuth(request);

  if (auth.error || !auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "A JSON body is required.", 400);
  }

  const parsed = validateClientRewardedEvent(body);

  if (!parsed.ok) {
    return errorResponse("invalid_request", parsed.errors.join(" "), 400);
  }

  const { eventType, episodeId, adIndex, requiredCount, resultingProgress, metadata } = parsed.value;

  const supabase = await createClient();

  const { error } = await supabase.rpc("record_rewarded_event", {
    p_event_type: eventType,
    p_user_id: auth.user.id,
    p_episode_id: episodeId,
    p_ad_index: adIndex,
    p_required_count: requiredCount,
    p_resulting_progress: resultingProgress,
    p_metadata: metadata as Json,
  });

  if (error) {
    return errorResponse("server_error", "Unable to record rewarded event.", 500);
  }

  return dataResponse({ recorded: true });
}
