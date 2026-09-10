import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { setAccessIdentity } from "./api";
import { clearParentalSessionUnlock } from "./parentalControls";
import {
  getHistoryMergeUiState,
  mergeGuestWatchHistory,
  retryPendingGuestHistoryMerge,
  type HistorySyncUiState,
} from "./playbackHistory";
import { supabase } from "./supabase";
import { handleAuthenticatedSession, handleSignOut } from "./notifications";

type AuthContextValue = {
  historySyncStatus: HistorySyncUiState;
  isLoading: boolean;
  retryGuestHistoryMerge: () => Promise<void>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [historySyncStatus, setHistorySyncStatus] = useState<HistorySyncUiState>({ status: "idle" });
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  // Authenticated requests read the identity registry rather than context, so
  // every authoritative session change must publish to it before the state
  // update. Without this a cold start issues no authenticated requests.
  const publishSession = useCallback((nextSession: Session | null) => {
    setAccessIdentity(nextSession?.user.id ?? null, nextSession?.access_token ?? null);
    setSession(nextSession);
  }, []);

  function syncParentalUnlocks(nextSession: Session | null) {
    const nextUserId = nextSession?.user?.id ?? null;

    if (lastUserIdRef.current !== nextUserId) {
      clearParentalSessionUnlock();
    }

    lastUserIdRef.current = nextUserId;
  }

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!isMounted) {
          return;
        }

        if (!data.session) {
          syncParentalUnlocks(null);
          publishSession(null);
          setIsLoading(false);
          return;
        }

        const { error: userError } = await supabase.auth.getUser();

        if (userError) {
          const isAuthError = userError.status && userError.status >= 400 && userError.status < 500;
          if (isAuthError) {
            await supabase.auth.signOut({ scope: "local" });
            if (isMounted) {
              syncParentalUnlocks(null);
              publishSession(null);
              setIsLoading(false);
            }
          } else {
            if (isMounted) {
              syncParentalUnlocks(data.session);
              publishSession(data.session);
              setIsLoading(false);
            }
          }
          return;
        }

        syncParentalUnlocks(data.session);
        publishSession(data.session);
        setIsLoading(false);
        void handleAuthenticatedSession(data.session.access_token);
      })
      .catch(async (error) => {
        if (!isMounted) {
          return;
        }

        const status = error && typeof error === "object" && "status" in error ? (error as Record<string, unknown>).status : null;
        const isAuthError = typeof status === "number" && status >= 400 && status < 500;

        if (isAuthError) {
          await supabase.auth.signOut({ scope: "local" });
        }
        syncParentalUnlocks(null);
        publishSession(null);
        setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncParentalUnlocks(nextSession);
      publishSession(nextSession);
      setIsLoading(false);
      if (nextSession?.access_token) {
        // New/changed session (sign-in, refresh, user-switch) — re-register
        // the current device under the CURRENT user. Failures are
        // best-effort (never thrown) so auth flow cannot break.
        void handleAuthenticatedSession(nextSession.access_token);
      } else {
        // Session cleared (sign-out from another tab/device) — reset the
        // success guard so a later user registers fresh.
        void handleSignOut(null).catch(() => undefined);
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token || !session.user?.id) {
      setHistorySyncStatus({ status: "idle" });
      return undefined;
    }

    let active = true;

    void getHistoryMergeUiState(session)
      .then((nextState) => {
        if (active) {
          setHistorySyncStatus(nextState);
        }
      })
      .catch(() => {
        if (active) {
          setHistorySyncStatus({ status: "idle" });
        }
      });

    void mergeGuestWatchHistory(session).catch((error) => {
      if (active) {
        console.warn("Unable to merge guest watch history after sign-in.", error);
      }
    });

    return () => {
      active = false;
    };
  }, [session]);

  const retryGuestHistoryMerge = useCallback(async () => {
    if (!session?.access_token || !session.user?.id) {
      return;
    }

    setHistorySyncStatus({ errorMessage: "Watch history couldn't fully sync.", status: "retrying" });

    try {
      const result = await retryPendingGuestHistoryMerge(session, mergeGuestWatchHistory);

      if (result.pending) {
        const nextState = await getHistoryMergeUiState(session);
        setHistorySyncStatus(nextState.status === "pending" ? nextState : { errorMessage: "Watch history couldn't fully sync.", status: "pending" });
        return;
      }

      setHistorySyncStatus({ status: "idle" });
    } catch (error) {
      console.warn("Unable to retry guest watch history merge.", error);
      setHistorySyncStatus({ errorMessage: "Watch history couldn't fully sync.", status: "pending" });
    }
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      historySyncStatus,
      isLoading,
      retryGuestHistoryMerge,
      session,
      async signIn(email, password) {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw new Error(error.message);
        }

        const accessToken = data?.session?.access_token ?? null;
        if (accessToken) {
          void handleAuthenticatedSession(accessToken);
        }
      },
      async signOut() {
        if (session?.access_token) {
          await handleSignOut(session.access_token);
        }
        const { error } = await supabase.auth.signOut();

        if (error) {
          throw new Error(error.message);
        }
      },
    }),
    [historySyncStatus, isLoading, retryGuestHistoryMerge, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
