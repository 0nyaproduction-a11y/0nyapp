import type { Session } from "@supabase/supabase-js";

/**
 * Stable playback-relevant auth identity.
 *
 * Supabase TOKEN_REFRESHED emits a brand-new Session object (and access
 * token string) for the SAME user. Playback source resolution, series
 * access loading, and watch-history ownership must key on the user
 * identity — not on Session object identity — so a routine token refresh
 * alone never re-authorizes, remounts the player, or races the latest
 * progress save. Identity changes (sign-in as another user, sign-out to
 * guest) still change the value and invalidate correctly.
 */
export function getPlaybackAuthIdentity(session: Session | null | undefined) {
  return session?.user.id ?? null;
}

/**
 * Whether a previous data-load/source-resolution run's auth identity is the
 * same as the current one. A routine Supabase TOKEN_REFRESHED emits a new
 * Session object with the SAME user id, so this stays true and must NOT
 * trigger an episode/film reload, a re-authorization, a new signed URL, or a
 * player remount. Only a real identity change (another user, sign-out to
 * guest) flips it to false.
 */
export function isSamePlaybackAuthIdentity(
  previousIdentity: string | null | undefined,
  nextIdentity: string | null | undefined,
) {
  return previousIdentity === nextIdentity;
}
