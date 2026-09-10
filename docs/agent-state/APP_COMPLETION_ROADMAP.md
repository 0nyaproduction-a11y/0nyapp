# 0nya App Completion Roadmap

**Version:** 1.7
**Baseline date:** 2026-09-02
**Last reconciled:** 2026-09-02 — B02 dependency-independent work verified (bounded AuthReturnIntent context preservation + `__DEV__` dev-login guard + AgeDeclaration return consumption + guest-history merge invariants + no OTP/token logging); phone OTP/SMS physical E2E externally blocked; B05 final candidate development build in progress; next dependency-safe batch: B04B functional; CMS/content-ingest Phases 1–4B verified and recorded; Phase 5 (CMS Workflow Refinement Gate) set as next PO-override task
**Purpose:** Single operational execution roadmap for completing the consumer **0nya App** from the current live repository state to a release candidate.
**Canonical repo location:** `docs/agent-state/APP_COMPLETION_ROADMAP.md`

## 2026-09-10 audit reconciliation

The current worktree is not a release baseline: it has broad modified files
and 201 untracked paths, including valid Android/CMS/source/migration work,
agent-state reports, and scratch/device artifacts. No cleanup or deletion is
authorized by this audit. Current verification is root build PASS, root and
Android typecheck PASS, Android direct tests 225 PASS, root suite 346 PASS / 2
FAIL / 12 SKIP, and root lint FAIL. Cloud Run QA endpoint probes returned 200,
but deployed-revision identity and remote Supabase migration application are
not proven against this worktree.

The Android billing status is corrected: an `expo-iap` adapter exists in
`apps/android/src/billing/googlePlay.ts`; production Play product setup,
server purchase-token verification, acknowledgement/consumption, restore and
revocation lifecycle, and device E2E remain partial, unverified, and externally
blocked. The next gate is not “implement a billing client”; it is the bounded
Play-availability check followed by real store/server lifecycle verification.

> This roadmap is an execution-priority and completion-tracking document. It is **not** a product authority and does not replace the 9 canonical App authority documents.

---

## 1. Authority and Operating Rule

Execution must follow this order:

1. Explicit current user-approved decision.
2. The 9 canonical 0nya App authority documents, in their established authority order.
3. Verified current repository/source/runtime evidence.
4. This roadmap for priority, sequencing, ownership, blockers, and completion evidence.
5. The individual task/chat.

If source code conflicts with higher product authority, classify it as a **PRODUCT/CODE MISMATCH**. Do not redefine the product to match stale code.

### Roadmap-first focus rule

Every significant 0nya App task should advance, unblock, verify, or document a roadmap item.

If a requested task is valid 0nya work but is outside the **CURRENT ACTIVE BATCH**, flag:

**ROADMAP DEVIATION**

Then either:
- keep the current chat focused and recommend a separate chat, or
- explicitly change roadmap priority if the user chooses to do so.

Do not reopen `VERIFIED COMPLETE` work unless new evidence shows regression or a release-gate verification requires it.

---

## 2. System Boundary

This roadmap governs only the **0nya consumer/product App**.

- `docs/**` = App documentation.
- `docs/_unclassified/**` = provenance only / non-governing.
- `0nya_autonomous/**` = separate Autonomous organism.

Normal App work must not use `0nya_autonomous/**` as product, UI, backend, CMS, playback, monetization, or release authority.

---

## 3. Current Infrastructure Baseline

| Area | Current baseline | Status |
|---|---|---|
| QA backend/API | `https://onya-qa-api-gwkke6nq5a-el.a.run.app` | IMPLEMENTED / QA authority |
| QA CMS | `https://onya-qa-api-gwkke6nq5a-el.a.run.app/admin/login` | IMPLEMENTED + DEPLOYED QA; `/admin/home` route alive behind auth gate; prior server-render failure not recurring |
| Backend/CMS hosting | Google Cloud Run | IMPLEMENTED |
| Website/domain hosting | Netlify | IMPLEMENTED; not current API/CMS backend |
| Database/data/auth | Supabase | IMPLEMENTED foundation |
| Video/media | Mux | PARTIALLY IMPLEMENTED for production |
| Android | Expo SDK 57 / React Native | IMPLEMENTED |
| Android playback | `expo-video` | IMPLEMENTED / DO NOT REPLACE |
| Physical QA device | OnePlus 13R, CPH2691, known USB serial `b94e2903` | REQUIRED for final Android acceptance |
| Production Google Play Billing | Not implemented | DEFERRED + external Play/D-U-N-S dependency |
| Production rewarded ads | Logic substantially implemented; real production E2E unproven | PARTIALLY IMPLEMENTED |
| Production Short Film ads | CMS config exists; playback ad-roll integration missing | PARTIALLY IMPLEMENTED |
| Production signed playback/CDN | Signing code exists; provisioning/deliverability unproven | PARTIALLY IMPLEMENTED |

---

## 4. Mandatory Physical QA Timeboxes

For physical-device tasks:

- ADB discovery: **30s**
- Metro health: **30s**
- App launch: **45s**
- Normal screen load: **30s**
- Navigation action: **15s**
- API-dependent load: **30s**
- Playback start: **30s**

Pattern:

`1 requested action -> 1 bounded wait -> evidence -> PASS / FAIL / TIMEOUT`

No indefinite waits, blind retries, or inferred PASS.

---

## 5. Verified Current App Baseline

### Substantially implemented — preserve, do not reimplement

- Expo/React Native Android shell and navigation.
- Bottom nav: Home / Explore / Profile.
- Explore and Search Results.
- Series Detail and episode list/tray.
- `expo-video` player stack.
- Access resolver and locked preview path.
- Continue Watching, progress, guest/auth persistence, and merge foundation.
- Dynamic Episode Access Options.
- Wallet/coin UI.
- Server wallet/order/idempotency logic.
- Permanent coin episode entitlements.
- Rewarded attempt/progress/SSV architecture.
- Chai coin-ledger architecture.
- Short Film detail/playback/end flow.
- Parental-control server/client foundation.
- Home editorial rows and Home Composer implementation; Home Composer is committed at current HEAD `8d5b4c6`.
- Multi-Spotlight implementation exists in the current working tree.
- Account deletion implementation.
- Cloud Run QA backend/CMS migration.
- Supabase data model/migrations 001–026; migration `027` (tracked/committed in source) for rewarded multi-completion; not proven applied to remote QA.
- Mux playback authorization/signing code foundation.

### Current working-tree reality

The repository is heavily dirty and contains legitimate concurrent work.

Important in-flight/uncommitted areas include:

- Android Multi-Spotlight Home.
- Home/API/CMS types and Home Composer work.
- Rewarded multi-completion backend/client work.
- Migration `027` for multi-rewarded completion (tracked/committed in source; not proven applied to remote QA).
- Rewarded analytics/config/routes/tests.
- AdMob SSV hardening.
- Authority-document revisions.
- Agent-state/skills/supporting documentation.

**Do not reset, restore, clean, stash, overwrite, or broad-refactor this work.**

---

## 6. Reconciled Findings from the Final Master Audit

The final live-repository audit confirms that the App is well beyond the foundational build stage.

### Confirmed

- Home Multi-Spotlight exists in the working tree.
- Explore/Search are implemented.
- Series/Episode/access flows exist.
- `expo-video` playback exists.
- Continue Watching exists.
- Dynamic paywall/access options exist.
- Wallet/Coin UI exists.
- Server wallet/order/idempotency must be preserved.
- Rewarded multi-completion work substantially exists.
- Production rewarded ad E2E remains unproven.
- Plus UI/state exists; real Google Play purchase integration does not.
- Play/D-U-N-S is separately externally blocked.
- Short Film detail/playback/end exists.
- Short Film production ad-roll playback is not implemented.
- Chai substantially exists.
- Parental Controls substantially exist.
- Age verification is deferred.
- Deep links are config-level / not proven end-to-end.
- Cloud Run is the current QA API/CMS authority.
- Netlify is web/domain hosting only.
- Production signed playback is not proven.
- `expo-blur` dependency exists; glass UI does not.
- Android typography redesign is not implemented.
- App Architecture contains stale implementation-status passages.

### Important corrections to earlier assumptions

1. **Current Home Multi-Spotlight verified on physical device.**
   Multi-Spotlight 5-item rail, next-card peek, Watch CTA, Short Film Detail routing, Continue Watching resume position preserved across app restart (~100s after force-stop/relaunch), CMS editorial rows, and bottom navigation are physically verified on OnePlus 13R against Cloud Run QA.

2. **Auth is not fully aligned.**
   Phone OTP exists, but return-to-origin after OTP is missing and unguarded development email/password sign-in rows are present.

3. **P05 Manage Subscription is missing on Android.**

4. **Rewarded multi-completion is in-flight/uncommitted and migration 027 must be reconciled/applied before production credit.**

5. **Legal/help/grievance/report surfaces are not release-ready.**

---

## 6A. B00 Final Baseline Audit — 2026-08-31

The final read-only B00 audit established a coherent source baseline without modifying code, docs, data, Git state, deployments, or migrations.

### Proven in current source / Git

- Branch: `qa/netlify-api-e34ab5e`.
- HEAD at snapshot: `e7abbcc2da2b50975b9565d1b2e0711b9682e72d` (prior snapshot cited
  `8d5b4c6`; the branch has since advanced. B00/B01 were verified at `8d5b4c6`;
  the current tip's current-tree B00/B01 status is UNVERIFIED and the working
  tree is dirty).
- Baseline reference point: the Home Composer deployability milestone commit
  `8d5b4c6`.
- Non-Autonomous dirty App work remains substantial and legitimate; do not reset/clean/stash/overwrite it.
- Android typecheck: PASS.
- Root typecheck: PASS.
- `git diff --check`: PASS.
- Rewarded `.test.ts` files exist, but the current tree has no configured Jest/Vitest runner or `test` script, so those tests are presently **UNRUNNABLE** rather than passing.
- Multi-Spotlight Home is implemented in source.
- Approved Spotlight width formula and 12dp gap are present.
- Home decorative motion regressions are absent in current Android source.
- Authenticated Home wallet affordance is **MISSING in current Home source** and must be resolved as an authority/UI decision during the appropriate visual batch; do not silently add it before authority reconciliation.
- CMS Home Composer is implemented and committed at HEAD.
- Restored QA `4 series / 20 episodes DRAFT` state and current 5-item QA Spotlight configuration are consistent with prior evidence.
- Restored-series playback remains blocked by missing/invalid media; Mux production readiness remains **PARTIALLY IMPLEMENTED / NOT PROVEN**.
- Coin wallet/unlock/idempotency architecture remains implemented; real Google Play coin purchase/verification remains incomplete/external.
- Rewarded 1–2 completion architecture is coherent in source.
- Migration `027` is tracked/committed in source (663 lines), not proven applied
  to remote QA.
- Launch rewarded entitlement semantics in migration `027` are permanent-only.
- A rewarded **session-mode configuration trap is CONFIRMED**:
  - database legacy CHECK still permits `session`;
  - bulk episode CMS still exposes `session`;
  - single-episode form hides it;
  - migration `027` RPC rejects it;
  - therefore a bulk-configured session episode can become non-unlockable via rewarded ads.
- All 9 authority documents were diff-audited; targeted synchronization completed.

### B00 documentation status

Current authority-document reconciliation:

| Document | B00 status | Synchronized state |
|---|---|---|
| Product Bible | SYNCHRONIZED | explicit Multi-Spotlight behavior added; Spotlight Resume wording removed; rewarded launch semantics permanent-only |
| Master User Flow | SYNCHRONIZED | Multi-Spotlight flow added while preserving exact return-to-origin |
| UI Wireframes | SYNCHRONIZED | replaced old Featured Hero / Watch Now / Info Home model; reconciled current screen coverage |
| Design System | SYNCHRONIZED | replaced stale Featured Hero visual section and old Watch/Resume wording |
| CMS Product Contract | SYNCHRONIZED | formally superseded old Featured Hero contract; reconciled rewarded permanent-only launch behavior |
| App Architecture | SYNCHRONIZED | refreshed implementation-status passages; preserved implemented systems |
| Backend API Contract | SYNCHRONIZED | verified current contract alignment; no rewrite needed |
| Video Playback Architecture | SYNCHRONIZED | replaced obsolete mock narrative with current Android/Mux/playback evidence while retaining production-not-proven distinctions |
| Security/Privacy/Compliance | SYNCHRONIZED | verified current implementation evidence without claiming unverified legal completion |

---

## 6B. B00 Remote Closeout — 2026-08-31

B00 remote-state closeout is complete.

### Home / Spotlight

- Public QA `home.spotlights[]` returns 5 real published Short Films.
- Current observed API order:
  1. `trial-and-error-romantic` — `showTitle=true`
  2. `couple` — `showTitle=false`
  3. `the-influencers` — `showTitle=false`
  4. `tree-of-life` — `showTitle=false`
  5. `funeral-procession` — `showTitle=false`
- **API/CMS order is authoritative.** Do not maintain a predetermined client-side title order and do not reorder CMS merely to satisfy an old test expectation.
- The previously reported `tree-of-life` / `funeral-procession` “swap” is **NOT A REGRESSION**; it is the current authoritative remote order.
- `showTitle` values match the approved per-item configuration model.

### Home Composer

- `/admin/home` is alive on current QA and redirects unauthenticated requests to `/admin/login` rather than failing with the prior Server Component error.
- Home Composer implementation remains committed at HEAD `8d5b4c6`.

### Restored QA series / episodes — direct QA database verification

A legitimate read-only QA Supabase query directly confirmed:

| Series | Status | Episodes | Draft episodes | Episodes with media reference |
|---|---|---:|---:|---:|
| Aadha Takiya | DRAFT | 8 | 8 | 2 |
| Chaadar | DRAFT | 4 | 4 | 0 |
| Doosri Rasoi | DRAFT | 4 | 4 | 0 |
| Mute Button | DRAFT | 4 | 4 | 0 |

Therefore:

- restored series count = **4**
- restored episode count = **20**
- all 4 restored series remain **DRAFT**
- all 20 restored episodes remain **DRAFT**
- restored poster + hero artwork for all 4 series is hosted on the QA Supabase project, not localhost
- Aadha Takiya Episodes 1–2 retain historical Mux media references
- the other restored episodes have no media reference

Historical Aadha Takiya Mux references remain classified from prior validation as unavailable/invalid for current playback. Database `media_assets.status='ready'` is metadata only and does not override the prior real playback failure.

### B00 final result

B00 acceptance is satisfied:

- source/Git baseline classified;
- static checks passed;
- authority-document synchronization completed;
- current Home remote state recorded;
- API-order authority clarified;
- restored 4-series / 20-episode DRAFT state directly verified;
- artwork hosting directly verified;
- media-blocked classification preserved;
- Mux production readiness not falsely upgraded;
- no B00 closeout mutation required.

**B00 STATUS: VERIFIED COMPLETE**

---

## 7. Locked Product Rules — Never Reintroduce

Do not implement:

- fixed first 3 episodes free;
- Episode-4-specific paywall;
- Prime tier;
- Like/Comment MVP;
- Short Film coin lock;
- Short Film subscription lock;
- cash/UPI Chai;
- interruptive Micro Drama pre/mid/post-roll;
- permanent Search/Browse bottom tabs;
- TikTok/Reels-style feed;
- client-authoritative coin/wallet/entitlement mutations.

One subscription tier only: **0nya Plus**.

---

## 8. Design Status

### Home

Current approved Home behavior:

- Multi-Spotlight.
- Horizontal poster-only stage.
- Strict 9:16.
- Manual swipe only.
- No autoplay/timer/dots/arrows/parallax.
- No Info button.
- Poster tap -> Detail.
- CTA label exactly **Watch**.
- Continue Watching owns Resume/progress language.
- CMS controls ordering and `showTitle`.
- No `catalog[0]` fallback.
- No decorative Home motion.

Current approved Spotlight width formula:

```ts
Math.round(Math.min(260, Math.max(220, usableWidth * 0.67)))
```

Status: **PHYSICALLY VERIFIED COMPLETE ON ONEPLUS 13R**

### Glass

`expo-blur ~57.0.2` exists, but there are no current Android `BlurView` imports.

Status: **EXPERIMENTAL / NOT IMPLEMENTED**

Do not roll glass app-wide. Home-only experiment requires explicit approval gate.

### Typography

Semantic typography tokens exist, but Android still uses system fonts.

Product Owner approved typography direction (2026-08-31, B04 experimental sub-gate):

- English/Latin PRIMARY target: **0nya Sans**, researched as based on Plus Jakarta Sans (SIL Open Font License 1.1). Target weights 400 / 500 / 600.
- Hindi/Devanagari companion typeface: NOT yet selected/approved (TBD); system/Noto fallback is a safety net only.
- Facelio is NO LONGER the consumer-UI implementation path (web wordmark candidate only).

Status: **APPROVED DIRECTION / NOT IMPLEMENTED / NOT VISUALLY LOCKED**

This docs-only sync does NOT implement or verify typography. Typography work must still follow font-asset/licensing audit and the B04 visual pass before Android adoption.

---

## 9. Build 15 Completion Snapshot

| ID / Area | Current status | Primary remaining action |
|---|---|---|
| A01 Launch | IMPLEMENTED | regression only |
| H01/H02 Home | VERIFIED COMPLETE | 5-item Spotlight, Continue Watching, Detail routing, resume, editorial rows, and navigation verified on OnePlus 13R |
| E01 Explore | IMPLEMENTED | final visual consistency QA |
| E02 Search Results | IMPLEMENTED | regression QA |
| D01 Series Detail | IMPLEMENTED | final visual/device QA |
| V01 Player Clean | IMPLEMENTED dev/QA | production Mux provisioning |
| V02 Player Controls | IMPLEMENTED | physical regression |
| V03 Episode List | IMPLEMENTED | visual/device QA |
| V04 Auto-next | IMPLEMENTED | physical regression |
| W01 Locked Preview | IMPLEMENTED | production preview-media verification |
| W02 Dynamic Paywall / Contextual Micro Drama Access | IMPLEMENTED logic/UI; presented contextually via C01 Wallet per product decision (see B04) | insufficient-coins path must be consolidated to contextual Add Coins inside Wallet (B04 functional consolidation) before visual pass |
| R01 Phone Entry | IMPLEMENTED | real SMS/device proof |
| R02 OTP | PARTIALLY IMPLEMENTED / CURRENT ACTIVE | restore initiating context; hide dev login |
| C01 Wallet | IMPLEMENTED; primary Micro Drama access hub per product decision | Wallet visual redesign deferred to B04 visual pass after functional consolidation; production store-integration dependency (B08) |
| C02 Coin Purchase | PARTIALLY IMPLEMENTED | real Play purchase + server verification |
| A02/A03 Rewarded | PARTIALLY IMPLEMENTED / IN-FLIGHT | stabilize untracked 027, eliminate confirmed session-mode trap, then real AdMob/SSV device E2E |
| S01/S02 Plus/Sync | PARTIALLY IMPLEMENTED | real Play Billing/restore |
| D02 Short Film Detail | IMPLEMENTED | QA |
| F01 Short Film Player | IMPLEMENTED core | production media + ad-roll work |
| F02 Short Film End | IMPLEMENTED | device QA |
| T01/T02 Chai | IMPLEMENTED substantial | physical QA |
| P01/P02/P03 Profile | IMPLEMENTED | visual/release QA |
| P04 Settings | PARTIALLY IMPLEMENTED | replace Coming Soon legal/support rows when destinations exist |
| P05 Manage Subscription | MISSING | implement store-supported flow when contract/path is proven |
| P06 Restore/Sync | PARTIALLY IMPLEMENTED | real Play restore |
| G01 Rating Slate | IMPLEMENTED | regression QA |
| G02 Parental Gate | IMPLEMENTED | physical QA |
| G03 Age Verification | DEFERRED | keep A-rated unpublished until reliable solution exists |
| Q01 Delete Account | IMPLEMENTED | retention/legal disclosure + release QA |
| X01 No Internet | PARTIALLY IMPLEMENTED | decide if dedicated state is necessary |
| X02 Playback Error | IMPLEMENTED | production failure QA |
| X03 Commerce Error | IMPLEMENTED | production purchase QA |
| X04 Search Empty | IMPLEMENTED | regression |
| L01 Deep Links | PARTIALLY IMPLEMENTED / NOT PROVEN | canonical URL, assetlinks, host/device proof |

---

## 10. Completion Lanes

### Lane A — Baseline stabilization
No external dependency.

### Lane B — Android functional correctness
No Play/D-U-N.S dependency for most items.

### Lane C — Physical-device/visual QA
Use Cloud Run QA + OnePlus timeboxes.

### Lane D — Production monetization
Depends partly on Play/D-U-N-S and AdMob provisioning.

### Lane E — Production playback/media
Depends on Mux production provisioning.

### Lane F — Compliance/release surfaces
Requires business/legal decisions plus implementation.

### Lane G — Final release hardening
Runs only after prerequisite lanes converge.

External blockers must not prevent progress on independent lanes.

---

# 11. CONTROLLED COMPLETION BATCHES

## BATCH 00 — Roadmap + Baseline Freeze

**Status:** VERIFIED COMPLETE
**Owner:** ChatGPT coordination + OpenCode repository verification
**Completed:** 2026-08-31

### Verified completion evidence

- dirty working tree classified without destructive cleanup;
- Home / CMS / rewarded coherent change groups established;
- Android and root typechecks passed;
- `git diff --check` passed;
- migration `027` structure/dependencies understood and left unapplied;
- confirmed rewarded `session` configuration trap recorded for B03;
- 9 authority docs audited and targeted synchronization completed;
- Home Multi-Spotlight authority synchronized across product/flow/wireframe/design/CMS docs;
- rewarded launch persistence synchronized to permanent-only;
- current QA Home public payload recorded;
- CMS/API order declared authoritative for Spotlight;
- restored 4 series / 20 episodes directly verified as DRAFT in QA;
- restored artwork verified on QA Supabase storage;
- restored-series playback retained as BLOCKED BY MEDIA;
- Mux production readiness retained as PARTIALLY IMPLEMENTED / NOT PROVEN;
- no B00 closeout mutation was required.

### Preserve return evidence

Do not reopen B00 unless new regression evidence materially invalidates this baseline.

---

## BATCH 01 — Home Current-Environment Physical Verification

**Status:** VERIFIED COMPLETE
**Owner:** OpenCode / Android QA
**Physical QA:** YES
**Completed:** 2026-08-31

### Verified completion evidence

- physical OnePlus 13R (CPH2691, USB serial `b94e2903`) acceptance completed against Cloud Run QA backend;
- 5-item Multi-Spotlight renders in exact authoritative API/CMS order: `trial-and-error-romantic`, `couple`, `the-influencers`, `tree-of-life`, `funeral-procession`;
- per-item `showTitle` toggle behavior verified (`trial-and-error-romantic` shows canonical title, others hide);
- manual horizontal swipe, next-card peek, active footer, and final-item no-fake-sixth card verified;
- exact `Watch` CTA and no Spotlight Info/Resume copy verified;
- Spotlight poster tap -> correct Short Film Detail navigation PASS;
- Continue Watching rail populated and functional;
- Continue Watching tap -> correct `couple` playback resumption preserved across app restart (~100s position after force-stop/relaunch) PASS;
- CMS editorial rows render in server order;
- bottom navigation cycle (Home -> Explore -> Profile -> Home) verified PASS without regressions;
- bounded physical timeboxes satisfied with zero timeouts;
- verified on existing working-tree baseline with zero app/code mutations.

### Preserve return evidence

Do not reopen B01 unless new regression evidence materially invalidates this baseline.

---

## BATCH 02 — Auth Integrity and Context Preservation

**Status:** DEPENDENCY-INDEPENDENT WORK VERIFIED / PHONE OTP PHYSICAL E2E EXTERNALLY BLOCKED / FINAL ACCEPTANCE PENDING
**Owner:** OpenCode Android; Kilo only if server/auth config gap is proven
**Physical QA:** YES

### Proven gaps

- OTP flow loses initiating context.
- Development email/password sign-in rows are not production-guarded.
- SMS provider current remote configuration is not proven.

### Scope

- Preserve initiating route/action through SignIn/OTP.
- OTP success must return to exact initiating flow after required age/account steps.
- Hide development-only sign-in from production/release UI.
- Preserve guest-first behavior and existing history merge.
- Do not change product to email/password.
- Verify guest-history -> existing-account conflict handling: preserve the newest
  valid watch progress, never regress a completed state, create no duplicate
  progress, and make the merge retryable/idempotent.
- A guest-history merge failure must be visible/retryable and must not undo an
  otherwise successful authentication. Do not infer guest-wallet or paid-
  entitlement migration.

### Acceptance

- Guest monetization action -> OTP -> returns to originating action.
- Direct account sign-in can return to intended account flow.
- Production-mode UI contains no Development sign-in.
- No OTP/token logs.
- Physical-device OTP test if provider is available; otherwise the external
  blocker and exact return point are recorded.

### External availability constraint

Real phone OTP / SMS provider E2E is **EXTERNALLY BLOCKED — expected
unavailable approximately one month from 2026-09-02; re-check before
resuming.** Do not repeatedly retry SMS provisioning, fabricate an OTP pass,
block independent roadmap work, or change the product to email/password.

While dependency-independent B02 work remains unfinished, B02 stays `CURRENT
ACTIVE`. Once it is verified but phone OTP remains unavailable, use:

`B02 — DEPENDENCY-INDEPENDENT WORK VERIFIED / PHONE OTP PHYSICAL E2E EXTERNALLY BLOCKED / FINAL ACCEPTANCE PENDING`

**Return point:** `REAL PHONE OTP / SMS PHYSICAL E2E`.

At that point preserve the B02 return point and choose the next
dependency-safe roadmap batch rather than waiting idle. B02 must not become
`VERIFIED COMPLETE` / `LOCKED` until the applicable final OTP gate passes.

---

## BATCH 03 — Rewarded Multi-Completion Stabilization

**Status:** IN PROGRESS / UNCOMMITTED (parallel / in-flight)
**Owner:** Kilo backend/CMS/Supabase + OpenCode Android integration verification
**Physical QA:** YES after remote QA deploy

### Scope

- Finalize migration 027.
- Verify 1–2 completion backend/CMS semantics.
- Permanent entitlement only at required completion count.
- Explicit user tap for each ad.
- Resolve the **confirmed** `session` mode config trap across bulk CMS + legacy DB CHECK + migration 027 RPC semantics.
- Verify new analytics/events do not become client authority.
- Apply/verify remote QA migration only after explicit deployment approval.
- Test SSV/reward progression.

### Acceptance

- 1-ad flow works.
- 2-ad flow shows 1/2 then requires explicit second tap.
- Exactly one permanent entitlement after completion.
- No client-derived completion count.
- Bulk/single CMS and database constraints cannot create a `session` configuration that migration 027 rejects.
- Relevant tests pass.
- Remote QA migration state proven.

---

## BATCH 04 — UI Visual Completion Pass

**Status:** READY AFTER B02 for relevant screens
**Owner:** OpenCode / Android
**Physical QA:** YES

### Scope

Audit current screens rather than rebuilding:

- Explore.
- Search.
- Series Detail.
- Episode List.
- Access Options.
- Wallet.
- Plus.
- Short Film Detail/End/Chai.
- Profile/Settings.

Fix only authority-proven visual gaps and inconsistent routing behavior.

Specific known candidates:
- Home editorial series poster routing differs from Short Film poster routing; inspect against authority before changing.
- Authenticated Home wallet affordance is absent in current Home source; reconcile against current approved product/UI authority before implementing.

### Experimental sub-gates

**Glass:** Home-only prototype, if user still wants it.
**Typography:** separate pass after font/licensing audit. Approved direction (2026-08-31): 0nya Sans / Plus Jakarta Sans (OFL 1.1) for English/Latin; Hindi Devanagari companion remains TBD. NOT implemented or visually locked by this docs sync.
**App Language:** Product Owner approved English-default bilingual app UI (English / हिन्दी), changed later from Settings, no first-launch chooser. Separate from Subtitle Language. PRODUCT DECISION only — not implemented/verified by this docs update.

Neither experiment should silently become release scope.

---

## BATCH 04B — Micro Drama Wallet / Access Consolidation (B04 sub-gate)

**Status:** READY (functional work)
**Owner:** OpenCode Android + Kilo backend/CMS as needed
**Physical QA:** YES (after functional consolidation lands)
**Product decision:** 2026-08-31 — C01 Wallet is the primary Micro Drama access hub; Add Coins for episode access is offered contextually inside Wallet when coin balance is insufficient; Wallet visual redesign is deferred until functional consolidation is stable; Short Film Chai (F02 -> T01 -> T02 -> C02) remains a dedicated, separate flow (NOT migrated into Wallet).

### Sequencing (strict, non-reversible)

```
FUNCTIONAL CONSOLIDATION FIRST
   -> stabilize Micro Drama access journey through Wallet
   -> verify Coin / Rewarded / Plus / Add Coins / exact episode return
VISUAL REDESIGN SECOND
   -> final C01 Wallet UI/UX only after functional consolidation is stable
```

### Scope

- **Functional** (first):
  - For a locked Micro Drama episode (W02), present access methods contextually
    through C01 Wallet.
  - When the viewer's coin balance is insufficient for a Coin unlock, offer
    contextual **Add Coins** inside Wallet (leading to C02) and return to the
    exact originating episode/lock context (exact episode return).
  - Keep Coin / Rewarded / Plus / Add Coins availability strictly driven by
    backend/episode flags (do not hardcode).
  - Keep the exact episode return contract (`Watch` with episode + access context).
  - Chai (System B) stays a dedicated flow; do NOT route Chai through Wallet/W02.
  - Rewarded multi-completion semantics preserved (B03): required count is
    backend/episode-controlled, server-authoritative progress, explicit tap per
    ad, permanent entitlement only after required count.
- **Visual** (second, deferred):
  - Final C01 Wallet UI/UX redesign only after the functional access journey is
    stable. Follow Quiet Cinema (flat hierarchy, restrained surfaces, strong
    balance readability, clean ledger/activity presentation, no oversized
    dashboard cards, no aggressive commerce treatment, no gamified coin
    styling).

### What is NOT in scope for this sub-gate

- No route or screen retirement. All existing routes preserved; a later
  READ-ONLY audit must justify any retirement — do not retire proactively.
- No client-authoritative coin/wallet/entitlement mutations.
- No Chai migration into Wallet.
- No redefinition of B03 rewarded multi-completion semantics.
- No production Play Billing / AdMob provisioning (that remains B08 / B09).

### Current audit state (read-only, apps/android at HEAD 8d5b4c6)

- `WalletScreen.tsx` exists and renders balance + Add Coins + activity + Plus.
- `EpisodeAccessOptionsScreen.tsx` (W02) currently loads wallet balance inline
  and, on insufficient balance, shows an inline "Not enough coins." error with
  **no** Add Coins / Wallet navigation — this is the consolidation gap.
- Chai (F02 -> T01 -> T02 -> ShortFilmEnd -> C02 with `returnToChai`) is a
  dedicated flow and is preserved.
- Rewarded multi-completion, Plus, and exact episode return are already
  implemented.

### Acceptance

1. Insufficient-coin Micro Drama episode unlock offers contextual Add Coins (to
   C02) inside Wallet, then returns to the exact originating episode/lock
   context.
2. Rewarded multi-completion, Plus, and exact return unchanged.
3. Chai (System B) remains a dedicated flow; Wallet is not used for Chai.
4. No route retirement introduced by this sub-gate.
5. Physical-device verification of the contextual Add Coins -> CoinPurchase ->
   return-to-episode path.

`B02 return point` / `B03 in-flight` / `B08 Play externally blocked` — all
preserved; this sub-gate does not alter their status.

---

## BATCH 05 — Deep Link Completion

**Status:** FINAL CANDIDATE BUILD IN PROGRESS / FINAL ACCEPTANCE PENDING
**Owner:** OpenCode Android + web/hosting owner as needed
**Physical QA:** YES

Current operation: exactly one authorized EAS Android `development` build is
being produced with the existing EAS-managed Android signing credentials. Its
purpose is the final B05 App-Link/runtime candidate. Do not trigger another
B05 build from this roadmap task.

### Scope

- Canonical App URL.
- Intent filters.
- `assetlinks.json`.
- Series/Short Film/Watch destinations.
- Auth/access/parental gates.
- Return-to-origin behavior.

### Acceptance

Real HTTPS link -> installed app -> correct target -> required gates -> same target after auth/unlock.
The already-proven `0nya.com` association/signing/App-Link work is preserved.
This batch is not `VERIFIED COMPLETE` until candidate runtime, OnePlus, and all
required locked acceptance evidence exist.

---

## BATCH 06 — Legal / Help / Grievance / Report Surfaces

**Status:** SOURCE VERIFIED / LIVE WEBSITE ACCEPTANCE PENDING / ANDROID PHYSICAL LINK ACCEPTANCE PENDING
**Owner:** Kilo/Web + user/business/legal for approved content
**Physical QA:** YES for Android links

### Scope

Implement approved production destinations for:

- Privacy.
- Terms.
- Help.
- Grievance.
- Report Content Issue.
- Account-deletion/retention disclosure where required.

Do not invent legal entity, grievance officer, address, retention period, or compliance claims.

### Acceptance

- Public pages/routes exist.
- Android Settings/Profile links are live.
- Account deletion disclosures match actual data behavior.
- Official policies rechecked immediately before release.

### Verification (B06-B2)

- `/delete-account` route exists; secure web-authenticated via Supabase server client + admin delete.
- External deletion contact: `privacy@0nya.com` for unauthenticated requests.
- Legal identity: `0NYA PRIVATE LIMITED`; Grievance Officer `Jitesh Pathak`; emails `support@0nya.com`, `grievance@0nya.com`, `privacy@0nya.com`; jurisdiction `India (Maharashtra, Mumbai)`.
- Android Settings links resolve to `https://0nya.com/{privacy,terms,help,grievance,report-content}`.
- Native Delete Account flow preserved (AccountScreen -> DeleteAccountScreen -> API).
- Root `tsc --noEmit`: PASS. Android `tsc --noEmit`: PASS. ESLint: PASS (no errors on changed files).
- git diff --check: PASS.

---

## BATCH 07 — Production Playback / Mux Readiness

**Status:** PARTIALLY IMPLEMENTED
**Owner:** Kilo/backend/media/infrastructure + OpenCode Android verification
**Physical QA:** YES

### Scope

- Verify production media assets.
- Verify Mux playback IDs.
- Verify signing keys/secrets in Cloud Run.
- Verify webhook.
- Verify preview assets.
- Verify 720p guest / 1440p Plus server ceiling where rendition exists.
- Verify CDN/signed playback deliverability.
- **B07-A Signed Playback Lifecycle:** verify authorization timing, token
  expiry/`expiresAt`, long pause/background return, fresh authorization after
  expiry, preview tokens, the 720p Free / 1440p Plus ceiling, and no
  development fallback.
- **B07-B Playback Resilience/Performance:** measure first authorization
  latency, source load, first frame, buffering, Auto-Next transition, network
  recovery, long-binge/memory stability, and subtitle/speed/resume continuity.
  Do not prescribe dual-player pooling, custom ABR, arbitrary Mux TTL, or GOP
  values without evidence.
- **B07-C Production Media Proof:** prove real signed Mux -> Android
  `expo-video` -> physical-device playback. Preserve `expo-video`.

### Acceptance

Physical Android playback succeeds from production-like signed authorization without development fallback.

---

## BATCH 08 — Google Play Billing

**Status:** DEFERRED + EXTERNALLY BLOCKED
**Owner:** Kilo server + OpenCode Android + user/business
**External blocker:** D-U-N-S / Play organization + real Google Play Billing
availability. Real Google Play Billing is **EXTERNALLY BLOCKED — expected
unavailable approximately one month from 2026-09-02; re-check before
resuming.**

### Do now while blocked

- Preserve billing abstraction.
- Finalize server-side verification design against existing idempotency.
- Do not fake prices.
- Do not credit from client.
- Do not grant Coins or Plus from client state.
- Do not fake purchases, Restore/Sync, localized store prices, or purchase-token
  verification.
- Do not introduce alternative cash checkout.
- Do not repeatedly attempt Play integration/provisioning or spend roadmap time
  waiting for Google Play.

### Execute when Play becomes available

- Configure coin products.
- Configure 0nya Plus.
- Native purchase.
- Server verification.
- `credit_verified_coin_purchase`.
- subscription grant/verification.
- Restore/Sync.
- P05 store-supported Manage Subscription.
- Trusted flow only: Play purchase token -> trusted backend -> Google
  verification -> `PENDING` / `PURCHASED` / `INVALID` -> server-authoritative
  grant -> acknowledge/consume as applicable -> Restore/Sync -> P05 -> RTDN
  lifecycle reconciliation. Never use client-authoritative optimistic Plus.

### Acceptance

Verified-store-purchase -> server verification -> idempotent wallet/subscription state -> physical-device proof.

**Return point:** `B08 real Google Play Billing implementation + store
configuration + server verification + Restore/Sync + physical-device E2E`.
Re-check availability before activating B08.

---

## BATCH 09 — Production Rewarded Ads + Privacy

**Status:** PARTIALLY IMPLEMENTED
**Owner:** Kilo backend/AdMob config + OpenCode Android
**Physical QA:** YES

### Scope

- Production AdMob app/ad unit.
- UMP/privacy message as required.
- SSV callback.
- Multi-completion E2E.
- No-fill/failure/retry.
- Fail-closed ad-unit pinning.

### Acceptance

Real device ad -> verified SSV -> required progress -> permanent entitlement.
Production E2E must cover: one-ad completion; two-ad `0/2 -> 1/2 ->` app
kill/relaunch `->` explicit Ad 2 `-> 2/2`; exactly one permanent entitlement;
no-fill/network failure; duplicate/replayed callback; and wrong
user/episode/ad-unit fail-closed cases.

---

## BATCH 10 — Short Film Ad Playback

**Status:** MISSING PLAYBACK INTEGRATION
**Owner:** Product approval + Kilo backend/CMS + OpenCode Android
**Physical QA:** YES

CMS already provides mid/post-roll configuration.

Before implementation confirm this remains required for launch.

If enabled:
- non-Plus obeys CMS timecodes/post-roll;
- Plus remains ad-free;
- Short Film remains always playable.

If not production-ready at launch:
- keep CMS ad controls disabled; never advertise unsupported behavior.

---

## BATCH 11 — Release Hardening

**Status:** BLOCKED BY PRIOR BATCHES
**Owner:** OpenCode + Kilo + user/business

### Scope

- Full current-tree typecheck/lint/tests.
- QA backend/CMS health.
- Supabase migration reconciliation/RLS.
- Physical-device golden path.
- account deletion.
- auth/logout/session expiry.
- deep-link bypass tests.
- wallet/idempotency replay.
- rewarded replay.
- Chai replay.
- parental gates.
- legal routes.
- EAS production build.
- Play Data Safety / store declarations.
- official policy recheck.
- Coin/Chai/Rewarded/PX01 concurrency and idempotency runtime tests.
- Playback observability and error classification; monetization analytics.
- Final account-deletion regression including PX01 rooms, participants, and
  messages if PX01 ships.
- Analytics must never contain tokens, OTP, phone numbers, purchase tokens, or
  signed playback URLs.

### Acceptance

Release checklist passes with no unresolved MUST-NOT-SHIP item.

---

## 12. External / Business Blockers

These must remain visible but must not stall independent engineering:

| Blocker | Status |
|---|---|
| Phone OTP / SMS E2E | EXTERNALLY BLOCKED — expected unavailable approximately one month from 2026-09-02; re-check before resuming |
| Google Play Billing | EXTERNALLY BLOCKED — D-U-N-S / Play organization + current Play Billing availability; expected unavailable approximately one month from 2026-09-02; re-check before resuming |
| Google Play products/pricing | EXTERNAL / PENDING |
| Production AdMob app/ad unit | EXTERNAL / PENDING |
| UMP configuration | EXTERNAL / PENDING |
| SMS provider remote setup | UNKNOWN / NOT PROVEN |
| Production Mux asset/signing provisioning | UNKNOWN / NOT PROVEN; restored historical series media is currently missing/invalid and must not be treated as playback-ready |
| Legal entity/grievance/retention content | BUSINESS/LEGAL INPUT REQUIRED |
| Canonical HTTPS deep-link host | `0nya.com` association/signing/App-Link work proven; final candidate runtime acceptance in progress |

---

## 13. Documentation Work

Do not create additional planning documents unless a genuinely new subsystem requires one.

### Authority documents

Authority docs record product/contract truth; this roadmap records execution progress.

1. `0nya_PRODUCT_UIUX_BIBLE_v3.0.md` — Synchronized (Multi-Spotlight, Watch CTA, permanent-only rewarded).
2. `0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md` — Synchronized (Multi-Spotlight, return-to-origin).
3. `0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md` — Synchronized (Multi-Spotlight Home, screen coverage).
4. `0nya_DESIGN_SYSTEM_v1.0.md` — Synchronized (Multi-Spotlight visual specs, static motion).
5. `0nya_CMS_PRODUCT_CONTRACT_v1.0.md` — Synchronized (Multi-Spotlight superseding Featured Hero, permanent-only rewarded).
6. `0nya_APP_ARCHITECTURE_v1.0.md` — Synchronized (implementation status updated, production distinction retained).
7. `0nya_BACKEND_API_CONTRACT_v1.0.md` — Synchronized.
8. `0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md` — Synchronized (current playback stack updated, production media unproven retained).
9. `0nya_SECURITY_PRIVACY_COMPLIANCE_RELEASE_v1.0.md` — Synchronized.

### Non-authority cleanup

- Keep `.local-docs` competing Bible absent/non-governing.
- Classify old Netlify/localhost references as historical/dev/test unless they are current config bugs.
- Update relevant `docs/agent-state/*` only after verified material state changes.
- Replace ChatGPT Project copies of authority docs after the repo versions are finalized so future Project chats read the same canonical text.

---

## 14. Do-Not-Reimplement List

Before modifying nearby code, preserve:

- `expo-video` player architecture.
- playback-source/controller stack.
- backend playback authorization chain.
- wallet/order/idempotency logic.
- `purchase_episode_with_coins`.
- permanent coin entitlement.
- rewarded attempt/progress/SSV architecture.
- Chai idempotent ledger.
- parental-control server model.
- watch-progress/history merge.
- Home rows/Spotlight/CMS Composer foundation.
- account deletion cascade.
- existing Supabase migration history.
- CMS admin auth/structure.

---

## 15. Roadmap Status Vocabulary & Locked Acceptance Protocol

All roadmap batch completions must strictly adhere to the **Locked Final Acceptance Protocol** in `AGENTS.md`.

### Consumer App sequence:
`SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT -> PHYSICAL ONEPLUS -> LOCK`

### CMS sequence:
`CMS SOURCE/CONFIG -> DEPLOYED QA/API -> CMS WEBSITE -> SCREENSHOTS -> OWNER+CHATGPT REVIEW -> OWNER HANDS-ON CMS CHECK -> LOCK`

Use:

- `SOURCE VERIFIED`
- `EMULATOR VERIFIED`
- `CMS/API VERIFIED`
- `CMS WEBSITE VERIFIED`
- `READY FOR OWNER/CHATGPT REVIEW`
- `VISUAL CANDIDATE APPROVED — READY FOR PHYSICAL FINAL CHECK`
- `PHYSICAL QA PASS`
- `FINAL ACCEPTANCE PENDING`
- `VERIFIED COMPLETE` / `LOCKED BASELINE`
- `NOT STARTED`
- `READY`
- `IN PROGRESS`
- `VERIFYING`
- `PARTIALLY IMPLEMENTED`
- `BLOCKED`
- `EXTERNALLY BLOCKED`
- `DEFERRED`
- `UNKNOWN / NOT PROVEN`
- `EXPERIMENTAL — APPROVAL GATE`

`VERIFIED COMPLETE` requires all gates of the respective locked protocol to pass. No AI agent or automated test runner has authority to self-approve final visual or operational deliverables.

---

## 16. Completion Evidence Required per Batch

Every completed batch should report:

**ROADMAP IMPACT**

- Batch:
- Previous status:
- New status:
- Protocol gates satisfied:
  - App: SOURCE / EMULATOR / SCREENSHOTS / OWNER REVIEW / CHATGPT REVIEW / REFINEMENT / PHYSICAL ONEPLUS / FINAL LOCK
  - CMS: SOURCE / DEPLOYED QA-API / CMS WEBSITE / SCREENSHOTS / OWNER REVIEW / CHATGPT REVIEW / OWNER HANDS-ON / FINAL LOCK
- Files/subsystems changed:
- Product/authority requirements satisfied:
- Static verification:
- Runtime verification:
- Physical-device verification:
- Backend/CMS verification:
- Migration/deployment evidence:
- Remaining gap:
- New blocker:
- Documentation update required:
- Next dependency-safe batch:

No batch becomes `VERIFIED COMPLETE` merely because code exists.

---

# 17. CURRENT ACTIVE BATCH

## BATCH 02 — Auth Integrity and Context Preservation

**Current status:** DEPENDENCY-INDEPENDENT WORK VERIFIED / PHONE OTP PHYSICAL E2E EXTERNALLY BLOCKED / FINAL ACCEPTANCE PENDING
**Owner:** OpenCode Android; Kilo only if server/auth config gap is proven
**Physical QA:** YES

### Proven gaps to address (resolved)

- OTP flow loses initiating context — CLOSED in source: bounded typed `AuthReturnIntent` (`authReturnIntent.ts` + `authReturnIntentStorage.ts`) wired from Account, EpisodeAccessOptions, Player, Plus, RestoreSync, and ShortFilmChai* into SignIn; AgeDeclaration consumes the return intent on Continue via `CommonActions.reset`. Source-verified; `authReturnIntent.test.ts` present.
- Development email/password sign-in rows not guarded — CLOSED in source: SignInScreen guards development sign-in behind `__DEV__`; production/release does not render Development sign-in.
- SMS provider remote configuration not proven — REMAINS EXTERNALLY BLOCKED (real phone OTP/SMS physical E2E unproven on device). B02 must not become `VERIFIED COMPLETE` / `LOCKED` until the OTP gate passes.

### Immediate next action (dependency-independent work complete)

1. (Done) Initiating context/route preservation through SignIn/OTP via AuthReturnIntent.
2. (Done) Guard development email/password sign-in rows from production/release builds (`__DEV__`).
3. (Done) Preserve guest-first behavior, anonymous session, and existing history merge; no OTP/token/password logging; auth success performs no coin/wallet/reward/purchase/tip side effects.
4. Real phone OTP/SMS physical E2E — externally blocked; return point preserved: `REAL PHONE OTP / SMS PHYSICAL E2E`.

### Exit (blocked closeout)

B02 dependency-independent work is verified, but the OTP physical E2E gate cannot be
satisfied now (external availability window). Per the B02 external-availability
constraint, B02 status is:

`B02 — DEPENDENCY-INDEPENDENT WORK VERIFIED / PHONE OTP PHYSICAL E2E EXTERNALLY BLOCKED / FINAL ACCEPTANCE PENDING`

Do not mark B02 `VERIFIED COMPLETE` / `LOCKED` until `REAL PHONE OTP / SMS PHYSICAL E2E` passes. While B02 awaits that external gate, advance the next dependency-safe batch (B04B functional) rather than waiting idle. B03 Rewarded multi-completion continues in parallel/in-flight; B08 Play remains externally blocked.

Then B04 UI Visual Completion Pass becomes ready for relevant screens, and B04B Micro Drama Wallet / Access Consolidation (functional-first, visual-second sub-gate) becomes ready for its functional work. (B03 Rewarded multi-completion continues in parallel/in-flight as tracked; B08 Play externally blocked is preserved.)

---

## 18. Release Definition

The 0nya App reaches **RELEASE CANDIDATE** only when:

1. Core Android flows are physically verified on the current QA environment.
2. Auth preserves initiating context and has no development-only production UI.
3. Monetization methods enabled for launch are genuinely production-capable.
4. Production playback/media is verified.
5. Deep links cannot bypass access/compliance.
6. Legal/help/grievance/account-deletion surfaces are production-ready.
7. Supabase migrations/RLS and server idempotency are verified.
8. Full release static/build/device regressions pass.
9. No MUST-NOT-SHIP security/privacy/compliance blocker remains.
10. External Play requirements are either completed or the Play submission step remains explicitly blocked.

---

## 18A. Revision Log — v1.1

Updated from the 2026-08-31 final B00 read-only audit:

- B00 source baseline verified but batch kept active for documentation synchronization and bounded remote state confirmation.
- Home source classified IMPLEMENTED / VERIFYING; OnePlus acceptance remains open.
- Home Composer upgraded from “foundation” wording to implemented at current HEAD; current QA runtime re-probe remains required.
- Current Home source confirmed static/no decorative press-progress animation.
- Authenticated Home wallet affordance recorded as missing pending authority/UI reconciliation.
- Rewarded migration `027` recorded as untracked and not remotely proven applied.
- Confirmed rewarded session-mode configuration trap added to B03.
- Restored-series playback remains blocked by media; Mux production readiness unchanged.
- Authority-document sync requirements expanded from generic cleanup into a B00 exit gate.
- Glass remains `EXPERIMENTAL — APPROVAL GATE`; it is not itself B04.
- No B01/B02/B03 implementation priority was advanced during this revision.

## 18B. Revision Log — v1.2

Reconciled after B00 documentation sync and remote closeout, plus B01 physical verification completion:

- B00 moved to `VERIFIED COMPLETE` (documentation synchronization and remote state checks completed).
- B01 moved to `VERIFIED COMPLETE` (OnePlus 13R physical acceptance satisfied across 5-item Multi-Spotlight, Watch CTA, Short Film detail routing, Continue Watching resume position preserved across app restart, CMS editorial rows, and bottom navigation).
- B02 moved to `CURRENT ACTIVE`.
- Locked Final Acceptance Protocol synchronized across all roadmap batches (App: `SOURCE -> EMULATOR -> SCREENSHOTS -> OWNER+CHATGPT -> REFINE -> ONEPLUS -> LOCK`; CMS: `CMS SOURCE -> DEPLOYED QA/API -> CMS WEBSITE -> SCREENSHOTS -> OWNER+CHATGPT -> OWNER HANDS-ON -> LOCK`).
- Current 5-item public QA Spotlight state recorded.
- API/CMS Spotlight ordering made explicit as the runtime authority; no predetermined client-side title order.
- Restored QA state directly verified through read-only QA Supabase access: 4 series / 20 episodes, all DRAFT.
- Restored artwork verified as QA Supabase-hosted.
- Aadha Takiya Episodes 1–2 retain media references; other restored episodes have none.
- Restored-series playback remains `BLOCKED BY MEDIA`.
- Mux production readiness remains `PARTIALLY IMPLEMENTED / NOT PROVEN`.
- B03 retains the confirmed rewarded session-mode trap and unapplied migration `027` in parallel/in-flight tracking.
- No B00/B01 closeout data/code/deployment mutation was required.

## 18C. Revision Log — v1.3

Documentation sync (2026-08-31) on Micro Drama Wallet / Access consolidation:

- Product decision recorded: C01 Wallet is the primary Micro Drama access hub; Add Coins for episode unlock is offered contextually inside Wallet; Wallet visual redesign is deferred until functional consolidation is stable; Short Film Chai stays a dedicated flow (F02 -> T01 -> T02 -> C02, NOT migrated into Wallet).
- W02 snapshot row updated to "presented contextually via C01 Wallet"; noted insufficient-coins functional gap as the B04 consolidation target.
- C01 Wallet snapshot row updated to "primary Micro Drama access hub"; noted visual redesign deferred to B04; B08 Play dependency preserved.
- New BATCH 04B (Micro Drama Wallet / Access Consolidation) added as a functional-first / visual-second sub-gate; sequence, scope, audit findings, and acceptance criteria recorded.
- READ-ONLY implementation audit (apps/android at HEAD 8d5b4c6) recorded in App Architecture §25C: WalletScreen exists; EpisodeAccessOptionsScreen (W02) currently leaves insufficient-coin viewers on an inline error with no contextual Add Coins — the consolidation gap; Chai (F02 -> T01 -> T02 -> C02) is a dedicated separate flow; Rewarded multi-completion, Plus, and exact episode return are preserved.
- B02 CURRENT ACTIVE, B03 IN PROGRESS / IN-FLIGHT, B08 EXTERNALLY BLOCKED — all preserved unchanged.
- No code, backend, CMS, data, Git, or deployment mutation was required or performed by this documentation sync.

---

## 19. Roadmap Principle

The remaining 0nya work is **completion, integration, physical verification, production provisioning, visual consistency, security/compliance, and release hardening**.

It is **not** a rebuild.

Always:

`INSPECT -> IDENTIFY EXACT GAP -> MAKE SMALLEST COMPATIBLE CHANGE -> VERIFY -> UPDATE ROADMAP -> NEXT DEPENDENCY-SAFE BATCH`

---

# 20. Post-Roadmap Feature Batch — PX01 (APPROVED / SOURCE FOUNDATION)

## PX01 — 0nya Plus Play Together / 0chat

**Status:** APPROVED / SOURCE FOUNDATION PRESENT / RUNTIME AND ANDROID UI UNVERIFIED
**Owner:** (assigned when activated)
**Physical QA:** YES (when activated)

### Relationship to the current roadmap

PX01 sits **AFTER** the major completion work (B00–B11). It does **NOT** become the current active batch automatically and must not alter, pause, or reclassify any existing incomplete or completed batch. The current active batch remains **B02 — Auth Integrity and Context Preservation**.

PX01 remains activation-gated for consumer release. The current working tree has
uncommitted backend/migration preparation for secure invite/redeem, rooms and
participants, ordered room-scoped 0chat messaging, backend-controlled
acquisition/access, and a SOURCE-VERIFIED (unapplied) PX01-D playback-sync
foundation: backend sync-tuning columns plus a Realtime PRESENCE RLS policy and
an inert Android sync adapter driven by the consumed `/api/v1/play-together/config`.
It is not proof of applied schema, deployed runtime,
realtime Android synchronization, or chat UI.

### Product authority

PX01 product rules are locked at `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md` §36. This section records only the roadmap placement and deferral constraints; it does not restate or override the Bible.

### Scope (future)

- **Play Together** — synchronized private co-viewing for exactly 1 Host + maximum 1 Guest, Micro-Drama episodes only (Short Films excluded from V1).
- **0chat** — minimal private text communication inside the active Play Together room.
- Room acquisition/access is separate from episode entitlement. Each
  participant independently passes episode authorization; Host entitlement and
  an invite never transfer or grant episode entitlement.
- Current source keeps PX01 commercial access backend-controlled, including the
  approved configured Coin price and Plus bypass. Android must not hardcode it.

### Future implementation plan

Each slice is independently bounded and activation-gated:

- **PX01-A** Compatibility / read-only architecture audit
- **PX01-B** Room + realtime backend foundation
- **PX01-C** Android Play Together room shell
- **PX01-D** Playback synchronization
- **PX01-E** 0chat
- **PX01-F** Auth / entitlement / Auto-Next / invite / return-context integration
- **PX01-G** Two-client emulator verification
- **PX01-H** Current screenshots → Product Owner + ChatGPT review → refinement loop
- **PX01-I** Two-device physical verification (OnePlus 13R)
- LOCK only after the full Locked Final Acceptance Protocol passes.

### Required PX01 hardening before production

- **PX01-SYNC:** one canonical room timeline/state; Host playback-intent
  authority; state version/time reference; heartbeat/offset measurement;
  measured drift correction; buffering/reconnect/control policy. Do not
  hardcode a drift threshold.
- **PX01 Auto-Next:** no two independent Auto-Next state machines. One
  authoritative room advance is: current episode complete -> next sequential
  published episode -> per-participant authorization -> synchronized room
  transition.
- **PX01 deletion/data:** before production 0chat, verify account deletion
  against hosted/joined rooms, participants/messages, and FK/nullability
  behavior. Do not invent retention rules.

### Deferral constraints

Until the Product Owner explicitly activates consumer PX01:

- No unproven source foundation is represented as deployed, enabled, or
  consumer complete.
- No feature flag is enabled in runtime config.
- No paid realtime/chat SaaS is selected.
- No deployment is performed.

## 20. CMS/Content-Ingest Priority Override — 2026-09-02

> **NOTICE:** The following CMS/content-ingest program is an explicit **PRODUCT OWNER PRIORITY OVERRIDE / ROADMAP DEVIATION**.
> Formal roadmap statuses are preserved:
> - **B02** = CURRENT ACTIVE (exact return point preserved)
> - **B03** = IN PROGRESS / IN-FLIGHT
> - **B05** = FINAL CANDIDATE / FINAL ACCEPTANCE PENDING (do not trigger another B05 build)

### Phase 1 — Consumer-Virgin QA Reset
**STATUS:** PASS / VERIFIED EXPERIMENT BASELINE

- Consumer catalog safely cleared
- Protected B04B financial/access history preserved
- Empty canonical Start Here retained
- No destructive reset of unrelated data
- Clean consumer-virgin baseline evidence captured
- Not a final CMS locked baseline

### Phase 2 — 0% Home / App Experiment
**STATUS:** PRODUCT OWNER + CHATGPT VISUAL REVIEW PASS — INTERMEDIATE EXPERIMENT CHECKPOINT

Approved behavior:
- Actual 0nya logo asset
- Absent Spotlight collapses
- Never-watched state: "Start watching to continue here."
- No Continue Watching heading for never-watched state
- Six virgin-only structural headings:
  - Start Here
  - Trending Now
  - New Releases
  - Micro Dramas
  - Vertical Short Films
  - Staff Picks
- Explore/Search empty-state behavior verified
- No physical OnePlus required for this intermediate checkpoint
- Not VERIFIED COMPLETE / LOCKED BASELINE

### Phase 3 — Fresh CMS Ingest Pilot
**STATUS:** PASS

**Final Pilot Inventory:**

**Series:**
- Aadha Takiya — 8 episodes
- Doosri Rasoi — 3 episodes

**Short Films:**
- Funeral Procession
- Tree of Life

**Ingest Summary:**
- All content/media identities freshly created
- 11 Series episodes Media Ready
- Both Short Films Media Ready
- Signed playback verified
- Final public catalog exactly 2 Series + 2 Short Films
- No B04B/Chaadar/Mute Button consumer exposure

**Real Short Film Publish Blockers Discovered & Fixed:**

1. **Obsolete `short_films.playback_reference` publish validation**
   - Replaced with canonical chain:
     - `media_asset_id` → `media_assets.status` → `provider_playback_reference`

2. **Invalid PostgREST `storage.objects` poster validation**
   - Replaced by canonical Supabase Storage API lookup against `content-artwork`

**QA Deploy Progression:**
- Previous: `onya-qa-api-00008-6wh`
- Playback fix: `onya-qa-api-00009-xhr`
- Poster integrity fix: `onya-qa-api-00010-82g`

No migration required.

### Phase 4 — Partial App Verification
**STATUS:** TECHNICAL PASS

- Explore renders all four current items correctly
- Home initially empty because CMS Home composition was genuinely empty
- Android Home rendering was correct for API state

### Phase 4A — Root-Cause Audit
**STATUS:** PASS

Proven gaps identified:
- Missing CMS Home composition
- Virgin headings flashed before catalog hydration
- Explore keyboard leaked across tab navigation
- Generic Series poster taps bypassed D01 and opened Watch directly

### Phase 4B — Partial Home Correction
**STATUS:** SOURCE VERIFIED / CMS CONFIG VERIFIED / EMULATOR VERIFIED / PRODUCT OWNER + CHATGPT VISUAL REVIEW PASS — PARTIAL-CONTENT CANDIDATE APPROVED

**Android Fixes:**
- HomeScreen: Virgin state gated behind resolved hydration
- MainTabs: Explore blur dismisses keyboard
- Home/Explore/Search Results: Generic Series cards navigate to D01 Series Detail
- Direct Watch/Resume/episode flows preserved

**Final CMS Home Configuration:**

| Section | Contents | Notes |
|---------|----------|-------|
| Spotlight | Aadha Takiya | enabled, showTitle=false |
| Start Here | Aadha Takiya, Doosri Rasoi, Tree of Life, Funeral Procession | |
| Micro Dramas | Aadha Takiya, Doosri Rasoi | |
| Vertical Short Films | Funeral Procession, Tree of Life | |
| New Releases | Aadha Takiya, Doosri Rasoi, Funeral Procession, Tree of Life | |

**Watched-State Proof:**
- Continue Watching visible
- Aadha Takiya — Episode 4 — Resume
- Teal progress indicator
- No new-viewer sentence

> **NOTICE:** Phase 4B is an **INTERMEDIATE APPROVED EXPERIMENT CHECKPOINT**.
> It is **NOT** final App VERIFIED COMPLETE / LOCKED BASELINE.
> Final physical OnePlus acceptance remains later.

### Carry Forward (Without Reopening Phase 4B)

**D01 Series Detail:**
Metadata completeness remains a B04 visual-completion gap, including current authority-required metadata such as language/rating-descriptor/creator fields where applicable.

### Next Override Phase

**PHASE 5 — CMS WORKFLOW REFINEMENT GATE**

**Purpose:** Use the Phase-3 ingest observations to improve ONLY proven CMS operator friction before remaining catalog upload.

> **EXPLICIT DIRECTIVE:** DO NOT upload remaining catalog until Phase 5 passes.

**After Phase 5:**
- Phase 6 = Remaining content ingest
- Phase 7 = Full CMS/backend verification
- Phase 8 = Full Android emulator verification
- Phase 9 = CMS ingest-pipeline lock gate

Future phases are not marked complete.

---

## 20A. Revision Log — v1.4

- B05 updated to `FINAL CANDIDATE BUILD IN PROGRESS / FINAL ACCEPTANCE
  PENDING`; one authorized EAS development candidate is in progress and no
  additional build is authorized by this roadmap.
- B02 conflict-safe guest-history merge acceptance added without inventing
  wallet or paid-entitlement migration.
- B07-A/B/C, B08 trusted Play lifecycle, B09 production SSV E2E, and B11
  concurrency/observability/privacy hardening added.
- PX01 reconciled to current source-foundation evidence while retaining the
  correct unverified state for applied runtime, realtime synchronization, and
  Android chat UI.
- Rejected AI-review ideas were not promoted: no mandatory dual player, Redis
  rewrite, custom ABR, arbitrary GOP/TTL/room limits, per-segment entitlement
  check, optimistic Plus, Coin Stack, timed unlocks, Auto-Unlock, Starter Pack,
  swipe-next, Watch Later launch scope, DOB PIN recovery, device fingerprinting,
  or invented deletion grace period.

## 20B. Revision Log — v1.5

Product Owner external-availability update: real phone OTP/SMS and real Google
Play Billing are unavailable for approximately one month from 2026-09-02.
Dependency-independent work must continue; B02 and B08 retain their exact
blocked return points and availability must be re-checked before resuming.

## 20C. Revision Log — v1.6

B02 closeout with OTP external-blocked (dependency-independent work verified, final
acceptance pending):
- Verified in current source (`apps/android`): bounded typed `AuthReturnIntent`
  (`authReturnIntent.ts` + `authReturnIntentStorage.ts`) wired from Account /
  EpisodeAccessOptions / Player / Plus / RestoreSync / ShortFilmChai* / Wallet
  into SignIn; AgeDeclaration consumes the return intent on Continue; SignInScreen
  guards development email/password behind `__DEV__`; guest-history merge
  invariants preserved; no OTP/token/password logging; auth success performs no
  coin/wallet/reward/purchase/tip side effects. `authReturnIntent.test.ts` present.
- B02 status advanced to `DEPENDENCY-INDEPENDENT WORK VERIFIED / PHONE OTP
  PHYSICAL E2E EXTERNALLY BLOCKED / FINAL ACCEPTANCE PENDING`. B02 return point
  preserved: `REAL PHONE OTP / SMS PHYSICAL E2E`. B02 NOT promoted to
  `VERIFIED COMPLETE` / `LOCKED` (OTP gate cannot pass now).
- Next dependency-safe launch batch: **B04B Micro Drama Wallet / Access
  Consolidation (functional-first)** — consumes the verified return-intent contract
  to close the W02 insufficient-coins gap at source (W02 -> contextual Add Coins in
  Wallet -> CoinPurchase -> Wallet return path wired; `coinUnlock`/`plus`/`rewarded`
  return intents resolve to EpisodeAccessOptions/Wallet); independent of OTP/SMS,
  Play Billing, AdMob, Mux, and legal input. Physical-device QA pending. B03
  continues in parallel/in-flight; B05 candidate build already in progress
  (final acceptance OTP-gated — do not trigger another B05 build).
- No source, Git, deployment, or migration mutation in this docs/state closeout.

## 20D. Revision Log — v1.7

CMS/content-ingest Product Owner priority override recorded (Phases 1–4B verified):
- **Phase 1** — Consumer-Virgin QA Reset: PASS / VERIFIED EXPERIMENT BASELINE
- **Phase 2** — 0% Home / App Experiment: PRODUCT OWNER + CHATGPT VISUAL REVIEW PASS (intermediate checkpoint)
- **Phase 3** — Fresh CMS Ingest Pilot: PASS — Inventory: Aadha Takiya (8 eps), Doosri Rasoi (3 eps), Funeral Procession, Tree of Life. Two real publish blockers fixed (obsolete playback_reference validation, invalid storage.objects poster validation). QA revision: onya-qa-api-00010-82g.
- **Phase 4** — Partial App Verification: TECHNICAL PASS
- **Phase 4A** — Root-Cause Audit: PASS — gaps: missing CMS Home composition, virgin flash, keyboard leak, Series-card bypass
- **Phase 4B** — Partial Home Correction: SOURCE/CMS/EMULATOR VERIFIED + PRODUCT OWNER VISUAL REVIEW PASS — partial-content candidate approved (NOT locked baseline)
- **Next PO-override task:** Phase 5 — CMS Workflow Refinement Gate (DO NOT upload remaining catalog until Phase 5 passes)
- **Carry forward:** D01 Series Detail metadata completeness remains a B04 visual-completion gap
- Formal B02/B03/B05 statuses preserved; no future phase marked complete; no source/Git/deployment/migration mutation.

## 20E. Revision Log — v1.8

Phase 5 CMS workflow refinement implementation:
- Short Film editor now runs a read-only publish preflight before status
  submission, using the canonical media-asset readiness and content-artwork
  checks already enforced by the publish guardrail.
- Operators see actionable missing-artwork or playback-readiness blockers
  before attempting to publish, while the server-side fail-closed guardrail is
  unchanged.
- Source typecheck and targeted ESLint pass.
- Phase 5 remains pending deployed CMS/QA verification and Product Owner
  hands-on acceptance; remaining catalog upload remains blocked.
