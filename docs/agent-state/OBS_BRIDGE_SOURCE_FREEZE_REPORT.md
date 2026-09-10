# OBS-BRIDGE-FREEZE-01 -- Source Freeze at Infrastructure Boundary

**Date:** 2026-09-06  
**Status:** `SOURCE VERIFIED` -- infrastructure provisioning remains
`BLOCKED_PENDING_OWNER_APPROVAL`.

## Frozen source boundary

### Architecture

- The Consumer App retains product/business authority, authoritative evidence
  extraction, Android lifecycle capture, privacy minimization, and fail-open
  handoff behavior.
- The future Observation Bridge owns evidence custody, validation,
  normalization/translation, deterministic serialization, CanonicalEvent
  projection, delivery, retry/replay, and Bridge-local audit persistence.
- Autonomous is limited to future learning/decision consumption. It has no
  product authority and no Consumer App imports.
- Searches of the Consumer App observation sources and shared Bridge contract
  found no Autonomous import/reference. No Consumer App-to-Autonomous or
  Autonomous-to-Consumer-App dependency was added.

### Contract

[`shared/observation/evidence-envelope.ts`](../../shared/observation/evidence-envelope.ts)
is frozen as dependency-free `onya_evidence_envelope_v1`.

The focused suite verifies:

- deterministic serialization and SHA-256 content hash;
- producer-owned UUID identity and canonical UTC timestamp requirements;
- independently nullable actor/session fields;
- scalar-only bounded payloads and privacy rejection;
- duplicate equivalence and idempotency conflict semantics; and
- envelope representation for Android lifecycle, persisted coin-unlock
  success, and ranking decision evidence.

The contract does not implement transport, a live bridge service, persistence,
retries, canonical event delivery, or an Autonomous connection.

### Current runtime state

- No live Observation Bridge service exists in the current Cloud Run project.
- No App-to-Bridge transport exists.
- No Bridge-owned persistence/schema exists.
- No Consumer App or Android producer is wired to Bridge ingress.
- No Autonomous connection exists.
- The App datastore was not changed.

## Infrastructure hold point

The current GCP project is disqualified: it contains active QA workload
`onya-qa-api` and the QA runtime identity. The repository Supabase project
`0nyapp` is the Consumer App datastore and is disqualified from Bridge reuse.

Unknown / not approved:

- dedicated DEV GCP project ID;
- approved region;
- dedicated Bridge datastore;
- product-backend producer identity;
- Bridge runtime identity;
- Bridge deployer identity;
- secrets owner; and
- billing/infrastructure approval.

No GCP resource, Supabase/Postgres resource, IAM policy, secret, deployment,
App producer, Android runtime path, Autonomous component, or App database was
created or modified.

## Verification

| Check | Result |
| --- | --- |
| Evidence envelope + shared foundation + coin producer focused tests | PASS -- 23 tests |
| Android typecheck | PASS |
| No Autonomous reference/import in Bridge/App observation scope | PASS |
| Current Cloud Run Bridge service inventory | PASS -- none found |
| Root typecheck | BLOCKED by unrelated concurrent CMS mismatch: `MediaAdminClientProps` lacks `loadQuarantineStatusAction` passed by `src/app/admin/media/page.tsx` |
| Scoped documentation diff check | PASS |

The root typecheck failure is outside the frozen Bridge contract files and
does not alter the Bridge source disposition. It must be resolved by the owner
of the concurrent CMS work before a repository-wide typecheck can pass.

## Safe return point

Resume only after the Product Owner explicitly approves and supplies:

1. isolated DEV GCP project ID and approved region;
2. dedicated Bridge datastore target;
3. product-backend producer identity;
4. dedicated Bridge runtime identity;
5. deployer identity;
6. secrets ownership; and
7. billing/infrastructure approval.

The next permitted task then provisions only the isolated DEV Bridge
foundation and verifies its IAM and datastore boundary before wiring any
Consumer App producer.
