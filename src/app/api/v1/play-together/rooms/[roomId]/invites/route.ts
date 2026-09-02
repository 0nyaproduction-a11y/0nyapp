import { getApiAuth } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/responses";
import {
  canUserAccessPlayTogetherEpisode,
  createPlayTogetherInvite,
  getParticipantRoomState,
  normalizeUuid,
  resolvePlayTogetherAccess,
} from "@/lib/play-together";

export async function POST(
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

  const actor = room.participants.find((participant) => participant.userId === auth.user?.id);

  if (actor?.role !== "host") {
    return errorResponse("forbidden", "Only the room host may create invites.", 403);
  }

  const episodeAccess = await canUserAccessPlayTogetherEpisode({
    episodeId: room.episodeId,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!episodeAccess.allowed) {
    return errorResponse("forbidden", "Episode access is required.", 403);
  }

  const playTogetherAccess = await resolvePlayTogetherAccess({
    roomId: room.id,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!playTogetherAccess.allowed) {
    return errorResponse("forbidden", "0chat access is required.", 403);
  }

  const invite = await createPlayTogetherInvite({
    actorUserId: auth.user.id,
    room,
  });

  if (!invite.ok) {
    return errorResponse("server_error", "Unable to create Play Together invite.", 500);
  }

  return Response.json(
    {
      data: {
        accessMethod: playTogetherAccess.method,
        invite: invite.data,
      },
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
