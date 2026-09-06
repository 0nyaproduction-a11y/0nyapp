import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "../components/Screen";
import { ContentRatingSlate } from "../components/ContentRatingSlate";
import { LoadingState, RecoveryState } from "../components/ui";
import { getSeries } from "../lib/api";
import { subscribeConfirmedSeriesAccess } from "../lib/confirmedSeriesAccess";
import { loadWatchHistory } from "../lib/playbackHistory";
import { perfEnd, perfMark, perfStart } from "../lib/perf";
import { resolveEffectiveEpisodeClassification } from "../lib/classification";
import { useAuth } from "../lib/authContext";
import {
  getParentalScope,
  isParentalSessionUnlocked,
  loadParentalControls,
  shouldRequireParentalGate,
} from "../lib/parentalControls";
import type { RootStackParamList } from "../navigation/types";
import { getWatchEpisodeTransitionParams, getWatchRouteParams } from "../navigation/routeSerialization";
import { PlayerScreen } from "../player/PlayerScreen";
import { WalletAccessPaywall } from "../components/WalletAccessPaywall";
import { getPlaybackResumeOwner, loadTargetPlaybackHistory, type TargetHistoryState } from "../player/targetResume";
import { usePlaybackSource } from "../player/usePlaybackSource";
import type { PlaybackContext } from "../player/types";
import type {
  ApiEpisode,
  ApiSeries,
  EpisodeAccess,
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

export function WatchScreen({ navigation, route }: Props) {
  const { session, isLoading } = useAuth();
  const params = getWatchRouteParams(route.params);
  const owner = params ? getPlaybackResumeOwner({ type: "SERIES_EPISODE", ...params }, session?.user.id) : "invalid";
  if (isLoading) return <PlaybackTransitionScreen />;
  // Target, identity and explicit re-entry intent own the entire playback lifetime.
  // setParams changes the durable URL while preserving the originating Back stack.
  return <WatchTargetScreen key={JSON.stringify([owner, params?.resumeAtSeconds, params?.startFromBeginning])} navigation={navigation} route={params ? { ...route, params: { ...route.params, ...params } } : route} />;
}

function WatchTargetScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const parentalScope = useMemo(() => getParentalScope(session), [session]);

  const [targetSeries, setTargetSeries] = useState<ApiSeries | null>(null);
  const [targetEpisode, setTargetEpisode] = useState<ApiEpisode | null>(null);
  const [targetAccess, setTargetAccess] = useState<EpisodeAccess | null>(null);
  const [targetEpisodeAccess, setTargetEpisodeAccess] = useState<Record<string, EpisodeAccess>>(
    {},
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable" | "error">(() => {
    if (!getWatchRouteParams(route.params)) {
      return "unavailable";
    }

    return "loading";
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const [acknowledgedTargetKey, setAcknowledgedTargetKey] = useState<string | null>(null);
  const [blockedTargetKey, setBlockedTargetKey] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<GateBlocker | null>(null);
  const resumeOwner = getPlaybackResumeOwner({ type: "SERIES_EPISODE", ...route.params }, session?.user.id);
  const [history, setHistory] = useState<TargetHistoryState>({ owner: resumeOwner, status: "loading" });
  const [historyRetryNonce, setHistoryRetryNonce] = useState(0);
  const [parentalControlState, setParentalControlState] = useState<ParentalControlState | null>(null);
  const [resumeSeconds, setResumeSeconds] = useState<number | null>(null);
  // Replaces Wallet navigation for locked episodes with no preview seconds:
  // when the episode is locked and lockedPreviewSeconds=0 we show the paywall
  // inline inside the Watch screen instead of navigating away to Wallet.
  const [showInlinePaywall, setShowInlinePaywall] = useState(false);

  useEffect(() => {
    perfMark("WATCH_MOUNT", {
      episode_number: route.params.episode?.number ?? route.params.episodeNumber,
      has_initial_target: Boolean(route.params.series && route.params.episode),
      series_slug: route.params.series?.slug ?? route.params.seriesSlug,
    });
  }, [route.params]);

  const currentTargetKey = targetSeries && targetEpisode ? `${targetSeries.slug}:${targetEpisode.number}` : null;
  // Reset inline paywall whenever the target episode changes.
  useEffect(() => {
    setShowInlinePaywall(false);
  }, [currentTargetKey]);
  const hasValidWatchRoute = getWatchRouteParams(route.params) !== null;
  const classification = useMemo(
    () =>
      targetSeries && targetEpisode
        ? resolveEffectiveEpisodeClassification(targetSeries, targetEpisode)
        : null,
    [targetEpisode, targetSeries],
  );
  const isProgressResolved = history.owner === resumeOwner && history.status === "resolved";
  const isSlateAcknowledged = currentTargetKey ? acknowledgedTargetKey === currentTargetKey : false;
  const isBlockedTarget = currentTargetKey ? blockedTargetKey === currentTargetKey : false;
  const requiresParentalGateForClassification = classification
    ? shouldRequireParentalGate(classification.contentRating, parentalControlState)
    : false;
  // A content_rating/descriptor value alone is display-only classification, not
  // proof a blocking gate is required. This mirrors the authoritative backend
  // truth in src/lib/playback.ts loadEpisodePlaybackContext(): age verification
  // always blocks, while a parental lock only blocks when one is actually
  // configured for this account/guest and not already unlocked this session.
  const requiresComplianceGate = Boolean(
    classification &&
      (classification.ageVerificationRequired ||
        (classification.parentalLockRequired &&
          requiresParentalGateForClassification &&
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
    },
    [],
  );

  const navigateToEpisode = useCallback((episodeNumber: number) => {
    navigation.setParams(getWatchEpisodeTransitionParams(route.params.seriesSlug, episodeNumber));
  }, [navigation, route.params.seriesSlug]);

  // C01 Wallet is the central Micro Drama access hub.
  // All locked Micro Drama lock events (preview end, locked selection, auto-next)
  // navigate to Wallet with the exact microDramaAccess context.
  const openEpisodeAccessOptionsFor = useCallback(
    (episode: ApiEpisode, access: EpisodeAccess, resumeAtSeconds?: number | null) => {
      if (!targetSeries) {
        return;
      }

      navigation.navigate("Wallet", {
        microDramaAccess: {
          access,
          episode,
          episodeAccess: targetEpisodeAccess,
          episodeNumber: episode.number,
          resumeAtSeconds,
          seriesSlug: targetSeries.slug,
          seriesTitle: targetSeries.title,
        },
      });
    },
    [navigation, targetEpisodeAccess, targetSeries],
  );

  const activateTargetFromEpisode = useCallback(
    (episodeNumber: number, source: "auto_next" | "manual" = "manual") => {
      if (!targetSeries) {
        return;
      }

      const episode = targetSeries.episodes.find((candidate) => candidate.number === episodeNumber);
      const access = targetEpisodeAccess[String(episodeNumber)];

      if (!episode || !access) {
        if (source === "auto_next") {
          perfMark("NEXT_ACCESS_END", {
            episode_number: episodeNumber,
            series_slug: targetSeries.slug,
            status: "unavailable",
          });
        }
        return;
      }

      if (source === "auto_next") {
        perfMark("NEXT_ACCESS_END", {
          access_kind: access.kind,
          can_watch: access.canWatch,
          episode_number: episodeNumber,
          series_slug: targetSeries.slug,
          status: "ready",
        });
      }

      const nextClassification = resolveEffectiveEpisodeClassification(targetSeries, episode);
      const hasLockedPreview = !access.canWatch && episode.lockedPreviewSeconds > 0;
      const requiresNextParentalGate = Boolean(
        shouldRequireParentalGate(nextClassification.contentRating, parentalControlState) &&
          !isParentalSessionUnlocked(parentalScope),
      );

      if (nextClassification.ageVerificationRequired) {
        navigateToEpisode(episodeNumber);
        return;
      }

      if (!access.canWatch && !hasLockedPreview) {
        if (requiresNextParentalGate) {
          navigation.navigate("ParentalControls", {
            mode: "unlock",
            target: {
              params: {
                microDramaAccess: {
                  access,
                  episode,
                  episodeAccess: targetEpisodeAccess,
                  episodeNumber: episode.number,
                  resumeAtSeconds: undefined,
                  seriesSlug: targetSeries.slug,
                  seriesTitle: targetSeries.title,
                },
              },
              screen: "Wallet",
            },
          });
          return;
        }

        // Navigate to the Watch screen for this episode and let WatchScreen
        // render the inline WalletAccessPaywall instead of going to Wallet.
        navigateToEpisode(episodeNumber);
        return;
      }

      if (nextClassification.contentRating) {
        navigateToEpisode(episodeNumber);
        return;
      }

      navigateToEpisode(episodeNumber);
    },
    [
      navigateToEpisode,
      navigation,
      openEpisodeAccessOptionsFor,
      parentalScope,
      parentalControlState,
      targetEpisodeAccess,
      targetSeries,
    ],
  );

  const openEpisodeAccessOptions = useCallback(() => {
    if (!targetSeries || !targetEpisode || !targetAccess) {
      return;
    }

    openEpisodeAccessOptionsFor(
      targetEpisode,
      targetAccess,
      targetEpisode.lockedPreviewSeconds > 0 ? targetEpisode.lockedPreviewSeconds : undefined,
    );
  }, [openEpisodeAccessOptionsFor, targetAccess, targetEpisode, targetSeries]);

  useEffect(() => {
    if (!targetSeries) {
      return undefined;
    }

    return subscribeConfirmedSeriesAccess((seriesResponse) => {
      if (!seriesResponse) {
        setTargetAccess(null);
        setTargetEpisodeAccess({});
        setLoadState("loading");
        setRetryNonce((value) => value + 1);
        return;
      }
      if (seriesResponse.series.slug !== targetSeries.slug) {
        return;
      }

      const refreshedEpisode = targetEpisode
        ? seriesResponse.series.episodes.find((candidate) => candidate.number === targetEpisode.number) ?? null
        : null;
      const refreshedAccess = refreshedEpisode
        ? seriesResponse.episodeAccess[String(refreshedEpisode.number)] ?? null
        : null;

      setTargetSeries(seriesResponse.series);
      setTargetEpisode(refreshedEpisode);
      setTargetEpisodeAccess(seriesResponse.episodeAccess);

      setTargetAccess(refreshedAccess);
      if (!refreshedEpisode || !refreshedAccess) setLoadState("unavailable");
    });
  }, [targetAccess, targetEpisode, targetSeries]);

  useEffect(() => {
    let isMounted = true;

    const episodeNumber = route.params.episodeNumber;
    const seriesSlug = route.params.seriesSlug;

    if (!hasValidWatchRoute) {
      return () => {
        isMounted = false;
      };
    }

    const accessMeasure = perfStart("ACCESS", {
      episode_number: episodeNumber,
      series_slug: seriesSlug,
      source: "WATCH_ROUTE",
    });

    void getSeries(seriesSlug, accessToken)
      .then((seriesData) => {
        if (!isMounted) {
          return;
        }

        const episode = seriesData.series.episodes.find((candidate) => candidate.number === episodeNumber);
        const access = seriesData.episodeAccess[String(episodeNumber)];

        if (!episode || !access) {
          perfEnd(accessMeasure, {
            episode_number: episodeNumber,
            series_slug: seriesSlug,
            status: "unavailable",
          });
          setLoadState("unavailable");
          return;
        }

        perfEnd(accessMeasure, {
          access_kind: access.kind,
          can_watch: access.canWatch,
          episode_number: episodeNumber,
          series_slug: seriesSlug,
          status: "ready",
        });
        activateTarget({
          access,
          episode,
          episodeAccess: seriesData.episodeAccess,
          series: seriesData.series,
        });
      })
      .catch(() => {
        perfEnd(accessMeasure, {
          episode_number: episodeNumber,
          series_slug: seriesSlug,
          status: "error",
        });
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
    hasValidWatchRoute,
    route.params.seriesSlug,
    route.params.episodeNumber,
    retryNonce,
  ]);

  useEffect(() => {
    if (!currentTargetKey) {
      return undefined;
    }

    const request = loadTargetPlaybackHistory({
      owner: resumeOwner,
      target: { type: "SERIES_EPISODE", seriesSlug: route.params.seriesSlug, episodeNumber: route.params.episodeNumber },
      load: () => loadWatchHistory(session),
      publish: setHistory,
    });
    return request.cancel;
  }, [currentTargetKey, historyRetryNonce, resumeOwner, route.params.seriesSlug, route.params.episodeNumber, session]);

  useEffect(() => {
    let active = true;
    void loadParentalControls(session).then((state) => {
      if (active) setParentalControlState(state);
    }).catch(() => {
      if (active) setParentalControlState(null);
    });
    return () => { active = false; };
  }, [session]);

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

    if (playback.status === "parental_required" && parentalControlState?.hasPin) {
      navigation.replace("ParentalControls", {
        mode: "unlock",
        target: {
          params: {
            access: targetAccess,
            episode: targetEpisode,
            episodeNumber: targetEpisode.number,
            episodeAccess: targetEpisodeAccess,
            resumeAtSeconds: route.params.resumeAtSeconds,
            seriesSlug: targetSeries.slug,
            series: targetSeries,
          },
          screen: "Watch",
        },
      });
      return;
    }

    // When shouldUsePreview is true the in-player WalletAccessPaywall owns the
    // access_required state. Navigating to Wallet here would bypass the
    // preview+paywall flow entirely. When there is no preview, show the inline paywall.
    if (playback.status === "access_required" && !shouldUsePreview) {
      setShowInlinePaywall(true);
    }
  }, [
    navigation,
    parentalControlState?.hasPin,
    playback.status,
    route.params.resumeAtSeconds,
    shouldUsePreview,
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

    // Instead of navigating to Wallet, show the paywall inline so the user
    // stays within the Watch/Player stack (PAYWALL_OVER_VIDEO=YES).
    setShowInlinePaywall(true);
  }, [
    requiresComplianceGate,
    loadState,
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

    if (
      classification.parentalLockRequired &&
      shouldRequireParentalGate(classification.contentRating, parentalControlState)
    ) {
      if (!isParentalSessionUnlocked(parentalScope)) {
        const unlockTargetScreen =
          targetAccess.canWatch || shouldUsePreview ? "Watch" : "Wallet";
        navigation.navigate("ParentalControls", {
          mode: "unlock",
          target:
            unlockTargetScreen === "Watch"
              ? {
                  params: {
                    access: targetAccess,
                    episode: targetEpisode,
                    episodeNumber: targetEpisode.number,
                    episodeAccess: targetEpisodeAccess,
                    resumeAtSeconds: route.params.resumeAtSeconds,
                    seriesSlug: targetSeries.slug,
                    series: targetSeries,
                  },
                  screen: "Watch",
                }
              : {
                  params: {
                    microDramaAccess: {
                      access: targetAccess,
                      episode: targetEpisode,
                      episodeAccess: targetEpisodeAccess,
                      episodeNumber: targetEpisode.number,
                      resumeAtSeconds:
                        targetEpisode.lockedPreviewSeconds > 0 ? targetEpisode.lockedPreviewSeconds : undefined,
                      seriesSlug: targetSeries.slug,
                      seriesTitle: targetSeries.title,
                    },
                  },
                  screen: "Wallet",
                },
        });
        return;
      }

      setAcknowledgedTargetKey(currentTargetKey);
      setBlockedTargetKey(null);
      setBlockedReason(null);

      if (!targetAccess.canWatch && !shouldUsePreview) {
        setShowInlinePaywall(true);
      }
      return;
    }

    if (!targetAccess.canWatch && !shouldUsePreview) {
      setShowInlinePaywall(true);
      return;
    }

    setAcknowledgedTargetKey(currentTargetKey);
    setBlockedTargetKey(null);
    setBlockedReason(null);
  }, [
    classification,
    currentTargetKey,
    navigation,
    parentalControlState,
    targetAccess,
    targetEpisode,
    targetEpisodeAccess,
    targetSeries,
    parentalScope,
    route.params.resumeAtSeconds,
    shouldUsePreview,
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

  // Inline paywall for locked episodes with no preview seconds (or when paywall is explicitly invoked).
  // Shown instead of navigating to Wallet, keeping the user in the Watch stack.
  if (showInlinePaywall && targetEpisode && targetAccess && targetSeries && !targetAccess.canWatch) {
    return (
      <Screen scroll={false}>
        <WalletAccessPaywall
          microDramaAccess={{
            access: targetAccess,
            episode: targetEpisode,
            episodeAccess: targetEpisodeAccess,
            episodeNumber: targetEpisode.number,
            resumeAtSeconds: undefined,
            seriesSlug: targetSeries.slug,
            seriesTitle: targetSeries.title,
          }}
          onDismiss={backToPrevious}
          onSuccess={() => {
            setShowInlinePaywall(false);
            setRetryNonce((v) => v + 1);
          }}
          variant="card"
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

  if (playback.status === "parental_required") {
    return <PlaybackTransitionScreen />;
  }

  // When shouldUsePreview is true and access_required is returned (preview
  // endpoint blocked), fall through to render PlayerScreen. The in-player
  // WalletAccessPaywall will show over the frozen frame. Only block here if
  // there is no preview path and Wallet navigation is needed.
  if (playback.status === "access_required" && !shouldUsePreview) {
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
              setShowInlinePaywall(true);
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
      <Screen scroll={false}>
        <RecoveryState
          body="This episode is not ready to play right now."
          onPrimaryAction={() => playback.refresh()}
          primaryActionLabel="Retry"
          onSecondaryAction={backToPrevious}
          secondaryActionLabel="Back"
          variant="cinematic"
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

  // No preview source available but episode is locked and has a preview
  // seconds value → show the paywall immediately (no video to play).
  if (shouldUsePreview && playback.status === "access_required" && !playback.source) {
    const paywallAccess =
      targetEpisode && targetAccess && targetSeries
        ? {
            access: targetAccess,
            episode: targetEpisode,
            episodeAccess: targetEpisodeAccess,
            episodeNumber: targetEpisode.number,
            resumeAtSeconds:
              targetEpisode.lockedPreviewSeconds > 0
                ? targetEpisode.lockedPreviewSeconds
                : undefined,
            seriesSlug: targetSeries.slug,
            seriesTitle: targetSeries.title,
          }
        : null;

    if (paywallAccess) {
      return (
        <Screen scroll={false}>
          <WalletAccessPaywall
            microDramaAccess={paywallAccess}
            onDismiss={backToPrevious}
            onSuccess={() => {
              setResumeSeconds(0);
              playback.refresh();
            }}
            variant="card"
          />
        </Screen>
      );
    }
  }

  if (!playback.source) {
    return <PlaybackTransitionScreen />;
  }

  if (!shouldUsePreview && history.status === "error") {
    return <Screen><RecoveryState body="Your saved position couldn't load. Please try again." onPrimaryAction={() => setHistoryRetryNonce((value) => value + 1)} primaryActionLabel="Retry" onSecondaryAction={backToPrevious} secondaryActionLabel="Back" title="Unable to load your progress" /></Screen>;
  }

  if (!shouldUsePreview && !isProgressResolved) return <PlaybackTransitionScreen />;

  return (
    <PlayerScreen
      searchContext={route.params.searchContext}
      key={`${resumeOwner}:${playback.source.playbackUri}`}
      initialSeekSeconds={resumeSeconds ?? (route.params.startFromBeginning ? 0 : route.params.resumeAtSeconds ?? null)}
      context={context}
      episodeAccess={targetEpisodeAccess}
      episodes={targetSeries!.episodes}
      isProgressResolved={isProgressResolved}
      microDramaAccess={
        targetEpisode && targetAccess && targetSeries
          ? {
              access: targetAccess,
              episode: targetEpisode,
              episodeAccess: targetEpisodeAccess,
              episodeNumber: targetEpisode.number,
              resumeAtSeconds:
                targetEpisode.lockedPreviewSeconds > 0
                  ? targetEpisode.lockedPreviewSeconds
                  : undefined,
              seriesSlug: targetSeries.slug,
              seriesTitle: targetSeries.title,
            }
          : undefined
      }
      onSeeOptions={openEpisodeAccessOptions}
      onRefreshSource={(currentTime) => {
        setResumeSeconds(currentTime);
        playback.refresh();
      }}
      onAdvanceToNext={(nextEpisode) => {
        activateTargetFromEpisode(nextEpisode.episodeNumber, "auto_next");
      }}
      onSelectEpisode={(episodeNumber) => {
        activateTargetFromEpisode(episodeNumber);
      }}
      playbackMode={playback.playbackMode}
      previewSeconds={playback.previewSeconds}
      savedProgress={isProgressResolved ? history.progress : undefined}
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
