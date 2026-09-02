import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  canUserAccessPlayTogetherEpisode,
  createPlayTogetherAcquisitionIntent,
  getInviteJoinContext,
  getPlayTogetherCommercialConfig,
  normalizeIdempotencyKey,
  normalizeInviteToken,
  normalizeUuid,
  type PlayTogetherAcquisitionMethod,
  type PlayTogetherAcquisitionTarget,
} from "@/lib/play-together";

const TARGETS = new Set<PlayTogetherAcquisitionTarget>(["host_create", "guest_join"]);
const METHODS = new Set<PlayTogetherAcquisitionMethod>(["coin", "rewarded"]);

function normalizeTarget(value: unknown) {
  return typeof value === "string" && TARGETS.has(value as PlayTogetherAcquisitionTarget)
    ? (value as PlayTogetherAcquisitionTarget)
    : null;
}

function normalizeMethod(value: unknown) {
  return typeof value === "string" && METHODS.has(value as PlayTogetherAcquisitionMethod)
    ? (value as PlayTogetherAcquisitionMethod)
    : null;
}

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

  const payload = body as {
    episodeId?: unknown;
    idempotencyKey?: unknown;
    inviteToken?: unknown;
    method?: unknown;
    target?: unknown;
  };
  const target = normalizeTarget(payload.target);
  const method = normalizeMethod(payload.method);
  const idempotencyKey = normalizeIdempotencyKey(payload.idempotencyKey);

  if (!target || !method || !idempotencyKey) {
    return errorResponse("invalid_request", "target, method, and idempotencyKey are required.", 400);
  }

  if (target === "host_create") {
    const episodeId = normalizeUuid(payload.episodeId);

    if (!episodeId || payload.inviteToken !== undefined) {
      return errorResponse("invalid_request", "episodeId is required for Host acquisition.", 400);
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

    const intent = await createPlayTogetherAcquisitionIntent({
      episodeId,
      idempotencyKey,
      method,
      target,
      userId: auth.user.id,
    });

    if (!intent.ok) {
      const status = intent.reason === "transaction_conflict" ? 409 : 400;
      return errorResponse("invalid_request", "Unable to create Play Together acquisition intent.", status);
    }

    const config = await getPlayTogetherCommercialConfig();

    return dataResponse({
      config: config.ok ? config.data : null,
      intent: intent.data,
      rewardedOperational: false,
    });
  }

  const inviteToken = normalizeInviteToken(payload.inviteToken);

  if (!inviteToken || payload.episodeId !== undefined) {
    return errorResponse("invalid_request", "inviteToken is required for Guest acquisition.", 400);
  }

  const invite = await getInviteJoinContext(inviteToken);

  if (!invite) {
    return errorResponse("not_found", "Invite not found.", 404);
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

  const intent = await createPlayTogetherAcquisitionIntent({
    idempotencyKey,
    inviteToken,
    method,
    target,
    userId: auth.user.id,
  });

  if (!intent.ok) {
    const status = intent.reason === "transaction_conflict" ? 409 : 400;
    return errorResponse("invalid_request", "Unable to create Play Together acquisition intent.", status);
  }

  const config = await getPlayTogetherCommercialConfig();

  return dataResponse({
    config: config.ok ? config.data : null,
    intent: intent.data,
    rewardedOperational: false,
  });
}
