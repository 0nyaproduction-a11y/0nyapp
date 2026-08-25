# 0nya VIDEO PLAYBACK ARCHITECTURE v1.0

## Scope

This document describes the video and playback implementation that actually exists in the repository today. It is evidence-based and intentionally limited to code that is currently present in the repo. This slice adds a server-only Mux backend foundation without changing the Android player stack or installing new packages.

## Executive summary

Status: PARTIALLY IMPLEMENTED

The repository contains two different playback implementations:

- Android/mobile player: Expo app using `expo-video` with a development HLS source and player lifecycle management.
- Web player: a custom Next.js mock player UI that tracks playback position in JavaScript but does not use an actual HTML video element.

The repo now has a server-only Mux media foundation for production upload/webhook metadata, signed playback authorization, and a secure locked-preview backend foundation. Android playback continues to use `expo-video`, and the production player flow is still not wired into the native client.

Important product constraint reminder:

- Micro-drama playback must never receive interruptive pre-roll, mid-roll, or post-roll ads under the final Product Bible.
- The repo does not currently implement such ad insertion for micro-dramas.

---

## 1. Platforms

### 1.1 Web video implementation

Status: PARTIALLY IMPLEMENTED

Evidence:

- `src/components/player/VerticalPlayer.tsx`
- `src/components/player/PlayerControls.tsx`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- `src/lib/watch-progress.ts`

Behavior:

- This is a custom client-side playback shell, not a native video element player.
- It uses React state and `window.setInterval()` to increment a simulated playback position.
- It renders a stylized vertical player screen with a poster background and playback UI.
- It persists watch progress to Supabase via `saveWatchProgress()` and `markEpisodeCompleted()`.
- It resolves access before rendering the player using `canUserWatchEpisode()`.

Important caveat:

- There is no actual browser `<video>` element, no `HTMLMediaElement` wiring, and no media source handling in the web implementation.
- This is a front-end progression model, not a production streaming player.

### 1.2 Android/mobile video implementation

Status: PARTIALLY IMPLEMENTED

Evidence:

- `apps/android/package.json`
- `apps/android/src/player/PlayerScreen.tsx`
- `apps/android/src/player/usePlaybackController.ts`
- `apps/android/src/player/PlayerControls.tsx`
- `apps/android/src/player/devSources.ts`
- `apps/android/src/player/useWatchProgressSync.ts`

Behavior:

- The Android app uses Expo’s `expo-video` package version `~57.0.2`.
- `VideoView` and `useVideoPlayer()` are used to create and manage playback.
- A development HLS source is passed into `useVideoPlayer(source, ...)`.
- Playback lifecycle, buffering, seeking, end-of-stream, retry, and watch-progress sync are implemented in the Android player layer.

### 1.3 Shared code

Status: PARTIALLY IMPLEMENTED

Evidence:

- `src/lib/watch-progress.ts`
- `src/lib/entitlements.ts`
- `src/types/database.ts`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`

Shared behavior:

- Access checks are shared between web and data layers.
- Watch progress schema and server-side persistence are shared via Supabase.
- Resume position is computed in shared code before playback begins.
- `episode_entitlements`, `subscriptions`, and `watch_progress` are shared backend data structures.

### 1.4 Platform distinction summary

| Platform | Current reality | Status |
| --- | --- | --- |
| Web | Custom UI-only playback simulation with progress timer and server save hooks | PARTIALLY IMPLEMENTED |
| Android / Expo | Real `expo-video` player with lifecycle management and HLS input | PARTIALLY IMPLEMENTED |
| Shared | Access, resume, and DB logic | PARTIALLY IMPLEMENTED |

---

## 2. Player technology

### 2.1 Current player library and version

Status: IMPLEMENTED for Android; MISSING for web production player

Explicit evidence:

- Android app dependency: `expo-video` at `~57.0.2` in `apps/android/package.json`
- Web app package file: `package.json` contains no dedicated external video player package

### 2.2 Native / Expo / Web APIs in use

Android / Expo:

- `VideoView` from `expo-video`
- `useVideoPlayer` from `expo-video`
- `VideoSource` type from `expo-video`
- `SubtitleTrack` and `VideoPlayerStatus`
- `AppState` for lifecycle pause handling
- `useEventListener` from `expo`

Web:

- React + Next.js only
- no `video` tag or native media API integration
- simulated state-driven progress with `setInterval()`

### 2.3 Relevant source files

- `apps/android/src/player/PlayerScreen.tsx`
- `apps/android/src/player/usePlaybackController.ts`
- `apps/android/src/player/PlayerControls.tsx`
- `apps/android/src/player/useWatchProgressSync.ts`
- `apps/android/src/player/devSources.ts`
- `src/components/player/VerticalPlayer.tsx`
- `src/components/player/PlayerControls.tsx`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`

---

## 3. Video source

### 3.1 HLS support

Status: IMPLEMENTED for the Android dev player

Evidence:

- `apps/android/src/player/devSources.ts` sets:
  - `contentType: "hls"`
  - `uri: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"`
  - `uri: "https://ik.imagekit.io/highheat/luna_promo.mp4/ik-master.m3u8?tr=sr-360_480_720_1080"`

This is a development-only HLS playback URL, not an app-level production stream config.

### 3.2 MP4 / direct URL support

Status: UNKNOWN / NOT FOUND for production

Evidence found:

- the development HLS source is the only concrete playback source in repo code
- no direct MP4 URL pipeline or asset mapping for production episodes was found
- `video_asset_id` exists in `src/types/database.ts` and SQL schema, but no code resolves it to a playable URL

### 3.3 How playback URLs are obtained

Status: IMPLEMENTED on the server, not yet wired into Android/web playback clients

Evidence:

- `src/app/api/v1/playback/route.ts` resolves episodes and short films to a server-signed Mux playback URL
- the helper keeps the signed playback URL server-only and does not expose provider IDs to the client
- Android/web playback clients are still not wired to consume the new endpoint

### 3.4 Signed/private URLs

Status: PARTIALLY IMPLEMENTED

Evidence found:

- a server-only RS256 Mux playback signer now exists in `src/lib/mux/index.ts`
- token handling still does not exist in the player code for signed playback URLs

### 3.5 CDN / storage integration

Status: UNKNOWN / NOT FOUND

Evidence found:

- `public/` and Supabase schema suggest content metadata but not a real streaming/CDN integration
- no storage bucket configuration for video playback was found in the repo

---

## 3.6 Production media provider decision

Status: PARTIALLY IMPLEMENTED

Decision recorded from the current repo slice:

- Production video upload/transcoding/HLS/CDN provider: Mux
- Playback policy for production video: signed
- Artwork/posters/thumbnails: Supabase Storage (`content-artwork`, public read, server-controlled writes)
- Subtitle source files: private Supabase Storage (`content-subtitles`, server-controlled writes/reads)
- Android playback library: `expo-video` preserved
- CMS/admin upload UI: still missing
- Production integration: partial until upload creation, webhook processing, and signed playback delivery are all proven end to end

---

## 4. Playback lifecycle

### 4.1 Android / Expo lifecycle

Status: IMPLEMENTED

Evidence:

- `apps/android/src/player/usePlaybackController.ts`

Implemented behaviors:

- load: `useVideoPlayer(source, ...)` then `sourceLoad` event sets duration and subtitle tracks
- buffering: `status === "loading"` is tracked as `isBuffering`
- play: `player.play()`
- pause: `player.pause()`
- seek: `player.seekBy(seconds)` and `player.currentTime = nextTime`
- completion: `playToEnd` event calls `onEnded?.({ context })`
- replay: `player.replay()`
- cleanup/unmount: `useEffect(() => () => { isMountedRef.current = false; }, [])` and AppState pause handling

### 4.2 Web lifecycle

Status: PARTIALLY IMPLEMENTED

Evidence:

- `src/components/player/VerticalPlayer.tsx`

Implemented behaviors:

- load: initial state and `durationSeconds` from route params
- play / pause: boolean timer `isPlaying`
- seek: no actual seek API; only progress state increments
- completion: `isComplete` when progress >= 100, then `EpisodeComplete` overlay appears
- replay: no actual media replay path found
- cleanup/unmount: pagehide / beforeunload save hook

Important caveat:

- This is UI-only state simulation rather than a real media lifecycle.

---

## 5. Progress / Continue Watching

### 5.1 Database and API support

Status: IMPLEMENTED

Evidence:

- `supabase/001_profiles_watch_progress.sql`
- `src/lib/watch-progress.ts`
- `src/app/api/v1/watch-progress/route.ts`
- `src/lib/api/auth.ts`

The database includes:

- `watch_progress`
- `(user_id, series_slug, episode_number)` unique constraint
- `position_seconds`, `duration_seconds`, `completed`, `last_watched_at`

### 5.2 Update frequency and persistence

Web:

- `saveWatchProgress()` is called when progress delta reaches ~15s while playing.
- `markEpisodeCompleted()` writes completed state when near the end.
- `pagehide` and `beforeunload` final save are used.

Android:

- `useWatchProgressSync.ts` syncs every 5s while playing.
- `saveFinal` is invoked on end-of-stream.
- `saveNow` is used on blur / pause / app background transitions.
- The API route used is `PUT /api/v1/watch-progress`.

### 5.3 Resume logic

Status: IMPLEMENTED

Evidence:

- `src/lib/watch-progress.ts`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- `apps/android/src/player/PlayerScreen.tsx`

Behavior:

- `getResumePositionSeconds(progress, fallback, durationSeconds)` returns saved position when valid.
- If `progress.completed` or position is almost at the end, it resets to 0.
- On Android, `savedProgress` is passed into the player and the resume position is applied once after source load.

### 5.4 Completion logic

Status: IMPLEMENTED for persisted progress; MISSING for real media completion events on web

Evidence:

- `saveWatchProgress(..., completed: true)`
- `markEpisodeCompleted()`
- `playToEnd` event in Android player

---

## 6. Episode playback

### 6.1 Episode selection and route resolution

Status: IMPLEMENTED

Evidence:

- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- `src/lib/catalog.ts`
- `src/lib/entitlements.ts`

Behavior:

- Route resolves series and episode by slug and episode number.
- It checks if user can watch the episode using `canUserWatchEpisode()`.
- If not allowed, it renders `LockedEpisode` instead of playback.

### 6.2 Access / entitlement check before playback

Status: IMPLEMENTED

Evidence:

- `src/lib/entitlements.ts`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`

Checks include:

- episode `is_free`
- active subscription
- valid episode entitlement
- guest access denial for paid content

### 6.3 Next episode logic

Status: IMPLEMENTED (sequential-only by design)

Evidence:

- `apps/android/src/screens/WatchScreen.tsx` (`buildSeriesEpisodeContext`)
- `apps/android/src/player/PlayerScreen.tsx`
- `src/components/player/EpisodeComplete.tsx`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`

Behavior:

- `buildSeriesEpisodeContext` only ever looks for "current episode number + 1"
  in the already-fetched (published-only) episode list; it never searches
  ahead for the next *published* episode. A later published episode is
  therefore never silently skipped — this is an intentional continuity rule,
  not a gap.
- If "current number + 1" is not published, `nextEpisode` is `undefined`.
  `episodeCount` (the series' total planned count) distinguishes an
  unreleased-but-planned next episode from a genuine series finale for the
  completion-state message; neither case skips ahead.
- Android player automatically advances (seamlessly, no countdown) when
  `context.nextEpisode` exists and the source reaches `playToEnd`.
- Web route passes `nextEpisode` to `VerticalPlayer` and renders an explicit
  next-episode CTA.
- There is no real auto-next queue beyond the UI model.

### 6.4 Auto-next (Android: seamless, no countdown)

Status: IMPLEMENTED (Android) / PARTIALLY IMPLEMENTED (Web)

Evidence:

- Android `handlePlaybackEnded` (`PlayerScreen.tsx`) saves final progress,
  then — if the next sequential episode is published — calls `advanceToNext()`
  immediately (no countdown UI, no confirmation step). `advanceToNext` calls
  `onAdvanceToNext?.(context.nextEpisode)`, which in `WatchScreen.tsx`
  re-resolves that episode's existing access state and either starts it or
  opens the existing `EpisodeAccessOptions` flow — Auto-Next never bypasses
  access.
- Web overlay suggests next episode after completion (unchanged; out of
  scope for this Android-only change).

### 6.5 Episode list integration

Status: PARTIALLY IMPLEMENTED

Evidence:

- `src/lib/catalog.ts`
- `src/components/series/EpisodeList.tsx`
- `src/app/series/[slug]/page.tsx` (not inspected in full but likely exists in repo)

There is route and list data integration, but not a real playback queue with full episode switching logic in the actual media layer.

---

## 7. Locked preview

Status: MISSING

Evidence:

- `src/components/player/LockedEpisode.tsx`
- `src/lib/entitlements.ts`

Current behavior:

- The app renders a locked-content wall when a user is not entitled.
- It offers unlock / login / plans options.
- It includes a disabled button for “Watch ad to unlock.”

What is not present:

- no preview playback state
- no preview duration computation
- no preview endpoint or `locked_preview_seconds` enforcement
- no transition from preview to locked state

The product Bible expects real preview behavior for some access models; this repository has no implementation of that lifecycle.

---

## 8. Short Film playback

Status: PARTIALLY IMPLEMENTED (server auth only)

Evidence:

- `apps/android/src/player/types.ts` includes `ShortFilmPlaybackContext`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx` is episode-specific and does not implement a short-film route
- `src/app/api/v1/playback/route.ts` now authorizes signed playback for short films on the server
- no short-film page or dedicated player flow was found in the repo

Current state:

- the enum and context type exist, but no actual short-film playback screen or video source pipeline was found
- no mid-roll / post-roll ad logic was found
- no short-film reward or Chai flow is implemented in this repo

This is not a finished short-film architecture.

---

## 9. Advertising

### 9.1 Rewarded-ad code related to video

Status: MISSING

Evidence:

- `src/components/player/LockedEpisode.tsx` contains a disabled button labeled “Watch ad to unlock” with a comment:
  - “Rewarded-ad entitlements must be granted only after trusted server-side ad verification.”

No actual rewarded ad SDK, ad completion watcher, or rewarded callback flow was found.

### 9.2 Short-film mid-roll implementation

Status: MISSING

Evidence:

- no `midroll_enabled`, `midroll_timecodes`, or runtime ad scheduler found in the repo
- no short-film player with scheduled ad insertion exists

### 9.3 Short-film post-roll implementation

Status: MISSING

Evidence:

- no post-roll ad flow found in the player source
- no related completion screen with Chai / share flow exists for short films

### 9.4 Existing ad SDK / player integration

Status: MISSING / UNKNOWN / NOT FOUND

Evidence:

- no ad SDK dependency found in `package.json` or Android app dependencies
- no ad provider integration (e.g., rewarded video SDK, VAST/VPAID, ad insertion SDK) was found

### Product rule check

Micro-drama playback should not receive pre-roll/mid-roll/post-roll ads. The current repo does not implement such ad insertion for micro-dramas.

---

## 10. Subtitles

Status: PARTIALLY IMPLEMENTED

Evidence:

- `apps/android/src/player/usePlaybackController.ts` contains state for:
  - `subtitleTracks`
  - `availableSubtitleTracksChange`
  - `availableSubtitleTracks` from `expo-video`

What exists:

- subtitle metadata and track detection is supported by `expo-video`
- there is no actual subtitle file source in the repo
- no language-selection UI or persistent subtitle preference was found
- no subtitle track load or `TextTrackList` selection logic was found in app code

This means the underlying platform API is exposed, but the app does not currently implement subtitle delivery or user choice.

---

## 11. Player controls

### 11.1 Android controls

Status: PARTIALLY IMPLEMENTED

Evidence:

- `apps/android/src/player/PlayerControls.tsx`

Included controls:

- back (icon-only, top-left, ~38dp translucent circular backing, no border/ring)
- top overlay hierarchy: series title (primary) + Episode N (secondary,
  directly beneath; never "EP1"/"E01"), aligned between Back and the
  right-side icon cluster
- play / pause / replay (compact ~52dp circular icon control, bone-white
  glyph, no large CTA styling; temporarily hidden while hold-to-1.5x is
  active so it never visually stacks with the transient speed indicator)
- seek via scrub bar (thin track, teal played segment, muted remaining
  segment, small thumb at rest that enlarges while actively dragging)
- current time and duration
- buffered progress
- top/bottom scrims: a single smooth bitmap-gradient fade (no stacked
  translucent bands), darkest near the controls and fading fully transparent
  into the video; never darkens the whole frame
- Episodes (icon + quiet Title Case label, only for series episodes; the
  only persistent bottom action — no Share/Settings text or buttons at the
  bottom)
- Share and Settings gear: icon-only, top-right cluster (Settings outermost
  right, Share immediately to its left), ~38dp translucent circular backing,
  equal visual weight, `hitSlop` keeping the effective tap target ~48dp;
  Share uses the standard Android three-node glyph, handler/payload
  unchanged; Settings opens the "Playback settings" sheet
- Playback settings sheet: playback speed (0.75x–2x, persisted), quality
  (read-only "Auto" / "Adaptive streaming"), captions (only shown when the
  active source actually has subtitle tracks; opens the existing subtitle
  track picker)
- temporary hold-to-1.5x: press-and-hold the right-side video zone
  temporarily sets 1.5x playback (skipped if the persistent speed is already
  >= 1.5x, to avoid unexpectedly slowing playback down); a small transient
  "1.5x" indicator appears away from the center and the top-right icons;
  releasing restores the viewer's persistent speed without overwriting it

Not implemented in repo code:

- manual quality/rendition selection (installed `expo-video` exposes
  `availableVideoTracks` but no proven JS setter for manual rendition choice;
  playback remains Auto ABR)
- fullscreen / orientation switch
- animated auto-hide/show fade for the control overlay (still an immediate
  show/hide; not attempted because it required changing the mount lifecycle
  shared with the tap-to-reveal touch layer, which risked the locked V01
  gesture architecture)

### 11.2 Web controls

Status: PARTIALLY IMPLEMENTED

Evidence:

- `src/components/player/PlayerControls.tsx`

Included controls:

- back
- play/pause
- mute
- fullscreen placeholder button
- next episode link
- progress bar

Not implemented:

- real seek scrubbing
- subtitle selection
- quality selection
- true fullscreen media mode

---

## 12. Quality / streaming

APPROVED POLICY (server-enforced):

- Guest / non-Plus ceiling: max 720p
- 0nya Plus ceiling: max 1440p / 2K
- 4K is not part of current MVP scope
- ceilings are maximums only; actual source rendition availability still wins

CURRENT IMPLEMENTATION STATUS:

- tier-based resolution ceiling enforcement: IMPLEMENTED server-side. Both
  `/api/v1/playback` and `/api/v1/playback/preview` resolve the viewer's
  trusted maximum resolution via `resolvePlaybackMaxResolution` in
  `src/lib/entitlements.ts` (guest/free → `"720p"`, active 0nya Plus →
  `"1440p"`, fails closed to `"720p"` if subscription state cannot be proven
  active) and pass it into `createMuxSignedPlaybackUrl` in
  `src/lib/mux/index.ts`, which embeds it as the `max_resolution` claim
  inside the signed Mux playback JWT (never appended unsigned, never accepted
  from the Android client). Coin/rewarded/free episode access remains fully
  independent of this quality ceiling: a coin-unlocked episode for a
  non-Plus viewer still resolves to 720p.
- manual rendition selection: MISSING (unchanged). Installed `expo-video`
  exposes `availableVideoTracks`/`videoTrack` for read-only inspection, but
  no proven JS setter for manual rendition selection was found. This remains
  out of MVP scope by design.
- current playback behavior: Auto ABR for all viewers, within the resolved
  ceiling.
- Android surfaces this truthfully: the Playback settings sheet
  (`PlayerMoreSheet.tsx`) shows "Quality: Auto" with a static "Adaptive
  streaming" note, unchanged by this work. It does not display a
  detected-rendition diagnostic, does not claim a specific ceiling, and does
  not present selectable rendition buttons.
- development fallback: the `__DEV__` ImageKit source in
  `apps/android/src/player/devSources.ts` remains a public/unsigned URL and
  is explicitly NOT part of secure tier enforcement; production signed Mux
  playback is the authoritative V02 enforcement path.
- 1440p asset availability: not proven for all current content. If an asset
  only contains renditions up to 1080p, an active Plus viewer receives the
  highest available rendition below the 1440p ceiling; this is expected,
  correct behavior for a maximum-only ceiling, not a bug.
- 1440p ingest configuration: the dev/operator-only direct-upload helper
  (`createMuxDirectUpload` in `src/lib/mux/index.ts`) now requests
  `max_resolution_tier: "1440p"` for future assets it creates, and the
  dev/operator reconciliation response surfaces the resulting `resolution_tier`
  / `max_resolution_tier` diagnostically. This does not manufacture 1440p
  detail from a lower-resolution source, does not affect existing assets, and
  is not a production CMS ingest path — a real production ingest route is
  still missing and remains a separate, unbuilt track.

Evidence:

- Android `devSources.ts` uses a single HLS source
- `useCaching: false` is set in the development source object
- no bitrate adaptation layer or quality-switch logic exists in the repo
- no ABR / manifest-switching strategy found
- no preload or caching policy beyond the dev source flag

---

## 13. Error handling

### 13.1 Android

Status: PARTIALLY IMPLEMENTED

Evidence:

- `usePlaybackController.ts` tracks `error` from `statusChange`
- `retry()` reissues `player.replaceAsync(source)` and optionally resumes playback

Behavior:

- network / invalid playback errors are captured in `PlayerError`
- retry flow exists
- no dedicated user-facing recovery screen or timestamp-recovery flow was found

### 13.2 Web

Status: PARTIALLY IMPLEMENTED

Evidence:

- no explicit error state or retry UI in the web player path
- no playback-failure fallback view found

### 13.3 Recovery from timestamp / resume error

Status: PARTIALLY IMPLEMENTED

Evidence:

- `getResumePositionSeconds()` handles saved progress and fallback values
- no robust recovery or timestamp repair logic was found beyond resume clamping

---

## 14. Analytics

Status: MISSING / UNKNOWN / NOT FOUND

Evidence:

- no playback analytics event names or event emitter code were found in the repo
- no segment for `play`, `pause`, `progress`, `completion`, `buffering`, or `error` was found in app or server code
- no existing analytics provider integration for media events was found

---

## 15. Security

### 15.1 Playback URL protection

Status: MISSING

Evidence:

- no signed URL implementation
- no tokenized playback pipeline
- no secure media access helper or backend route for playback authorization

### 15.2 Entitlement checks

Status: IMPLEMENTED at server/app gate level

Evidence:

- `src/lib/entitlements.ts`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- Supabase `episode_entitlements` and `subscriptions`

This prevents unauthorized playback at app route level based on entitlement state. However, it does not prove a secure signed-streaming pipeline.

### 15.3 Server-side authorization

Status: PARTIALLY IMPLEMENTED

Evidence:

- `canUserWatchEpisode()` checks user auth + entitlement before rendering the player
- watch progress route validates auth and writes progress for the signed-in user

This is a product access gate, not a fully secure streaming token system.

---

## 16. Capability status summary

| Capability | Status |
| --- | --- |
| Web player exists | PARTIALLY IMPLEMENTED |
| Android Expo player exists | PARTIALLY IMPLEMENTED |
| Shared playback access logic exists | IMPLEMENTED |
| HLS support exists | IMPLEMENTED (dev source only) |
| MP4/direct URL support | UNKNOWN / NOT FOUND |
| Signed/private playback URLs | MISSING |
| CDN/storage integration | UNKNOWN / NOT FOUND |
| Playback lifecycle methods | PARTIALLY IMPLEMENTED |
| Resume / continue watching | IMPLEMENTED |
| Auto-next | PARTIALLY IMPLEMENTED |
| Locked preview | PARTIALLY IMPLEMENTED (backend foundation only) |
| Short-film playback | MISSING |
| Rewarded-ad unlock flow | MISSING |
| Mid-roll ad insertion | MISSING |
| Post-roll ad insertion | MISSING |
| Subtitle support | PARTIALLY IMPLEMENTED |
| Quality selection | MISSING |
| Error retry logic | PARTIALLY IMPLEMENTED |
| Playback analytics | MISSING |
| Secure signed streaming | MISSING |

---

## BUILD 15 VIDEO GAPS

This section compares the implemented player architecture to the Product Bible v3.0, the Master User Flow v1.1, and the all-screen wireframes.

### Gap 1 — Real micro-drama player instead of simulated web player

- Existing behavior: `VerticalPlayer.tsx` is UI-only and simulates progress using timers; it does not use a real video element or streaming engine.
- Required behavior: A real 9:16 micro-drama player should manage actual media playback, buffering, seek, and completion without fake timer-based progress.
- Affected files: `src/components/player/VerticalPlayer.tsx`, `src/components/player/PlayerControls.tsx`, `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- Scope: Web / Shared
- Severity: Critical

### Gap 2 — Android Expo player is development-only, not production media pipeline

- Existing behavior: `apps/android/src/player/devSources.ts` hardcodes HLS dev URLs and passes them through `expo-video`.
- Required behavior: Production episode playback must come from backend/CMS-controlled URLs or signed media endpoints; the app must not be pinned to static dev streams.
- Affected files: `apps/android/src/player/devSources.ts`, `apps/android/src/player/usePlaybackController.ts`, `apps/android/src/player/PlayerScreen.tsx`
- Scope: Android / Backend
- Severity: Critical

### Gap 3 — No signed or private URL protection

- Existing behavior: No secure media URL generation or token mechanism was found.
- Required behavior: Playback URLs should be authorized server-side and protected by URL expiry / token / entitlement checks.
- Affected files: none found; no playback URL helper exists in `src/lib/**` or Android source
- Scope: Backend / Shared / Android
- Severity: Critical

### Gap 4 — Locked preview backend exists, client presentation still missing

- Existing behavior: the backend can provision and authorize secure preview clip assets, but `LockedEpisode.tsx` still does not render a real preview playback experience.
- Required behavior: preview playback should be allowed for configured episodes, with a preview timer and state handoff after completion.
- Affected files: `src/components/player/LockedEpisode.tsx`, `src/lib/entitlements.ts`
- Scope: Web / Shared / Backend
- Severity: High

### Gap 5 — No short-film playback flow

- Existing behavior: `ShortFilmPlaybackContext` exists in types, but no actual short-film screen or film player is implemented.
- Required behavior: short films must have their own detail -> play flow with CMS-controlled ad insertion only for non-Plus users.
- Affected files: `apps/android/src/player/types.ts`, no implemented short-film player files found
- Scope: Web / Android / Shared
- Severity: Critical

### Gap 6 — No mid-roll / post-roll ad infrastructure

- Existing behavior: no ad scheduler, ad break logic, or video ad insertion code exists.
- Required behavior: short film playback must support CMS-defined mid-rolls and post-rolls only for non-Plus users, with no micro-drama ad insertion.
- Affected files: no relevant files found in `src/**` or `apps/android/src/**`
- Scope: Web / Android / Backend
- Severity: Critical

### Gap 7 — No rewarded-ad unlock flow in actual video path

- Existing behavior: disabled button labeled “Watch ad to unlock” in the lock screen.
- Required behavior: rewarded ad unlock must be explicit, user-initiated, verified completion-based, and server-authorized.
- Affected files: `src/components/player/LockedEpisode.tsx`
- Scope: Web / Shared / Backend
- Severity: Critical

### Gap 8 — Subtitle content not yet uploaded for existing episodes (RESOLVED: client support; OPEN: media has no tracks)

- Existing behavior: `expo-video` subtitle track selection, persistence (`apps/android/src/lib/subtitles.ts`), and UI (`SubtitleTrackSheet.tsx`) are implemented and reachable via a "Captions" row inside the Playback settings sheet (only rendered when the active source actually reports tracks). The DB has subtitle-track foundation infra (`subtitle_tracks` table), but no code path calls `createMuxSubtitleTextTrack` to attach a track to any existing episode, so current media (including Aadha Takiya) has no proven subtitle track.
- Required behavior: once subtitle files exist for an episode/short film, they should load, selection should persist, and the app should support language switching. This behavior is already implemented; it only needs real subtitle content.
- Affected files: `apps/android/src/lib/subtitles.ts`, `apps/android/src/player/usePlaybackController.ts`, `apps/android/src/player/PlayerScreen.tsx`, `apps/android/src/player/PlayerMoreSheet.tsx`
- Scope: Android / Content
- Severity: Low (client implemented; content pipeline gap only)

### Gap 9 — Manual rendition selection not implemented (tier-based ceiling now enforced)

- Existing behavior: playback is Auto ABR for every viewer tier, now within a server-enforced maximum: guest/non-Plus 720p, active 0nya Plus 1440p/2K (real source rendition still wins). Playback speed (0.75x–2x) is implemented and persisted via the Playback settings sheet. Quality is presented truthfully as read-only "Auto" / "Adaptive streaming"; no selectable rendition buttons and no technical rendition diagnostics exist because installed `expo-video` has no proven JS setter for manual rendition choice. Both `/api/v1/playback` and `/api/v1/playback/preview` now resolve the ceiling via `resolvePlaybackMaxResolution` and embed it in the Mux signed-URL `max_resolution` claim.
- Remaining gap: manual rendition selection is intentionally out of MVP scope. 1440p rendition availability is asset-dependent and not yet proven for all current content; the development ImageKit fallback remains public/unsigned and does not securely enforce any ceiling.
- Affected files: `apps/android/src/player/PlayerMoreSheet.tsx`, `src/app/api/v1/playback/route.ts`, `src/app/api/v1/playback/preview/route.ts`, `src/lib/entitlements.ts`, `src/lib/mux/index.ts`
- Scope: Backend (implemented) / Media (asset-dependent, deferred)
- Severity: Low

### Gap 10 — No analytics events for player lifecycle

- Existing behavior: no playback event tracking found.
- Required behavior: play, pause, progress, buffering, completion, and error analytics are required for product QA and measurement.
- Affected files: none found in app or server code
- Scope: Web / Android / Shared
- Severity: Medium

### Gap 11 — No full player control parity with the wireframes

- Existing behavior: Android now has an icon-based control surface (back, play/pause/replay, Episodes, Settings gear, Share), a compact Playback settings sheet (speed, quality, captions), and a temporary hold-to-1.5x gesture; the remaining parity gap is manual quality selection (not implementable with proven APIs today), fullscreen/orientation handling, and an animated auto-hide fade (left as immediate show/hide to avoid touching the locked touch-layer architecture). Web player control parity remains unchanged.
- Required behavior: player controls should match the product and wireframe list for micro-drama playback.
- Affected files: `src/components/player/PlayerControls.tsx`, `apps/android/src/player/PlayerControls.tsx`
- Scope: Web / Android
- Severity: Medium

### Gap 12 — No real network / playback failure recovery UI

- Existing behavior: `retry()` exists on Android, but no user-facing error/retry screen is connected to the player flow.
- Required behavior: playback errors should surface recoverability states and allow retry or route back to a safe state.
- Affected files: `apps/android/src/player/usePlaybackController.ts`, `src/components/player/VerticalPlayer.tsx`
- Scope: Android / Web
- Severity: Medium

### Gap 13 — No real watch-progress integration for actual media playback in web

- Existing behavior: the web player is a simulated timer, so progress is derived from JS state rather than true media events.
- Required behavior: actual media playback timestamps should be read from a real media element and persisted at product-safe thresholds.
- Affected files: `src/components/player/VerticalPlayer.tsx`, `src/lib/watch-progress.ts`
- Scope: Web / Shared
- Severity: High

### Gap 14 — No deep-link / player restore contract beyond basic resume

- Existing behavior: resume is persisted, but no deep-link / player recovery flow with route restoration is implemented.
- Required behavior: the app must restore playback state reliably after OTP, subscriptions, wallet flows, and app interruptions.
- Affected files: `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`, `apps/android/src/player/useWatchProgressSync.ts`
- Scope: Web / Android / Shared
- Severity: Medium

### Gap 15 — Product Bible rule: no interruptive micro-drama ads

- Existing behavior: no ad starts or ad insertion logic is present in the codebase for micro-dramas.
- Required behavior: micro-drama playback must remain ad-free, with only episode access logic and resume handling.
- Affected files: none found implementing micro-drama ads
- Scope: Web / Android / Backend
- Severity: Critical

---

## Final conclusion

The repository contains a meaningful playback foundation, but it is not a complete production-grade video architecture. The implemented system is best described as a partial, development-stage player shell with access control and hydrated watch-progress logic.

The most important repository reality is this:

- The repo has real access logic and watch-progress persistence.
- The repo has a development HLS player on Android using `expo-video`.
- The repo has a custom web progress model that is not a true media player.
- The repo does not yet implement production video delivery, signed playback URLs, short-film ads, rewarded ads, or the full product-Bible playback contract.

This should be treated as a working foundation to extend, not as a completed build-ready video platform.
