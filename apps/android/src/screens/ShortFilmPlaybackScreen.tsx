import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Screen } from "../components/Screen";
import { LoadingState, RecoveryState } from "../components/ui";
import { getShortFilm, isShortFilmPublished } from "../lib/api";
import { loadWatchHistory } from "../lib/playbackHistory";
import {
  getParentalScope,
  isParentalSessionUnlocked,
  loadParentalControls,
} from "../lib/parentalControls";
import { useAuth } from "../lib/authContext";
import { PlayerScreen } from "../player/PlayerScreen";
import { getResumePositionSeconds } from "../player/resumePosition";
import { usePlaybackSource } from "../player/usePlaybackSource";
import type { PlaybackContext } from "../player/types";
import type { RootStackParamList } from "../navigation/types";
import type { ApiShortFilm, ShortFilmResponse, WatchProgressItem } from "../types/api";
import type { ParentalControlState } from "../lib/parentalControls";

type Props = NativeStackScreenProps<RootStackParamList, "ShortFilmPlayback">;

export function ShortFilmPlaybackScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const normalizedSlug = typeof route.params.slug === "string" ? route.params.slug.trim() : "";
  const hasValidSlug = normalizedSlug.length > 0;
  const shouldStartFromBeginning = route.params.startFromBeginning === true;
  const parentalScope = useMemo(() => getParentalScope(session), [session]);
  const isSessionUnlocked = isParentalSessionUnlocked(parentalScope);
  const [shortFilm, setShortFilm] = useState<ApiShortFilm | null>(null);
  const [chai, setChai] = useState<ShortFilmResponse["chai"] | null>(null);
  const [savedProgress, setSavedProgress] = useState<WatchProgressItem | undefined>();
  const [parentalControlState, setParentalControlState] = useState<ParentalControlState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const didOpenEndScreenRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (
      !shortFilm ||
      !shortFilm.parentalLockRequired ||
      !parentalControlState?.hasPin ||
      isSessionUnlocked
    ) {
      return;
    }

    navigation.replace("ParentalControls", {
      mode: "unlock",
      target: {
        screen: "ShortFilmPlayback",
        params: {
          resumeAtSeconds: route.params.resumeAtSeconds,
          slug: shortFilm.slug,
          startFromBeginning: shouldStartFromBeginning,
        },
      },
    });
  }, [isSessionUnlocked, navigation, parentalControlState?.hasPin, route.params.resumeAtSeconds, shortFilm, shouldStartFromBeginning]);

  useEffect(() => {
    didOpenEndScreenRef.current = false;
  }, [route.params.slug]);

  const loadShortFilm = useCallback(async () => {
    if (!hasValidSlug) {
      throw new Error("Invalid short film slug.");
    }

    return getShortFilm(normalizedSlug, accessToken);
  }, [accessToken, hasValidSlug, normalizedSlug]);

  useEffect(() => {
    if (!hasValidSlug) {
      setError("This short film link is unavailable.");
      setShortFilm(null);
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lifecycle boundary.
    setIsLoading(true);
    setSavedProgress(undefined);

    void Promise.all([loadShortFilm(), loadWatchHistory(session), loadParentalControls(session)])
      .then(([data, history, parentalControlStatus]) => {
        if (!isMounted) {
          return;
        }

        setShortFilm({
          ...data.shortFilm,
        });
        setChai(data.chai);
        setSavedProgress(
          history.find(
            (entry) =>
              entry.contentType === "short_film" && entry.shortFilmSlug === data.shortFilm.slug,
          ),
        );
        setParentalControlState(parentalControlStatus);
        setError(null);
      })
      .catch(() => {
        if (isMounted) {
          setError("We couldn't load this right now.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hasValidSlug, loadShortFilm, session]);

  const context = useMemo<PlaybackContext | null>(
    () =>
      shortFilm
        ? {
            filmSlug: shortFilm.slug,
            title: shortFilm.title,
            type: "SHORT_FILM",
          }
        : null,
    [shortFilm],
  );
  const playback = usePlaybackSource(context, session);
  const normalEntryInitialSeekSeconds = useMemo(() => {
    const routeResumeAtSeconds = route.params.resumeAtSeconds;
    const preferredProgress =
      typeof routeResumeAtSeconds === "number"
        ? {
            completed: savedProgress?.completed ?? false,
            durationSeconds: savedProgress?.durationSeconds ?? 0,
            positionSeconds: routeResumeAtSeconds,
          }
        : savedProgress;

    return getResumePositionSeconds(preferredProgress);
  }, [route.params.resumeAtSeconds, savedProgress]);

  useEffect(() => {
    if (playback.status !== "parental_required" || !shortFilm || !parentalControlState?.hasPin) {
      return;
    }

    navigation.replace("ParentalControls", {
      mode: "unlock",
      target: {
        screen: "ShortFilmPlayback",
        params: {
          resumeAtSeconds: route.params.resumeAtSeconds,
          slug: shortFilm.slug,
          startFromBeginning: shouldStartFromBeginning,
        },
      },
    });
  }, [navigation, parentalControlState?.hasPin, playback.status, route.params.resumeAtSeconds, shortFilm, shouldStartFromBeginning]);

  const handleEnded = useCallback(() => {
    if (!shortFilm || didOpenEndScreenRef.current) {
      return;
    }

    didOpenEndScreenRef.current = true;
    navigation.replace("ShortFilmEnd", {
      chai: chai ?? {
        allowedCoinAmounts: [],
        available: false,
      },
      shortFilm,
    });
  }, [chai, navigation, shortFilm]);

  if (!hasValidSlug) {
    return (
      <Screen>
        <RecoveryState
          body="This short film link is unavailable."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Unavailable"
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!shortFilm) {
    return (
      <Screen>
        <RecoveryState
          body={error ?? "Please try again."}
          onPrimaryAction={() => {
            setIsLoading(true);
            setShortFilm(null);
            setChai(null);
            setError(null);
            setSavedProgress(undefined);
            void loadShortFilm()
              .then((data) => {
                setShortFilm(data.shortFilm);
                setChai(data.chai);
              })
              .catch(() => {
                setError("We couldn't load this right now.");
              })
              .finally(() => {
                setIsLoading(false);
              });
          }}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      </Screen>
    );
  }

  if (!isShortFilmPublished(shortFilm)) {
    return (
      <Screen>
        <RecoveryState
          body="This short film is unavailable right now."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Unavailable"
        />
      </Screen>
    );
  }

  if (shortFilm.ageVerificationRequired) {
    return (
      <Screen>
        <RecoveryState
          body="Age verification is not available yet, so this film stays blocked."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Age verification unavailable"
        />
      </Screen>
    );
  }

  if (shortFilm.parentalLockRequired && parentalControlState?.hasPin && !isSessionUnlocked) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!shortFilm.playbackReady && !__DEV__) {
    return (
      <Screen>
        <RecoveryState
          body="This short film is not ready to play yet."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Playback not ready"
        />
      </Screen>
    );
  }

  if (playback.status === "loading") {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (playback.status === "parental_required" || playback.status === "access_required") {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (playback.status === "age_verification_required") {
    return (
      <Screen>
        <RecoveryState
          body="Age verification is not available yet, so this film stays blocked."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Age verification unavailable"
        />
      </Screen>
    );
  }

  if (playback.status === "media_not_ready" || playback.status === "playback_unavailable") {
    return (
      <Screen>
        <RecoveryState
          body="This short film is not ready to play yet."
          onPrimaryAction={() => playback.refresh()}
          primaryActionLabel="Retry"
          title="Playback unavailable"
        />
      </Screen>
    );
  }

  if (playback.status === "not_found") {
    return (
      <Screen>
        <RecoveryState
          body="This short film is unavailable right now."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Unavailable"
        />
      </Screen>
    );
  }

  if (!playback.source) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <PlayerScreen
      key={playback.source.playbackUri}
      context={context!}
      onEnded={handleEnded}
      savedProgress={savedProgress}
      session={session}
      shortFilm={shortFilm}
      shortFilmChai={chai}
      initialSeekSeconds={
        shouldStartFromBeginning
          ? 0
          : normalEntryInitialSeekSeconds
      }
      source={playback.source}
    />
  );
}
