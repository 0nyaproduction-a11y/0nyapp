import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  canUserAccessPlayTogetherEpisode,
  getInviteJoinContext,
  normalizeInviteToken,
  redeemPlayTogetherInvite,
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

  const inviteToken = normalizeInviteToken((body as { inviteToken?: unknown }).inviteToken);

  if (!inviteToken) {
    return errorResponse("invalid_request", "inviteToken is required.", 400);
  }

  const invite = await getInviteJoinContext(inviteToken);

  if (!invite) {
    return errorResponse("not_found", "Invite not found.", 404);
  }

  const playTogetherAccess = await resolvePlayTogetherAccess({
    roomId: invite.roomId,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!playTogetherAccess.allowed) {
    return errorResponse("forbidden", "0chat access is required.", 403);
  }

  const episodeAccess = await canUserAccessPlayTogetherEpisode({
    episodeId: invite.episodeId,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!episodeAccess.allowed) {
    return episodeAccess.reason === "not_found"
      ? errorResponse("not_found", "Episode not found.", 404)
      : errorResponse("forbidden", "Episode access is required.", 403);
  }

  const joined = await redeemPlayTogetherInvite({
    inviteToken,
    joiningUserId: auth.user.id,
  });

  if (!joined.ok) {
    const status = joined.reason === "room_full" ? 409 : 403;
    return errorResponse("forbidden", "Invite cannot be redeemed.", status);
  }

  return dataResponse({
    accessMethod: playTogetherAccess.method,
    room: joined.data,
  });
}
