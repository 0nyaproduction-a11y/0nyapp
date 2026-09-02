import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { ApiError, getPlayTogetherHeartbeat, sendPlayTogetherRoomCommand } from "../lib/api";
import { supabase } from "../lib/supabase";
import type {
  PlayTogetherCommandType,
  PlayTogetherFeatureConfig,
  PlayTogetherRoomState,
} from "../types/playTogether";
import {
  classifyDrift,
  correctionRateForDrift,
  createPlayTogetherCommandId,
  estimateClockOffsetMs,
  expectedPositionMs,
  offsetSampleMs,
  parseStateServerTimeMs,
} from "./playTogetherSync";

// PX01-D — Play Together playback-sync adapter.
//
// The adapter is INERT by default. It only engages when every gate passes:
//   - the room session was actually requested (enabledByGate, a PX01-E/F flow)
//   - the backend config resolves with `enabled === true` (never client-forged)
//   - the room is `active` on the episode the player has loaded
//   - the current user is a room participant (Host or Guest)
//
// Responsibilities (split by role):
//   HOST  -> publish play/pause/seek commands to the canonical backend; hosts
//            never apply canonical state locally (they ARE canonical).
//   GUEST -> apply canonical state (play/pause/seek/anchor rate) and run the
//            drift policy: ignore < 300ms, gentle rate correction < 1200ms,
//            direct seek beyond 1200ms (backend-tuned, fail-closed defaults).
//   BOTH  -> host buffering rides Realtime Presence on the *separate*
//            `play_together_room_presence:<roomId>` topic (private), so the
//            read-only PX01-C room-state seam gains no write capability.
//
// Canonical state always wins and always comes from the GET seam
// (refreshRoom); presences and probes are never authoritative.

export type PlayTogetherPlaybackTarget = {
  currentTimeMs: number;
  durationMs: number | null;
  isBuffering: boolean;
  isPlaying: boolean;
  playbackRate: number;
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
};

export type UsePlayTogetherPlaybackSyncOptions = {
  accessToken: string | null;
  config: PlayTogetherFeatureConfig | null;
  enabledByGate: boolean;
  episodeId: string | null;
  myUserId: string | null;
  refreshRoom: () => Promise<void>;
  room: PlayTogetherRoomState | null;
  roomId: string | null;
  target: PlayTogetherPlaybackTarget;
};

export type UsePlayTogetherPlaybackSyncResult = {
  active: boolean;
  clockOffsetMs: number;
  correctedRate: number;
  handlePlayPause: () => void;
  handleSeekBy: (seconds: number) => void;
  handleSeekTo: (seconds: number) => void;
  hostBuffering: boolean;
  isHost: boolean;
  lastCommandError: string | null;
};

const OFFSET_SAMPLE_WINDOW = 8;
const DRIFT_POLL_INTERVAL_MS = 1000;
const RATE_EPSILON = 0.001;

export function usePlayTogetherPlaybackSync(
  options: UsePlayTogetherPlaybackSyncOptions,
): UsePlayTogetherPlaybackSyncResult {
  const {
    accessToken,
    config,
    enabledByGate,
    episodeId,
    myUserId,
    refreshRoom,
    room,
    roomId,
    target,
  } = options;

  const myParticipant = useMemo(
    () => (room && myUserId ? room.participants.find((participant) => participant.userId === myUserId) ?? null : null),
    [myUserId, room],
  );

  const isHost = myParticipant?.role === "host";

  const active =
    Boolean(enabledByGate && accessToken && roomId && episodeId && myUserId) &&
    Boolean(config?.enabled) &&
    room !== null &&
    room.status === "active" &&
    room.episodeId === episodeId &&
    myParticipant !== null;

  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [correctedRate, setCorrectedRate] = useState(1);
  const [hostBuffering, setHostBuffering] = useState(false);
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);

  const roomRef = useRef(room);
  roomRef.current = room;
  const targetRef = useRef(target);
  targetRef.current = target;
  const activeRef = useRef(active);
  activeRef.current = active;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const clockOffsetMsRef = useRef(clockOffsetMs);
  clockOffsetMsRef.current = clockOffsetMs;

  const clockSamplesRef = useRef<number[]>([]);
  const appliedStateVersionRef = useRef(-1);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  // -------------------------------------------------------------------------
  // HOST: publish commands to the canonical backend. Fire-and-forget; the
  // backend answers with the next room state through the broadcast + GET seam.
  // A 409 (stale_version / ended / expired) just triggers a room refetch; the
  // adapter never retries a possibly-partially-applied command.
  // -------------------------------------------------------------------------
  const publishCommand = useCallback(
    async (commandType: PlayTogetherCommandType, positionMs: number | null) => {
      const roomIdValue = roomIdRef.current;
      const accessTokenValue = accessTokenRef.current;

      if (!activeRef.current || !isHostRef.current || !roomIdValue || !accessTokenValue) {
        return;
      }

      try {
        await sendPlayTogetherRoomCommand(accessTokenValue, roomIdValue, {
          commandId: createPlayTogetherCommandId(),
          commandType,
          expectedVersion: null,
          positionMs,
          targetEpisodeId: null,
        });
        setLastCommandError(null);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          void refreshRoom();
          return;
        }
        setLastCommandError(error instanceof Error ? error.message : "Play Together command failed.");
      }
    },
    [refreshRoom],
  );

  const handlePlayPause = useCallback(() => {
    const currentTarget = targetRef.current;

    if (!activeRef.current || !isHostRef.current) {
      return;
    }

    if (currentTarget.isPlaying) {
      void publishCommand("pause", null);
      currentTarget.pause();
    } else {
      void publishCommand("play", null);
      currentTarget.play();
    }
  }, [publishCommand]);

  const handleSeekTo = useCallback(
    (seconds: number) => {
      const currentTarget = targetRef.current;

      if (!activeRef.current || !isHostRef.current) {
        return;
      }

      const positionMs = Math.max(0, Math.round(seconds * 1000));
      void publishCommand("seek", positionMs);
      currentTarget.seekTo(seconds);
    },
    [publishCommand],
  );

  const handleSeekBy = useCallback(
    (seconds: number) => {
      const currentTarget = targetRef.current;

      if (!activeRef.current || !isHostRef.current) {
        return;
      }

      const currentSeconds = currentTarget.currentTimeMs / 1000;
      const nextSeconds = Math.max(0, currentSeconds + seconds);
      void publishCommand("seek", Math.round(nextSeconds * 1000));
      currentTarget.seekTo(nextSeconds);
    },
    [publishCommand],
  );

  // -------------------------------------------------------------------------
  // PRESENCE: ephemeral "Host is buffering" signal on the private presence
  // topic. Guests read the Host's tracked payload; the Host re-tracks whenever
  // its own buffering state flips. The channel is owned only while the gate is
  // engaged, so an inert adapter never joins a topic.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!active || !roomId || !myUserId) {
      return undefined;
    }

    const hostUserId = room?.participants.find((participant) => participant.role === "host")?.userId;
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`play_together_room_presence:${roomId}`, {
        config: {
          private: true,
          presence: { key: myUserId },
        },
      })
      .on("presence", { event: "sync" }, () => {
        if (!channel) {
          return;
        }
        const hostEntry = hostUserId ? channel.presenceState()[hostUserId] : undefined;
        const latest = Array.isArray(hostEntry) ? hostEntry[hostEntry.length - 1] : undefined;
        setHostBuffering(Boolean(latest && (latest as { buffering?: unknown }).buffering));
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || !channel) {
          return;
        }
        if (isHostRef.current) {
          void channel.track({ buffering: targetRef.current.isBuffering });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      presenceChannelRef.current = null;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [active, myUserId, room, roomId]);

  useEffect(() => {
    const channel = presenceChannelRef.current;

    if (!channel || !active || !isHost) {
      return;
    }

    void channel.track({ buffering: target.isBuffering });
  }, [active, isHost, target.isBuffering]);

  // -------------------------------------------------------------------------
  // HEARTBEAT: clock-offset samples from the GET seam + canonical refresh.
  // Sample = stateServerTime - RTT midpoint, rolled into a small median so a
  // slow/jammed round trip cannot skew the estimate.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!active || !accessToken || !roomId) {
      return undefined;
    }

    const sync = config?.sync;
    if (!sync?.heartbeatSeconds) {
      return undefined;
    }

    const heartbeatMs = Math.max(1000, sync.heartbeatSeconds * 1000);
    let cancelled = false;

    const tick = async () => {
      const requestStartMs = Date.now();

      try {
        const response = await getPlayTogetherHeartbeat(accessToken, roomId);

        if (cancelled) {
          return;
        }

        const sample = offsetSampleMs({
          requestEndMs: Date.now(),
          requestStartMs,
          serverTimeMs: parseStateServerTimeMs(response.room.stateServerTime),
        });

        if (sample !== null) {
          clockSamplesRef.current.push(sample);
          setClockOffsetMs(estimateClockOffsetMs(clockSamplesRef.current, OFFSET_SAMPLE_WINDOW));
        }

        void refreshRoom();
      } catch {
        // Transient heartbeat failure; the next tick retries silently.
      }
    };

    void tick();
    const intervalId = setInterval(() => {
      void tick();
    }, heartbeatMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [accessToken, active, config?.sync?.heartbeatSeconds, refreshRoom, roomId]);

  // -------------------------------------------------------------------------
  // GUEST: apply canonical room state whenever the room advances. Version
  // monotonicity makes repeated/cached payloads safe to discard; the applied
  // guard resets when the room scope itself changes (new room / new episode)
  // so a fresh room is never skipped because an older room had a higher version.
  // -------------------------------------------------------------------------
  useEffect(() => {
    appliedStateVersionRef.current = -1;
  }, [episodeId, roomId]);

  useEffect(() => {
    if (!active || isHost || !room) {
      return;
    }

    if (room.stateVersion <= appliedStateVersionRef.current) {
      return;
    }

    appliedStateVersionRef.current = room.stateVersion;

    const currentTarget = targetRef.current;
    const expectedSeconds =
      expectedPositionMs({
        durationMs: currentTarget.durationMs,
        hostPositionMs: room.hostPositionMs,
        nowMs: Date.now(),
        offsetMs: clockOffsetMs,
        playbackRate: room.playbackRate,
        playbackState: room.playbackState,
        stateServerTimeMs: parseStateServerTimeMs(room.stateServerTime),
      }) / 1000;

    if (room.playbackState === "paused") {
      if (currentTarget.isPlaying) {
        currentTarget.pause();
      }
    } else if (!currentTarget.isPlaying) {
      currentTarget.play();
    }

    currentTarget.seekTo(expectedSeconds);
    currentTarget.setPlaybackRate(room.playbackRate);
    setCorrectedRate(room.playbackRate);
  }, [active, clockOffsetMs, isHost, room]);

  // -------------------------------------------------------------------------
  // GUEST: steady-state drift policy. Runs every second while engaged; seeks
  // and rate nudges are bounded by the backend-tuned thresholds.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!active || isHost) {
      return undefined;
    }

    const syncConfig = config?.sync;
    if (!syncConfig) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      const currentRoom = roomRef.current;
      const currentTarget = targetRef.current;

      if (!activeRef.current || isHostRef.current || !currentRoom) {
        return;
      }

      if (currentRoom.playbackState !== "playing") {
        if (Math.abs(currentTarget.playbackRate - currentRoom.playbackRate) > RATE_EPSILON) {
          currentTarget.setPlaybackRate(currentRoom.playbackRate);
        }
        setCorrectedRate(currentRoom.playbackRate);
        return;
      }

      if (currentTarget.isBuffering || currentTarget.durationMs === null) {
        return;
      }

      const expectedMs = expectedPositionMs({
        durationMs: currentTarget.durationMs,
        hostPositionMs: currentRoom.hostPositionMs,
        nowMs: Date.now(),
        offsetMs: clockOffsetMsRef.current,
        playbackRate: currentRoom.playbackRate,
        playbackState: currentRoom.playbackState,
        stateServerTimeMs: parseStateServerTimeMs(currentRoom.stateServerTime),
      });

      const driftMs = expectedMs - currentTarget.currentTimeMs;
      const resolution = classifyDrift(driftMs, syncConfig);

      if (resolution === "seek") {
        currentTarget.seekTo(expectedMs / 1000);
        currentTarget.setPlaybackRate(currentRoom.playbackRate);
        setCorrectedRate(currentRoom.playbackRate);
        return;
      }

      if (resolution === "rate") {
        const { rate } = correctionRateForDrift({
          canonicalRate: currentRoom.playbackRate,
          config: syncConfig,
          driftMs,
        });
        currentTarget.setPlaybackRate(rate);
        setCorrectedRate(rate);
        return;
      }

      if (Math.abs(currentTarget.playbackRate - currentRoom.playbackRate) > RATE_EPSILON) {
        currentTarget.setPlaybackRate(currentRoom.playbackRate);
      }
      setCorrectedRate(currentRoom.playbackRate);
    }, DRIFT_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [active, config, isHost]);

  return {
    active,
    clockOffsetMs,
    correctedRate,
    handlePlayPause,
    handleSeekBy,
    handleSeekTo,
    hostBuffering,
    isHost,
    lastCommandError,
  };
}