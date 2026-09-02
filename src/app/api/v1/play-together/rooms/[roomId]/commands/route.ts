import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  applyPlayTogetherRoomCommand,
  getParticipantRoomState,
  normalizeCommandId,
  normalizeCommandType,
  normalizeOptionalNonNegativeInteger,
  normalizeUuid,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "A valid JSON body is required.", 400);
  }

  const commandId = normalizeCommandId((body as { commandId?: unknown }).commandId);
  const commandType = normalizeCommandType((body as { commandType?: unknown }).commandType);

  if (!commandId || !commandType) {
    return errorResponse("invalid_request", "commandId and commandType are required.", 400);
  }

  const expectedVersion = normalizeOptionalNonNegativeInteger(
    (body as { expectedVersion?: unknown }).expectedVersion ?? null,
  );
  const positionMs = normalizeOptionalNonNegativeInteger(
    (body as { positionMs?: unknown }).positionMs ?? null,
  );
  const targetEpisodeId = normalizeUuid(
    (body as { targetEpisodeId?: unknown }).targetEpisodeId ?? null,
  );

  const room = await getParticipantRoomState({
    roomId,
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (!room) {
    return errorResponse("not_found", "Room not found.", 404);
  }

  const result = await applyPlayTogetherRoomCommand({
    actorUserId: auth.user.id,
    commandId,
    commandType,
    expectedVersion,
    positionMs,
    roomId,
    targetEpisodeId,
  });

  if (!result.ok) {
    return errorResponse("server_error", "Unable to apply Play Together command.", 500);
  }

  const command = result.data;

  if (!command.success) {
    switch (command.status) {
      case "invalid_request":
      case "invalid_position":
      case "invalid_episode":
        return errorResponse("invalid_request", `Invalid ${commandType} command.`, 400);
      case "not_host":
        return errorResponse("forbidden", "Only the Host can issue playback commands.", 403);
      case "room_not_found":
        return errorResponse("not_found", "Room not found.", 404);
      case "room_ended":
        return errorResponse("forbidden", "Room has ended.", 409);
      case "room_expired":
        return errorResponse("forbidden", "Room has expired.", 409);
      case "stale_version":
        return errorResponse("forbidden", "Room state changed; refetch the room.", 409);
      case "transaction_conflict":
        return errorResponse("forbidden", "Conflicting sequence for this command.", 409);
      default:
        return errorResponse("server_error", "Unable to apply Play Together command.", 500);
    }
  }

  return dataResponse({ command });
}