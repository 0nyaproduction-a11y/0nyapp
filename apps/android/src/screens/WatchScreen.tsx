import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "../components/Screen";
import { ContentRatingSlate } from "../components/ContentRatingSlate";
import { LoadingState, RecoveryState } from "../components/ui";
import { getSeries } from "../lib/api";
import { loadWatchHistory } from "../lib/playbackHistory";
import { resolveEffectiveEpisodeClassification } from "../lib/classification";
import { useAuth } from "../lib/authContext";
import {
  getParentalScope,
  isParentalSessionUnlocked,
  loadParentalControls,
} from "../lib/parentalControls";
import type { RootStackParamList } from "../navigation/types";
import { PlayerScreen } from "../player/PlayerScreen";
import { usePlaybackSource } from "../player/usePlaybackSource";
import type { PlaybackContext } from "../player/types";
import type {
  ApiEpisode,
  ApiSeries,
  EpisodeAccess,
  WatchProgressItem,
} from "../types/api";
import type { ParentalControlState } from "../lib/parentalControls";

type Props = NativeStackScreenProps<RootStackParamList, "Watch">;

type GateBlocker = "parental" | "age";

type PlaybackTarget = {
  access: EpisodeAccess;
  episode: ApiEpisode;
  episodeAccess: Record<string, EpisodeAccess>;
  series: ApiSeries;
};

function hasInitialTarget(params: Props["route"]["params"]) {
  return Boolean(params.series && params.episode && params.access && params.episodeAccess);
}

export function WatchScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const parentalScope = useMemo(() => getParentalScope(session), [session]);

  const [targetSeries, setTargetSeries] = useState<ApiSeries | null>(route.params.series ?? null);
  const [targetEpisode, setTargetEpisode] = useState<ApiEpisode | null>(route.params.episode ?? null);
  const [targetAccess, setTargetAccess] = useState<EpisodeAccess | null>(route.params.access ?? null);
  const [targetEpisodeAccess, setTargetEpisodeAccess] = useState<Record<string, EpisodeAccess>>(
    route.params.episodeAccess ?? {},
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable" | "error">(() => {
    if (hasInitialTarget(route.params)) {
      return "ready";
    }

    if (!route.params.seriesSlug || typeof route.params.episodeNumber !== "number") {
      return "unavailable";
    }

    return "loading";
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const [acknowledgedTargetKey, setAcknowledgedTargetKey] = useState<string | null>(null);
  const [blockedTargetKey, setBlockedTargetKey] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<GateBlocker | null>(null);
  const [progressByEpisode, setProgressByEpisode] = useState<Record<number, WatchProgressItem>>({});
  const [loadedProgressToken, setLoadedProgressToken] = useState<string | null>(null);
  const [parentalControlState, setParentalControlState] = useState<ParentalControlState | null>(null);

  const currentTargetKey = targetSeries && targetEpisode ? `${targetSeries.slug}:${targetEpisode.number}` : null;
  const classification = useMemo(
    () =>
      targetSeries && targetEpisode
        ? resolveEffectiveEpisodeClassification(targetSeries, targetEpisode)
        : null,
    [targetEpisode, targetSeries],
  );
  const accessTokenReady = !accessToken || loadedProgressToken === accessToken;
  const isSlateAcknowledged = currentTargetKey ? acknowledgedTargetKey === currentTargetKey : false;
  const isBlockedTarget = currentTargetKey ? blockedTargetKey === currentTargetKey : false;
  const hasConfiguredParentalLock = parentalControlState?.hasPin ?? false;
  // A content_rating/descriptor value alone is display-only classification, not
  // proof a blocking gate is required. This mirrors the authoritative backend
  // truth in src/lib/playback.ts loadEpisodePlaybackContext(): age verification
  // always blocks, while a parental lock only blocks when one is actually
  // configured for this account/guest and not already unlocked this session.
  const requiresComplianceGate = Boolean(
    classification &&
      (classification.ageVerificationRequired ||
        (classification.parentalLockRequired &&
          hasConfiguredParentalLock &&
          !isParentalSessionUnlocked(parentalScope))),
  );
  const shouldShowSlate = Boolean(
    loadState === "ready" &&
      requiresComplianceGate &&
      !isSlateAcknowledged &&
      !isBlockedTarget,
  );

  // Watch is a dedicated video viewer surface; remove the persistent native header.
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const backToPrevious = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("MainTabs", { screen: "Home" });
  }, [navigation]);

  const activateTarget = useCallback(
    (target: PlaybackTarget) => {
      setTargetSeries(target.series);
      setTargetEpisode(target.episode);
      setTargetAccess(target.access);
      setTargetEpisodeAccess(target.episodeAccess);
      setLoadState("ready");
      setBlockedTargetKey(null);
      setBlockedReason(null);
      setProgressByEpisode({});
      setLoadedProgressToken(null);
    },
    [],
  );

  const activateTargetFromEpisode = useCallback(
    (episodeNumber: number) => {
      if (!targetSeries) {
        return;
      }

      const episode = targetSeries.episodes.find((candidate) => candidate.number === episodeNumber);
      const access = targetEpisodeAccess[String(episodeNumber)];

      if (!episode || !access) {
        return;
      }

      const nextClassification = resolveEffectiveEpisodeClassification(targetSeries, episode);
      const hasLockedPreview = !access.canWatch && episode.lockedPreviewSeconds > 0;

      if (nextClassification.contentRating) {
        activateTarget({
          access,
          episode,
          episodeAccess: targetEpisodeAccess,
          series: targetSeries,
        });
        return;
      }

      if (!access.canWatch && !hasLockedPreview) {
        navigation.replace("EpisodeAccessOptions", {
          access,
          episode,
          episodeAccess: targetEpisodeAccess,
          resumeAtSeconds: undefined,
          seriesSlug: targetSeries.slug,
          seriesTitle: targetSeries.title,
        });
        return;
      }

      activateTarget({
        access,
        episode,
        episodeAccess: targetEpisodeAccess,
        series: targetSeries,
      });
    },
    [activateTarget, navigation, targetEpisodeAccess, targetSeries],
  );

  const openEpisodeAccessOptions = useCallback(() => {
    if (!targetSeries || !targetEpisode || !targetAccess) {
      return;
    }

    navigation.replace("EpisodeAccessOptions", {
      access: targetAccess,
      episode: targetEpisode,
      episodeAccess: targetEpisodeAccess,
      resumeAtSeconds: targetEpisode.lockedPreviewSeconds > 0 ? targetEpisode.lockedPreviewSeconds : undefined,
      seriesSlug: targetSeries.slug,
      seriesTitle: targetSeries.title,
    });
  }, [navigation, targetAccess, targetEpisode, targetEpisodeAccess, targetSeries]);

  useEffect(() => {
    let isMounted = true;

    if (hasInitialTarget(route.params)) {
      return () => {
        isMounted = false;
      };
    }

    const { episodeNumber, seriesSlug } = route.params;

    if (!seriesSlug || typeof episodeNumber !== "number") {
      return () => {
        isMounted = false;
      };
    }

    void getSeries(seriesSlug, accessToken)
      .then((seriesData) => {
        if (!isMounted) {
          return;
        }

        const episode = seriesData.series.episodes.find((candidate) => candidate.number === episodeNumber);
        const access = seriesData.episodeAccess[String(episodeNumber)];

        if (!episode || !access) {
          setLoadState("unavailable");
          return;
        }

        activateTarget({
          access,
          episode,
          episodeAccess: seriesData.episodeAccess,
          series: seriesData.series,
        });
      })
      .catch(() => {
        if (isMounted) {
          setLoadState("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    accessToken,
    activateTarget,
    route.params,
    retryNonce,
  ]);

  useEffect(() => {
    if (!targetSeries || !targetEpisode) {
      return undefined;
    }

    let isMounted = true;

    void Promise.all([loadWatchHistory(session), loadParentalControls(session)])
      .then(([progress, parentalControlStatus]) => {
        if (!isMounted) {
          return;
        }

        const nextProgressByEpisode = progress.reduce<Record<number, WatchProgressItem>>(
          (progressMap, progress) => {
            if (
              progress.contentType === "series_episode" &&
              progress.seriesSlug === targetSeries.slug &&
              progress.episodeNumber !== null
            ) {
              progressMap[progress.episodeNumber] = progress;
            }

            return progressMap;
          },
          {},
        );

        setProgressByEpisode(nextProgressByEpisode);
        setParentalControlState(parentalControlStatus);
      })
      .catch(() => {
        if (isMounted) {
          setProgressByEpisode({});
          setParentalControlState(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadedProgressToken(session?.access_token ?? null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session, targetEpisode, targetSeries]);

  const context = useMemo(
    () =>
      targetSeries && targetEpisode && targetAccess
        ? buildSeriesEpisodeContext(
            targetSeries.slug,
            targetSeries.title,
            targetEpisode,
            targetAccess,
            targetSeries.episodes,
            targetEpisodeAccess,
            !targetAccess.canWatch && targetEpisode.lockedPreviewSeconds > 0,
            targetSeries.episodeCount,
          )
        : null,
    [targetAccess, targetEpisode, targetEpisodeAccess, targetSeries],
  );
  const shouldUsePreview = Boolean(
    targetSeries &&
      targetEpisode &&
      targetAccess &&
      !targetAccess.canWatch &&
      targetEpisode.lockedPreviewSeconds > 0,
  );
  const playback = usePlaybackSource(context, session, {
    playbackMode: shouldUsePreview ? "preview" : "full",
  });

  useEffect(() => {
    if (!targetSeries || !targetEpisode || !targetAccess || !playback.status) {
      return;
    }

    if (playback.status === "parental_required" && hasConfiguredParentalLock) {
      navigation.replace("ParentalControls", {
        mode: "unlock",
        target: {
          params: {
            access: targetAccess,
            episode: targetEpisode,
            episodeAccess: targetEpisodeAccess,
            resumeAtSeconds: route.params.resumeAtSeconds,
            series: targetSeries,
          },
          screen: "Watch",
        },
      });
      return;
    }

    if (playback.status === "access_required") {
      openEpisodeAccessOptions();
    }
  }, [
    openEpisodeAccessOptions,
    hasConfiguredParentalLock,
    navigation,
    playback.status,
    route.params.resumeAtSeconds,
    targetAccess,
    targetEpisode,
    targetEpisodeAccess,
    targetSeries,
  ]);

  useEffect(() => {
    if (
      loadState !== "ready" ||
      !targetSeries ||
      !targetEpisode ||
      !targetAccess ||
      requiresComplianceGate ||
      targetAccess.canWatch ||
      shouldUsePreview
    ) {
      return;
    }

    openEpisodeAccessOptions();
  }, [
    requiresComplianceGate,
    loadState,
    openEpisodeAccessOptions,
    shouldUsePreview,
    targetAccess,
    targetEpisode,
    targetSeries,
  ]);

  const handleSlateContinue = useCallback(() => {
    if (!targetSeries || !targetEpisode || !targetAccess || !classification || !currentTargetKey) {
      return;
    }

    if (classification.ageVerificationRequired) {
      setBlockedTargetKey(currentTargetKey);
      setBlockedReason("age");
      return;
    }

    if (classification.parentalLockRequired && hasConfiguredParentalLock) {
      if (!isParentalSessionUnlocked(parentalScope)) {
        const unlockTargetScreen =
          targetAccess.canWatch || shouldUsePreview ? "Watch" : "EpisodeAccessOptions";
        navigation.navigate("ParentalControls", {
          mode: "unlock",
          target:
            unlockTargetScreen === "Watch"
              ? {
                  params: {
                    access: targetAccess,
                    episode: targetEpisode,
                    episodeAccess: targetEpisodeAccess,
                    resumeAtSeconds: route.params.resumeAtSeconds,
                    series: targetSeries,
                  },
                  screen: "Watch",
                }
              : {
                  params: {
                    access: targetAccess,
                    episode: targetEpisode,
                    episodeAccess: targetEpisodeAccess,
                    resumeAtSeconds:
                      targetEpisode.lockedPreviewSeconds > 0 ? targetEpisode.lockedPreviewSeconds : undefined,
                    seriesSlug: targetSeries.slug,
                    seriesTitle: targetSeries.title,
                  },
                  screen: "EpisodeAccessOptions",
                },
        });
        return;
      }

      setAcknowledgedTargetKey(currentTargetKey);
      setBlockedTargetKey(null);
      setBlockedReason(null);

      if (!targetAccess.canWatch && !shouldUsePreview) {
        openEpisodeAccessOptions();
      }
      return;
    }

    if (!targetAccess.canWatch && !shouldUsePreview) {
      openEpisodeAccessOptions();
      return;
    }

    setAcknowledgedTargetKey(currentTargetKey);
    setBlockedTargetKey(null);
    setBlockedReason(null);
  }, [
    classification,
    currentTargetKey,
    hasConfiguredParentalLock,
    navigation,
    targetAccess,
    targetEpisode,
    targetEpisodeAccess,
    targetSeries,
    parentalScope,
    route.params.resumeAtSeconds,
    shouldUsePreview,
    openEpisodeAccessOptions,
  ]);

  if (loadState === "error") {
    return (
      <Screen>
        <RecoveryState
          body="Please try again."
          onPrimaryAction={() => {
            setLoadState("loading");
            setRetryNonce((value) => value + 1);
          }}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      </Screen>
    );
  }

  if (loadState === "unavailable") {
    return (
      <Screen>
        <RecoveryState
          body="This link is unavailable right now."
          onPrimaryAction={backToPrevious}
          primaryActionLabel="Back"
          title="Unavailable"
        />
      </Screen>
    );
  }

  if (isBlockedTarget && blockedReason) {
    return (
      <Screen>
        <RecoveryState
          body={
            blockedReason === "age"
              ? "Age verification is required before viewing this title."
              : "Parental lock is required before viewing this title."
          }
          onPrimaryAction={backToPrevious}
          primaryActionLabel="Back"
          title={blockedReason === "age" ? "Age verification required" : "Parental lock required"}
        />
      </Screen>
    );
  }

  if (shouldShowSlate && classification?.contentRating) {
    return (
      <Screen>
        <ContentRatingSlate
          contentDescriptors={classification.contentDescriptors}
          contentRating={classification.contentRating}
          onBack={backToPrevious}
          onContinue={handleSlateContinue}
        />
      </Screen>
    );
  }

  if (loadState === "loading" || !context) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (playback.status === "loading") {
    return <PlaybackTransitionScreen />;
  }

  if (playback.status === "parental_required" || playback.status === "access_required") {
    return <PlaybackTransitionScreen />;
  }

  if (playback.status === "age_verification_required") {
    return (
      <Screen>
        <RecoveryState
          body="Age verification is not available yet, so this title stays blocked."
          onPrimaryAction={backToPrevious}
          primaryActionLabel="Back"
          title="Age verification unavailable"
        />
      </Screen>
    );
  }

  if (playback.status === "preview_not_ready" || playback.status === "preview_unavailable") {
    const hasUnlockMethod =
      Boolean(targetEpisode?.coinUnlockEnabled && targetEpisode.coinPrice > 0) ||
      Boolean(targetEpisode?.rewardedUnlockEnabled) ||
      Boolean(targetEpisode?.plusAccess);

    return (
      <Screen>
        <RecoveryState
          body={
            hasUnlockMethod
              ? "Preview is not ready right now, but unlock options are still available."
              : "Preview is not ready right now."
          }
          onPrimaryAction={() => {
            if (hasUnlockMethod) {
              openEpisodeAccessOptions();
              return;
            }

            backToPrevious();
          }}
          primaryActionLabel={hasUnlockMethod ? "See Options" : "Back"}
          title="Preview unavailable"
        />
      </Screen>
    );
  }

  if (playback.status === "media_not_ready" || playback.status === "playback_unavailable") {
    return (
      <Screen>
        <RecoveryState
          body="This episode is not ready to play right now."
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
          body="This link is unavailable right now."
          onPrimaryAction={backToPrevious}
          primaryActionLabel="Back"
          title="Unavailable"
        />
      </Screen>
    );
  }

  if (!playback.source) {
    return <PlaybackTransitionScreen />;
  }

  return (
    <PlayerScreen
      key={playback.source.playbackUri}
      initialSeekSeconds={route.params.resumeAtSeconds ?? null}
      context={context}
      episodeAccess={targetEpisodeAccess}
      episodes={targetSeries!.episodes}
      isProgressResolved={accessTokenReady}
      onSeeOptions={openEpisodeAccessOptions}
      onAdvanceToNext={(nextEpisode) => {
        activateTargetFromEpisode(nextEpisode.episodeNumber);
      }}
      onSelectEpisode={(episodeNumber) => {
        activateTargetFromEpisode(episodeNumber);
      }}
      playbackMode={playback.playbackMode}
      previewSeconds={playback.previewSeconds}
      savedProgress={targetEpisode ? progressByEpisode[targetEpisode.number] : undefined}
      session={session}
      source={playback.source}
    />
  );
}

function buildSeriesEpisodeContext(
  seriesSlug: string,
  seriesTitle: string,
  episode: ApiEpisode,
  access: EpisodeAccess,
  episodes: ApiEpisode[],
  episodeAccess: Record<string, EpisodeAccess>,
  allowLockedPreview: boolean,
  seriesEpisodeCount: number,
): PlaybackContext | null {
  if (!access.canWatch && !allowLockedPreview) {
    return null;
  }

  // Story continuity is strictly sequential: this only ever looks for
  // "current number + 1" and never searches ahead for the next *published*
  // episode, so a later published episode is never silently skipped.
  const nextEpisode = episodes.find((candidate) => candidate.number === episode.number + 1);
  const nextAccess = nextEpisode ? episodeAccess[String(nextEpisode.number)] : undefined;
  // `episodes` only ever contains published rows (see src/lib/catalog.ts), so
  // a missing next-number episode is ambiguous: it could be the genuine
  // series finale, or the next episode could simply be unreleased/draft.
  // `episodeCount` is the series' total planned episode count and is the
  // only signal available to tell those two cases apart without inventing
  // new backend data.
  const hasUnreleasedNextEpisode = !nextEpisode && episode.number < seriesEpisodeCount;

  return {
    type: "SERIES_EPISODE",
    seriesSlug,
    seriesTitle,
    episodeNumber: episode.number,
    episodeTitle: episode.title,
    accessKind: access.kind,
    accessLabel: access.label,
    nextEpisode: nextEpisode
      ? {
          episodeNumber: nextEpisode.number,
          episodeTitle: nextEpisode.title,
          accessKind: nextAccess?.kind ?? "locked",
          accessLabel: nextAccess?.label ?? "Locked",
        }
      : undefined,
    hasLockedNextEpisode: Boolean(nextEpisode && (!nextAccess || !nextAccess.canWatch || nextAccess.kind === "locked")),
    hasUnreleasedNextEpisode,
  };
}

// Full-bleed matte-black transition surface for episode-to-episode source
// swaps (V04 seamless Auto-Next, manual episode selection, retries). Replaces
// the padded/ScrollView <Screen><LoadingState /></Screen> treatment for these
// specific transient states so no layout gap exposes anything behind it, and
// only reveals the existing spinner once loading genuinely exceeds a normal
// source-switch delay (no spinner flash for fast swaps).
const PLAYBACK_TRANSITION_SPINNER_DELAY_MS = 220;

function PlaybackTransitionScreen() {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => setShowSpinner(true), PLAYBACK_TRANSITION_SPINNER_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return <View style={styles.transitionScreen}>{showSpinner ? <LoadingState /> : null}</View>;
}

const styles = StyleSheet.create({
  transitionScreen: {
    alignItems: "center",
    backgroundColor: "#050505",
    flex: 1,
    justifyContent: "center",
  },
});
