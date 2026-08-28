# 0nya Android Performance Rig

Development-only markers are emitted as `[0NYA_PERF]` lines from the Expo app.
Set a run ID before launching the app:

```bash
EXPO_PUBLIC_ONYA_PERF_RUN_ID=P05-001 npm run android --workspace apps/android
```

In a debugger console you can also set:

```js
globalThis.__0NYA_PERF_RUN_ID__ = "P05-001";
```

If no run ID is supplied, the app generates a temporary `DEV-*` ID.

## Scenario IDs

- P01 Cold launch -> Home ready
- P02 Warm launch -> Home ready
- P03 Home vertical scroll
- P04 Home -> Explore -> Profile -> Home
- P05 Home content tap -> playback
- P06 Explore/Search result -> playback
- P07 Continue Watching -> resumed playback
- P08 Player controls show/hide
- P09 Seek
- P10 Background -> foreground
- P11 Episode completion -> auto-next
- P12 Playback failure/retry

## Capture

The Android package is read from `apps/android/app.json` and is currently `com.onya.app`.

```bash
node scripts/android-perf-capture.mjs --run P05-001 --duration 90 --reset-gfxinfo
```

Optional device selector:

```bash
node scripts/android-perf-capture.mjs --run P05-001 --serial emulator-5554 --duration 90
```

Outputs:

```text
perf/P05-001/devices.txt
perf/P05-001/logcat.txt
perf/P05-001/gfxinfo.txt
perf/P05-001/meminfo.txt
perf/P05-001/manifest.json
```

Summarize one captured log:

```bash
node scripts/android-perf-summary.mjs --log perf/P05-001/logcat.txt
```

The summary reports missing event pairs as `NOT CAPTURED`. For five-run
baselines, report BEST, MEDIAN, and WORST only. Do not report p95 from five
samples.

## Event Notes

`PLAYBACK_STARTED` is based on expo-video `playingChange` and is the closest
reliable playback-start marker currently exposed by the existing player. The
rig intentionally does not emit `FIRST_FRAME`.

API markers redact headers, bodies, access tokens, refresh tokens, OTP values,
phone numbers, purchase receipts, and signed playback URLs. API paths omit query
strings.

## Initial Emulator Baseline

Run the same capture format for:

```text
P01 x 5
P03 x 5
P04 x 5
P05 x 5
P07 x 5
P11 x 5
```

Use a consistent emulator, API base URL, HLS/media environment, account state,
and app build for the whole baseline.

## Physical Phone Handoff

The rig is ready for physical-device testing after the emulator baseline is
clean. Use the same scenario IDs and capture format.

Prerequisites:

- Android phone
- Developer Options enabled
- USB Debugging enabled
- reliable USB cable
- phone unlocked
- computer authorized for USB debugging
- `adb devices` shows the phone as `device`
- current test build installed and runnable
- same API/HLS environment documented
