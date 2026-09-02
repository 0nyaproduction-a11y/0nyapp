import type { Session } from "@supabase/supabase-js";

export type HistoryMergeStateEntry = {
  guestCredential: string | null;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  mergedAt: string;
  status?: "completed" | "pending";
};

export type HistoryMergeState = Record<string, HistoryMergeStateEntry>;

export type HistorySyncUiStatus = "idle" | "pending" | "retrying";

export type HistorySyncUiState = {
  errorMessage?: string;
  status: HistorySyncUiStatus;
};

export function getHistoryMergeUiStateFromEntry(entry?: HistoryMergeStateEntry | null): HistorySyncUiState {
  if (!entry || entry.status === "completed") {
    return { status: "idle" };
  }

  return {
    errorMessage: entry.lastErrorMessage ?? "Watch history couldn't fully sync.",
    status: "pending",
  };
}

export function getHistoryMergeUiState(
  session: Session | null,
  state: HistoryMergeState = {},
): HistorySyncUiState {
  if (!session?.user?.id) {
    return { status: "idle" };
  }

  return getHistoryMergeUiStateFromEntry(state[session.user.id]);
}

export async function retryPendingGuestHistoryMerge(
  session: Session | null,
  mergeFn: (currentSession: Session | null) => Promise<{ pending: boolean }>,
) {
  if (!session?.user?.id || !session.access_token) {
    return { pending: false, retried: false, status: "idle" as const };
  }

  const result = await mergeFn(session);
  const status = result.pending ? "pending" : "idle";

  return {
    pending: result.pending,
    retried: true,
    status,
  };
}
