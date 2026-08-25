import { useEventListener } from "expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  useVideoPlayer,
  type PlayerError,
  type SubtitleTrack,
  type VideoTrack,
  type VideoPlayerStatus,
  type VideoSource,
} from "expo-video";
import type { PlaybackContext, PlaybackEndedPayload } from "./types";

type UsePlaybackControllerOptions = {
  context: PlaybackContext;
  playbackLimitSeconds?: number | null;
  source: VideoSource;
  onEnded?: (payload: PlaybackEndedPayload) => void;
};

const INITIAL_STATUS: VideoPlayerStatus = "idle";

function normalizeRetrySeekSeconds(position: number | null | undefined, duration?: number | null) {
  if (position === null || position === undefined || !Number.isFinite(position) || position < 0) {
    return null;
  }

  const flooredPosition = Math.floor(position);

  if (duration === null || duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    return flooredPosition;
  }

  const flooredDuration = Math.floor(duration);
  const clampedPosition = Math.min(flooredPosition, Math.max(0, flooredDuration - 1));

  if (flooredDuration - clampedPosition <= 5) {
    return Math.max(0, flooredDuration - 5);
  }

  return clampedPosition;
}

export function usePlaybackController({
  context,
  playbackLimitSeconds,
  onEnded,
  source,
}: UsePlaybackControllerOptions) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPosition, setBufferedPosition] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [subtitleTrack, setSubtitleTrack] = useState<SubtitleTrack | null>(null);
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [videoTrack, setVideoTrack] = useState<VideoTrack | null>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [status, setStatus] = useState<VideoPlayerStatus>(INITIAL_STATUS);
  const [error, setError] = useState<PlayerError | undefined>();
  const [sourceLoadCount, setSourceLoadCount] = useState(0);
  const isMountedRef = useRef(true);
  const userPausedRef = useRef(false);
  const endedRef = useRef(false);
  const pendingRetrySeekRef = useRef<number | null>(null);
  const playbackLimit =
    typeof playbackLimitSeconds === "number" && Number.isFinite(playbackLimitSeconds) && playbackLimitSeconds > 0
      ? playbackLimitSeconds
      : null;

  const player = useVideoPlayer(source, (createdPlayer) => {
    createdPlayer.loop = false;
    createdPlayer.muted = false;
    createdPlayer.volume = 1;
    createdPlayer.preservesPitch = true;
    createdPlayer.playbackRate = 1;
    createdPlayer.timeUpdateEventInterval = 0.5;
    createdPlayer.keepScreenOnWhilePlaying = true;
    createdPlayer.showNowPlayingNotification = false;
    createdPlayer.staysActiveInBackground = false;
  });
  const effectiveDuration =
    playbackLimit !== null
      ? Math.min(duration || player.duration || 0, playbackLimit)
      : duration || player.duration || 0;
  const effectiveCurrentTime = playbackLimit !== null ? Math.min(currentTime, playbackLimit) : currentTime;

  const signalEnded = useCallback(() => {
    if (endedRef.current) {
      return;
    }

    endedRef.current = true;
    setHasEnded(true);
    setIsPlaying(false);
    player.pause();
    onEnded?.({ context });
  }, [context, onEnded, player]);

  useEffect(() => {
    // expo-video exposes playbackRate as a mutable player property.
    if (player.playbackRate !== playbackRate) {
      player.playbackRate = playbackRate;
    }
  }, [playbackRate, player]);

  const pause = useCallback(() => {
    userPausedRef.current = true;
    player.pause();
  }, [player]);

  const play = useCallback(() => {
    userPausedRef.current = false;
    endedRef.current = false;
    setHasEnded(false);
    player.play();
  }, [player]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      userPausedRef.current = true;
      player.pause();
    } else if (hasEnded) {
      userPausedRef.current = false;
      endedRef.current = false;
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
      const safeDuration = duration > 0 ? duration : player.duration;
      const current = currentTime;
      const proposedTime = current + seconds;
      const maxAllowed = playbackLimit ?? (safeDuration || proposedTime);
      const nextTime = Math.max(0, Math.min(proposedTime, maxAllowed));

      endedRef.current = false;
      setHasEnded(false);
      // eslint-disable-next-line react-hooks/immutability -- expo-video exposes exact seeking through this mutable player property.
      player.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [currentTime, duration, playbackLimit, player],
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const safeDuration = duration > 0 ? duration : player.duration;
      const maxAllowed = playbackLimit ?? (safeDuration || seconds);
      const nextTime = Math.max(0, Math.min(seconds, maxAllowed));
      endedRef.current = false;
      setHasEnded(false);
      // eslint-disable-next-line react-hooks/immutability -- expo-video exposes exact seeking through this mutable player property.
      player.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration, playbackLimit, player],
  );

  const replay = useCallback(() => {
    userPausedRef.current = false;
    endedRef.current = false;
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

  const setPlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackRateState(rate);
      player.preservesPitch = true;
      player.playbackRate = rate;
    },
    [player],
  );

  const retry = useCallback(async (seekSeconds?: number | null) => {
    userPausedRef.current = false;
    endedRef.current = false;
    setHasEnded(false);
    pendingRetrySeekRef.current = normalizeRetrySeekSeconds(seekSeconds);
    setCurrentTime(pendingRetrySeekRef.current ?? 0);
    setDuration(0);
    try {
      await player.replaceAsync(source);
    } catch (error) {
      pendingRetrySeekRef.current = null;
      throw error;
    }
    if (pendingRetrySeekRef.current !== null) {
      const retryPosition = pendingRetrySeekRef.current;
      pendingRetrySeekRef.current = null;
      // eslint-disable-next-line react-hooks/immutability -- expo-video exposes exact seeking through this mutable player property.
      player.currentTime = retryPosition;
      setCurrentTime(retryPosition);
    }
    if (isMountedRef.current && !userPausedRef.current) {
      player.play();
    }
  }, [player, source]);

  useEffect(() => {
    userPausedRef.current = false;
    endedRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- player changes are source lifecycle boundaries; reset stale source state before autoplay.
    setHasEnded(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPosition(0);
    setError(undefined);
    setSourceLoadCount(0);
    setStatus(INITIAL_STATUS);
    // A new player instance always constructs with subtitleTrack: null (expo-video default).
    setSubtitleTrack(null);
    pendingRetrySeekRef.current = null;
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

    if (playbackLimit !== null && !endedRef.current && payload.currentTime >= playbackLimit) {
      signalEnded();
    }
  });

  useEventListener(player, "sourceLoad", (payload) => {
    setDuration(payload.duration);
    setSubtitleTracks(payload.availableSubtitleTracks);
    setSourceLoadCount((count) => count + 1);
    if (pendingRetrySeekRef.current !== null) {
      const retryPosition = normalizeRetrySeekSeconds(pendingRetrySeekRef.current, payload.duration);

      pendingRetrySeekRef.current = null;

      if (retryPosition !== null) {
        // eslint-disable-next-line react-hooks/immutability -- expo-video exposes exact seeking through this mutable player property.
        player.currentTime = retryPosition;
        setCurrentTime(retryPosition);
      }
    }
  });

  useEventListener(player, "availableSubtitleTracksChange", (payload) => {
    setSubtitleTracks(payload.availableSubtitleTracks);
  });

  useEventListener(player, "videoTrackChange", (payload) => {
    setVideoTrack(payload.videoTrack);
  });

  useEventListener(player, "playbackRateChange", (payload) => {
    setPlaybackRateState(payload.playbackRate);
  });

  useEventListener(player, "subtitleTrackChange", (payload) => {
    setSubtitleTrack(payload.subtitleTrack);
  });

  useEventListener(player, "playToEnd", () => {
    signalEnded();
  });

  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state !== "active") {
        userPausedRef.current = true;
        player.pause();
        player.playbackRate = playbackRate;
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [player, playbackRate]);

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
    currentTime: effectiveCurrentTime,
    duration: effectiveDuration,
    bufferedPosition: playbackLimit !== null ? Math.min(bufferedPosition, playbackLimit) : bufferedPosition,
    videoTracks,
    videoTrack,
    playbackRate,
    subtitleTracks,
    subtitleTrack,
    pause,
    play,
    togglePlay,
    seekBy,
    seekTo,
    replay,
    retry,
    setPlaybackRate,
    setTemporaryRate,
  };
}
