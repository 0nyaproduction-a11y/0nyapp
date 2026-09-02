import "server-only";

import crypto, { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canUserWatchEpisode, hasActiveSubscription } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ReadBuilder<T> = {
  eq: (column: string, value: string) => ReadBuilder<T>;
  gt: (column: string, value: string) => ReadBuilder<T>;
  in: (column: string, values: string[]) => ReadBuilder<T>;
  is: (column: string, value: null) => ReadBuilder<T>;
  limit: (count: number) => ReadBuilder<T>;
  maybeSingle: () => Promise<{ data: T | null; error: unknown }>;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => Promise<{ data: T | null; error: unknown }>;
};

type PlayTogetherSupabaseClient = {
  from: (table: string) => {
    insert: (values: unknown) => {
      select: <T>(columns: string) => {
        maybeSingle: () => Promise<{ data: T | null; error: unknown }>;
      };
    };
    select: <T>(columns: string) => ReadBuilder<T>;
  };
  rpc: <T = unknown>(
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message?: string } | null }>;
};

type EpisodeWithSeries = Database["public"]["Tables"]["episodes"]["Row"] & {
  series: Pick<Database["public"]["Tables"]["series"]["Row"], "status"> | null;
};

type PlayTogetherAccessMethod = "plus" | "coin" | "rewarded";

export type PlayTogetherAccessCheck =
  | { allowed: true; method: PlayTogetherAccessMethod }
  | {
      allowed: false;
      reason:
        | "access_resolver_unavailable"
        | "content_access_required"
        | "feature_deferred"
        | "ttl_unresolved";
    };

export type PlayTogetherRoomState = {
  endedAt: string | null;
  episodeId: string;
  expiresAt: string;
  hostPositionMs: number;
  id: string;
  lastCommandId: string | null;
  participants: Array<{
    id: string;
    joinedAt: string;
    role: "host" | "guest";
    userId: string;
  }>;
  playbackRate: number;
  playbackState: string;
  stateServerTime: string | null;
  stateVersion: number;
  status: string;
};

export type PlayTogetherInviteContext = {
  episodeId: string;
  expiresAt: string;
  id: string;
  roomId: string;
  roomExpiresAt: string;
  roomStatus: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export type PlayTogetherRpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export type CreatedPlayTogetherRoom = {
  episodeId: string;
  expiresAt: string;
  hostParticipantId: string;
  id: string;
  stateVersion: number;
  status: string;
};

export type CreatedPlayTogetherInvite = {
  expiresAt: string;
  id: string;
  inviteToken: string;
  roomId: string;
};

export type RevokedPlayTogetherInvite = {
  id: string;
  result: "revoked" | "already_revoked" | "already_used";
  revokedAt: string | null;
  roomId: string;
  usedAt: string | null;
};

export type JoinedPlayTogetherRoom = {
  episodeId: string;
  participantId: string;
  roomId: string;
  stateVersion: number;
  status: string;
};

export type PlayTogetherAcquisitionTarget = "host_create" | "guest_join";
export type PlayTogetherAcquisitionMethod = "coin" | "rewarded";

export type PlayTogetherCommercialConfig = {
  enabled: boolean;
  coinPrice: number;
  requiredRewardedCompletions: number;
  sync: PlayTogetherSyncConfig;
};

export type PlayTogetherSyncConfig = {
  heartbeatSeconds: number;
  largeDriftMs: number;
  rateMaxFactor: number;
  rateMinFactor: number;
  smallDriftMs: number;
};

export type PlayTogetherAcquisitionIntent = {
  configuredCoinPriceSnapshot: number | null;
  configuredRewardedCountSnapshot: number | null;
  episodeId: string;
  expiresAt: string;
  id: string;
  inviteId: string | null;
  method: PlayTogetherAcquisitionMethod;
  roomId: string | null;
  status: string;
  target: PlayTogetherAcquisitionTarget;
};

export type PlayTogetherCoinAcquisition = {
  accessMethod: "coin" | "plus";
  coinTransactionId: string | null;
  episodeId: string;
  hostParticipantId: string | null;
  intentId: string;
  remainingBalance: number | null;
  roomId: string | null;
  status: string;
};

export type PlayTogetherRoomCommandType =
  | "play"
  | "pause"
  | "seek"
  | "episode_change"
  | "end_room";

export type PlayTogetherRoomCommandResult = {
  endedAt: string | null;
  episodeId: string;
  hostPositionMs: number;
  playbackRate: number;
  playbackState: string;
  roomId: string;
  stateServerTime: string | null;
  stateVersion: number;
  status: string;
  statusCode: string;
  success: boolean;
};

export type PlayTogetherRoomCommandStatus =
  | "applied"
  | "replayed"
  | "invalid_request"
  | "invalid_position"
  | "invalid_episode"
  | "not_host"
  | "room_not_found"
  | "room_ended"
  | "room_expired"
  | "stale_version"
  | "transaction_conflict";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOINABLE_ROOM_STATUSES = ["waiting", "active", "waiting_for_access"];
export const PLAY_TOGETHER_ROOM_TTL_MS = 6 * 60 * 60 * 1000;
export const PLAY_TOGETHER_INVITE_TTL_MS = 60 * 60 * 1000;

export function normalizeUuid(value: unknown) {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

export function normalizeCommandType(value: unknown): PlayTogetherRoomCommandType | null {
  const type = typeof value === "string" ? value.trim() : "";

  return type === "play" ||
    type === "pause" ||
    type === "seek" ||
    type === "episode_change" ||
    type === "end_room"
    ? type
    : null;
}

export function normalizeCommandId(value: unknown) {
  const commandId = typeof value === "string" ? value.trim() : "";

  return /^[\x21-\x7e]{8,160}$/.test(commandId) ? commandId : null;
}

export function normalizeOptionalNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function normalizeInviteToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_-]{32,128}$/.test(token) ? token : null;
}

export function normalizeIdempotencyKey(value: unknown) {
  const key = typeof value === "string" ? value.trim() : "";
  return key.length >= 8 && key.length <= 160 ? key : null;
}

function toIsoDate(value: Date) {
  return value.toISOString();
}

export function resolvePlayTogetherRoomExpiry(now = new Date()) {
  return toIsoDate(new Date(now.getTime() + PLAY_TOGETHER_ROOM_TTL_MS));
}

export function resolvePlayTogetherInviteExpiry(input: {
  now?: Date;
  roomExpiresAt: string;
}) {
  const now = input.now ?? new Date();
  const roomExpiry = new Date(input.roomExpiresAt).getTime();
  const uncappedExpiry = now.getTime() + PLAY_TOGETHER_INVITE_TTL_MS;

  return toIsoDate(new Date(Math.min(uncappedExpiry, roomExpiry)));
}

export async function resolvePlayTogetherAccess(input: {
  roomId?: string | null;
  supabase?: SupabaseClient<Database>;
  userId: string;
}): Promise<PlayTogetherAccessCheck> {
  if (await hasActiveSubscription(input.userId, input.supabase)) {
    return { allowed: true, method: "plus" };
  }

  if (!input.roomId) {
    return { allowed: false, reason: "access_resolver_unavailable" };
  }

  const supabase = getAdminSupabase();
  const now = new Date().toISOString();
  const { data: room, error: roomError }: {
    data: { expires_at: string; status: string } | null;
    error: unknown;
  } = await supabase
    .from("play_together_rooms")
    .select<{ expires_at: string; status: string }>("status, expires_at")
    .eq("id", input.roomId)
    .in("status", JOINABLE_ROOM_STATUSES)
    .gt("expires_at", now)
    .maybeSingle();

  if (roomError || !room) {
    return { allowed: false, reason: "access_resolver_unavailable" };
  }

  const { data: grant, error: grantError }: {
    data: { source: PlayTogetherAccessMethod } | null;
    error: unknown;
  } = await supabase
    .from("play_together_room_access_grants")
    .select<{ source: PlayTogetherAccessMethod }>("source")
    .eq("user_id", input.userId)
    .eq("room_id", input.roomId)
    .limit(1)
    .maybeSingle();

  if (grantError || !grant) {
    return { allowed: false, reason: "access_resolver_unavailable" };
  }

  if (grant.source === "coin" || grant.source === "rewarded") {
    return { allowed: true, method: grant.source };
  }

  return { allowed: false, reason: "access_resolver_unavailable" };
}

function getAdminSupabase() {
  return createAdminClient() as unknown as PlayTogetherSupabaseClient;
}

export async function loadPublishedEpisodeForPlayTogether(episodeId: string) {
  const supabase = getAdminSupabase();
  const { data, error }: { data: EpisodeWithSeries | null; error: unknown } = await supabase
    .from("episodes")
    .select<EpisodeWithSeries>("*, series:series_id(status)")
    .eq("id", episodeId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data || data.series?.status !== "published") {
    return null;
  }

  if (data.published_at && new Date(data.published_at).getTime() > Date.now()) {
    return null;
  }

  return data;
}

export async function canUserAccessPlayTogetherEpisode(input: {
  episodeId: string;
  supabase?: SupabaseClient<Database>;
  userId: string;
}) {
  const episode = await loadPublishedEpisodeForPlayTogether(input.episodeId);

  if (!episode) {
    return { allowed: false as const, reason: "not_found" as const };
  }

  const allowed = await canUserWatchEpisode({
    episode: {
      id: episode.id,
      coinPrice: episode.coin_price,
      coinUnlockEnabled: episode.coin_unlock_enabled,
      contentDescriptors: [],
      contentDescriptorsOverride: [],
      contentRating: null,
      contentRatingOverride: null,
      description: episode.synopsis ?? "",
      isFree: episode.is_free,
      isLocked: !episode.is_free,
      lockedPreviewSeconds: episode.locked_preview_seconds,
      number: episode.episode_number,
      parentalLockRequired: false,
      plusAccess: episode.plus_access,
      requiredRewardedCompletions: episode.required_rewarded_completions,
      rewardedAccessMode: episode.rewarded_access_mode,
      rewardedUnlockEnabled: episode.rewarded_unlock_enabled,
      runtime: `${episode.duration_seconds}`,
      title: episode.title ?? `Episode ${episode.episode_number}`,
    },
    supabase: input.supabase,
    userId: input.userId,
  });

  return allowed
    ? { allowed: true as const, episode }
    : { allowed: false as const, reason: "content_access_required" as const };
}

export async function getParticipantRoomState(input: {
  roomId: string;
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<PlayTogetherRoomState | null> {
  const supabase = input.supabase as unknown as PlayTogetherSupabaseClient;
  const { data: room, error: roomError }: {
    data: {
      ended_at: string | null;
      episode_id: string;
      expires_at: string;
      host_position_ms: number;
      id: string;
      last_command_id: string | null;
      playback_rate: number;
      playback_state: string;
      state_server_time: string | null;
      state_version: number;
      status: string;
    } | null;
    error: unknown;
  } = await supabase
    .from("play_together_rooms")
    .select<{
      ended_at: string | null;
      episode_id: string;
      expires_at: string;
      host_position_ms: number;
      id: string;
      last_command_id: string | null;
      playback_rate: number;
      playback_state: string;
      state_server_time: string | null;
      state_version: number;
      status: string;
    }>(
      "id, episode_id, status, host_position_ms, playback_rate, playback_state, state_version, state_server_time, last_command_id, expires_at, ended_at",
    )
    .eq("id", input.roomId)
    .maybeSingle();

  if (roomError || !room) {
    return null;
  }

  const { data: participants, error: participantError }: {
    data:
      | Array<{
          id: string;
          joined_at: string;
          role: "host" | "guest";
          user_id: string;
        }>
      | null;
    error: unknown;
  } = await supabase
    .from("play_together_participants")
    .select<
      Array<{
        id: string;
        joined_at: string;
        role: "host" | "guest";
        user_id: string;
      }>
    >("id, user_id, role, joined_at")
    .eq("room_id", input.roomId)
    .order("joined_at", { ascending: true });

  if (participantError || !participants?.some((participant) => participant.user_id === input.userId)) {
    return null;
  }

  return {
    endedAt: room.ended_at,
    episodeId: room.episode_id,
    expiresAt: room.expires_at,
    hostPositionMs: Number(room.host_position_ms),
    id: room.id,
    lastCommandId: room.last_command_id,
    participants: participants.map((participant) => ({
      id: participant.id,
      joinedAt: participant.joined_at,
      role: participant.role,
      userId: participant.user_id,
    })),
    playbackRate: Number(room.playback_rate),
    playbackState: room.playback_state,
    stateServerTime: room.state_server_time,
    stateVersion: Number(room.state_version),
    status: room.status,
  };
}

function rpcFailure(error: { message?: string } | null) {
  return { ok: false as const, reason: error?.message ?? "server_error" };
}

export async function getPlayTogetherCommercialConfig(): Promise<
  PlayTogetherRpcResult<PlayTogetherCommercialConfig>
> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc<
    Array<{
      enabled: boolean;
      coin_price: number;
      required_rewarded_completions: number;
      sync_heartbeat_seconds: number;
      sync_large_drift_ms: number;
      sync_rate_max_factor: number;
      sync_rate_min_factor: number;
      sync_small_drift_ms: number;
    }>
  >("get_play_together_commercial_config", {});

  if (error) {
    return rpcFailure(error);
  }

  const config = data?.at(0);

  if (!config) {
    return { ok: false, reason: "config_unavailable" };
  }

  return {
    ok: true,
    data: {
      enabled: config.enabled,
      coinPrice: Number(config.coin_price),
      requiredRewardedCompletions: Number(config.required_rewarded_completions),
      sync: {
        heartbeatSeconds: Number(config.sync_heartbeat_seconds),
        largeDriftMs: Number(config.sync_large_drift_ms),
        rateMaxFactor: Number(config.sync_rate_max_factor),
        rateMinFactor: Number(config.sync_rate_min_factor),
        smallDriftMs: Number(config.sync_small_drift_ms),
      },
    },
  };
}

export async function createPlayTogetherAcquisitionIntent(input: {
  episodeId?: string | null;
  idempotencyKey: string;
  inviteToken?: string | null;
  method: PlayTogetherAcquisitionMethod;
  target: PlayTogetherAcquisitionTarget;
  userId: string;
}): Promise<PlayTogetherRpcResult<PlayTogetherAcquisitionIntent>> {
  const supabase = getAdminSupabase();
  const inviteToken = input.inviteToken ? normalizeInviteToken(input.inviteToken) : null;
  const { data, error } = await supabase.rpc<
    Array<{
      configured_coin_price_snapshot: number | null;
      configured_rewarded_count_snapshot: number | null;
      episode_id: string;
      expires_at: string;
      intent_id: string;
      invite_id: string | null;
      method: PlayTogetherAcquisitionMethod;
      room_id: string | null;
      status: string;
      success: boolean;
      target: PlayTogetherAcquisitionTarget;
    }>
  >("create_play_together_acquisition_intent", {
    p_episode_id: input.episodeId ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_invite_token_hash: inviteToken ? hashInviteToken(inviteToken) : null,
    p_method: input.method,
    p_target: input.target,
    p_user_id: input.userId,
  });

  if (error) {
    return rpcFailure(error);
  }

  const intent = data?.at(0);

  if (!intent) {
    return { ok: false, reason: "server_error" };
  }

  if (!intent.success) {
    return { ok: false, reason: intent.status };
  }

  return {
    ok: true,
    data: {
      configuredCoinPriceSnapshot: intent.configured_coin_price_snapshot,
      configuredRewardedCountSnapshot: intent.configured_rewarded_count_snapshot,
      episodeId: intent.episode_id,
      expiresAt: intent.expires_at,
      id: intent.intent_id,
      inviteId: intent.invite_id,
      method: intent.method,
      roomId: intent.room_id,
      status: intent.status,
      target: intent.target,
    },
  };
}

export async function purchasePlayTogether0chatWithCoins(input: {
  intentId: string;
  userId: string;
}): Promise<PlayTogetherRpcResult<PlayTogetherCoinAcquisition>> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc<
    Array<{
      access_method: "coin" | "plus";
      coin_transaction_id: string | null;
      episode_id: string;
      host_participant_id: string | null;
      intent_id: string;
      remaining_balance: number | null;
      room_id: string | null;
      status: string;
      success: boolean;
    }>
  >("purchase_play_together_0chat_with_coins", {
    p_intent_id: input.intentId,
    p_user_id: input.userId,
  });

  if (error) {
    return rpcFailure(error);
  }

  const result = data?.at(0);

  if (!result) {
    return { ok: false, reason: "server_error" };
  }

  if (!result.success) {
    return { ok: false, reason: result.status };
  }

  return {
    ok: true,
    data: {
      accessMethod: result.access_method,
      coinTransactionId: result.coin_transaction_id,
      episodeId: result.episode_id,
      hostParticipantId: result.host_participant_id,
      intentId: result.intent_id,
      remainingBalance: result.remaining_balance,
      roomId: result.room_id,
      status: result.status,
    },
  };
}

export async function createPlayTogetherRoom(input: {
  episodeId: string;
  hostUserId: string;
}): Promise<PlayTogetherRpcResult<CreatedPlayTogetherRoom>> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc<
    Array<{
      episode_id: string;
      expires_at: string;
      host_participant_id: string;
      room_id: string;
      state_version: number;
      status: string;
    }>
  >("create_play_together_room", {
    p_episode_id: input.episodeId,
    p_host_user_id: input.hostUserId,
    p_room_expires_at: resolvePlayTogetherRoomExpiry(),
  });

  if (error) {
    return rpcFailure(error);
  }

  const room = data?.at(0);

  if (!room) {
    return { ok: false, reason: "server_error" };
  }

  return {
    ok: true,
    data: {
      episodeId: room.episode_id,
      expiresAt: room.expires_at,
      hostParticipantId: room.host_participant_id,
      id: room.room_id,
      stateVersion: Number(room.state_version),
      status: room.status,
    },
  };
}

export async function createPlayTogetherInvite(input: {
  actorUserId: string;
  room: PlayTogetherRoomState;
}): Promise<PlayTogetherRpcResult<CreatedPlayTogetherInvite>> {
  const inviteToken = createInviteToken();
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc<
    Array<{
      expires_at: string;
      invite_id: string;
      room_id: string;
    }>
  >("create_play_together_invite", {
    p_actor_user_id: input.actorUserId,
    p_invite_expires_at: resolvePlayTogetherInviteExpiry({ roomExpiresAt: input.room.expiresAt }),
    p_room_id: input.room.id,
    p_token_hash: hashInviteToken(inviteToken),
  });

  if (error) {
    return rpcFailure(error);
  }

  const invite = data?.at(0);

  if (!invite) {
    return { ok: false, reason: "server_error" };
  }

  return {
    ok: true,
    data: {
      expiresAt: invite.expires_at,
      id: invite.invite_id,
      inviteToken,
      roomId: invite.room_id,
    },
  };
}

export async function revokePlayTogetherInvite(input: {
  actorUserId: string;
  inviteId: string;
  roomId: string;
}): Promise<PlayTogetherRpcResult<RevokedPlayTogetherInvite>> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc<
    Array<{
      invite_id: string;
      result: "revoked" | "already_revoked" | "already_used";
      revoked_at: string | null;
      room_id: string;
      used_at: string | null;
    }>
  >("revoke_play_together_invite", {
    p_actor_user_id: input.actorUserId,
    p_invite_id: input.inviteId,
    p_room_id: input.roomId,
  });

  if (error) {
    return rpcFailure(error);
  }

  const invite = data?.at(0);

  if (!invite) {
    return { ok: false, reason: "server_error" };
  }

  return {
    ok: true,
    data: {
      id: invite.invite_id,
      result: invite.result,
      revokedAt: invite.revoked_at,
      roomId: invite.room_id,
      usedAt: invite.used_at,
    },
  };
}

export async function getInviteJoinContext(
  inviteToken: string,
): Promise<PlayTogetherInviteContext | null> {
  const supabase = getAdminSupabase();
  const now = new Date().toISOString();
  const { data, error }: {
    data: {
      expires_at: string;
      id: string;
      play_together_rooms?: { episode_id: string; expires_at: string; status: string } | null;
      revoked_at: string | null;
      room_id: string;
      used_at: string | null;
    } | null;
    error: unknown;
  } = await supabase
    .from("play_together_invites")
    .select<{
      expires_at: string;
      id: string;
      play_together_rooms?: { episode_id: string; expires_at: string; status: string } | null;
      revoked_at: string | null;
      room_id: string;
      used_at: string | null;
    }>(
      "id, room_id, expires_at, used_at, revoked_at, play_together_rooms!inner(episode_id, expires_at, status)",
    )
    .eq("token_hash", hashInviteToken(inviteToken))
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .gt("play_together_rooms.expires_at", now)
    .in("play_together_rooms.status", JOINABLE_ROOM_STATUSES)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const joinedRoom = data.play_together_rooms;

  if (!joinedRoom) {
    return null;
  }

  return {
    episodeId: joinedRoom.episode_id,
    expiresAt: data.expires_at,
    id: data.id,
    revokedAt: data.revoked_at,
    roomExpiresAt: joinedRoom.expires_at,
    roomId: data.room_id,
    roomStatus: joinedRoom.status,
    usedAt: data.used_at,
  };
}

export async function redeemPlayTogetherInvite(input: {
  inviteToken: string;
  joiningUserId: string;
}): Promise<PlayTogetherRpcResult<JoinedPlayTogetherRoom>> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc<
    Array<{
      episode_id: string;
      participant_id: string;
      room_id: string;
      state_version: number;
      status: string;
    }>
  >("redeem_play_together_invite", {
    p_joining_user_id: input.joiningUserId,
    p_token_hash: hashInviteToken(input.inviteToken),
  });

  if (error) {
    return rpcFailure(error);
  }

  const joined = data?.at(0);

  if (!joined) {
    return { ok: false, reason: "server_error" };
  }

  return {
    ok: true,
    data: {
      episodeId: joined.episode_id,
      participantId: joined.participant_id,
      roomId: joined.room_id,
      stateVersion: Number(joined.state_version),
      status: joined.status,
    },
  };
}

export async function applyPlayTogetherRoomCommand(input: {
  actorUserId: string;
  commandId: string;
  commandType: PlayTogetherRoomCommandType;
  expectedVersion?: number | null;
  positionMs?: number | null;
  roomId: string;
  targetEpisodeId?: string | null;
}): Promise<PlayTogetherRpcResult<PlayTogetherRoomCommandResult>> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc<
    Array<{
      ended_at: string | null;
      episode_id: string;
      host_position_ms: number;
      playback_rate: number;
      playback_state: string;
      room_id: string;
      state_server_time: string | null;
      state_version: number;
      status: string;
      status_code: string;
      success: boolean;
    }>
  >("apply_play_together_room_command", {
    p_actor_user_id: input.actorUserId,
    p_room_id: input.roomId,
    p_command_id: input.commandId,
    p_command_type: input.commandType,
    p_expected_version: input.expectedVersion ?? null,
    p_position_ms: input.positionMs ?? null,
    p_target_episode_id: input.targetEpisodeId ?? null,
  });

  if (error) {
    return rpcFailure(error);
  }

  const command = data?.at(0);

  if (!command) {
    return { ok: false, reason: "server_error" };
  }

  return {
    ok: true,
    data: {
      endedAt: command.ended_at,
      episodeId: command.episode_id,
      hostPositionMs: Number(command.host_position_ms),
      playbackRate: Number(command.playback_rate),
      playbackState: command.playback_state,
      roomId: command.room_id,
      stateServerTime: command.state_server_time,
      stateVersion: Number(command.state_version),
      status: command.status,
      statusCode: command.status_code,
      success: command.success,
    },
  };
}
