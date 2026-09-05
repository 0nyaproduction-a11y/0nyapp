import { useFocusEffect } from "@react-navigation/native";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useMemo, useState } from "react";
import { getCatalog, getRequestRecoveryCopy, type RecoveryCopy } from "./api";
import { loadWatchHistory } from "./playbackHistory";
import { createScreenRequestOwner, loadScreenResources, type ScreenRequestOwner } from "./screenResources";
import type { ApiSeries, ApiShortFilm, WatchProgressItem } from "../types/api";

const EMPTY_CATALOG: ApiSeries[] = [];
const EMPTY_FILMS: ApiShortFilm[] = [];

type Catalog = Awaited<ReturnType<typeof getCatalog>>;
type HistoryStatus = "loading" | "resolved" | "error";
type State = {
  owner: ScreenRequestOwner;
  data: Catalog | null;
  progress: WatchProgressItem[];
  historyStatus: HistoryStatus;
  error: RecoveryCopy | null;
  isLoading: boolean;
  hasHydrated: boolean;
};

export function useDiscoveryCatalog(session: Session | null, withHistory: boolean) {
  const accessToken = session?.access_token;
  const userId = session?.user.id;
  // A new identity gets an empty view immediately, before its requests resolve.
  const owner = useMemo(() => createScreenRequestOwner({ accessToken, userId }), [accessToken, userId]);
  const empty = useMemo<State>(() => ({ owner, data: null, progress: [], historyStatus: "loading", error: null, isLoading: true, hasHydrated: false }), [owner]);
  const [stored, setStored] = useState<State>(empty);
  const state = stored.owner === owner ? stored : empty;
  const reload = useCallback(() => {
    setStored((previous) => ({ ...(previous.owner === owner ? previous : empty), isLoading: true, historyStatus: "loading" }));
    return loadScreenResources({
      owner,
      loadRequired: () => getCatalog(accessToken),
      onRequired: (data) => setStored((previous) => ({ ...previous, owner, data, error: null })),
      onRequiredError: (error) => setStored((previous) => ({ ...previous, owner, error: getRequestRecoveryCopy(error, { body: "Please try again.", title: "We couldn't load this right now." }) })),
      onRequiredSettled: () => setStored((previous) => ({ ...previous, owner, isLoading: false, hasHydrated: true })),
      loadOptional: withHistory ? () => loadWatchHistory(session) : undefined,
      onOptional: (progress) => setStored((previous) => ({ ...previous, owner, progress, historyStatus: "resolved" })),
      // Preserve this identity's last known history; error is not synced-empty.
      onOptionalError: () => setStored((previous) => ({ ...previous, owner, historyStatus: "error" })),
    });
  }, [accessToken, empty, owner, session, withHistory]);
  useFocusEffect(useCallback(() => {
    void reload();
    return () => owner.invalidate();
  }, [owner, reload]));
  return { ...state, catalog: state.data?.catalog ?? EMPTY_CATALOG, shortFilms: state.data?.shortFilms ?? EMPTY_FILMS, reload };
}
