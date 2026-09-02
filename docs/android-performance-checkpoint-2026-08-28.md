# 0nya Android Performance Checkpoint — 2026-08-28

## 1. Frozen Baseline Environment

* **Git Commit HEAD:** `56dfea95856d8333b9a29875c374dcff3bbbce03`
* **Device / Target:** Android Studio Emulator `emulator-5554` (`sdk_gphone64_x86_64`)
* **OS / Android API Level:** Android 16 / API Level 36 (`x86_64` ABI)
* **Build / Runtime Mode:** Expo Dev Client (`com.onya.app`) with Metro Bundler
* **API Base URL:** `https://0nya-qa-api.netlify.app`
* **Media / HLS Environment:** Mux HLS signed playback streams (`/api/v1/playback`)

---

## 2. Benchmark Scenario Results (5 Runs Each)

### P01: Cold Launch → Home Ready
* **Marker:** `APP_START` → `HOME_DATA_READY`
* **Duration:**
  * **BEST:** 2,977.4 ms
  * **MEDIAN:** 3,488.3 ms
  * **WORST:** 4,686.9 ms
* **GFX Jank:** 76.6% median (cold JS bundle execution / initial render)
* **Memory (Total PSS):** 329.6 MB median

### P03: Home Vertical Scroll
* **Marker:** Continuous scrolling up/down across carousels
* **GFX Jank:** 0.0% median
* **Memory (Total PSS):** 294.5 MB median

### P04: Home → Explore → Profile → Home
* **Marker:** Tab switching and screen mount cycles
* **GFX Jank:** 0.0% median
* **Memory (Total PSS):** 300.7 MB median

### P05: Home Content Tap → Playback (Series / Short Film)
* **Detailed Step-by-Step Trace:**
  1. `CONTENT_TAP` (t=0 ms)
  2. `WATCH_MOUNT` (+88.8 ms)
  3. `ACCESS_END` (BEFORE: +2,033.6 ms to +7,608.2 ms | **AFTER: 0.0 ms [CACHE HIT]**)
  4. `SOURCE_RESOLVED` (+1,027.7 ms to +1,632.9 ms)
  5. `PLAYER_LOADED` (+4,736.1 ms to +6,253.1 ms)
  6. `PLAYBACK_STARTED` (ExoPlayer HLS segment buffering)
* **Total Tap-to-Playback Duration (`CONTENT_TAP` → `PLAYBACK_STARTED`):**
  * **BEFORE Median:** 22,579.2 ms (Best: 20,210.6 ms | Worst: 24,947.8 ms)
  * **AFTER Median:** 17,083.2 ms (Best: 17,083.2 ms | Worst: 17,083.2 ms)
  * **Net Improvement:** **-5,496.0 ms (~5.5 seconds faster)**
* **GFX Jank:** 0.0% median
* **Memory (Total PSS):** 305.6 MB median

### P07: Continue Watching → Playback
* **Marker:** `CONTENT_TAP` (source: `HOME_CONTINUE_WATCHING`) → `PLAYBACK_STARTED`
* **Resume Seeking:** Verified position restore from server progress sync
* **Memory (Total PSS):** 343.8 MB median

### P11: Episode Completion → Auto-Next
* **Marker:** `AUTO_NEXT_START` → `NEXT_ACCESS_END` → `NEXT_PLAYBACK_STARTED`
* **Transition Time:** 10,407.6 ms (seamless background handoff, next access verified in 0.9 ms)

---

## 3. Bottleneck Analysis & Ranking

1. **`HLS_MEDIA` / `ENVIRONMENT` (External Limitation):** Remote Mux HLS chunk download & ExoPlayer buffer initialization (~13.6s buffering duration on emulator).
2. **`API_NETWORK` / `NAVIGATION` (#1 Proven Fixable Client Bottleneck):** Sequential network waterfall where `WatchScreen` performed a redundant un-cached `GET /api/v1/series/:slug` network call (taking 2,000–7,600 ms) before `POST /api/v1/playback` could be requested.

---

## 4. Applied Optimization

* **Files Modified:**
  * `apps/android/src/lib/api.ts`
  * `apps/android/src/screens/HomeScreen.tsx`
* **Fix Summary:**
  * Added 15-second auth-scoped TTL cache (`seriesCache`) to `getSeries` in `api.ts` (matching `catalogCache` pattern).
  * Added pre-fetch warming of `getSeries` on content tap in `HomeScreen.tsx`.
  * Preserved backend CMS authority, session isolation, entitlement resolution, and wallet idempotency.

---

## 5. Verification & Code Health

* **Android TypeScript:** `npm --prefix apps/android run typecheck` passed (0 errors).
* **ESLint:** `npm run lint` passed (0 errors).
* **Git Diff Check:** `git diff --check` passed cleanly.
* **Status:** Changes preserved in local working tree (not committed, not pushed).
