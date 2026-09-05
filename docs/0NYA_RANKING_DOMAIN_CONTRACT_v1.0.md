# 0nya Ranking Domain Contract

**Version:** 1.0  
**Status:** APPROVED ARCHITECTURAL BASELINE / CANONICAL DOMAIN BRIDGE  
**Date:** 2026-09-05  
**Scope:** Consumer App ranking/discovery domain ↔ future 0nya Autonomous integration  
**Repositories:** Physically and logically separate  
**Live autonomous ranking:** NOT AUTHORIZED  
**AI recommendation:** DEFERRED / NOT IMPLEMENTED BY THIS CONTRACT  
**0nya Autonomous Constitution:** LOCKED / UNCHANGED  
**Autonomous Seed action space:** UNCHANGED  

---

## 0. Purpose

This contract defines the canonical boundary between:

1. the **0nya Consumer App Ranking/Discovery domain**, and
2. the **0nya Autonomous system**.

It exists so the App can build a complete, auditable ranking and discovery foundation now while remaining compatible with future observation, shadow evaluation, and—only after explicit authorization—bounded autonomous recommendation experiments.

This document is **not** the 0nya Autonomous Constitution.  
It does **not** modify the Autonomous Seed.  
It does **not** authorize live autonomous ranking.  
It does **not** implement AI recommendation.  
It does **not** replace CMS/editorial authority.

The governing relationship is:

```text
0nya App Ranking System
        ↓
observations + ranking decisions + outcomes
        ↓
Ranking Event / Domain Adapter
        ↓
0nya Autonomous Runtime/Core
```

Only after shadow-mode proof and explicit Product Owner authorization may a reverse action path exist:

```text
0nya Autonomous
        ↓
bounded recommendation
        ↓
Ranking Action Adapter
        ↓
0nya App Ranking Engine
```

The App Ranking domain remains independently operable when the Autonomous system is absent, disabled, unavailable, uncertified, or disconnected.

---

# 1. Authority and Precedence

This contract supplements existing 0nya authority. It never overrides it.

Use this order:

1. New explicit Product Owner-approved decision.
2. Root `AGENTS.md`.
3. Current canonical 0nya product/security/backend/CMS authority documents.
4. Verified current repository/source/runtime evidence.
5. `APP_COMPLETION_ROADMAP.md`.
6. This Ranking Domain Contract for ranking-domain integration semantics.
7. Agent-state, handover, audit, and task reports.

For Autonomous-system behavior, its own locked Constitution and certification rules remain authoritative within the Autonomous repository/system.

This contract may define how the App exposes ranking-domain evidence to Autonomous. It may not redefine Autonomous constitutional invariants.

---

# 2. Permanent Separation Rules

The following are locked architectural boundaries for this domain integration.

## 2.1 Ranking is an App domain

The Ranking System belongs to the Consumer App/product domain.

It owns:

- content taxonomy used for discovery;
- ranking requests;
- candidate generation;
- deterministic ranking;
- CMS/editorial ranking;
- ranking policy identity;
- ranking decision identity;
- candidate-set evidence;
- ranking result ordering;
- ranking event production;
- outcome linkage;
- Explore filtering/sorting;
- Home ranked collections;
- product recommendation reason codes;
- App-side ranking safety/product constraints.

The Ranking System is **not** the Autonomous organism.

## 2.2 Autonomous remains a separate system

0nya Autonomous owns its internal:

- observation processing;
- learning/reasoning;
- shadow prediction;
- autonomous decision reasoning;
- safety/governance logic;
- certification state;
- future bounded recommendation generation.

It does not own App content truth, CMS truth, entitlement truth, media readiness, content publication state, or final playback authorization.

## 2.3 Physical repository separation

The Consumer App repository and Autonomous repository remain physically separate.

No requirement in this contract permits:

- direct source-code imports across repositories;
- shared internal module paths;
- Autonomous code being copied into the Consumer App;
- App ranking code being copied into the Autonomous Seed;
- one repository treating the other's internal files as runtime dependencies;
- one repository writing directly into the other's private state.

Integration occurs only through explicit, versioned domain adapters/contracts.

## 2.4 Logical data separation

The App remains authoritative for App-domain source data.

Autonomous may receive only the ranking-domain observations/evidence explicitly exposed through the adapter.

Autonomous must not directly mutate:

- CMS tables/configuration;
- catalog/content records;
- editorial order;
- wallet/coins;
- subscriptions;
- entitlements;
- playback authorization;
- age/parental controls;
- media readiness;
- App ranking policy configuration.

A future authorized recommendation must return through the Ranking Action Adapter and must still pass App-owned validation and authority boundaries.

---

# 3. Existing Ranking Architecture Preserved

This contract strengthens rather than replaces the approved ranking architecture.

The following remain unchanged:

## 3.1 Canonical taxonomy

Format, genre, editorial classification, lifecycle state, compliance classification, and access/commercial state remain separate concepts.

## 3.2 Format

System-owned content types include:

```text
MICRO_DRAMA
SHORT_FILM
```

Format is not manually reinterpreted as genre.

## 3.3 Genre

Genres are CMS/backend-controlled taxonomy.

A content item may have:

```text
primary_genre
secondary_genres[]
```

where supported by the current product/schema authority.

Stable machine identifiers should be preferred over display labels for domain contracts.

## 3.4 Editorial classification

Editorial concepts are not genres.

Examples:

```text
STAFF_PICK
START_HERE
TRENDING_EDITORIAL
FEATURED
```

## 3.5 Lifecycle classification

Lifecycle concepts should derive from authoritative state/time where possible.

Examples:

```text
NEW_RELEASE
COMING_SOON
CURRENTLY_RELEASING
COMPLETED_SERIES
```

## 3.6 Compliance separation

Ratings/descriptors remain separate from recommendation taxonomy.

Ranking must not reinterpret or weaken compliance/parental policy.

## 3.7 Access/commercial separation

The following are access states, not genres or ranking categories:

```text
FREE
COIN
REWARDED
PLUS
```

Ranking never becomes final access authority.

## 3.8 CMS editorial authority

CMS/API ordering is canonical for editorial collections.

The App must not secretly rerank a CMS-ordered editorial collection unless a future, explicitly authorized ranking policy says that collection is algorithmically ranked.

## 3.9 Deterministic ranking

Launch-safe deterministic policies remain valid, including:

```text
EDITORIAL
NEWEST
STAFF_PICKS
MOST_WATCHED   only when trustworthy signals support it
```

Algorithmic personalized `For You` ranking remains deferred.

---

# 4. Core Domain Objects

This contract defines the following conceptual interfaces.

They are domain semantics, not mandatory database-table names.

```text
RankingObservation
RankingRequest
RankingDecision
RankingCandidateSet
RankingCandidate
RankingResult
RankingOutcome
RankingPolicyVersion
RankingReasonCode
RankingExperiment
RankingEligibilityFilter
RankingEditorialIntervention
RankingEventAdapter
RankingOutcomeAdapter
FutureRankingActionAdapter
```

Implementation must reuse existing repository structures where suitable and avoid duplicate competing systems.

---

# 5. Identity Semantics

## 5.1 ranking_decision_id

Every generated ranked collection must have one stable unique identifier:

```text
ranking_decision_id
```

It identifies one ranking evaluation/result set.

It must allow reconstruction of:

```text
ranking request
→ candidate set
→ filters
→ ordered result
→ served items
→ impressions
→ opens
→ plays
→ outcomes
```

Two requests using the same policy/configuration may still have different `ranking_decision_id` values.

A CMS row ID is not a substitute for `ranking_decision_id`.

## 5.2 actor_id

`actor_id` represents the ranking-domain actor when an approved safe identity exists.

Rules:

- it may be pseudonymous;
- it may be absent;
- it must not imply authentication when the viewer is anonymous;
- it must not carry raw phone numbers, access tokens, OTPs, or other sensitive identity material;
- the same event contract must support authenticated, anonymous, and pseudonymous traffic.

## 5.3 session_id

`session_id` identifies a discovery/session context.

It is distinct from account identity.

It should support analysis of:

```text
ranking exposure
→ navigation
→ playback
→ session outcome
```

without requiring the viewer to be authenticated.

Exact session-lifetime policy must be defined by the App implementation/privacy architecture; this contract does not invent a duration.

---

# 6. Ranking Policy Identity and Versioning

Every RankingDecision must identify the logic that produced it.

Minimum conceptual fields:

```text
ranking_policy
ranking_policy_version
config_version
config_hash?
ranking_engine_version?
```

Examples:

```text
ranking_policy = editorial
ranking_policy_version = trending_v1

ranking_policy = newest
ranking_policy_version = release_date_v1

ranking_policy = most_watched
ranking_policy_version = qualified_watch_v1
```

Future example only:

```text
ranking_policy = learned
ranking_policy_version = model_2028_04
```

`config_version` represents the effective ranking/editorial/config state relevant to that decision.
It is the human/operator-friendly configuration identity.

`config_hash` is reserved as an optional exact machine-reproducible configuration identity.
Do not require `config_hash` until a canonical configuration representation exists.

`ranking_engine_version` is reserved as an optional producing service/code/model implementation
identity where needed for audit. It is not required in Android/client responses unless there is
a concrete product or audit need.

Use these identities distinctly:

```text
ranking_policy_version
```

describes the ranking logic/policy semantic version.

```text
config_version / config_hash
```

describes the effective policy/config state.

```text
ranking_engine_version
```

describes the producing implementation identity where needed for audit.

A later analyst must be able to distinguish:

```text
viewer behavior changed
vs
ranking policy changed
vs
ranking configuration changed
vs
catalog/eligibility changed
vs
traffic composition changed
```

Do not overload a generic app build number as the only ranking-policy version.

---

# 7. Candidate Set Evidence

A ranked list alone is insufficient evidence.

The system must know, or be able to reconstruct, what content entered consideration.

Minimum conceptual reference:

```text
candidate_set_id
candidate_set_version
candidate_count
eligibility_snapshot_ref?
```

The candidate set may be persisted directly, derived from a versioned snapshot/query definition, or reconstructed from another safe canonical reference.

The contract does **not** require every event to carry every candidate ID.

Candidate-set reconstruction must reproduce eligibility as it existed at ranking-decision time,
not merely current catalog state.

`eligibility_snapshot_ref` is reserved as an optional conceptual reference for decision-time
eligibility reconstruction. This contract does not prescribe the storage mechanism.

The evidence model must distinguish:

```text
candidate existed but ranked low
candidate was filtered
candidate was unavailable
candidate was unpublished
candidate was editorially blocked
candidate never entered the pool
```

Absence from a ranked list must never automatically mean poor performance.

---

# 8. Eligibility and Filtering

Ranking candidate eligibility and final content authorization are separate stages.

Conceptual candidate lifecycle:

```text
DISCOVERED_CANDIDATE
        ↓
ELIGIBLE_CANDIDATE
        ↓
RANKED_CANDIDATE
        ↓
SERVED_CANDIDATE
        ↓
IMPRESSION
```

Filtering reasons must be recorded or reconstructible where they materially affect ranking evaluation.

Example vocabulary:

```text
UNPUBLISHED
MEDIA_UNAVAILABLE
AGE_RESTRICTED
REGION_RESTRICTED
ENTITLEMENT_POLICY
EDITORIAL_BLOCK
INVALID_CONTENT_STATE
```

The exact implementation vocabulary must match the App's real eligibility architecture.

Important:

`ENTITLEMENT_POLICY` as a ranking/filter reason does not make the ranking engine authoritative for entitlement.

Final access/playback remains governed by the existing backend access and playback authorization systems.

---

# 9. Ranking Decision Contract

Conceptual schema:

```text
RankingDecision {
  ranking_decision_id
  created_at

  actor_id?
  session_id

  ranking_policy
  ranking_policy_version
  config_version
  config_hash?
  ranking_engine_version?

  candidate_set_id
  candidate_set_version
  candidate_count
  eligibility_snapshot_ref?

  source_surface
  row_id?

  deterministic

  experiment_id?
  experiment_variant?

  propensity_type?
  selection_probability?

  ordered_results[]
}
```

Each ordered result:

```text
RankingResult {
  content_id
  content_type
  position

  recommendation_reason?

  editorial_intervention?
  editorial_change_ref?

  selection_probability?
}
```

Implementation may add only fields that have a concrete product/evaluation need.

---

# 10. Served vs Impression

The system must distinguish server/client delivery from actual exposure.

## 10.1 content_served

Means:

> the ranking result was delivered into the client/surface context.

It does **not** mean the user saw it.

## 10.2 content_impression

Means:

> the content received meaningful viewport exposure according to the current client measurement policy.

Do not invent an arbitrary impression threshold in this architecture document.

Future-quality fields may include:

```text
visibility_fraction?
visible_duration_ms?
```

They should only be implemented when the client can measure them reliably.

---

# 11. Mandatory Placement Context

Ranking evidence must preserve placement context.

Minimum:

```text
source_surface
row_id?
position
```

Example:

```text
content_id = xyz
source_surface = home
row_id = trending
position = 3
ranking_decision_id = ...
```

A ranking impression without placement context is incomplete evidence.

`row_id` may be absent on surfaces that do not use row semantics, but `source_surface` and result `position` remain required where ranking occurred.

---

# 12. Ranking Event Contract

Compact conceptual envelope:

```text
RankingEvent {
  event_id
  event_type
  occurred_at

  ranking_decision_id

  actor_id?
  session_id

  content_id
  content_type

  source_surface
  row_id?
  position?

  recommendation_reason?

  experiment_id?
  experiment_variant?

  attribution_source?
  attribution_policy?

  event_data?
}
```

Recommended event vocabulary:

```text
content_served
content_impression
content_open

play_start
qualified_watch
play_complete
play_abandon

share
tip
hide
skip
quick_back
session_exit_after_open
```

Do not emit noisy derived events unnecessarily.

Example:

```text
impression_without_open
```

should normally be derived from event evidence rather than emitted independently.

---

# 13. Outcome Semantics

Ranking success is not one permanent metric.

Preserve independent observed signals:

```text
impression
open
play_start
qualified_watch
watch_time
play_complete
share
tip
return
hide
skip
abandonment
```

Do not permanently define:

```text
CTR = truth
raw views = truth
completion = truth
```

and do not collapse all observations into one fixed reward formula unless a future approved ranking policy explicitly defines such a function.

Raw evidence remains available for future evaluation.

---

# 14. Negative Evidence

Future ranking learning/evaluation must receive non-positive evidence as well as positive evidence.

Supported concepts include:

```text
quick_back
play_abandon
hide
not_interested
skip
session_exit_after_open
```

Only emit negative events that can be measured reliably.

Absence-derived outcomes should remain derived when appropriate.

---

# 15. Delayed Outcome Attribution

Ranking effects may occur after the immediate interaction.

Example:

```text
content impression
→ no immediate open
→ later search
→ title open
→ watch
```

The system must support association with prior ranking evidence through:

```text
ranking_decision_id
attribution_source
attribution_policy
```

Delayed attribution represents an attribution hypothesis/evidence relationship unless causality
has been established through an approved evaluation method. Do not treat a later search, open,
or watch as automatically proven causal credit for an earlier ranking exposure.

Example future attribution sources:

```text
DIRECT
LATER_SEARCH
LATER_RETURN
RELATED_NAVIGATION
```

This contract intentionally does not define an arbitrary attribution time window.

If attribution windows are introduced later, they must be policy/version controlled.

---

# 16. Recommendation Reason vs Autonomous Decision Reason

Two semantic namespaces must remain separate.

## 16.1 Product / recommendation reason

Examples:

```text
NEW_RELEASE
TRENDING
STAFF_PICK
SAME_GENRE
CONTINUE_WATCHING
BECAUSE_YOU_WATCHED
POPULAR_IN_ROMANCE
```

Field:

```text
recommendation_reason
```

## 16.2 Future Autonomous decision reason

Examples:

```text
GREEDY
EXPLORE
SURVIVAL
SAFETY_RESTRICTED
OWNER_OVERRIDE
```

Field:

```text
autonomous_decision_reason
```

`autonomous_decision_reason` is not required today because Autonomous does not control ranking.

Future example:

```text
recommendation_reason = SAME_GENRE
autonomous_decision_reason = EXPLORE
```

The two fields must never be conflated.

---

# 17. Editorial Intervention Provenance

CMS/editorial authority remains intact.

Editorial ranking interventions must be distinguishable from algorithmic behavior.

Conceptual types:

```text
EDITORIAL_PIN
EDITORIAL_BOOST
EDITORIAL_REMOVE
EDITORIAL_ORDER
```

Optional provenance:

```text
editorial_change_ref
```

or an equivalent reference compatible with the existing CMS audit/change model.

Do not teach future learning systems that an editor-forced position was an organic ranking outcome.

---

# 18. Experiment Identity

Reserve clean experiment semantics:

```text
experiment_id
experiment_variant
```

No experimentation platform is required by this contract.

These fields exist for traceability so future A/B, randomized, exploration, or shadow comparisons do not mix incompatible policies/variants.

---

# 19. Propensity Readiness

Deterministic editorial ranking must not invent fake selection probabilities.

Current deterministic example:

```text
deterministic = true
selection_probability = null
propensity_type = none
```

The contract reserves propensity support for future:

```text
A/B tests
randomized ordering
exploration
personalized ranking
learned ranking
bounded autonomous experiments
```

Possible future fields:

```text
selection_probability
propensity_type
```

These may only be populated when the producing policy can compute or reconstruct meaningful probabilities.

This preserves future off-policy evaluation and exposure-bias correction without forcing a schema redesign.

---

# 20. RankingObservation

A `RankingObservation` is the App-domain evidence exposed to an adapter.

It may reference one or more of:

```text
RankingDecision
RankingCandidateSet
RankingEvent
RankingOutcome
RankingPolicyVersion
RankingExperiment
RankingEligibilityFilter
RankingEditorialIntervention
```

It must not expose secrets or unrelated product data.

The adapter should receive the minimum evidence needed for the authorized Autonomous observation purpose.

---

# 21. RankingOutcome

A conceptual outcome object may normalize downstream evidence for export/evaluation:

```text
RankingOutcome {
  ranking_decision_id
  actor_id?
  session_id

  content_id
  content_type

  outcome_type
  occurred_at

  source_surface
  row_id?
  original_position?

  attribution_source?
  attribution_policy?

  value?
  metadata?
}
```

`value` is optional and should be used only for inherently quantitative outcomes such as approved watch-time units.

Do not use `value` as a generic hidden reward score.

---

# 22. Ranking Event / Outcome Adapters

## 22.1 RankingEventAdapter

Direction:

```text
App Ranking Domain
→ Autonomous
```

Purpose:

- translate versioned App ranking evidence into the approved Autonomous observation interface;
- preserve ranking identity/provenance;
- prevent Autonomous from depending on App internal database/schema details.

It is observation-only.

## 22.2 RankingOutcomeAdapter

Direction:

```text
App Ranking Domain
→ Autonomous
```

Purpose:

- export outcome evidence associated with prior decisions;
- preserve delayed-attribution semantics;
- expose raw/normalized outcomes without collapsing them into a permanent reward formula.

It is observation-only.

## 22.3 FutureRankingActionAdapter

Direction, only if later authorized:

```text
Autonomous
→ App Ranking Domain
```

Current status:

```text
DEFINED AS FUTURE BOUNDARY ONLY
NOT IMPLEMENTED
NOT CONNECTED
NOT AUTHORIZED
```

It must never provide direct database/CMS mutation.

A future action must be interpreted as a bounded recommendation proposal that the App Ranking Engine validates against:

- currently authorized action scope;
- current ranking policy;
- editorial constraints;
- candidate eligibility;
- safety/product restrictions;
- current catalog state.

Final entitlement/access/playback authorization remains outside autonomous ranking authority.

---

# 23. Autonomous Shadow-Mode Boundary

The integration order is mandatory.

## Stage 1 — Independent App Ranking

The App Ranking system operates normally with:

```text
CMS editorial ranking
deterministic ranking
taxonomy
Explore/Search discovery
ranking evidence
```

Autonomous is not required.

## Stage 2 — Observation Only

Autonomous receives ranking evidence through observation adapters.

Direction:

```text
App → Autonomous
```

No recommendation returned to App ranking.

## Stage 3 — Shadow Recommendation

Autonomous may produce recommendations internally/in a shadow evidence stream.

Shadow outputs:

- do not change user-visible order;
- do not modify CMS;
- do not modify candidate eligibility;
- do not change access;
- do not change playback;
- do not mutate App ranking configuration.

## Stage 4 — Shadow Evaluation

Compare:

```text
actual App decision/outcomes
vs
Autonomous shadow recommendation
```

Evaluation must preserve:

- policy versions;
- candidate-set versions;
- editorial interventions;
- experiments;
- exposure/propensity context where applicable.

## Stage 5 — One Bounded Experiment

Only explicit Product Owner authorization may activate one tightly scoped ranking experiment.

The authorized experiment must define:

- exact surface;
- exact audience;
- exact action space for the ranking domain;
- start/stop criteria;
- safety/rollback;
- experiment identity;
- evaluation metrics;
- maximum authority.

This does not modify the Autonomous Seed action space.

## Stage 6 — Bounded Authority Expansion

Only proven, explicitly authorized ranking authority may expand.

There is no automatic promotion from shadow performance to live authority.

---

# 24. Autonomous Seed Protection

Ranking is a future autonomous **domain**, not a Seed action-space extension.

Do not:

- map arbitrary content IDs directly into the current Seed action set;
- modify the Seed action space for ranking;
- add ranking-specific actions to the locked Seed merely to make integration convenient;
- modify the Autonomous Constitution for this App-domain contract.

The integration abstraction is:

```text
Autonomous Core
        ↓
future domain recommendation
        ↓
Ranking Action Adapter
        ↓
App Ranking Domain
```

not:

```text
content ranking
→ Seed action mutation
```

---

# 25. Security and Privacy

Ranking evidence must follow existing 0nya privacy/security authority.

Never include in ranking analytics/adapters:

```text
OTP
access token
refresh token
service-role key
purchase token
raw signed playback URL
private signing material
full phone number
unnecessary PII
```

Prefer:

```text
ranking_decision_id
internal/pseudonymous actor identity
session_id
content ID
event ID
policy/version IDs
safe reason codes
```

Anonymous users must remain valid participants in the event contract.

Data collection should be purpose-limited.

Do not add speculative fields merely because they might be useful to a future model.

---

# 26. Reliability and Failure Behavior

The App Ranking system must fail independently of Autonomous.

If Autonomous observation delivery fails:

```text
App ranking continues
CMS ranking continues
Explore/Search continue
playback/access continue
```

If a future shadow service fails:

```text
no user-visible ranking change
```

If a future authorized RankingActionAdapter fails:

```text
fall back to the approved App-owned policy
```

Autonomous unavailability must never block Home, Explore, Search, content access, or playback.

---

# 27. Normalized Ranking API Boundary

The App should evolve toward one normalized ordered-result boundary so the consumer does not need to understand ranking internals.

Conceptual response metadata:

```text
ranking_decision_id
ranking_policy
ranking_policy_version
source_surface
row_id?
ordered_results[]
```

A result may contain:

```text
content_id
content_type
rank
recommendation_reason?
```

Internal scores should not be exposed to clients unless they serve a concrete approved purpose.

Android must not become authoritative for ranking-policy computation.

---

# 28. Roadmap Integration

This contract does not change the current App active batch.

Ranking/discovery work remains a separate bounded track unless the Product Owner explicitly changes priority.

Recommended ranking sequence:

## RANK-00 — Current Truth Audit

Read-only audit of:

- taxonomy/schema;
- editorial flags;
- CMS row/order behavior;
- Explore filtering/sorts;
- search metadata;
- watch/engagement signals;
- existing event infrastructure;
- anonymous/session identity;
- eligibility/filter sources;
- CMS change/audit provenance;
- dirty/high-collision files.

No implementation.

## RANK-01 — Canonical Taxonomy

Implement only proven gaps in:

- format;
- canonical genres;
- primary/secondary genre semantics where approved;
- stable machine IDs;
- CMS assignment;
- API representation.

No AI.

## RANK-02 — Editorial Ranking Foundation

Preserve CMS authority.

Add only proven gaps in:

- editorial policy/config identity;
- change/version provenance;
- intervention semantics;
- deterministic editorial order.

## RANK-03 — Explore Discovery

Complete approved deterministic discovery:

- All;
- Micro Dramas;
- Short Films;
- CMS-driven Genres;
- Trending;
- Newest;
- Staff Picks;
- Most Watched only when trustworthy data exists.

Every ranked collection must be compatible with `ranking_decision_id`.

## RANK-04 — Search Metadata

Complete search metadata gaps without rebuilding Search.

Search should be compatible with delayed attribution later.

## RANK-05 — Behavioral Signal Foundation

Instrument the smallest reliable evidence set:

```text
content_served
content_impression
content_open
play_start
qualified_watch
play_complete
play_abandon
```

with:

```text
ranking_decision_id
actor/session context
surface/row/position
```

Add negative signals only when reliably measurable.

## RANK-05B — Ranking Decision Evidence Contract

Implement this contract's domain objects/semantics:

- RankingDecision;
- RankingCandidateSet;
- RankingPolicyVersion;
- RankingOutcome;
- RankingReasonCode;
- RankingExperiment;
- RankingEligibilityFilter;
- editorial intervention provenance;
- propensity readiness.

This is the key Autonomous-preparation milestone.

## RANK-05C — Observation Adapter Preparation

Define/implement only the observation-side adapter when the Autonomous project explicitly requests integration.

Allowed direction:

```text
App → Autonomous
```

No reverse action path.

## RANK-06 — Ranking Metrics

Build trustworthy aggregates from raw evidence.

Possible metrics:

- served;
- impressions;
- opens;
- qualified watches;
- completion;
- watch time;
- negative outcomes.

Raw evidence remains authoritative.

Finalize Most Watched only here if the signal definition is trustworthy.

## RANK-07 — Recommendation-Ready Ranking Boundary

Normalize rank/source/reason/decision identity so future recommendation systems can plug into the ranking domain without changing App rendering, routing, access, or playback authority.

Future `RankingActionAdapter` remains dormant.

---

# 29. Implementation Safety

Before any implementation:

- read current `APP_COMPLETION_ROADMAP.md`;
- confirm current Product Owner priority;
- inspect current working tree;
- identify dirty/high-collision files;
- reuse existing systems rather than duplicating them.

Never perform destructive Git cleanup to make ranking work easier.

No commit, push, deploy, remote migration, CMS publish, or production-data change without explicit Product Owner authorization where applicable.

`0nya_autonomous/**` remains outside normal Consumer App ranking work unless the Product Owner explicitly assigns an Autonomous integration task.

---

# 30. Acceptance Criteria

The Ranking Domain Contract is considered correctly implemented only when the architecture can prove the following without Autonomous live control:

1. Every ranked collection can receive a stable `ranking_decision_id`.
2. Authenticated and anonymous discovery can use one safe event contract.
3. Ranking policy/config versions are reconstructible.
4. Candidate-set evidence distinguishes absence from poor performance.
5. Served and impression are distinct.
6. Surface/row/position context is preserved.
7. Product recommendation reasons and Autonomous decision reasons are separate.
8. Propensity can be added later without redesigning the schema.
9. Raw outcomes remain independent; no permanent reward formula is forced.
10. Positive and reliable negative evidence are representable.
11. Delayed attribution is possible without invented windows.
12. Editorial interventions are distinguishable from ranking behavior.
13. Eligibility/filter reasons are reconstructible.
14. Future experiment IDs/variants fit the same contract.
15. App and Autonomous remain physically/logically separate.
16. Observation precedes shadow; shadow precedes any live experiment.
17. CMS/editorial authority remains intact.
18. Autonomous Seed action space remains unchanged.
19. Autonomous Constitution remains unchanged.
20. AI recommendation remains deferred.

---

# 31. Constitution Impact

```text
NO CONSTITUTION CHANGE REQUIRED
```

This contract defines a Consumer App ranking domain and its integration boundary.

It does not identify a constitutional gap and does not modify any locked Autonomous invariant.

---

# 32. Current Authorization State

As of this contract baseline:

```text
0nya Autonomous Constitution      LOCKED / unchanged
Seed action space                 unchanged
Live autonomous ranking           NOT AUTHORIZED
AI recommendation                 NOT IMPLEMENTED / DEFERRED
CMS editorial authority           PRESERVED
Ranking remains an App domain     YES
Autonomous integration            OBSERVATION / SHADOW FIRST
Ranking Action Adapter            FUTURE ONLY / DISABLED
```

---

# 33. Canonical Boundary Summary

```text
                    0NYA CONSUMER APP
                           │
                           │
                ┌──────────▼──────────┐
                │  APP RANKING DOMAIN │
                │                     │
                │ CMS editorial       │
                │ deterministic rank  │
                │ taxonomy            │
                │ candidate sets      │
                │ decisions           │
                │ outcomes            │
                └──────────┬──────────┘
                           │
             OBSERVATION   │
             ONLY TODAY    │
                           ▼
                ┌─────────────────────┐
                │ RANKING DOMAIN      │
                │ ADAPTER             │
                │                     │
                │ Event Adapter       │
                │ Outcome Adapter     │
                │ Action Adapter      │
                │ (future/disabled)   │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ 0NYA AUTONOMOUS     │
                │                     │
                │ observe             │
                │ shadow              │
                │ evaluate            │
                │                     │
                │ no live ranking     │
                │ authority today     │
                └─────────────────────┘
```

The App remains complete and operable without Autonomous.

Future Autonomous recommendation is an optional bounded input into the App Ranking domain, never a replacement for App product authority.

---

# 34. Change Control

Changes to this contract require explicit review against:

- current Product Owner decisions;
- App product/CMS/security authority;
- current repository evidence;
- current App roadmap priority;
- the locked Autonomous Constitution;
- Autonomous certification/authority boundaries.

Any proposal that would:

- activate live autonomous ranking;
- expand Autonomous authority;
- change the Seed action space;
- alter CMS editorial authority;
- make ranking authoritative for access/playback;
- merge the repositories;
- introduce personalized AI recommendation;

is outside this contract's current authorization and requires a separate explicit Product Owner decision.

---

**END — 0nya Ranking Domain Contract v1.0**
