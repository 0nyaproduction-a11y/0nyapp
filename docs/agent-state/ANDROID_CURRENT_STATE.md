# 0nya Android Current State

Snapshot from repository evidence. Verify against `apps/android/` before
editing. Status vocabulary: COMPLETE / PARTIAL / PENDING / BLOCKED /
UNVERIFIED.

## Status summary

The consumer Android app is implemented as an Expo SDK ~57 / React Native
0.86 app. Major flows (Home, Explore, Series, Player, Wallet, Profile, Short
Films, Watch, parental controls, deep links) exist and have been exercised on
emulator and physical device per `docs/qa/` tracker and root `emulator_*.png`
evidence (Build 15 era). Large uncommitted work is present in the working
tree (see "Git state" below).

## 2026-09-10 UI Foundation Solidification & Reconciliation

- Cleaned up obsolete files: deleted untracked dead `HeaderUtilities.tsx` and obsolete prototype harness `devSources.ts`.
- Removed dead `OnyaPlusBrandMark` export and unused import from `components/ui.tsx`.
- Refactored untyped navigation in `PlusScreen.tsx` and `CoinPurchaseScreen.tsx` to type-safe nested navigation (`MainTabs -> Profile -> RestoreSync`).
- Consolidated route serialization imports in `routeSerialization.ts`.
- TypeScript typecheck (`tsc --noEmit` in `apps/android`): PASS (0 errors).
- ESLint on modified UI files: PASS (0 errors, 0 warnings).
- Android test suite (`apps/android/src/**/*.test.ts` & `*.contract.test.ts`): 225 PASS, 0 FAIL.
- Emulator runtime testing on `emulator-5554`: Verified 7 journeys (Home/tabs, Series -> episode -> player, locked preview -> paywall modal, Plus -> Restore Purchases, Coin Purchase -> Restore Purchases, Sign In screen + back key, Deep link & back navigation).
- Physical-device acceptance (OnePlus 13R) remains pending under the Locked Final Acceptance Protocol.


## App architecture

- Entry: `apps/android/App.tsx` → `AdMobProvider` → `AuthProvider` →
  `NavigationContainer` (native stack).
- React Navigation; three main tabs (Home / Explore / Profile) via
  `src/navigation/MainTabs.tsx`; a Profile stack
  (`src/navigation/ProfileStack.tsx`).
- Supabase client: `src/lib/supabase.ts` (publishable key, SecureStore
  persistence, `src/lib/secureStorage.ts`).
- API facade: `src/lib/api.ts` — Bearer-token requests, 401 refresh retry,
  catalog/series TTL cache.
- TypeScript typecheck script: `npm run typecheck` in `apps/android`.
  Unit and contract tests executed via `npx tsx --test` (225 passing tests).
  `expo-doctor` = `npm run doctor`.

## Navigation (verified routes)

Root stack screens (from `App.tsx`): MainTabs, Wallet, CoinPurchase, Plus,
SearchResults, Series, SeriesEpisodes, ShortFilm, ShortFilmPlayback,
ShortFilmEnd, ShortFilmChaiAmount, ShortFilmChaiConfirm,
EpisodeAccessOptions, ParentalControls, Watch, AgeDeclaration, SignIn.

Screens present under `src/screens/`: Account, AgeDeclaration, CoinPurchase,
DeleteAccount, EpisodeAccessOptions, Explore, Home, ParentalControls, Plus,
RestoreSync, SearchResults, Series, SeriesEpisodes, SeriesEpisodeTray,
Settings, ShortFilmChaiAmount, ShortFilmChaiConfirm, ShortFilmDetail,
ShortFilmEnd, ShortFilmPlayback, SignIn, Wallet, Watch.

Deep links (verified in `src/navigation/linking.ts` + `src/lib/content-links.ts`):

- `/series/:slug` → Series
- `/short-films/:slug` → ShortFilm
- `/watch/:seriesSlug/:episodeNumber` → Watch

## Home

- Rendered by `src/screens/HomeScreen.tsx`; data from `GET /api/v1/catalog`
  (`src/lib/api.ts` getCatalog), normalized `home` payload.
- Editorial rows + spotlight are CMS-managed: backend `src/lib/home.ts`
  resolves `home_settings`, `home_rows`, `home_row_items` into `HomeState`
  (`state` H01/H02, `startHereVisible`, `lowHistoryThreshold`, `completedCount`,
  `spotlight`, `spotlights`, `rows`).
- Spotlight support is present in the client (multiple spotlight items,
  `showTitle` flag, `SpotlightPosterItem` component). Home Spotlight
  foundation migration is uncommitted-in-progress
  (`supabase/migrations/20260829173000_023_home_spotlight_foundation.sql`,
  `20260830090000_026_home_row_items_show_title.sql`) with matching backend
  and CMS work in the working tree.
- Continue Watching: client builds entries from watch-progress
  (`ContinueWatchingCard`, progress bars, resume) in `HomeScreen.tsx`; safe
  offline media cache per entry (`useContinueWatchingMedia`).
- Home rows show/consume `showTitle`-aware item rendering in current diff —
  VERIFY against the working tree before trusting static description.

## Series / Content Detail

- Series screen `src/screens/SeriesScreen.tsx`; data via
  `GET /api/v1/series/[slug]` (cached, `publishConfirmedSeriesAccess`
  consumer `src/lib/confirmedSeriesAccess.ts`).
- Episode list/access UI: `SeriesEpisodesScreen`, `SeriesEpisodeTray`,
  `EpisodeAccessOptionsScreen`.
- Short films: `ShortFilmDetailScreen`, library `src/lib/shortFilmArtwork.ts`,
  `src/lib/media.ts`.

## Player

- `src/player/PlayerScreen.tsx` + controller/source hooks
  (`usePlaybackController`, `usePlaybackSource`, `useWatchProgressSync`,
  `useAutoHideControls`), `expo-video` provider, player sheets
  (`EpisodeListSheet`, `PlayerMoreSheet`, `SubtitleTrackSheet`).
- Playback URLs come from `POST /api/v1/playback` (signed Mux URLs) and
  `/api/v1/playback/preview` for locked previews
  (`src/lib/api.ts` authorizePlayback / authorizePreviewPlayback).
- Resume: `src/player/resumePosition.ts`; progress sync via
  `useWatchProgressSync`; history/sync `src/lib/playbackHistory.ts`.
- Guest watch history is stored locally (SecureStore key
  `0nya.watch-history.v1.guest`) and merged into the account after sign-in
  (`src/lib/authContext.tsx` → `mergeGuestWatchHistory`).
- Clear on complete: completed/near-end positions resume from 0 (server
  `getResumePositionSeconds` semantics).

## Authentication

- Supabase email/password via `src/lib/authContext.tsx` (`signInWithPassword`); auth
  success performs no coin/wallet/reward/purchase/tip side effects.
- Bounded typed `AuthReturnIntent` (`src/lib/authReturnIntent.ts`) + SecureStore
  persistence (`authReturnIntentStorage.ts`) preserve initiating context; wired from
  Account / EpisodeAccessOptions / Player / Plus / RestoreSync / ShortFilmChai* /
  Wallet into SignIn; AgeDeclaration consumes the return intent on Continue
  (`CommonActions.reset`). Source-verified; `authReturnIntent.test.ts` present.
- SignInScreen guards development email/password rows behind `__DEV__`;
  production/release does not render Development sign-in; no OTP/token/password
  logging in auth paths.
- Guest browsing supported; guest-history merge invariants preserved in
  `authContext.tsx` -> `mergeGuestWatchHistory` (retryable/idempotent, failure
  non-blocking, no paid-entitlement migration).
- Real phone OTP / SMS physical E2E is **EXTERNALLY BLOCKED — expected
  unavailable approximately one month from 2026-09-02; re-check before
  resuming.** B02 dependency-independent work (context preservation + dev-login
  guard + return consumption + history-merge invariants) is verified; final
  acceptance awaits real OTP physical E2E. Return point preserved:
  `REAL PHONE OTP / SMS PHYSICAL E2E`.

## Wallet / Coins

- Wallet screen; `GET /api/v1/wallet` returns balance, coin products,
  transactions, top-ups.
- Coin purchase screen (`CoinPurchaseScreen`) with billing boundary service
  (`src/billing/*`): `createGooglePlayBillingService` is currently a
  stub returning `not_configured` for purchase/restore; `devHarness.ts`
  provides a dev harness toggle via
  `EXPO_PUBLIC_ONYA_DEV_BILLING_HARNESS`. Real Play Billing purchase
  integration: PARTIAL/UNVERIFIED in repo.
- Purchase requests: `POST /api/v1/billing/google-play`
  (mode purchase/restore boundary).

## Subscription

- `PlusScreen` (commercial config). Server-side subscription authority:
  `subscriptions` table + `hasActiveSubscription` (see
  `MONETIZATION_CURRENT_STATE.md`). On-device Play subscription purchase
  surfaced through the same billing boundary as coins. COMPLETE server-side;
  client purchase flow PARTIAL/UNVERIFIED.

## Rewarded Ads

- `src/lib/adMob.tsx` provider (UMP consent bootstrap; dev bypass in
  `__DEV__`); rewarded unlock client `src/lib/episodeRewardedUnlockAd.ts`.
- Server flow: create attempt `/api/v1/episodes/[id]/rewarded`, poll status
  `/api/v1/rewarded-ad-attempts/[customData]`, SSV webhook credit
  (AdMob). Multi-completion (`requiredRewardedCompletions`, progress route)
  is in-progress work in the tree.

## Deep Links

See Navigation above. Prefixes resolved in `src/lib/content-links.ts`.

### B05 current candidate status

`0nya.com` association/signing/App-Link work is preserved. B05 is **FINAL
CANDIDATE BUILD IN PROGRESS / FINAL ACCEPTANCE PENDING**: exactly one
authorized EAS Android `development` build using existing EAS-managed signing
credentials is being produced for final App-Link/runtime validation. No second
B05 build is authorized. Do not mark B05 complete until runtime and OnePlus
acceptance evidence exists.

### PX01 / Play Together / 0chat

The Android app has NO applied realtime Play Together synchronization or 0chat
UI. A SOURCE-VERIFIED (typecheck + unit/source tests only) PX01-D playback-sync
foundation now exists in the tree and is inert by default:

- `src/player/usePlayTogetherPlaybackSync.ts` — the sync adapter. Engages only
  when `PlayerScreen` is passed an explicit `playTogether` room scope AND the
  backend `/api/v1/play-together/config` resolves `enabled: true` AND the room
  is `active` on the loaded episode AND the user is a participant.
- `src/player/playTogetherSync.ts` — pure helpers (clock-offset median,
  expected-position, drift bands, rate correction) + 14 passing unit tests.
- `src/lib/api.ts` `sendPlayTogetherRoomCommand` + sync/command types in
  `src/types/playTogether.ts`. Drift/heartbeat tuning is consumed from config
  only; no hardcoded thresholds and no `enabled: true` anywhere in client code.
- Host-buffering rides a separate private Realtime PRESENCE topic
  (`play_together_room_presence:<roomId>`), which needs the PX01-D RLS migration
  applied; that migration also re-exposes sync tuning columns and keeps
  `enabled = false` (consume-only).

No emulator, runtime, presence, or device proof exists. Backend PX01 source
preparation must not be represented as an Android feature.

## Configuration / Environment

See `SYSTEM_MAP.md` env table. Read from `src/config/env.ts`. Names only —
never values.

## Completed / stable (evidence-backed)

- App shell, tabs, Profile stack, sign-in, guest browsing.
- Series + episode detail and playback with forced resume/access surface.
- Short-film detail/playback/end/chai-amount/chai-confirm flows.
- Wallet read surface; parental controls screens (AgeDeclaration,
  ParentalControls).
- Deep linking config validators for Series/ShortFilm/Watch.
- Catalog/series client cache + 401 refresh.

## Partial / pending

- Google Play Billing purchase/restore: stub service — PARTIAL.
  Real Google Play Billing is externally unavailable for approximately one month
  from 2026-09-02; re-check before B08 activation. Do not fake client
  purchases, Coins, Plus, Restore/Sync, or store prices.
- Home Spotlight editorial phase (023/026 migrations + backend + CMS +
  HomeScreen): in-progress working tree — PARTIAL.
- Rewarded multi-completion (2-ad unlocks, progress endpoint): in-progress —
  PARTIAL.
- Dedicated Android unit tests: 225 unit and contract tests exist under
  `apps/android/src/**/*.test.ts` and `apps/android/src/**/*.contract.test.ts`
  and are directly runnable via `npx tsx --test`; 225 PASS, 0 FAIL — COMPLETE (CURRENT-TIP VERIFIED).

## Known issues

- Only repository evidence, not exhaustive. Verify logs/device before
  reporting fixes.

## High-risk areas not to casually modify

- Playback authorization boundary (`src/lib/api.ts` authorizePlayback,
  `usePlaybackSource`) — must keep server-authorized signed URLs.
- Guest history merge (sign-in data durability).
- Access/unlock UI (EpisodeAccessOptions, rewarded/coin) — must not make the
  client authoritative.
- AdMob/UMP consent bootstrap (release compliance).

## Relevant files

`apps/android/App.tsx`; `src/navigation/*`; `src/screens/*`; `src/player/*`;
`src/lib/api.ts`, `authContext.tsx`, `adMob.tsx`, `playbackHistory.ts`,
`episodeRewardedUnlockAd.ts`, `confirmedSeriesAccess.ts`, `supabase.ts`,
`secureStorage.ts`, `parentalControls.ts`, `perf.ts`; `src/billing/*`;
`src/config/env.ts`; `src/types/api.ts`.

## Last verification evidence

- `docs/qa/0nya_Build15_Physical_Verification_Tracker.docx`
- `docs/android-performance-checkpoint-2026-08-28.md`
- Root `emulator_*.png` / `test_device.png` captures (Build 15 era)
- Git log: `Build 15: verified Android runtime checkpoint`, `Build 15:
  verify monetization and playback foundations`, `perf(qa): fix timing
  typescript types for netlify build`

## Git state at snapshot

Branch `qa/netlify-api-e34ab5e`. Uncommitted modifications/untracked files
touch many Android files (`HomeScreen.tsx`, `ExploreScreen.tsx`,
`SearchResultsScreen.tsx`, `ShortFilmDetailScreen.tsx`,
`ShortFilmPlaybackScreen.tsx`, `theme/tokens.ts`, `types/api.ts`,
`components/ui.tsx`, `eas.json`, package files) — treat as concurrent work;
do not clobber (see `0nya-git-safety`).