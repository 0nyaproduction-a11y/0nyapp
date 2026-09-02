import type { MicroDramaAccessContext } from "../navigation/types";
import type { ApiShortFilm } from "../types/api";

export const AUTH_RETURN_INTENT_KEY = "0nya.auth-return-intent.v1";

export type AuthReturnIntent =
  | { kind: "profile" }
  | { kind: "plus" }
  | { kind: "restoreSync" }
  | {
      kind: "wallet";
      microDramaAccess?: MicroDramaAccessContext | null;
    }
  | {
      kind: "coinUnlock";
      accessContext: MicroDramaAccessContext;
    }
  | {
      kind: "rewarded";
      accessContext: MicroDramaAccessContext;
    }
  | {
      kind: "chai";
      shortFilm: ApiShortFilm;
      selectedAmount?: number | null;
    }
  | { kind: "home" };

export interface ReturnRoute {
  name: string;
  key?: string;
  params?: Record<string, unknown>;
}

export interface ReturnNavigationState {
  index: number;
  routes: ReturnRoute[];
}

export function serializeAuthReturnIntent(intent: AuthReturnIntent): string {
  return JSON.stringify(intent);
}

export function parseAuthReturnIntent(raw: string | null | undefined): AuthReturnIntent | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValidReturnIntent(parsed) ? (parsed as AuthReturnIntent) : null;
  } catch {
    return null;
  }
}

export function isValidMicroDramaAccessContext(value: unknown): value is MicroDramaAccessContext {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.seriesSlug === "string" &&
    typeof candidate.seriesTitle === "string" &&
    candidate.access !== undefined &&
    candidate.episode !== undefined &&
    candidate.episodeAccess !== undefined
  );
}

export function isValidShortFilm(value: unknown): value is ApiShortFilm {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return typeof (value as { slug?: unknown }).slug === "string";
}

export function isValidReturnIntent(value: unknown): value is AuthReturnIntent {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  switch (candidate.kind) {
    case "profile":
    case "plus":
    case "restoreSync":
    case "home":
      return true;
    case "wallet":
      return (
        candidate.microDramaAccess === undefined ||
        candidate.microDramaAccess === null ||
        isValidMicroDramaAccessContext(candidate.microDramaAccess)
      );
    case "coinUnlock":
    case "rewarded":
      return isValidMicroDramaAccessContext(candidate.accessContext);
    case "chai":
      return (
        isValidShortFilm(candidate.shortFilm) &&
        (candidate.selectedAmount === undefined ||
          candidate.selectedAmount === null ||
          typeof candidate.selectedAmount === "number")
      );
    default:
      return false;
  }
}

export function resolveReturnRoutes(intent: AuthReturnIntent): ReturnNavigationState {
  switch (intent.kind) {
    case "profile":
      return {
        index: 0,
        routes: [
          {
            name: "MainTabs",
            params: { screen: "Profile", params: { screen: "Account" } },
          },
        ],
      };
    case "restoreSync":
      return {
        index: 0,
        routes: [
          {
            name: "MainTabs",
            params: { screen: "Profile", params: { screen: "RestoreSync" } },
          },
        ],
      };
    case "wallet": {
      const walletRoute: ReturnRoute = { name: "Wallet" };

      if (intent.microDramaAccess) {
        walletRoute.params = { microDramaAccess: intent.microDramaAccess };
      }

      return {
        index: 1,
        routes: [{ name: "MainTabs" }, walletRoute],
      };
    }
    case "plus":
      return {
        index: 1,
        routes: [{ name: "MainTabs" }, { name: "Plus" }],
      };
    case "coinUnlock":
    case "rewarded":
      return {
        index: 1,
        routes: [
          { name: "MainTabs" },
          {
            name: "EpisodeAccessOptions",
            params: { ...intent.accessContext },
          },
        ],
      };
    case "chai":
      return {
        index: 1,
        routes: [
          { name: "MainTabs" },
          {
            name: "ShortFilmChaiAmount",
            params: {
              shortFilm: intent.shortFilm,
              selectedAmount: intent.selectedAmount ?? undefined,
            },
          },
        ],
      };
    case "home":
      return {
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      };
  }
}
