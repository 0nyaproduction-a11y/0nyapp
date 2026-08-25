---
title: "0nya CMS Product Contract"
version: "1.0"
status: "Implementation Companion"
authority: "Use with Product Bible v3.0, Master Flow v1.1, and All-Screen Wireframes v1.0"
date: "2026-08-21"
product: "0nya"
---

# 0nya CMS PRODUCT CONTRACT v1.0

**Read with:**

1. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
2. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
3. `docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md`

> This document defines what the CMS/editorial layer must be able to control for the consumer app.
>
> It does **not** prescribe a specific CMS vendor, database technology, admin framework, or paid SaaS.
>
> Existing backend/CMS infrastructure should be reused wherever possible.

---

# 1. CMS PRINCIPLE

The CMS is authoritative for content/editorial configuration.

The consumer client must not hardcode:

- free episode count
- Episode 4 paywall
- coin price
- rewarded-ad availability
- Plus eligibility
- episode release date
- Home row order
- short-film mid-roll positions
- short-film post-roll eligibility
- Chai availability
- content ratings/descriptors

The CMS should allow these values to be changed without requiring a consumer-app release wherever technically practical.

---

# 2. CMS SCOPE

The CMS should support these product areas:

```text
Series
Episodes
Vertical Short Films
Home / Editorial Rows
Coin Packs
Chai Configuration
Content Ratings / Descriptors
Release Scheduling
Feature Flags
Notification Templates / Targeting
Creator Mapping
Basic Editorial Metadata
```

Existing creator submission/dashboard workflows should remain compatible unless an approved shared-data change requires otherwise.

---

# 3. SERIES ENTITY

Minimum conceptual fields:

```text
id
title
slug
synopsis
poster
hero_art
genres[]
language
creator_id / creator_reference
content_rating
content_descriptors[]
total_episode_count
published_episode_count
status
editorial_flags[]
created_at
updated_at
```

Optional/future fields may exist.

For MVP consumer metadata, the primary visible credit is creator/director. Optional writer, cast and artist credits may exist where available, but they must not block publication or require identical duplication on every episode.

## Series status examples

```text
draft
scheduled
published
paused
archived
```

Do not assume exact enum names if the existing backend already uses different names.

---

# 4. EPISODE ENTITY — CRITICAL ACCESS CONTROL

Each micro-drama episode must be independently configurable.

Minimum conceptual fields:

```text
id
series_id
episode_number
title
duration_seconds
hls_url / playback_reference
subtitle_tracks[]
thumbnail
publish_at

free_access
coin_unlock_enabled
coin_price
rewarded_unlock_enabled
rewarded_access_mode
plus_access
locked_preview_seconds

content_rating_override?
content_descriptors_override?
status

created_at
updated_at
```

## Core rule

There is **no platform-wide mandatory first-three-free rule**.

CMS must allow:

```text
Episode 1  free
Episode 2  free
Episode 3  coin + ad + Plus
Episode 4  Plus only
Episode 5  coin + Plus
Episode 6  free
```

or any other approved combination.

The client must render what CMS/backend resolves.

For long-series authoring, CMS should support a create-once / add-many / apply-defaults / override-individually workflow conceptually, including bulk changes for episode-controlled values that already belong to the contract. Bulk defaults are editorial convenience only; they never become hardcoded client policy.

---

# 5. EPISODE ACCESS VALIDATION

CMS/admin UI should prevent obviously invalid configuration where possible.

Examples:

### Free episode

```text
free_access = true
```

Other unlock methods may remain configured internally if existing architecture requires it, but the consumer access resolver should treat free access as immediately playable.

### Coin unlock

```text
coin_unlock_enabled = true
coin_price > 0
```

If coin unlock is disabled, coin price should not be shown to the viewer.

### Rewarded-ad unlock

```text
rewarded_unlock_enabled = true
rewarded_access_mode = permanent | session
```

This means:

> Viewer may explicitly choose a rewarded ad to unlock this episode.
> Verified completion grants access according to rewarded_access_mode
> (permanent ownership, or session-only access).

It does **not** mean:

> Insert an ad into normal micro-drama playback.

### Plus

```text
plus_access = true
```

Plus should not be assumed for every future episode if CMS/backend supports per-episode control.

### Preview

```text
locked_preview_seconds >= 0
```

`0` means:

```text
no preview
-> paywall directly
```

---

# 6. EPISODE RELEASE MANAGEMENT

CMS should support:

```text
publish_at
status
```

The app should be able to distinguish:

```text
published / playable
scheduled / coming soon
draft / unavailable
```

Do not rely only on episode number to infer release.

---

# 7. SHORT FILM ENTITY

Minimum conceptual fields:

```text
id
title
slug
synopsis
poster
hero_art?
creator_id / creator_reference
duration_seconds
hls_url / playback_reference
subtitle_tracks[]
language

content_rating
content_descriptors[]

status
publish_at

midroll_enabled
midroll_timecodes[]
postroll_enabled
chai_enabled

created_at
updated_at
```

Short films should show the primary creator/director credit in consumer UI. Optional writer/cast/artist credits may be carried where available, but they are not a publication blocker and do not need to be fully enumerated for MVP.

---

# 8. SHORT FILM COMMERCIAL RULES

Vertical Short Films are:

```text
always playable
never coin-locked
never subscriber-only
```

For non-Plus viewers:

```text
CMS may enable mid-roll
CMS may enable post-roll
```

For Plus viewers:

```text
short-film ads are suppressed
```

Do not add fields such as:

```text
short_film_coin_price
short_film_plus_only
```

unless the Product Bible is explicitly revised.

---

# 9. MID-ROLL TIMECODES

If:

```text
midroll_enabled = true
```

CMS should support editorially chosen safe insertion points.

Conceptual example:

```json
{
  "midroll_enabled": true,
  "midroll_timecodes": [242, 611]
}
```

Timecodes should be expressed consistently, preferably seconds from start unless existing backend already uses a documented format.

CMS should validate:

```text
timecode > 0
timecode < duration
no duplicate timecodes
reasonable spacing between multiple breaks
```

Do not make the client blindly insert an ad at 50%.

---

# 10. POST-ROLL

Conceptual field:

```text
postroll_enabled
```

Consumer behavior:

```text
Film completes
 -> if non-Plus and postroll_enabled
 -> post-roll ad
 -> Film End
 -> Chai / Share / Related
```

Ad no-fill/failure should not block the viewer from reaching Film End.

---

# 11. CHAI CONFIGURATION

Chai is an **0nya coin tip**.

It is not a second currency.

It is not direct cash/UPI tipping.

## Film-level field

```text
chai_enabled
```

## Global/config fields

Conceptually:

```text
allowed_chai_coin_amounts[]
creator_mapping
chai_feature_enabled
```

Example:

```json
{
  "allowed_chai_coin_amounts": [5, 10, 20, 50]
}
```

Viewer flow must always display current allowed values from configuration where available.

---

# 12. CHAI CREATOR MAPPING

Each Chai-enabled short film must resolve to an eligible creator/ledger destination.

Conceptually:

```text
short_film_id
creator_id
creator_ledger_id / accounting_reference
chai_enabled
```

The viewer-facing UI must not expose internal payout-accounting fields.

Viewer sees:

```text
Chai: 20 Coins
```

Back-office accounting may later convert eligible creator earnings according to creator agreement and net revenue.

Do not promise:

```text
1 coin = fixed ₹ cash value to creator
```

unless a separately approved policy says so.

---

# 13. HOME / EDITORIAL CONFIGURATION

CMS should be able to define Home rows without a consumer-app release where practical.

Conceptual structure:

```text
Home Page
  -> ordered rows
  -> row type
  -> title
  -> content membership
  -> visibility
```

Minimum conceptual row fields:

```text
id
title
row_type
sort_order
enabled
audience_rule?
items[]
```

Supported initial row concepts:

```text
Featured Hero
Start Here
Continue Watching (system-generated)
Recommended / Because You Watched (system-generated if available)
Trending Now
New Releases
Micro Dramas
Vertical Short Films
Staff Picks
```

Continue Watching should remain system/history-driven rather than manually curated.

---

# 14. FEATURED HERO

CMS/editorial should support selecting hero content.

Conceptual fields:

```text
content_id
content_type
hero_art
headline_override?
short_hook?
enabled
start_at?
end_at?
priority
```

Consumer CTA behavior is defined by Product Bible/Master Flow.

CMS should not attempt to redefine navigation behavior.

---

# 15. START HERE

CMS/editorial should support a curated Start Here collection.

Purpose:

> Help new / low-history viewers begin quickly.

Conceptual fields:

```text
row_id
content_ids[]
enabled
sort_order
```

The threshold deciding whether H01 or H02 is shown may be backend/config-controlled.

---

# 16. COIN PACK CONFIGURATION

Coin packs are commerce configuration, not hardcoded client constants.

Conceptual fields:

```text
id
store_product_id
coin_amount
enabled
display_order
platform
```

Localized price should come from the applicable store/billing source rather than being manually hardcoded in CMS if the store is authoritative.

CMS/admin may store product mapping, but consumer price display should use verified localized store data.

---

# 17. PLUS CONFIGURATION

There is one paid consumer tier:

```text
0nya Plus
```

CMS/backend may maintain mappings for:

```text
monthly product
yearly product
other approved billing periods
enabled/disabled
```

Do not create:

```text
Prime
Premium
Gold
VIP
```

as additional consumer tiers without a Bible revision.

---

# 18. CONTENT RATING / DESCRIPTORS

Supported classification values should align with current approved product policy.

Initial values:

```text
U
U/A 7+
U/A 13+
U/A 16+
A
```

CMS should support descriptors such as:

```text
language
violence
sexual content
substance use
fear / horror
mature themes
```

Exact descriptor taxonomy should remain centrally controlled rather than free-text wherever possible.

---

# 19. PARENTAL / AGE FLAGS

CMS/backend should make required access controls available to the client.

Conceptual output:

```text
content_rating
content_descriptors[]
parental_lock_required
age_verification_required
```

For A-rated content:

> Do not publish in MVP until reliable approved age verification exists.

---

# 20. NOTIFICATION CONFIGURATION

CMS/admin may support notification content and targeting.

Conceptual fields:

```text
template_id
notification_type
title
body
target_rule
content_id?
enabled
schedule?
```

Types may include:

```text
new release
episode release
transactional billing
account/security
marketing
```

Marketing messages require applicable viewer consent.

Do not treat notification templates as permission to bypass consent rules.

---

# 21. FEATURE FLAGS

CMS/config may expose approved feature flags.

Conceptual examples:

```text
moving_previews_enabled
share_to_unlock_enabled
advanced_deep_linking_enabled
rating_prompt_enabled
a_rated_content_enabled
```

Default state should follow Product Bible.

A feature flag must not be used to silently override a LOCKED product rule.

---

# 22. EDITORIAL VALIDATION

Before publish, CMS should warn or block where practical if:

```text
required title missing
poster/playback reference missing
published episode has no playback source
coin enabled but coin_price invalid
short-film midroll enabled but no valid timecode
A-rated content enabled without approved age-verification capability
Chai enabled but no creator/ledger mapping
scheduled content has invalid publish_at
```

Existing CMS validation mechanisms should be reused.

---

# 23. ROLE / PERMISSION CONCEPT

Reuse existing auth/role model.

Conceptually, CMS permissions may distinguish:

```text
Editorial
Content Operations
Commercial/Admin
Creator-facing read-only / limited access
Super Admin
```

Do not build a new complex RBAC system if current backend already has sufficient roles.

Sensitive commercial fields such as coin pack mappings, subscription product IDs, and creator ledger mappings should not be editable by every editorial user.

---

# 24. AUDITABILITY

Important configuration changes should be traceable where current backend supports it.

Useful audit fields:

```text
updated_by
updated_at
previous_value / revision history
publish action
```

Prioritize auditability for:

```text
episode access changes
coin price changes
release scheduling
Plus eligibility
Chai configuration
short-film ad timecodes
content rating changes
```

Do not introduce a paid audit-log service solely for MVP.

---

# 25. CREATOR DASHBOARD COMPATIBILITY

Existing creator dashboard/submission behavior must be preserved unless explicitly revised.

Creator reporting may include:

```text
film-level Chai coin totals
eligible creator reporting
content performance already supported by system
```

Do not expose:

```text
viewer phone number
viewer identity
raw payment receipt
private account information
```

Chai reporting should be aggregated/appropriate for creator use.

---

# 26. CMS VS BACKEND RESPONSIBILITY

CMS:

```text
author/editorial configuration
content metadata
access configuration
commercial configuration inputs
release schedule
ad insertion points
ratings/descriptors
feature configuration
```

Backend:

```text
validates CMS state
resolves viewer-specific entitlement
processes wallet/ledger transactions
verifies purchases
verifies rewarded-ad completion
returns effective access response
protects server-side invariants
```

Consumer client:

```text
renders effective state
does not invent policy
```

---

# 26A. DESTRUCTIVE CONTENT MANAGEMENT

- Archive/unpublish remains the normal editorial workflow.
- Authorized CMS admins may permanently delete eligible editorial records.
- Exact confirmation is required for every destructive action.
- Protected entitlement, commerce, accounting, and history dependencies must block deletion.
- Series-level "Delete All Episodes" and "Delete Series + All Episodes" are supported for operational cleanup.
- Content deletion may also remove exclusively owned Mux assets and their orphaned `media_assets` rows after the editorial records are gone.
- Shared Mux/media assets must be preserved.
- If provider cleanup fails after content deletion, the media asset row must be preserved for retry.

---

# 27. CMS EFFECTIVE ACCESS EXAMPLE

CMS may store:

```json
{
  "free_access": false,
  "coin_unlock_enabled": true,
  "coin_price": 9,
  "rewarded_unlock_enabled": true,
  "rewarded_access_mode": "permanent",
  "plus_access": true,
  "locked_preview_seconds": 3
}
```

Backend combines this with viewer state:

```text
viewer owns permanent unlock?
viewer has active Plus?
episode published?
```

Then returns effective access to consumer app.

Client should not reconstruct security-sensitive entitlement logic purely from raw CMS flags if an effective backend access endpoint already exists.

---

# 28. DO NOT BUILD FROM THIS DOCUMENT ALONE

This CMS contract defines product requirements.

Before changing CMS/backend code:

1. inspect current repository
2. inspect existing database/schema
3. inspect existing admin/CMS implementation
4. inspect creator workflows
5. map existing field names to these product semantics
6. identify gaps
7. make the smallest compatible changes

Do not rename production fields merely to match this document.

---

# 29. COPILOT CMS AUDIT PROMPT

Use before any CMS implementation:

```text
Read:

1. docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
2. docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
3. docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md
4. docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md
5. .github/copilot-instructions.md

Do not modify code.

Audit the current repository's backend/CMS/admin implementation against
0nya_CMS_PRODUCT_CONTRACT_v1.0.md.

Report:

1. Existing CMS/admin screens and files.
2. Existing content/database models.
3. Existing Series fields.
4. Existing Episode fields.
5. Existing Short Film fields.
6. Existing Home/editorial configuration.
7. Existing coin/subscription configuration.
8. Existing creator mapping / Chai-related infrastructure.
9. Existing content-rating fields.
10. Existing feature flags.
11. Existing roles/permissions.
12. Which CMS contract requirements already exist.
13. Which requirements are missing.
14. Which existing field names map to the conceptual fields in the CMS contract.
15. Any dangerous schema migration that should be avoided.
16. Minimum changes needed for Build 15.

Do not rename schemas.
Do not create migrations.
Do not install packages.
Do not modify code.
Do not commit or push.
```

---

# 30. AUTHORITY ORDER

If instructions conflict:

1. Current explicitly approved product decision
2. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
3. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
4. `docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md`
5. `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`
6. Repository AI instructions
7. Existing implementation conventions
8. AI preference

---

**0nya / शून्य**

**CMS PRODUCT CONTRACT v1.0**
