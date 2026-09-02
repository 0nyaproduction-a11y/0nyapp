# 0nya Release Current State

Snapshot from repository evidence. Verify against the current working tree —
do not convert an old passing check into a claim about the current tree.
Status vocabulary: COMPLETE / PARTIAL / PENDING / BLOCKED / UNVERIFIED.

## Approved QA infrastructure — 31 August 2026

Explicit user-approved project decision.

- Approved QA API: `https://onya-qa-api-gwkke6nq5a-el.a.run.app`
- Approved QA CMS: `https://onya-qa-api-gwkke6nq5a-el.a.run.app/admin/login`
- Cloud Run: QA backend/API + CMS/admin hosting
- Netlify: website / frontend / domain hosting only (not the QA API/backend/CMS)
- Supabase: database / data layer
- Mux: approved video/media infrastructure
- Android playback: expo-video (preserve)

Approved date:
31 August 2026

Evidence class:
EXPLICIT PROJECT / EXTERNAL STATE

These deployment facts are an explicit project decision, NOT Git-proven
implementation state. Provider/hosting approval does not imply that signed
playback authorization, production media pipeline, every API route, RLS, or
release readiness is IMPLEMENTED. Verify each separately with the status
vocabulary.

Do not direct Android QA calls to an old Netlify QA API address or to
localhost Supabase.

## Current branch / repository status

- Branch at snapshot: `qa/netlify-api-e34ab5e`.
- Working tree has a large set of uncommitted changes (modified + untracked
  files). Highlights: Home spotlight phase (migrations 023/026, `src/lib/home.ts`,
  `src/lib/cms/home.ts`, `src/app/admin/home/page.tsx`), rewarded
  multi-completion (migration 027, `src/lib/rewarded-*.ts` + tests,
  `monetization` events route), CMS password-recovery finalization, Android
  Home/Explore/tokens/api-types work, docs contract revisions
  (`0nya_BACKEND_API_CONTRACT_v1.0.md`, `0nya_CMS_PRODUCT_CONTRACT_v1.0.md`,
  etc.), `eas.json`/package files, `Dockerfile`, `.dockerignore`,
  `.gcloudignore`, plus untracked `0nya_autonomous/`, `docs/architecture/`,
  `src/lib/monetization/`, `MONETIZATION_DISCOVERY_REPORT.md`, QA screenshots.
- Recent commits (sampled): `fix: complete CMS password recovery flow`,
  `Build 15: lock launch commercial configuration`,
  `chore(android): point QA preview builds to Cloud Run`,
  `Build 15: verify monetization and playback foundations`,
  `Build 15: verified Android runtime checkpoint`.

## Android validation

- TypeScript typecheck exists (`npm run typecheck` in `apps/android`).
- Expo doctor script available (`npm run doctor`).
- Recent commits reference Netlify build type fixes for perf(timing) —
  evidence of prior QA build hardening.
- No full Android build was performed for this documentation-only snapshot —
  UNVERIFIED for the current uncommitted tree.

## TypeScript

- `tsconfig.json` at root was modified in the working tree (part of ongoing
  work). Current-tree typecheck status for root app: UNVERIFIED in this
  snapshot (no evidence of a fresh run for the uncommitted changes).

## lint

- `npm run lint` (eslint 9, `eslint.config.mjs`). Current-tree status:
  UNVERIFIED in this snapshot.

## tests

- No test runner wired in root `package.json` at snapshot.
- Verified test-like files present: `scripts/verify-commercial-config.mjs`
  (node:test; validates launch commercial configuration), and untracked
  `src/lib/{rewarded-analytics,rewarded-backend,rewarded-config}.test.ts`,
  `src/lib/monetization/events.test.ts`.
- `0nya_autonomous/tests/` are Python tests for the autonomous subsystem,
  not the product app.
- Earlier tracked behavior tests (e.g. `verify_schema.cjs`,
  `verify_auth.cjs`, `verify_constraints.cjs`, `check-db.mjs` at repo root)
  are scripts, not a suite.

## builds

- Dockerfile (Cloud Run) exists with build-time secret mounts and pinned
  public build args.
- Standalone `npm run build` for the current uncommitted tree: not run in
  this snapshot — UNVERIFIED.

## physical-device validation

- Build 15 era: `docs/qa/0nya_Build15_Physical_Verification_Tracker.docx`,
  `docs/android-performance-checkpoint-2026-08-28.md`, root `emulator_*.png`,
  `test_device.png` evidence exist in-repo.
- Fresh device validation of the current uncommitted tree: not re-run here —
  UNVERIFIED.

## backend/CMS validation

- CMS admin flows (login/reset) exercised via recent commits. Home spotlight +
  rewarded multi-completion are in-progress uncommitted — not yet release-validated.

## environment/configuration readiness

- Env names documented in `SYSTEM_MAP.md`. `.env.example` covers root vars.
- Commercial configuration locked by `verify-commercial-config.mjs`
  (`Build 15: lock launch commercial configuration`).
- QA preview EAS build env points to the Cloud Run QA API host
  (`apps/android/eas.json`, commit `chore(android): point QA preview builds
  to Cloud Run`).

## deep-link/app-link state

- Android linking config for `/series/:slug`, `/short-films/:slug`,
  `/watch/:seriesSlug/:episodeNumber` verified in
  `apps/android/src/navigation/linking.ts` + `src/lib/content-links.ts`.
- `0nya.com` association/signing/App-Link work is preserved. B05 is **FINAL
  CANDIDATE BUILD IN PROGRESS / FINAL ACCEPTANCE PENDING**: one authorized EAS
  Android development candidate is currently being produced for final runtime
  validation. Runtime/OnePlus/final acceptance is not yet proven.

## external dependencies/blockers

- Real phone OTP / SMS physical E2E: EXTERNALLY BLOCKED — expected unavailable
  approximately one month from 2026-09-02; re-check before resuming. This does
  not imply unavailability of any other provider or service.
- Mux assets + signed playback (needs live Mux env + ready media_assets).
- AdMob rewarded SSV requires the production `ADMOB_REWARDED_AD_UNIT_ID`
  pin (server fail-closed) and real Play Console ad-unit approval.
- Google Play Billing client service is still a stub — real Play purchase/
  restore is EXTERNALLY BLOCKED by D-U-N-S / Play organization and current
  availability, expected unavailable approximately one month from 2026-09-02;
  re-check before resuming.
- Home spotlight + rewarded multi-completion uncommitted work must land
  before those features can be considered release-ready.

## current known release blockers

Repository evidence only; confirm live:

- Home spotlight editorial phase: PENDING (uncommitted).
- Rewarded multi-completion + monetization events: PENDING (uncommitted).
- Play Billing client purchase/restore: PARTIAL (stub) + EXTERNALLY BLOCKED
  during the current availability window.
- Full current-tree build/typecheck/lint/device pass: UNVERIFIED.

## items requiring manual external action

- Google Play Console: app + rewarded ad unit + billing products setup.
- Mux: assets ready + webhooks + playback signing keys configured.
- Supabase remote: migrations applied; RLS verified for new migrations.
- Cloud Run: env secrets (`SUPABASE_SECRET_KEY`,
  `MUX_PLAYBACK_SIGNING_PRIVATE_KEY`, etc.) configured for the target
  environment.
- AdMob UMP privacy message configuration for release builds.

## unverified production assumptions

- Live production deployment health: UNVERIFIED REMOTELY.
- Production Supabase migration state vs `supabase/migrations/`: UNVERIFIED.
- Production Play Store listing / internal testing availability: UNVERIFIED.
- Any old passing test or fallback was not re-validated here.

## Evidence files

`docs/qa/0nya_Build15_Physical_Verification_Tracker.docx`,
`docs/android-performance-checkpoint-2026-08-28.md`,
`scripts/verify-commercial-config.mjs`, `apps/android/eas.json`,
`Dockerfile`, `.env.example`, root git log/status.