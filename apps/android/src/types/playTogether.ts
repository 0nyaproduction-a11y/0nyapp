// PX01-C — Play Together Android room types.
//
// Mirror the canonical backend payloads under src/app/api/v1/play-together/*
// and src/lib/play-together.ts. These types only describe server-returned
// truth; Android never decides Host identity, membership, room status,
// entitlement, or room version authoritatively.

export type PlayTogetherParticipantRole = "host" | "guest";

export type PlayTogetherParticipant = {
  id: string;
  joinedAt: string;
  role: PlayTogetherParticipantRole;
  userId: string;
};

export type PlayTogetherRoomStatus =
  | "waiting"
  | "active"
  | "waiting_for_access"
  | "ended"
  | "expired";

export type PlayTogetherRoomState = {
  endedAt: string | null;
  episodeId: string;
  expiresAt: string;
  hostPositionMs: number;
  id: string;
  lastCommandId: string | null;
  participants: PlayTogetherParticipant[];
  playbackRate: number;
  playbackState: string;
  stateServerTime: string | null;
  stateVersion: number;
  status: PlayTogetherRoomStatus;
};

export type PlayTogetherAccessMethod = "plus" | "coin" | "rewarded";

export type PlayTogetherCreatedRoom = {
  episodeId: string;
  expiresAt: string;
  hostParticipantId: string;
  id: string;
  stateVersion: number;
  status: PlayTogetherRoomStatus;
};

export type PlayTogetherCreateRoomResponse = {
  accessMethod: PlayTogetherAccessMethod;
  room: PlayTogetherCreatedRoom;
};

export type PlayTogetherCreatedInvite = {
  expiresAt: string;
  id: string;
  inviteToken: string;
  roomId: string;
};

export type PlayTogetherInviteResponse = {
  accessMethod: PlayTogetherAccessMethod;
  invite: PlayTogetherCreatedInvite;
};

export type PlayTogetherRevokedInvite = {
  id: string;
  result: "revoked" | "already_revoked" | "already_used";
  revokedAt: string | null;
  roomId: string;
  usedAt: string | null;
};

export type PlayTogetherJoinedRoom = {
  episodeId: string;
  participantId: string;
  roomId: string;
  stateVersion: number;
  status: PlayTogetherRoomStatus;
};

export type PlayTogetherJoinRoomResponse = {
  accessMethod: PlayTogetherAccessMethod;
  room: PlayTogetherJoinedRoom;
};

export type PlayTogetherHeartbeatResponse = {
  room: PlayTogetherRoomState;
};

// UI presentation states derived from canonical room status. "loading" and
// "reconnecting" are transport states only and never authoritative.
export type PlayTogetherPresentationState =
  | "loading"
  | "waiting"
  | "connected"
  | "waiting_for_access"
  | "ended"
  | "expired"
  | "reconnecting"
  | "unavailable";

// PX01-C1: Read-only consumer feature-config returned by the server-controlled
// visibility seam (GET /api/v1/play-together/config). The Android client must
// never hardcode `enabled` — it consumes the backend value, which defaults to
// false until the Product Owner explicitly activates Play Together.
//
// PX01-D: `sync` carries backend-controlled playback-synchronization tuning
// consumed by the sync adapter (drift thresholds, rate-correction bounds, and
// heartbeat cadence). `sync` is null when the config cannot be resolved; the
// adapter is inert whenever `enabled` is false.
export type PlayTogetherFeatureConfig = {
  enabled: boolean;
  sync: PlayTogetherSyncConfig | null;
};

export type PlayTogetherSyncConfig = {
  heartbeatSeconds: number;
  largeDriftCorrectionMs: number;
  rateMaxFactor: number;
  rateMinFactor: number;
  smallDriftIgnoredMs: number;
};

// PX01-D: Host-published playback commands (server-authoritative, never applied
// locally). Explicit commandId enforces idempotency and ordering against the
// room acting sequence; stale versions are rejected by the backend.
export type PlayTogetherCommandType = "play" | "pause" | "seek";

export type PlayTogetherRoomCommandRequest = {
  commandId: string;
  commandType: PlayTogetherCommandType;
  expectedVersion: number | null;
  positionMs: number | null;
  targetEpisodeId: string | null;
};

export type PlayTogetherRoomCommand = {
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