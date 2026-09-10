# 0nya CMS Completion Roadmap

**Version:** 1.0  
**Baseline date:** 2026-09-04  
**Status:** SEPARATE PARALLEL COMPLETION TRACK  
**Scope:** 0nya editorial CMS/admin + CMS-controlled backend/configuration workflows  
**Relationship to App roadmap:** INDEPENDENT — MUST NOT alter, pause, reclassify, or replace `APP_COMPLETION_ROADMAP.md`  
**Current App priority preserved:** B04 — UI / Visual Completion + Quiet Faceted Cinema Implementation

> This roadmap is an execution and verification tracker for the 0nya CMS only.
> It is NOT product authority and does not replace the Product/UI Bible, Master User Flow,
> CMS Product Contract, security/compliance authority, `AGENTS.md`, or verified repository/runtime evidence.

## 2026-09-10 audit reconciliation

The current source builds and typechecks, while the configured root suite is
346 PASS / 2 FAIL / 12 SKIP and root lint is FAIL. Cloud Run `/admin/login`
returned HTTP 200 and the public catalog/config probes returned HTTP 200, but
this does not prove authenticated CMS operations, persistence, remote
migrations, or Product Owner hands-on acceptance. CMS Phase 5 therefore remains
`FINAL ACCEPTANCE PENDING`; no catalog upload or CMS lock is implied.

---

## 1. Core Separation Rule

The CMS completion program runs separately and may progress in parallel with the consumer App roadmap.

It MUST NOT:

- change the App roadmap's current active/Product Owner priority;
- reclassify any App batch merely because CMS work passes;
- reopen a `VERIFIED COMPLETE / LOCKED BASELINE` App surface without new regression evidence;
- represent CMS success as Android rendering success;
- use `0nya_autonomous/**` as CMS authority;
- activate PX01 or any deferred consumer feature.

If a CMS change affects consumer Android behavior or presentation, that change creates a separate App integration-verification requirement under the existing App acceptance chain. It does not automatically complete or reopen an App batch.

---

## 2. Authority Order

For all CMS work use:

1. New explicit Product Owner-approved decision.
2. Root `AGENTS.md`.
3. Current canonical 0nya authority documents, especially:
   - `0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
   - `0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
   - `0nya_CMS_PRODUCT_CONTRACT_v1.0.md`
   - `0nya_BACKEND_API_CONTRACT_v1.0.md`
   - `0nya_SECURITY_PRIVACY_COMPLIANCE_RELEASE_v1.0.md`
4. Verified current repository/source/runtime evidence.
5. This CMS roadmap.
6. Agent-state / handover / task reports.

Agent reports are evidence, not product authority.

---

## 3. Current Infrastructure Baseline

Current approved QA infrastructure:

- QA backend/API: Google Cloud Run
- QA CMS/admin: same Cloud Run host under `/admin/login`
- Database/data/auth/storage where implemented: Supabase
- Video/media: Mux
- Netlify: website/frontend/domain hosting only; not current QA CMS/backend

Never resurrect stale Netlify API or localhost QA assumptions without current evidence.

---

## 4. CMS Product Boundary

The CMS is authoritative for content/editorial configuration and must support, where applicable:

- Series
- Episodes
- Vertical Short Films
- Home / Editorial Rows / Multi-Spotlight
- Coin packs / commercial configuration
- Episode access controls
- Rewarded unlock configuration
- 0nya Plus eligibility/configuration surfaces where defined
- Chai configuration and creator mapping
- Content ratings / descriptors
- Release scheduling / publishing state
- Feature flags
- Notification templates / targeting where implemented
- Basic editorial metadata
- Media/Mux ingest and readiness workflows where implemented

The client must not hardcode CMS-controlled values such as free-episode count, episode coin price, rewarded availability, Plus eligibility, release date, Home ordering, short-film ad timing, Chai availability, ratings/descriptors, or locked-preview duration.

---

## 5. Mandatory CMS Final Acceptance Chain

Every CMS milestone that claims final completion must pass:

`CMS SOURCE / CONFIG`
`-> DEPLOYED QA BACKEND / API`
`-> ACTUAL CMS WEBSITE RUNTIME CHECK`
`-> SCREENSHOTS / EVIDENCE`
`-> PRODUCT OWNER + CHATGPT REVIEW`
`-> PRODUCT OWNER HANDS-ON CMS WEBSITE CHECK`
`-> LOCK / VERIFIED COMPLETE`

Maximum intermediate statuses:

- `SOURCE VERIFIED`
- `CMS/API VERIFIED`
- `CMS WEBSITE VERIFIED`
- `READY FOR OWNER/CHATGPT REVIEW`
- `FINAL ACCEPTANCE PENDING`
- `VERIFIED COMPLETE / LOCKED BASELINE`

No coding agent, browser automation, test runner, database query, API check, or screenshot set may independently grant final CMS acceptance.

---

# 6. CMS Completion Sequence

## CMS-C00 — Baseline, Inventory & Collision Map

**Status:** NOT STARTED  
**Goal:** Establish the current CMS truth without changing behavior.

### Scope

- Inventory every current CMS/admin route, screen, form, table, action and backend helper.
- Map current DB fields to CMS Product Contract semantics.
- Record existing Series, Episode, Short Film, Home, monetization, ratings, media and creator-management capabilities.
- Identify legacy/duplicate CMS surfaces.
- Identify dirty/high-collision repository files before parallel work.
- Identify source-vs-runtime discrepancies.
- Identify stale controls that expose unsupported configuration.
- Preserve legitimate concurrent/uncommitted work.

### Required evidence

- CMS route/screen inventory.
- Current schema/config map.
- Existing-vs-missing capability matrix.
- Collision-risk map.
- Explicit `DO NOT REIMPLEMENT` list.

### Acceptance

`SOURCE VERIFIED` only. No implementation in this milestone.

---

## CMS-C01 — Admin Authentication, Authorization & Safety

**Status:** NOT STARTED

### Scope

- Admin login/runtime access.
- Admin session handling.
- Role/permission enforcement.
- Unauthorized-route behavior.
- Password recovery/change behavior where implemented.
- No privileged secrets in public/client surfaces.
- Safe error/logging behavior.
- Protection of commercial and user-sensitive controls.
- Verify CMS admin actions use the current privileged/server boundary safely.

### Acceptance

- Source/config verified.
- Deployed QA auth flows verified.
- Actual CMS website login/access behavior verified.
- Unauthorized access fails safely.
- Product Owner hands-on login check required before final lock.

---

## CMS-C02 — Series & Episode Authoring

**Status:** NOT STARTED

### Scope

### Series

- Create/edit Series.
- Title, slug, synopsis, artwork, language, creator/director, genre/editorial metadata.
- Ratings/descriptors.
- Draft/scheduled/published state.
- Episode workspace.
- Series publish behavior.

### Episodes

- Add one / add-many workflow where supported.
- Episode order/number/title/duration metadata.
- Thumbnail/media/subtitles where implemented.
- Publish/release state.
- Independent episode access controls.
- `free_access`.
- Coin unlock enabled + CMS-controlled price.
- Rewarded unlock enabled.
- Required rewarded completions.
- Permanent-only rewarded launch semantics.
- Plus eligibility.
- Backend/CMS-authoritative `locked_preview_seconds`.
- Per-episode rating override where implemented.

### Critical rules

- No mandatory first-three-free rule.
- No client-hardcoded Episode 4 paywall.
- Coin price remains CMS/backend controlled.
- Rewarded completion count must remain within supported configured range.
- Unsupported rewarded session-mode must not be offered as a valid launch configuration.
- Series publishing must not silently publish an invalid child state or bypass required media/readiness checks.

### Acceptance

Create/edit/save/refresh/publish workflows must persist correctly on deployed QA and be usable through the real CMS website.

---

## CMS-C03 — Short Film Authoring & Chai Configuration

**Status:** NOT STARTED

### Scope

- Short Film create/edit.
- Metadata/artwork/creator/duration/language.
- Ratings/descriptors.
- Publish/schedule state.
- Media/subtitles integration where implemented.
- Mid-roll enable/configured timecodes.
- Post-roll enable.
- Chai enable.
- Creator/accounting destination mapping.
- Allowed Chai coin amounts/config consumption.

### Critical rules

- Short Films remain always playable.
- Short Films are never coin-locked.
- Short Films are never subscriber-only.
- Plus suppresses Short Film ads at consumer runtime.
- Chai remains an 0nya coin tip, not direct cash/UPI.
- Invalid timecodes must be rejected or surfaced clearly.

### Acceptance

CMS configuration persists through deployed QA and actual website save/reload checks. Consumer behavior remains a separate App verification concern.

---

## CMS-C04 — Home Composer & Editorial Control

**Status:** NOT STARTED

### Scope

- Multi-Spotlight.
- Spotlight enable/disable.
- Add/remove items.
- Series + Short Film mixed membership.
- Ordering / Move Up / Move Down.
- Per-item `showTitle`.
- Published-only valid selections.
- Start Here.
- Generic editorial rows.
- Row title/order/visibility.
- Duplicate prevention.
- No fabricated/fallback items.
- Continue Watching remains system/history-driven, not manually curated.

### Critical rules

- One authoritative Multi-Spotlight stage.
- No return to superseded single Featured Hero CMS model.
- CMS/API order is authoritative.
- No client-side reordering to satisfy stale expectations.

### Acceptance

CMS website edits -> save -> refresh -> deployed API -> current Android consumer representation must match. Android rendering is verified separately under the App acceptance chain if changed.

---

## CMS-C05 — Media / Mux / Ingest Operations

**Status:** NOT STARTED

### Scope

- Media asset creation/upload workflow where implemented.
- Mux asset linkage.
- Processing/ready/failed states.
- Thumbnail/artwork/subtitle handling.
- Ready-media publication gates.
- Asset replacement/relinking behavior.
- Delete/reclaim behavior for exclusively owned assets where implemented.
- Shared-asset preservation.
- Webhook/runtime status reflection.
- Failure/retry UX.
- Safe handling of missing/invalid media.

### Critical rules

- CMS must not claim an item playable when required media is not ready.
- Never expose provider secrets.
- Preserve approved Mux architecture.
- Do not treat historical restoration evidence as current runtime proof.

### Acceptance

At least one complete safe test ingest must be proven from CMS action through deployed backend/media readiness to correct CMS runtime state. Consumer playback proof belongs to the App/media acceptance path.

---

## CMS-C06 — Monetization & Access Configuration

**Status:** NOT STARTED

### Scope

- Episode free/coin/rewarded/Plus configuration.
- Coin price validation.
- Rewarded required-completion configuration.
- Permanent-only rewarded launch policy.
- Coin products/config where CMS-controlled.
- Plus-related editorial/config surfaces where applicable.
- Chai configuration.
- Commercial-field permissions.
- Validation of mutually valid/invalid combinations.
- Preview duration/configuration.

### Critical rules

- CMS controls configuration; server remains financial/entitlement authority.
- CMS cannot directly grant client-authoritative wallet balance or entitlement.
- No unsupported rewarded session configuration.
- No invented Play pricing or fake store purchases.
- Preview duration is CMS/backend authoritative; never implement unrestricted locked playback protected only by a client timer.

### Acceptance

Valid configurations save and resolve correctly through deployed QA API; invalid configurations fail visibly and safely.

---

## CMS-C07 — Ratings, Compliance, Release Scheduling & Editorial Validation

**Status:** NOT STARTED

### Scope

- Content rating selection.
- Content descriptors.
- Episode overrides where supported.
- Scheduled release/publish time.
- Draft/scheduled/published/paused/archived behavior where implemented.
- Required pre-publication validation.
- Admin warning/error messaging.
- Feature flags and release controls where implemented.
- Compliance-sensitive fields protected from accidental invalid publication.

### Critical rules

- Do not invent legal/compliance values.
- Current official law/store policy remains a release-time recheck, not a static CMS assumption.
- A-rated content remains subject to the separately approved age-verification policy/gate.

### Acceptance

Publish/schedule operations behave correctly on deployed QA with clear invalid-state prevention.

---

## CMS-C08 — Runtime Resilience, Error States & Operational Usability

**Status:** NOT STARTED

### Scope

- Every major CMS page loads on deployed QA.
- Save success/failure states.
- Network/server error handling.
- Validation feedback.
- Refresh persistence.
- Back/forward/navigation safety.
- Duplicate submission prevention where state-changing actions matter.
- Empty states.
- Long-list usability.
- Accidental destructive action protection.
- No silent data loss.
- No broken/duplicate admin workflows.
- Practical content-ingest efficiency.

### Acceptance

Major CMS operational paths survive realistic admin use without hidden failure or ambiguous persistence.

---

## CMS-C09 — Full CMS Website QA & Evidence Pack

**Status:** NOT STARTED

### Scope

Run the complete deployed CMS golden-path examination across:

- Login/auth.
- Series.
- Episodes.
- Short Films.
- Home Composer.
- Media/Mux.
- Access/monetization config.
- Chai/creator mapping.
- Ratings/descriptors.
- Release scheduling.
- Validation/errors.
- Save/refresh persistence.
- Permissions/security boundaries.

### Required evidence

- Current QA deployment identity.
- Current screenshots for every critical state.
- API/persistence evidence where relevant.
- Before/after values for tested mutations.
- No stale screenshots.
- No source-only substitution for real runtime proof.

### Acceptance

Maximum status after agent/browser verification:

`READY FOR OWNER/CHATGPT REVIEW`

No final lock yet.

---

## CMS-C10 — Product Owner + ChatGPT Review & Refinement

**Status:** NOT STARTED

### Scope

Product Owner + ChatGPT review current CMS screenshots/evidence for:

- clarity;
- information hierarchy;
- field naming;
- grouping;
- discoverability;
- accidental-risk prevention;
- duplicated controls;
- editing efficiency;
- success/error messaging;
- consistency;
- practical real-world editorial workflow.

Any requested changes return only the affected CMS surfaces through:

`SOURCE/CONFIG -> DEPLOYED QA/API -> CMS WEBSITE -> SCREENSHOTS -> REVIEW`

Repeat until accepted.

### Acceptance

`FINAL ACCEPTANCE PENDING — READY FOR OWNER HANDS-ON CMS CHECK`

---

## CMS-C11 — Product Owner Hands-On Final CMS Check

**Status:** NOT STARTED

### Scope

The Product Owner personally logs into the deployed QA CMS and performs representative real operations, including at minimum:

- edit/save existing content;
- create or configure representative Series/Episode/Short Film data as safely appropriate;
- modify Home editorial configuration;
- verify persistence after refresh;
- verify media/config state visibility;
- verify important access/commercial controls are understandable;
- verify errors/validation are usable;
- verify no unacceptable workflow friction remains.

Coding agents must never fabricate this check.

### Acceptance

Product Owner explicitly confirms hands-on CMS pass.

---

## CMS-C12 — Final Reconciliation & Lock

**Status:** NOT STARTED

### Scope

- Reconcile final CMS source/runtime state with authority docs.
- Record remaining externally blocked or production-only dependencies separately.
- Verify no unresolved MUST-NOT-SHIP CMS issue remains.
- Preserve evidence pack location.
- Update relevant agent-state documentation only from verified evidence.

### Final status

Only after all applicable C00-C12 gates pass:

`VERIFIED COMPLETE / LOCKED BASELINE`

---

# 7. Cross-Cutting CMS Test Matrix

Every applicable CMS area should be tested for:

| Dimension | Required check |
|---|---|
| Create | Can a valid record be created? |
| Read | Does CMS show the true persisted state? |
| Update | Do edits save correctly? |
| Delete | Is deletion safe, authorized and consistent with linked data? |
| Validation | Are invalid states blocked with useful messages? |
| Persistence | Does refresh show the saved state? |
| API propagation | Does the deployed consumer API reflect CMS truth where applicable? |
| Permissions | Can only authorized admins mutate protected state? |
| Error recovery | Can the admin recover without data corruption or silent loss? |
| Empty state | Does zero-content state remain usable? |
| Concurrency/idempotency | Are repeated state-changing actions safe where required? |
| Auditability | Can critical commercial/editorial changes be traced where architecture supports it? |

---

# 8. CMS -> App Integration Rule

A CMS milestone may be `VERIFIED COMPLETE / LOCKED BASELINE` for CMS while an App-facing consequence remains unverified.

For CMS-driven Android behavior:

`CMS CONFIG VERIFIED`
`-> ANDROID EMULATOR`
`-> CURRENT SCREENSHOTS`
`-> PRODUCT OWNER + CHATGPT REVIEW`
`-> REFINEMENT IF REQUIRED`
`-> PHYSICAL ONEPLUS`
`-> APP LOCK`

Do not infer Android acceptance from API/database/CMS success.

---

# 9. Repository & Deployment Safety

For all CMS work:

- Preserve dirty/uncommitted concurrent work.
- No `git reset`, `git restore`, `git clean`, broad stash, or destructive cleanup without explicit Product Owner approval.
- Smallest safe change wins.
- Do not commit, push, deploy, migrate, publish CMS content, or modify production data without explicit Product Owner authorization.
- QA mutation must be bounded and evidence-backed.
- Production changes require separate explicit authorization.
- Do not expose secrets, service-role credentials, tokens, or private signing material.

---

# 10. Parallel Work / Collision Rule

CMS tasks may run parallel to App B04 only when file ownership does not collide.

Before assigning parallel agents:

1. inspect current dirty files;
2. identify shared backend/API/types files;
3. isolate ownership;
4. avoid two agents editing the same high-collision area;
5. require each agent to report exact changed files.

If a CMS change requires a shared Android/backend contract edit currently owned by B04, pause that CMS subtask or coordinate it explicitly rather than creating conflicting edits.

---

# 11. External / Business Dependencies

Track without allowing them to stall independent CMS work:

- Legal entity/grievance/retention content where still required.
- Production Google Play products/pricing.
- Production AdMob/UMP configuration.
- Production Mux provisioning/signing readiness.
- Any externally blocked SMS/OTP dependency.
- Production deployment credentials/configuration.

Do not invent missing business/legal values.

---

# 12. Completion Report Required Per CMS Milestone

Every completed CMS milestone must report:

**CMS ROADMAP IMPACT**

- Milestone:
- Previous status:
- New status:
- Files/subsystems changed:
- Current branch/HEAD:
- Working-tree safety preserved:
- Authority requirements satisfied:
- Source/config verification:
- Deployed QA/API verification:
- CMS website runtime verification:
- Screenshots/evidence:
- Product Owner review:
- ChatGPT review:
- Product Owner hands-on verification:
- Migration/deployment evidence:
- App integration verification required: YES/NO
- Remaining gap:
- New blocker:
- Documentation update required:
- Next dependency-safe CMS milestone:

No milestone becomes `VERIFIED COMPLETE` merely because code exists.

---

# 13. Initial Execution Order

Recommended first pass:

`CMS-C00 Baseline & Inventory`
`-> CMS-C01 Admin Security`
`-> CMS-C02 Series/Episodes`
`-> CMS-C03 Short Films/Chai`
`-> CMS-C04 Home Composer`
`-> CMS-C05 Media/Mux`
`-> CMS-C06 Monetization Controls`
`-> CMS-C07 Compliance/Publishing`
`-> CMS-C08 Runtime Resilience`
`-> CMS-C09 Full Website QA`
`-> CMS-C10 Owner+ChatGPT Review`
`-> CMS-C11 Owner Hands-On`
`-> CMS-C12 Lock`

Milestones may execute in parallel only when repository ownership/collision analysis proves it safe.

---

# 14. Current Start Point

**CMS CURRENT ACTIVE MILESTONE:** `CMS-C00 — Baseline, Inventory & Collision Map`

This CMS active milestone is independent of the consumer App roadmap.

**Consumer App priority remains:** `B04 — UI / VISUAL COMPLETION + QUIET FACETED CINEMA IMPLEMENTATION`.

Neither roadmap changes the other's active status unless the Product Owner explicitly decides otherwise.

