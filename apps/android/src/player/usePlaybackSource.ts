import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { getMobileEnv } from "../config/env";
import {
  authorizePlayback,
  authorizePreviewPlayback,
  type PlaybackAuthorizationRequest,
  type PreviewPlaybackAuthorizationRequest,
} from "../lib/api";
import { getPlaybackAuthorizationCredentials } from "../lib/parentalControls";
import { perfMark, perfNow } from "../lib/perf";
import type { PlaybackAuthorizationResponse, PreviewPlaybackAuthorizationResponse } from "../types/api";
import type { PlaybackContext, PlaybackMode, PlaybackSource } from "./types";

type PlaybackSourceStatus =
  | Exclude<PlaybackAuthorizationResponse["status"], "ok">
  | Exclude<PreviewPlaybackAuthorizationResponse["status"], "ok">;

type PlaybackSourceState =
  | {
      expiresAt: string | null;
      playbackMode: PlaybackMode;
      source: PlaybackSource | null;
      status: "loading";
      previewSeconds: number | null;
    }
  | {
      expiresAt: string | null;
      playbackMode: PlaybackMode;
      source: PlaybackSource;
      status: "ok";
      previewSeconds: number | null;
    }
  | {
      expiresAt: null;
      playbackMode: PlaybackMode;
      previewSeconds: null;
      source: null;
    status: PlaybackSourceStatus;
    };

type PlaybackSourceOptions = {
  playbackMode?: PlaybackMode;
};

function buildPlaybackContextRequest(
  context: PlaybackContext,
  auth: { guestCredential?: string | null; parentalSessionToken?: string | null },
): PlaybackAuthorizationRequest & { guestCredential?: string | null; parentalSessionToken?: string | null } {
  if (context.type === "SERIES_EPISODE") {
    return {
      episodeNumber: context.episodeNumber,
      guestCredential: auth.guestCredential ?? null,
      parentalSessionToken: auth.parentalSessionToken ?? null,
      seriesSlug: context.seriesSlug,
      targetType: "SERIES_EPISODE",
    };
  }

  return {
    guestCredential: auth.guestCredential ?? null,
    parentalSessionToken: auth.parentalSessionToken ?? null,
    slug: context.filmSlug,
    targetType: "SHORT_FILM",
  };
}

function buildPreviewPlaybackContextRequest(
  context: PlaybackContext,
  auth: { guestCredential?: string | null; parentalSessionToken?: string | null },
): PreviewPlaybackAuthorizationRequest & { guestCredential?: string | null; parentalSessionToken?: string | null } {
  if (context.type !== "SERIES_EPISODE") {
    throw new Error("Preview playback is only available for series episodes.");
  }

  return {
    episodeNumber: context.episodeNumber,
    guestCredential: auth.guestCredential ?? null,
    parentalSessionToken: auth.parentalSessionToken ?? null,
    seriesSlug: context.seriesSlug,
    targetType: "SERIES_EPISODE",
  };
}

function buildProductionPlaybackSource(
  context: PlaybackContext,
  playbackUrl: string,
): PlaybackSource {
  return {
    isDevelopmentOnly: false,
    playbackUri: playbackUrl,
    source: {
      contentType: "hls",
      metadata: {
        artist: "0nya production playback",
        title:
          context.type === "SERIES_EPISODE"
            ? `${context.seriesTitle} - Episode ${context.episodeNumber}`
            : context.title,
      },
      uri: playbackUrl,
      useCaching: false,
    },
  };
}

function getContextKey(context: PlaybackContext | null) {
  if (!context) {
    return "none";
  }

  return context.type === "SERIES_EPISODE"
    ? `${context.seriesSlug}:${context.episodeNumber}`
    : `film:${context.filmSlug}`;
}

function isShortFilmMuxProofPlaybackTarget(
  context: PlaybackContext,
): context is Extract<PlaybackContext, { type: "SHORT_FILM" }> {
  return context.type === "SHORT_FILM" && context.filmSlug === "mute-button";
}

async function resolvePreviewPlaybackSource(
  context: PlaybackContext,
  session: Session | null,
) {
  const auth = await getPlaybackAuthorizationCredentials(session);
  const response = await authorizePreviewPlayback(
    session?.access_token ?? null,
    buildPreviewPlaybackContextRequest(context, auth),
  );

  return response;
}

async function resolveFullPlaybackSource(context: PlaybackContext, session: Session | null) {
  const auth = await getPlaybackAuthorizationCredentials(session);
  const response = await authorizePlayback(
    session?.access_token ?? null,
    buildPlaybackContextRequest(context, auth),
  );

  return response;
}

export function usePlaybackSource(
  context: PlaybackContext | null,
  session: Session | null,
  options: PlaybackSourceOptions = {},
) {
  const playbackMode = options.playbackMode ?? "full";
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<PlaybackSourceState>({
    expiresAt: null,
    playbackMode,
    source: null,
    status: "loading",
    previewSeconds: null,
  });

  const refresh = useCallback(() => {
    setRetryNonce((value) => value + 1);
  }, []);

  const contextKey = getContextKey(context);

  useEffect(() => {
    if (!context) {
      return undefined;
    }

    let isMounted = true;
    const sourceResolveStartedAt = perfNow();

    perfMark("SOURCE_RESOLVE_START", {
      context: contextKey,
      playback_mode: playbackMode,
    });

    const markSourceResolved = (status: string, resolvedPlaybackMode = playbackMode) => {
      perfMark("SOURCE_RESOLVED", {
        context: contextKey,
        duration_ms: Math.max(0, perfNow() - sourceResolveStartedAt).toFixed(1),
        playback_mode: resolvedPlaybackMode,
        status,
      });
    };

    // Source swaps are lifecycle boundaries; clear the old URL before resolving a fresh one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      expiresAt: null,
      playbackMode,
      source: null,
      status: "loading",
      previewSeconds: null,
    });

    void (async () => {
      const { shortFilmMuxTestPlaybackEnabled } = getMobileEnv();

      if (playbackMode === "preview" && context.type === "SERIES_EPISODE") {
        const response = await resolvePreviewPlaybackSource(context, session);

        if (!isMounted) {
          return;
        }

        if (response.status === "preview_not_required") {
          const fullResponse = await resolveFullPlaybackSource(context, session);

          if (!isMounted) {
            return;
          }

          if (fullResponse.status === "ok") {
            markSourceResolved("ok", "full");
            setState({
              expiresAt: fullResponse.expiresAt,
              playbackMode: "full",
              previewSeconds: null,
              source: buildProductionPlaybackSource(context, fullResponse.playbackUrl),
              status: "ok",
            });
            return;
          }

          markSourceResolved(fullResponse.status, "full");
          setState({
            expiresAt: null,
            playbackMode: "full",
            previewSeconds: null,
            source: null,
            status: fullResponse.status,
          });
          return;
        }

        if (response.status === "ok") {
          markSourceResolved("ok", "preview");
          setState({
            expiresAt: response.expiresAt,
            playbackMode: "preview",
            previewSeconds: response.previewSeconds,
            source: buildProductionPlaybackSource(context, response.previewUrl),
            status: "ok",
          });
          return;
        }

        markSourceResolved(response.status, "preview");
        setState({
          expiresAt: null,
          playbackMode: "preview",
          previewSeconds: null,
          source: null,
          status: response.status,
        });
        return;
      }

      if (__DEV__) {
        if (context.type === "SERIES_EPISODE") {
          const response = await resolveFullPlaybackSource(context, session);

          if (!isMounted) {
            return;
          }

          console.info("[0nya series playback]", {
            authorizationRequested: true,
            authorizationSucceeded: response.status === "ok",
            contentSlug: context.seriesSlug,
            contentType: "series_episode",
            episodeIdPresent: false,
            episodeNumber: context.episodeNumber,
            hasPlaybackUrl: response.status === "ok",
            sourceAssigned: response.status === "ok",
            sourceMode: response.status === "ok" ? "mux" : "blocked",
          });

          if (response.status === "ok") {
            markSourceResolved("ok", "full");
            setState({
              expiresAt: response.expiresAt,
              playbackMode: "full",
              previewSeconds: null,
              source: buildProductionPlaybackSource(context, response.playbackUrl),
              status: "ok",
            });
            return;
          }

          markSourceResolved(response.status, "full");
          setState({
            expiresAt: null,
            playbackMode: "full",
            previewSeconds: null,
            source: null,
            status: response.status,
          });
          return;
        }

        if (context.type === "SHORT_FILM") {
          const shortFilmContext = context as Extract<PlaybackContext, { type: "SHORT_FILM" }>;
          const response = await resolveFullPlaybackSource(shortFilmContext, session);

          if (!isMounted) {
            return;
          }

          console.info("[0nya short film playback]", {
            authorizationRequested: true,
            authorizationStatus: response.status,
            contentSlug: shortFilmContext.filmSlug,
            contentType: "short_film",
            hasPlaybackUrl: response.status === "ok",
            sourceAssigned: response.status === "ok",
            sourceMode: response.status === "ok" ? "mux" : "blocked",
          });

          if (response.status === "ok") {
            markSourceResolved("ok", "full");
            setState({
              expiresAt: response.expiresAt,
              playbackMode: "full",
              previewSeconds: null,
              source: buildProductionPlaybackSource(shortFilmContext, response.playbackUrl),
              status: "ok",
            });
            return;
          }

          markSourceResolved(response.status, "full");
          setState({
            expiresAt: null,
            playbackMode: "full",
            previewSeconds: null,
            source: null,
            status: response.status,
          });
          return;
        }

        if (shortFilmMuxTestPlaybackEnabled && isShortFilmMuxProofPlaybackTarget(context)) {
          const shortFilmContext = context as Extract<PlaybackContext, { type: "SHORT_FILM" }>;
          const response = await resolveFullPlaybackSource(shortFilmContext, session);

          if (!isMounted) {
            return;
          }

          console.info("[0nya short film mux playback proof]", {
            contentSlug: shortFilmContext.filmSlug,
            expiresAtPresent: response.status === "ok" ? Boolean(response.expiresAt) : false,
            hasPlaybackUrl: response.status === "ok",
            sourceAssigned: response.status === "ok",
            sourceMode: "mux",
          });

          if (response.status === "ok") {
            markSourceResolved("ok", "full");
            setState({
              expiresAt: response.expiresAt,
              playbackMode: "full",
              previewSeconds: null,
              source: buildProductionPlaybackSource(shortFilmContext, response.playbackUrl),
              status: "ok",
            });
            return;
          }

          markSourceResolved(response.status, "full");
          setState({
            expiresAt: null,
            playbackMode: "full",
            previewSeconds: null,
            source: null,
            status: response.status,
          });
          return;
        }
      }

      const response = await resolveFullPlaybackSource(context, session);

      if (!isMounted) {
        return;
      }

      if (response.status === "ok") {
        markSourceResolved("ok", "full");
        setState({
          expiresAt: response.expiresAt,
          playbackMode: "full",
          previewSeconds: null,
          source: buildProductionPlaybackSource(context, response.playbackUrl),
          status: "ok",
        });
        return;
      }

      markSourceResolved(response.status, "full");
      setState({
        expiresAt: null,
        playbackMode: "full",
        previewSeconds: null,
        source: null,
        status: response.status,
      });
    })().catch(() => {
      if (!isMounted) {
        return;
      }

      setState({
        expiresAt: null,
        playbackMode,
        previewSeconds: null,
        source: null,
        status: playbackMode === "preview" ? "preview_unavailable" : "playback_unavailable",
      });
      markSourceResolved(playbackMode === "preview" ? "preview_unavailable" : "playback_unavailable");
    });

    return () => {
      isMounted = false;
    };
  }, [context, contextKey, playbackMode, retryNonce, session]);

  return {
    expiresAt: state.expiresAt,
    playbackMode: state.playbackMode,
    refresh,
    source: state.source,
    status: state.status,
    previewSeconds: state.previewSeconds,
  };
}
