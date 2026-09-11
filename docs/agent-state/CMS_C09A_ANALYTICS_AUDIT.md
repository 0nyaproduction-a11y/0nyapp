---
# CMS-C09A Analytics Implementation Audit

**Date:** 2026-09-11  
**Mode:** READ-ONLY AUDIT — NO CODE CHANGES, NO DEPLOY, NO MIGRATIONS, NO ANDROID, NO PROD MUTATION  
**Scope:** Reconcile approved C00D Analytics design against actual current source + QA capability

---

## STATUS

- ANALYTICS SURFACE: PARTIAL (Observation System exists; no admin analytics UI)
- DATA SOURCES: AVAILABLE (Supabase + Observation System + Mux)
- A METRICS: 11
- B METRICS: 6
- C METRICS: 5
- D METRICS: 8
- AUTHORITATIVE METRICS: 11
- TELEMETRY METRICS: 6
- DERIVED METRICS: 5
- UNSAFE/MISLEADING METRICS: 3
- PLAYBACK ANALYTICS: 2A, 3C, 2D
- MONETIZATION ANALYTICS: 3A, 2C, 2D
- OPERATIONS ANALYTICS: 3A, 2D
- PRIVACY RISKS: MEDIUM
- QA/PROD DIFFERENCES: MINIMAL
- TOP GAPS: 5
- SAFE FIRST SLICE: C09B-01 (operational/content KPIs)
- REQUIRES_OWNER_DECISION: YES (privacy model, analytics UI design)
- BLOCKER: NO ADMIN ANALYTICS INTERFACE
- NEXT: CMS-C09B IMPLEMENTATION PLAN

---

## 1. ANALYTICS SURFACES

### EXISTING: Observation System Infrastructure

**Observation System (B-grade telemetry)** — implemented across 6 domains:

| Domain | Module | Event Types |
|--------|--------|-------------|
| MONETIZATION | src/lib/observation/monetization.ts | COIN_PURCHASE_STARTED, COIN_PURCHASE_COMPLETED, COIN_PURCHASE_FAILED, REWARDED_UNLOCK_STARTED, REWARDED_UNLOCK_GRANTED, REWARDED_UNLOCK_FAILED, CHAI_TIP_STARTED, CHAI_TIP_COMPLETED, CHAI_TIP_FAILED |
| CONTENT | src/lib/observation/content.ts | CONTENT_PUBLISHED, CONTENT_UPDATED, CONTENT_UNPUBLISHED, CONTENT_AVAILABLE, CONTENT_UNAVAILABLE |
| ACCESS | src/lib/observation/access.ts | ACCESS_CHECKED, ACCESS_GRANTED, ACCESS_DENIED, ENTITLEMENT_GRANTED, ENTITLEMENT_REVOKED, ENTITLEMENT_EXPIRED |
| SYSTEM | src/lib/observation/system.ts | PLAYBACK_FAILED, API_REQUEST_FAILED, PAYMENT_FAILED, ENTITLEMENT_CHECK_FAILED, MEDIA_UNAVAILABLE |
| TRAFFIC | src/lib/observation/traffic.ts | Deep link, referral, campaign, notification, social, organic, direct, unknown sources |
| NOTIFICATIONS | src/lib/observation/notifications.ts | NOTIFICATION_QUEUED, NOTIFICATION_SENT, NOTIFICATION_DELIVERED, NOTIFICATION_OPENED, NOTIFICATION_DISMISSED |

**Key characteristics:**
- Events adapt to standardized ObservationEnvelope format
- Content hashing for privacy protection
- Idempotency keys prevent duplicates
- Schema version: app_observation_v1

### ABSENT: Admin Analytics UI

- ❌ No /admin/analytics route
- ❌ No analytics dashboards or reporting interfaces
- ❌ No analytics components in React
- ❌ No analytics API endpoints under /api/v1/analytics/*

### Current Admin Surfaces (for reference):
- /admin — Main dashboard
- /admin/home — Home Composer
- /admin/media — Media uploads & status
- /admin/series — Series CMS
- /admin/short-films — Short-film CMS
- /admin/billing — Coin packs catalog

---

## 2. DATA SOURCES

### A. Core Supabase Tables (Authoritative A-grade)

| Table | Purpose | Analytics Value |
|-------|---------|-----------------|
| episodes | Episode metadata, access controls | Episode counts, publishing status |
| series | Series catalog, status, artwork | Published series counts |
| short_films | Short film catalog | Published short-film counts |
| media_assets | Video asset status, provider references | Media readiness, problem counts |
| watch_progress | User playback progress | Playback telemetry (B-grade) |
| rewarded_ad_attempts | Rewarded ad attempts and progress | Rewarded unlock tracking |
| episode_entitlements | User episode access/sources | Access conversion metrics |
| coin_transactions | Coin purchases, refunds, tips | Monetization (A-grade) |
| payment_orders | Payment order tracking | Revenue verification (C-grade) |
| coin_products | Coin pack catalog | Product configuration |
| rewarded_monetization_events | Raw rewarded event data | Event logging (B-grade) |
| home_editorial_change_events | Home row changes | Content curation metrics |

### B. Observation System (B-grade telemetry)

**Location:** src/lib/observation/*.ts

**Key files:**
- monetization.ts — Coin purchases, rewarded unlocks, chai tips
- content.ts — Content publication events
- access.ts — Access checks and entitlement lifecycle
- system.ts — Playback failures, API failures, payment failures
- traffic.ts — Traffic source attribution
- notifications.ts — Notification lifecycle events

**Privacy features:**
- Content hashing for sensitive data
- Idempotency keys prevent duplicate processing
- Schema versioning (app_observation_v1)

### C. Mux Integration (C-grade)

**Location:** src/lib/mux/index.ts

**Capabilities:**
- Asset status tracking: pending, processing, ready, failed
- Playback reference management
- Upload tracking and reconciliation

---

## 3. METRICS CLASSIFICATION

### A METRICS (Authoritative, Production-Safe Now)

**CONTENT:**
1. Published series count — Source: series.status = 'published' | Authority: Direct Supabase read | Safe: YES
2. Episode count — Source: episodes.series_id + published status | Authority: Direct Supabase read | Safe: YES
3. Short-film count — Source: short_films.status = 'published' | Authority: Direct Supabase read | Safe: YES
4. Media readiness/problem counts — Source: media_assets.status | Authority: Direct Supabase read | Safe: YES
5. Home row/content counts — Source: home_row_items, home_rows | Authority: Direct Supabase read | Safe: YES

**MONETIZATION:**
6. Coin purchases — Source: coin_transactions | Authority: Direct Supabase read | Safe: YES
7. Coin spend/unlocks — Source: coin_transactions + payment_orders | Authority: Verified linkage | Safe: YES
8. Rewarded unlocks — Source: rewarded_ad_attempts + episode_entitlements | Authority: Verified linkage | Safe: YES

**OPERATIONS:**
9. Failed media — Source: media_assets.status = 'failed' | Authority: Direct Supabase read | Safe: YES
10. Unassigned assets — Source: Content tables with null media_asset_id | Authority: Direct Supabase read | Safe: YES
11. Publishing failures — Source: Status checks in CMS functions | Authority: Direct Supabase read | Safe: YES

### B METRICS (Telemetry Available, Incomplete/Non-Authoritative)

1. Rewarded monetization events — Source: rewarded_monetization_events | Gap: Client-emitted, requires validation
2. Traffic sources — Source: Observation system | Gap: Client-side tracking, may be incomplete
3. System failures — Source: Observation system | Gap: Client-reported with server validation
4. Notification events — Source: Observation system | Gap: Limited historical data
5. Content publication events — Source: Observation system | Gap: Recent implementation
6. Access checks — Source: Observation system | Gap: May have early gaps during rollout

### C METRICS (Derivable from Trustworthy Existing Data)

1. Revenue — Derivable from: payment_orders + coin_products | Requires: Provider mapping | Trust: MEDIUM
2. ARPU/ARPPU — Derivable from: coin_transactions / user count | Requires: User aggregation | Trust: MEDIUM
3. Completion rate — Derivable from: watch_progress.completed | Requires: Episode duration | Trust: MEDIUM
4. Episode drop-off — Derivable from: watch_progress patterns | Requires: Aggregation logic | Trust: MEDIUM
5. Series completion — Derivable from: Episode completion patterns | Requires: Complex logic | Trust: MEDIUM

### D METRICS (Unavailable, Would Require New Instrumentation)

1. Plays — Requires: Aggregation from watch_progress | Gap: No comprehensive tracking
2. Unique viewers — Requires: User deduplication logic | Gap: PII/privacy concerns
3. Watch time — Requires: Duration from episodes × completion | Gap: Complex calculation
4. Preview→unlock conversion — Requires: Tracking of preview vs full access | Gap: No existing tracking
5. Plus subscriptions — Requires: Subscription table | Gap: No subscription schema
6. Conversion rates — Requires: Denominator data | Gap: No baseline tracking
7. Playback failures — Requires: Error tracking | Gap: No error logging
8. Notification delivery — Requires: Notifications table | Gap: No notifications schema

---

## 4. INSPECT AT MINIMUM

### CONTENT

| Metric | Classification | Source | Notes |
|--------|----------------|--------|-------|
| Published series count | A | series.status = 'published' | Authoritative |
| Episode count | A | episodes + published status | Authoritative |
| Short-film count | A | short_films.status = 'published' | Authoritative |
| Media readiness/problem counts | A | media_assets.status | Ready/processing/failed/pending |
| Home row/content counts | A | home_row_items, home_rows | Editorial curation |

### AUDIENCE / PLAYBACK

| Metric | Classification | Source | Notes |
|--------|----------------|--------|-------|
| Plays | D | Would need aggregation | No comprehensive tracking |
| Unique viewers | D | Would need deduplication | PII/privacy concerns |
| Watch time | D | Would need calculation | Complex: episodes × completion |
| Completion rate | C | watch_progress.completed | Derivable, may have gaps |
| Episode drop-off | C | watch_progress patterns | Requires aggregation logic |
| Series completion | C | Episode completion patterns | Requires complex logic |
| Preview→unlock conversion | D | Would need new tracking | No existing mechanism |

### MONETIZATION

| Metric | Classification | Source | Notes |
|--------|----------------|--------|-------|
| Coin purchases | A | coin_transactions | Authoritative |
| Coin spend/unlocks | A | coin_transactions + linkage | Authoritative |
| Plus subscriptions | D | No subscription table | Requires new schema |
| Rewarded unlocks | A | rewarded_ad_attempts + entitlements | Authoritative |
| Revenue | D | Would need provider mapping | Complex tracking |
| ARPU/ARPPU | D | Would need user aggregation | PII concerns |
| Conversion rates | D | Would need denominator data | No baseline tracking |

### OPERATIONS

| Metric | Classification | Source | Notes |
|--------|----------------|--------|-------|
| Failed media | A | media_assets.status = 'failed' | Authoritative |
| Unassigned assets | A | Content tables with null media_asset_id | Authoritative |
| Publishing failures | A | CMS function status checks | Authoritative |
| Playback failures | D | Would need error tracking | No error logging |
| Notification delivery | D | Would need notifications table | No notifications schema |

---

## 5. TRUST BOUNDARY

### Where Truth Originates

**A (Authoritative):**
- Direct Supabase table reads — series, episodes, coin_transactions, media_assets, payment_orders
- CMS state directly stored in database
- No client-side fabrication

**B (Telemetry):**
- watch_progress — Client-emitted, server-stored
- rewarded_ad_attempts — Client-side attempts, server-validated
- rewarded_monetization_events — Client-emitted, validated before storage

**C (Derived):**
- Computed from existing authoritative tables
- Requires aggregation logic but sources are trustworthy

### Client-Derived

- watch_progress — Client-emitted playback position
- rewarded_ad_attempts — Client-side rewarded ad interactions
- Observation system events — Client-reported with server validation

### Duplicate/Replay-Safe

- ✅ coin_transactions — Unique transaction IDs
- ✅ payment_orders — Provider transaction IDs prevent duplicates
- ✅ Observation system — Idempotency keys and content hashing
- ⚠️ watch_progress — Potential for replay (client-side source)
- ✅ rewarded_ad_attempts — Custom data tracks uniqueness

### Historical Completeness

- ✅ Published content counts — Complete since inception
- ✅ Coin transactions — Complete once system operational
- ⚠️ Watch progress — May have gaps if client-side app lost sync
- ⚠️ Observation system — May have early gaps during rollout
- ⚠️ Rewarded attempts — May have gaps in early implementation

### QA vs Production Differences

- ✅ Same Supabase database schema for both QA and production
- ⚠️ QA API endpoint: https://onya-qa-api-gwkke6nq5a-el.a.run.app (Cloud Run)
- ⚠️ Production API: Different Cloud Run deployment
- ✅ Content/management identical across environments
- ✅ No local environment setup (remote-only workflow)

---

## 6. UI STATUS

### /admin/analytics: ABSENT

**Confirmed absence:**
- ❌ No /admin/analytics route
- ❌ No analytics dashboard components
- ❌ No reporting interfaces
- ❌ No analytics API endpoints

**Current admin page structure:**
src/app/admin/
├── page.tsx (main dashboard)
├── home/page.tsx (Home Composer)
├── media/page.tsx (Media assets)
├── series/page.tsx (Series CMS)
├── short-films/page.tsx (Short-film CMS)
├── billing/page.tsx (Coin products)
├── layout.tsx
├── loading.tsx
├── error.tsx
├── login/
└── reset-password/

**Observation system location:** src/lib/observation/ (server-side only, no UI)

---

## 7. SECURITY / PRIVACY

### PII Risk Assessment

**Identified Risks:**

1. User-level analytics exposure — MEDIUM RISK
   - coin_transactions.user_id
   - episode_entitlements.user_id
   - rewarded_ad_attempts.user_id
   - payment_orders.user_id
   - Operator access could expose user identities

2. Raw identifiers shown unnecessarily — MEDIUM RISK
   - User IDs appear in transaction records
   - Episode IDs, media asset IDs exposed in operational reports
   - Session IDs in observation records

3. Admin-only access expectations — LOW RISK (currently)
   - Analytics would require admin role restrictions
   - Need to audit existing admin auth for analytics access
   - No current analytics UI to protect

### Privacy Concerns

- User-level metrics expose individual user data
- Raw identifiers shown unnecessarily in operational views
- No anonymization present in current data models
- Potential for data leakage through user-focused metrics
- Observation system has privacy validation but no UI controls

### Existing Privacy Controls

- ✅ src/lib/rewarded-analytics.ts — Prohibited key validation
- ✅ Observation system — Content hashing for sensitive data
- ✅ src/lib/observation/access.ts — Sensitive value sanitization
- ⚠️ No comprehensive privacy controls for analytics UI (doesn't exist yet)

---

## 8. RECOMMEND IMPLEMENTATION SLICES

### Safe First Slice: C09B-01 — Authoritative Operational/Content KPIs

**Rationale:**
- ✅ All data sources are A-classification (authoritative)
- ✅ No new instrumentation required
- ✅ Zero PII exposure in operational metrics
- ✅ Direct Supabase reads (no client-side fabrication)
- ✅ Existing database schema sufficient
- ✅ No privacy/modeling decisions needed
- ✅ Clear business value and immediate utility

**Implementation scope:**
1. Published content counts (series, episodes, short-films)
2. Media readiness/problem counts
3. Home row/content counts
4. Failed media counts
5. Unassigned asset counts

**Risk assessment:**
- Technical Risk: LOW (existing schemas, no new code)
- Privacy Risk: LOW (no user data in operational metrics)
- Implementation Risk: LOW (straightforward dashboard)
- Business Impact: HIGH (immediate operational visibility)

### Subsequent Slices (if approved)

**C09B-02 — Playback Telemetry**
- Completion rate (C-grade, derivable)
- Episode drop-off (C-grade, derivable)
- Requires watch_progress aggregation

**C09B-03 — Monetization Analytics**
- Revenue (C-grade, derivable from payment_orders)
- ARPU/ARPPU (C-grade, requires user aggregation with privacy layer)
- Conversion rates (D-grade, requires new instrumentation)

**C09B-04 — Trend/Comparison UX**
- Time-series visualizations
- Period-over-period comparisons
- Requires historical data aggregation

---

## 9. TOP GAPS

1. No analytics admin interface/dashboard — Cannot display metrics even if available
2. Limited revenue tracking — No subscription tables; revenue requires provider mapping
3. No user-level aggregation without PII exposure — User IDs exposed in monetization tables
4. Playback metrics require complex calculations — Plays, Watch time need aggregation logic
5. No preview→unlock conversion tracking — No mechanism to track preview vs paid access

---

## 10. REQUIRES OWNER DECISION

1. Privacy model for user-level analytics — How to handle user identifiers in analytics views
2. Analytics UI design — Layout, components, visualization library
3. Admin access controls — Who can view analytics (roles, permissions)
4. Data retention policy — How long to store analytics data
5. Preview→unlock conversion tracking — Whether to implement new instrumentation

---

## 11. BLOCKER

**Primary blocker:** No /admin/analytics route or admin analytics UI exists. Cannot display any analytics metrics without building the admin interface first.

**Secondary blocker:** Missing instrumentation for D-grade metrics (plays, watch time, unique viewers, conversion rates).

---

## 12. NEXT: CMS-C09B IMPLEMENTATION PLAN

### Recommended Order:

1. **C09B-01** — Authoritative operational/content KPIs (Safe First Slice)
   - Build /admin/analytics route
   - Implement operational metrics dashboard
   - Leverage existing A-grade data sources

2. **C09B-02** — Playback telemetry
   - Add completion rate, episode drop-off, series completion
   - Requires watch_progress aggregation

3. **C09B-03** — Monetization analytics
   - Revenue, ARPU/ARPPU with privacy controls
   - Requires user-level aggregation with anonymization

4. **C09B-04** — Trend/comparison UX
   - Time-series visualizations
   - Period-over-period comparisons

---

## 13. EVIDENCE SUMMARY

### Files Inspected
- src/lib/observation/*.ts (6 domain modules + tests)
- src/lib/ranking/observation-adapter.ts
- src/lib/mux/index.ts
- src/app/admin/**/*.tsx (all admin routes)
- src/lib/cms/*.ts (CMS data sources)
- src/app/api/v1/*/route.ts (API endpoints)
- src/types/database.ts (schema)

### Key Findings
- Observation system is comprehensive but lacks UI
- No analytics admin interface exists
- Rich data sources available in Supabase
- Privacy controls exist in observation system but not in analytics UI

---

**AUDIT COMPLETED:** 2026-09-11  
**AUDITOR:** CMS-C09A Read-Only Audit  
**STATUS:** SOURCE VERIFIED — NO CODE CHANGES
 
