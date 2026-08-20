import { useEventListener } from "expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  useVideoPlayer,
  type PlayerError,
  type SubtitleTrack,
  type VideoPlayerStatus,
  type VideoSource,
} from "expo-video";
import type { PlaybackContext, PlaybackEndedPayload } from "./types";

type UsePlaybackControllerOptions = {
  context: PlaybackContext;
  source: VideoSource;
  onEnded?: (payload: PlaybackEndedPayload) => void;
};

const INITIAL_STATUS: VideoPlayerStatus = "idle";

export function usePlaybackController({
  context,
  onEnded,
  source,
}: UsePlaybackControllerOptions) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPosition, setBufferedPosition] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [hasEnded, setHasEnded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<VideoPlayerStatus>(INITIAL_STATUS);
  const [error, setError] = useState<PlayerError | undefined>();
  const [sourceLoadCount, setSourceLoadCount] = useState(0);
  const isMountedRef = useRef(true);
  const userPausedRef = useRef(false);

  const player = useVideoPlayer(source, (createdPlayer) => {
    createdPlayer.loop = false;
    createdPlayer.muted = false;
    createdPlayer.volume = 1;
    createdPlayer.playbackRate = 1;
    createdPlayer.timeUpdateEventInterval = 0.5;
    createdPlayer.keepScreenOnWhilePlaying = true;
    createdPlayer.showNowPlayingNotification = false;
    createdPlayer.staysActiveInBackground = false;
  });

  const pause = useCallback(() => {
    userPausedRef.current = true;
    player.pause();
  }, [player]);

  const play = useCallback(() => {
    userPausedRef.current = false;
    setHasEnded(false);
    player.play();
  }, [player]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      userPausedRef.current = true;
      player.pause();
    } else if (hasEnded) {
      userPausedRef.current = false;
      player.replay();
      setHasEnded(false);
      player.play();
    } else {
      userPausedRef.current = false;
      player.play();
    }
  }, [hasEnded, isPlaying, player]);

  const seekBy = useCallback(
    (seconds: number) => {
      setHasEnded(false);
      player.seekBy(seconds);
    },
    [player],
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const safeDuration = duration > 0 ? duration : player.duration;
      const nextTime = Math.max(0, Math.min(seconds, safeDuration || seconds));
      setHasEnded(false);
      // eslint-disable-next-line react-hooks/immutability -- expo-video exposes exact seeking through this mutable player property.
      player.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration, player],
  );

  const replay = useCallback(() => {
    userPausedRef.current = false;
    player.replay();
    setHasEnded(false);
    player.play();
  }, [player]);

  const setTemporaryRate = useCallback(
    (rate: number) => {
      // eslint-disable-next-line react-hooks/immutability -- expo-video exposes playback speed through mutable player properties.
      player.preservesPitch = true;
      player.playbackRate = rate;
    },
    [player],
  );

  const retry = useCallback(async () => {
    userPausedRef.current = false;
    setHasEnded(false);
    setCurrentTime(0);
    setDuration(0);
    await player.replaceAsync(source);
    if (isMountedRef.current && !userPausedRef.current) {
      player.play();
    }
  }, [player, source]);

  useEffect(() => {
    userPausedRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- player changes are source lifecycle boundaries; reset stale source state before autoplay.
    setHasEnded(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPosition(0);
    setError(undefined);
    setSourceLoadCount(0);
    setStatus(INITIAL_STATUS);
    player.play();
  }, [player]);

  useEventListener(player, "statusChange", (payload) => {
    setStatus(payload.status);
    setError(payload.error);
  });

  useEventListener(player, "playingChange", (payload) => {
    setIsPlaying(payload.isPlaying);
  });

  useEventListener(player, "timeUpdate", (payload) => {
    setCurrentTime(payload.currentTime);
    setBufferedPosition(payload.bufferedPosition);
  });

  useEventListener(player, "sourceLoad", (payload) => {
    setDuration(payload.duration);
    setSubtitleTracks(payload.availableSubtitleTracks);
    setSourceLoadCount((count) => count + 1);
  });

  useEventListener(player, "availableSubtitleTracksChange", (payload) => {
    setSubtitleTracks(payload.availableSubtitleTracks);
  });

  useEventListener(player, "playToEnd", () => {
    setHasEnded(true);
    setIsPlaying(false);
    onEnded?.({ context });
  });

  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state !== "active") {
        userPausedRef.current = true;
        player.pause();
        player.playbackRate = 1;
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [player]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    player,
    status,
    error,
    isPlaying,
    isBuffering: status === "loading",
    sourceLoadCount,
    hasEnded,
    currentTime,
    duration: duration || player.duration || 0,
    bufferedPosition,
    subtitleTracks,
    pause,
    play,
    togglePlay,
    seekBy,
    seekTo,
    replay,
    retry,
    setTemporaryRate,
  };
}
