import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  canUserAccessPlayTogetherEpisode,
  createPlayTogetherRoom,
  normalizeUuid,
  resolvePlayTogetherAccess,
} from "@/lib/play-together";

export async function POST(request: Request) {
  const auth = await getApiAuth(request);

  if (!auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "A valid JSON body is required.", 400);
  }

  const episodeId = normalizeUuid((body as { episodeId?: unknown }).episodeId);

  if (!episodeId) {
    return errorResponse("invalid_request", "episodeId is required.", 400);
  }

  const episodeAccess = await canUserAccessPlayTogetherEpisode({
    episodeId,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!episodeAccess.allowed) {
    return episodeAccess.reason === "not_found"
      ? errorResponse("not_found", "Episode not found.", 404)
      : errorResponse("forbidden", "Episode access is required.", 403);
  }

  const playTogetherAccess = await resolvePlayTogetherAccess({
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!playTogetherAccess.allowed) {
    return errorResponse("forbidden", "0chat access is required.", 403);
  }

  if (playTogetherAccess.method !== "plus") {
    return errorResponse("forbidden", "Coin and Rewarded room creation require a future acquisition binding.", 403);
  }

  const room = await createPlayTogetherRoom({
    episodeId,
    hostUserId: auth.user.id,
  });

  if (!room.ok) {
    return errorResponse("server_error", "Unable to create Play Together room.", 500);
  }

  return dataResponse({ accessMethod: playTogetherAccess.method, room: room.data });
}
