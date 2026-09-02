---
name: 0nya-qa-device
description: Use for verification, Android physical-device testing, emulator testing, ADB, Logcat, screenshots, regression checks, lint, typecheck, builds, and release hardening.
---

# 0nya QA and Device Verification

Load `0nya-execution`.

Verification is evidence-driven.

## Static checks

Use relevant checks:

- `git diff`
- `git diff --check`
- typecheck
- lint
- targeted tests
- relevant build

Do not repeatedly rerun already-successful checks without reason.

## Android

Where applicable:

1. verify device
2. verify intended build
3. reproduce exact scenario
4. capture relevant UI state
5. inspect filtered logs
6. distinguish app errors from OS/OEM noise

## Logs

Avoid giant output.

Prefer:

- process filter
- tag filter
- exact pattern search
- bounded time window
- tail/head
- Select-String/grep

## Screenshots

QA artifacts should not pollute tracked source unless repository conventions
explicitly specify otherwise.

## Verdict

Return:

```
PASS
PARTIAL
BLOCKED
```

State exactly:

- what was tested
- how
- physical-device evidence
- what remains unverified

## Physical Android QA device

Physical device testing is governed by the **Locked Final Acceptance Protocol** in `AGENTS.md`. The OnePlus physical check is the final real-hardware validation gate AFTER emulator screenshot review and approval by Product Owner + ChatGPT. It verifies touch, real dimensions/safe-areas, navigation, playback, and network on real hardware—it is NOT the visual refinement iteration environment.

Preferred final physical acceptance device:

- OnePlus 13R, model `CPH2691`
- Preferred USB serial when available: `b94e2903`
- Wireless ADB only when evidence proves it is the same physical device.

Do not assume a device from an old session is still connected. Every testing
session must re-prove the device target.

## Mandatory physical device timebox rule

Every physical-device test uses bounded waits to prevent indefinite waiting,
blind polling, infinite retry loops, random tapping, stale state assumptions,
false PASS results, and excessive time on one operation.

A timeout means: stop that action, inspect available evidence, report
TIMEOUT / BLOCKED / UNKNOWN. Do NOT silently extend a timeout.

### Default physical test timeboxes

- ADB device discovery: 30s maximum. PASS requires the intended physical
  device in usable `device` state. Otherwise `DEVICE TIMEOUT`.
- Metro health check: 30s maximum to prove the intended Metro session is
  healthy/reachable. Otherwise `METRO TIMEOUT`. Do not repeatedly restart
  Metro without explicit troubleshooting approval.
- App launch: 45s maximum from the intentional force-stop/launch action. PASS
  requires expected app/activity foreground and stable usable state.
  Otherwise `LAUNCH TIMEOUT`; capture available evidence and bounded Logcat.
- Normal screen load (Home/Explore/Profile/Series Detail/Short Film
  Detail/Wallet/Settings/Plus/Paywall): 30s maximum for stable expected UI.
  Otherwise `SCREEN LOAD TIMEOUT`. Do not keep tapping randomly.
- Navigation action: 15s per requested navigation action; PASS requires the
  destination to actually appear. Otherwise `NAVIGATION TIMEOUT`. Never infer
  success from the tap itself.
- API-dependent content load: 30s per requested action unless the user
  explicitly authorizes longer. If still loading record the requested action,
  endpoint if known, visible UI state, relevant bounded log/error, elapsed
  time; report TIMEOUT / BLOCKED.
- Playback start: 30s after explicit Play/Watch action. PASS requires
  observable playback (video visibly progressing, playback position changing,
  expo-video runtime state, relevant bounded playback logs). A player screen
  merely opening is NOT playback PASS. Otherwise `PLAYBACK START TIMEOUT`.
- Rewarded ad: never wait indefinitely for an external ad. Use only the
  existing supported QA/development rewarded-ad integration. If it does not
  reach the expected state within its supported bounded timeout: `AD TIMEOUT`
  or `INTEGRATION BLOCKED`. Never fake ad completion, reward callback, or
  episode entitlement.
- Build/install: every native build/install test specifies a task-appropriate
  timeout before starting. Do not repeatedly retry a native build after a
  proven OOM, environment failure, Gradle configuration failure, or missing
  dependency/toolchain without changing approach or troubleshooting approval.

## Timeboxes are failure ceilings

TIMEBOX != PERFORMANCE TARGET. An operation completing inside the ceiling may
still be a severe performance failure (e.g. Home at 29s within a 30s ceiling).
When performance is under test, record both actual elapsed time and the
timeout verdict, plus a separate performance verdict. Never report
"PASS performance" merely because the operation finished before timeout.

## Anti-loop rule

For a single physical QA action:

```
1 requested action
→ 1 bounded wait
→ inspect evidence
→ PASS / FAIL / TIMEOUT
```

Do NOT automatically perform repeated retries, restart Metro, restart the
app repeatedly, reinstall the app, or use random navigation/taps unless
troubleshooting is explicitly part of the requested task. Automatic/repeated
retries must not be hidden from the final report.

## No-hallucination device rule

A physical Android result is PASS only from observable evidence:

- Device PASS: intended ADB target proven.
- Launch PASS: target application/activity foreground and stable.
- Screen PASS: expected screen visibly rendered.
- Navigation PASS: actual destination rendered.
- Playback PASS: actual playback/progress evidence.
- API PASS: runtime/API evidence relevant to the tested operation.

If a device disconnects, Metro becomes unavailable, an app process
disappears, test state becomes uncertain, a timer expires, or evidence is
lost: use UNKNOWN / NOT PROVEN, TIMEOUT, or BLOCKED as appropriate.
Never write "probably passed", "should have worked", or "likely succeeded"
as verification.

## Physical build identity

Before final physical-device acceptance, prove the installed/running build
corresponds to the intended source under test. Record where possible:

- git HEAD, branch, dirty working tree: YES / NO
- Android application/package identity
- physical device model, ADB serial
- build type, build/install method

A successful test on an unknown or stale APK must not be reported as current
source acceptance. If build identity cannot be proven:

```
CURRENT-SOURCE DEVICE ACCEPTANCE:
UNKNOWN / NOT PROVEN
```

even if the old installed APK appears to work.

## Screenshot acceptance rule

For visual acceptance: capture screenshots only after stable UI; identify the
physical device; identify whether the capture is physical-device or emulator;
record the relevant screen; do not claim invisible/unverified visual
behavior. Final Android visual acceptance requires physical-device evidence
when the task calls for final device acceptance. An emulator screenshot alone
does not establish final physical-device visual acceptance.

## Logging discipline

Do not flood context with entire Logcat streams. Prefer process filtering,
tag filtering, exact error searches, bounded timestamps, tail/head,
grep/Select-String. Capture only logs relevant to the requested test. Never
expose secrets, OTPs, access tokens, or raw purchase credentials in logs or
reports.

## Mandatory physical device timer report

Every final report containing physical-device testing must include:

```
PHYSICAL DEVICE TIMER REPORT

1. Device detection
   elapsed: Xs
   result: PASS / TIMEOUT

2. Metro health
   elapsed: Xs
   result: PASS / TIMEOUT / N/A

3. App launch
   elapsed: Xs
   result: PASS / TIMEOUT / N/A

4. Target screen load
   elapsed: Xs
   result: PASS / TIMEOUT / N/A

5. Navigation actions
   slowest observed: Xs
   result: PASS / TIMEOUT / N/A

6. Playback start
   elapsed: Xs
   result: PASS / TIMEOUT / N/A

7. API/content wait
   longest observed: Xs
   result: PASS / TIMEOUT / N/A

8. Test exceeded any timebox
   YES / NO

9. Automatic/repeated retries performed
   YES / NO

10. Physical device
    model:
    serial:

11. Build identity
    HEAD:
    branch:
    dirty working tree:
    build/install method:

12. Current-source acceptance proven
    YES / NO / UNKNOWN
```

If item 9 is YES, explain exactly why the retry occurred and whether the user
had authorized troubleshooting.