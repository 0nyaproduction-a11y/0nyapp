import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { ApiError, getPlayTogetherRoom } from "./api";
import { supabase } from "./supabase";
import type { PlayTogetherRoomState } from "../types/playTogether";

// PX01-C — Play Together room-state seam.
//
// Read-only realtime seam over the existing PX01-B backend. Canonical state
// always comes from a GET; Supabase broadcast on the private
// `play_together_room:<roomId>` topic only triggers a refetch. The monotonic
// `stateVersion` guard makes cached/raced payloads safe to discard. This hook
// never writes, applies, or schedules playback/chat commands and never
// fabricates room state locally.

export type PlayTogetherRoomConnection = "connecting" | "connected" | "reconnecting";

export type UsePlayTogetherRoomResult = {
  connection: PlayTogetherRoomConnection;
  fatalError: string | null;
  refresh: () => Promise<void>;
  room: PlayTogetherRoomState | null;
};

const BROADCAST_EVENT = "state_changed";
const TERMINAL_STATUSES = new Set(["ended", "expired"]);

export function usePlayTogetherRoom(
  accessToken: string | null,
  roomId: string | null,
): UsePlayTogetherRoomResult {
  const [room, setRoom] = useState<PlayTogetherRoomState | null>(null);
  const [connection, setConnection] = useState<PlayTogetherRoomConnection>("connecting");
  const [fatalError, setFatalError] = useState<string | null>(null);

  const roomRef = useRef<PlayTogetherRoomState | null>(null);
  roomRef.current = room;

  const refresh = useCallback(async () => {
    if (!roomId || !accessToken) {
      setConnection("reconnecting");
      return;
    }

    try {
      const { room: incoming } = await getPlayTogetherRoom(accessToken, roomId);
      const current = roomRef.current;

      const flipsTerminal =
        current !== null &&
        TERMINAL_STATUSES.has(incoming.status) &&
        incoming.status !== current.status;

      if (!current || incoming.stateVersion > current.stateVersion || flipsTerminal) {
        setRoom(incoming);
      }

      setFatalError(null);
      setConnection("connected");
    } catch (error) {
      if (error instanceof ApiError && error.code === "network_error") {
        setConnection("reconnecting");
        return;
      }
      setFatalError(error instanceof Error ? error.message : "Room state could not be loaded.");
    }
  }, [accessToken, roomId]);

  useEffect(() => {
    if (!roomId || !accessToken) {
      return undefined;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`play_together_room:${roomId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: BROADCAST_EVENT }, () => {
        if (!cancelled) {
          void refresh();
        }
      })
      .subscribe((status) => {
        if (cancelled) {
          return;
        }
        if (status === "SUBSCRIBED") {
          setConnection("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("reconnecting");
        }
      });

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [accessToken, refresh, roomId]);

  useEffect(() => {
    if (!roomId || !accessToken) {
      return undefined;
    }

    setConnection("connecting");
    void refresh();

    return undefined;
  }, [accessToken, refresh, roomId]);

  return { connection, fatalError, refresh, room };
}