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
import { perfConsumeAutoNextPlaybackPending, perfMark } from "../lib/perf";
import { getMobileEnv } from "../config/env";
import type { PlaybackContext, PlaybackEndedPayload } from "./types";
import { useWebHlsPlayback } from "./useWebHlsPlayback";

/* eslint-disable react-hooks/immutability -- expo-video exposes its player as an imperative mutable object. */

type UsePlaybackControllerOptions = {
  context: PlaybackContext;
  playbackLimitSeconds?: number | null;
  source: VideoSource;
  onEnded?: (payload: PlaybackEndedPayload) => void;
};

const INITIAL_STATUS: VideoPlayerStatus = "idle";
const END_FRAME_HOLD_OFFSET_SECONDS = 0.05;

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

function getVideoSourceUri(source: VideoSource) {
  if (typeof source === "string") {
    return source;
  }

  if (source && typeof source === "object" && "uri" in source && typeof source.uri === "string") {
    return source.uri;
  }

  return null;
}

function getPerfContextFields(context: PlaybackContext) {  return context.type === "SERIES_EPISODE"
    ? {
        content_type: "series_episode",
        episode_number: context.episodeNumber,
        series_slug: context.seriesSlug,
      }
    : {
        content_type: "short_film",
        short_film_slug: context.filmSlug,
      };
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
  const [videoTracks] = useState<VideoTrack[]>([]);
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
  const hasMarkedPlaybackStartedRef = useRef(false);
  const previousStatusRef = useRef<VideoPlayerStatus>(INITIAL_STATUS);
  // Guards the autoplay effect against a replaceAsync that is still resolving.
  // A new source load interrupts any in-flight play() request, which is the
  // expected expo-video "play() interrupted by a new load" race; the autoplay
  // effect is skipped while a retry is in flight and retry() resumes play()
  // itself once the new source is attached.
  const replaceInFlightRef = useRef(false);
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
    perfMark("PLAYBACK_ENDED", getPerfContextFields(context));
    setHasEnded(true);
    setIsPlaying(false);
    player.pause();
    const endBoundary = (playbackLimit ?? duration) || player.duration;
    const finalFramePosition =
      Number.isFinite(endBoundary) && endBoundary > END_FRAME_HOLD_OFFSET_SECONDS
        ? endBoundary - END_FRAME_HOLD_OFFSET_SECONDS
        : null;
    if (finalFramePosition !== null) {
      // Android's native video surface can clear at exact EOS; hold the last
      // decodable boundary frame while the existing completed overlay is shown.
      player.currentTime = finalFramePosition;
      setCurrentTime(finalFramePosition);
    }
    onEnded?.({ context });
  }, [context, duration, onEnded, playbackLimit, player]);

  const handleWebSourceReady = useCallback(
    (durationSeconds: number) => {
      perfMark("PLAYER_LOADED", {
        ...getPerfContextFields(context),
        duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds.toFixed(1) : null,
        subtitle_track_count: 0,
      });
      setDuration(durationSeconds);
      setError(undefined);
      setStatus("readyToPlay");
      setSourceLoadCount((count) => count + 1);
    },
    [context],
  );

  const handleWebSourceError = useCallback((message: string) => {
    setError({ message });
    setStatus("error");
  }, []);

  useWebHlsPlayback({
    onError: handleWebSourceError,
    onReady: handleWebSourceReady,
    uri: getVideoSourceUri(source),
  });

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
    perfMark("PLAY_REQUESTED", {
      ...getPerfContextFields(context),
      action: "play",
    });
    userPausedRef.current = false;
    endedRef.current = false;
    setHasEnded(false);
    player.play();
  }, [context, player]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      userPausedRef.current = true;
      player.pause();
    } else if (hasEnded) {
      perfMark("PLAY_REQUESTED", {
        ...getPerfContextFields(context),
        action: "replay",
      });
      userPausedRef.current = false;
      endedRef.current = false;
      player.replay();
      setHasEnded(false);
      player.play();
    } else {
      perfMark("PLAY_REQUESTED", {
        ...getPerfContextFields(context),
        action: "toggle_play",
      });
      userPausedRef.current = false;
      player.play();
    }
  }, [context, hasEnded, isPlaying, player]);

  const seekBy = useCallback(
    (seconds: number) => {
      const safeDuration = duration > 0 ? duration : player.duration;
      const current = currentTime;
      const proposedTime = current + seconds;
      const maxAllowed = playbackLimit ?? (safeDuration || proposedTime);
      const nextTime = Math.max(0, Math.min(proposedTime, maxAllowed));

      endedRef.current = false;
      setHasEnded(false);
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
      player.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration, playbackLimit, player],
  );

  const replay = useCallback(() => {
    perfMark("PLAY_REQUESTED", {
      ...getPerfContextFields(context),
      action: "replay",
    });
    userPausedRef.current = false;
    endedRef.current = false;
    player.replay();
    setHasEnded(false);
    player.play();
  }, [context, player]);

  const setTemporaryRate = useCallback(
    (rate: number) => {
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
    perfMark("PLAY_REQUESTED", {
      ...getPerfContextFields(context),
      action: "retry",
    });
    userPausedRef.current = false;
    endedRef.current = false;
    setHasEnded(false);
    pendingRetrySeekRef.current = normalizeRetrySeekSeconds(seekSeconds);
    setCurrentTime(pendingRetrySeekRef.current ?? 0);
    setDuration(0);

    // A new source load interrupts any in-flight play() request, which is the
    // expected expo-video "play() interrupted by a new load" race. Gate the
    // autoplay effect on this flag so it never fires against a replaceAsync
    // that is still resolving; the retry() call resumes play() itself once
    // the new source is actually attached.
    replaceInFlightRef.current = true;

    try {
      await player.replaceAsync(source);
    } catch (replaceError) {
      pendingRetrySeekRef.current = null;
      replaceInFlightRef.current = false;

      if (isMountedRef.current) {
        const normalizedMessage =
          replaceError instanceof Error
            ? replaceError.message
            : "Playback retry failed. Please try again.";

        setError({ message: normalizedMessage });
        setStatus("error");
      }

      return;
    }
    if (pendingRetrySeekRef.current !== null) {
      const retryPosition = pendingRetrySeekRef.current;
      pendingRetrySeekRef.current = null;
      player.currentTime = retryPosition;
      setCurrentTime(retryPosition);
    }
    replaceInFlightRef.current = false;
    if (isMountedRef.current && !userPausedRef.current) {
      player.play();
    }
  }, [context, player, source]);

  useEffect(() => {
    // Source swaps are lifecycle boundaries; clear the old URL before resolving a fresh one.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- player changes are source lifecycle boundaries; reset stale source state before autoplay.
    setHasEnded(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPosition(0);
    setError(undefined);
    setSourceLoadCount(0);
    setStatus(INITIAL_STATUS);
    hasMarkedPlaybackStartedRef.current = false;
    previousStatusRef.current = INITIAL_STATUS;
    perfMark("PLAYER_LOAD_START", getPerfContextFields(context));
    // A new player instance always constructs with subtitleTrack: null (expo-video default).
    setSubtitleTrack(null);
    pendingRetrySeekRef.current = null;

    // Never start a play() against a source that is already being replaced by
    // retry(). The interrupt warning is expected in that case and would mask a
    // genuine playback failure.
    if (replaceInFlightRef.current) {
      return;
    }

    perfMark("PLAY_REQUESTED", {
      ...getPerfContextFields(context),
      action: "autoplay",
    });
    player.play();
  }, [context, player]);

useEventListener(player, "statusChange", (payload) => {
    const previousStatus = previousStatusRef.current;
    if (payload.status === "loading" && previousStatus !== "loading") {
      perfMark("BUFFER_START", getPerfContextFields(context));
    } else if (previousStatus === "loading" && payload.status !== "loading") {
      perfMark("BUFFER_END", {
        ...getPerfContextFields(context),
        status: payload.status,
      });
    }
    if (payload.status === "error") {
      perfMark("PLAYBACK_ERROR", {
        ...getPerfContextFields(context),
        message: payload.error?.message,
      });
    }
    previousStatusRef.current = payload.status;
    setStatus(payload.status);
    setError(payload.error);
  });

  useEffect(() => {
    // expo-video's web backend emits a benign "play() request was interrupted by
    // a new load request" page error whenever a source swap lands while a
    // previous play() is still resolving. It is not a playback failure, so it
    // is filtered out of the runtime error surface in dev builds only. Real
    // playback errors still surface through statusChange/error and the
    // PLAYBACK_ERROR perf mark.
    if (!__DEV__ || !getMobileEnv().suppressPlayInterruptionPageError) {
      return undefined;
    }

    const isBenignPlayInterruption = (message: string) =>
      /play\(\) request was interrupted by a new load request/i.test(message);

    const originalOnError = window.onerror;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    window.onerror = (message, source, lineno, colno, error) => {
      if (isBenignPlayInterruption(typeof message === "string" ? message : String(message))) {
        return true;
      }

      return typeof originalOnError === "function"
        ? originalOnError.call(window, message, source, lineno, colno, error)
        : false;
    };

    console.warn = (...args: unknown[]) => {
      if (isBenignPlayInterruption(typeof args[0] === "string" ? args[0] : String(args[0]))) {
        return;
      }

      originalConsoleWarn(...args);
    };

    console.error = (...args: unknown[]) => {
      if (isBenignPlayInterruption(typeof args[0] === "string" ? args[0] : String(args[0]))) {
        return;
      }

      originalConsoleError(...args);
    };

    return () => {
      window.onerror = originalOnError;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);

  useEventListener(player, "playingChange", (payload) => {
    if (payload.isPlaying && !hasMarkedPlaybackStartedRef.current) {
      hasMarkedPlaybackStartedRef.current = true;
      perfMark("PLAYBACK_STARTED", getPerfContextFields(context));
      if (perfConsumeAutoNextPlaybackPending()) {
        perfMark("NEXT_PLAYBACK_STARTED", getPerfContextFields(context));
      }
    }
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
    perfMark("PLAYER_LOADED", {
      ...getPerfContextFields(context),
      duration_seconds: Number.isFinite(payload.duration) ? payload.duration.toFixed(1) : null,
      subtitle_track_count: payload.availableSubtitleTracks.length,
    });
    setDuration(payload.duration);
    setSubtitleTracks(payload.availableSubtitleTracks);
    setSourceLoadCount((count) => count + 1);
    if (pendingRetrySeekRef.current !== null) {
      const retryPosition = normalizeRetrySeekSeconds(pendingRetrySeekRef.current, payload.duration);

      pendingRetrySeekRef.current = null;

      if (retryPosition !== null) {
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
