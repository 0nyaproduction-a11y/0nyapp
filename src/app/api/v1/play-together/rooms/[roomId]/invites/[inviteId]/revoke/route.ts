import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getParticipantRoomState, normalizeUuid, revokePlayTogetherInvite } from "@/lib/play-together";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string; inviteId: string }> },
) {
  const auth = await getApiAuth(request);

  if (!auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const { inviteId: rawInviteId, roomId: rawRoomId } = await params;
  const roomId = normalizeUuid(rawRoomId);
  const inviteId = normalizeUuid(rawInviteId);

  if (!roomId || !inviteId) {
    return errorResponse("invalid_request", "roomId and inviteId are required.", 400);
  }

  const room = await getParticipantRoomState({
    roomId,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!room) {
    return errorResponse("not_found", "Room not found.", 404);
  }

  const actor = room.participants.find((participant) => participant.userId === auth.user?.id);

  if (actor?.role !== "host") {
    return errorResponse("forbidden", "Only the room host may revoke invites.", 403);
  }

  const invite = await revokePlayTogetherInvite({
    actorUserId: auth.user.id,
    inviteId,
    roomId,
  });

  if (!invite.ok) {
    return invite.reason === "invite_not_found"
      ? errorResponse("not_found", "Invite not found.", 404)
      : errorResponse("server_error", "Unable to revoke Play Together invite.", 500);
  }

  return dataResponse({ invite: invite.data });
}
