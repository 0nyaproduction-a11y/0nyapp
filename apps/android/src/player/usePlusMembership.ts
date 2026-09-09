import { useEffect, useState } from "react";
import { getMe } from "../lib/api";

type PlusMembershipResult = {
  token: string;
  active: boolean;
};

/**
 * PIP01: server-derived 0nya Plus membership for player-level benefits.
 *
 * Single authority: the existing authenticated `GET /api/v1/me` via `getMe`.
 * The result is bound to the exact access token it was fetched with, so a
 * token change (sign-in/out/refresh) invalidates the previous answer and the
 * derived state fails closed while unauthenticated, loading, or on error.
 */
export function usePlusMembership(accessToken: string | null | undefined): boolean {
  const [result, setResult] = useState<PlusMembershipResult | null>(null);

  useEffect(() => {
    if (!accessToken) {
      // No fetch; the token-bound derivation below already fails closed.
      return undefined;
    }

    let cancelled = false;
    getMe(accessToken)
      .then((me) => {
        if (!cancelled) {
          setResult({ token: accessToken, active: me.subscription.status === "active" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ token: accessToken, active: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return Boolean(accessToken && result !== null && result.token === accessToken && result.active);
}
