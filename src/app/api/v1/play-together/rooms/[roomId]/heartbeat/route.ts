import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getParticipantRoomState, normalizeUuid } from "@/lib/play-together";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await getApiAuth(request);

  if (!auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const { roomId: rawRoomId } = await params;
  const roomId = normalizeUuid(rawRoomId);

  if (!roomId) {
    return errorResponse("invalid_request", "roomId is required.", 400);
  }

  const room = await getParticipantRoomState({
    roomId,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!room) {
    return errorResponse("not_found", "Room not found.", 404);
  }

  return dataResponse({ room });
}