# APP-AUTO-CONTRACT-01 -- Observation Contract Reconciliation

**Date:** 2026-09-06  
**Mode:** source and import-graph reconciliation only  
**Scope:** establish the contract boundary; no transport, persistence, event
producers, Autonomous integration, migration, or product behavior change.

## STATUS

`PARTIAL` -- one authoritative source contract can be identified, but it is not
yet exposed through a verified cross-runtime module boundary. The Android
foundation is a duplicate fork, not an independent compatible contract.

## ROOT FOUNDATION

`AUTHORITATIVE` -- [`src/lib/observation/foundation.ts`](../../src/lib/observation/foundation.ts)
is the authoritative APP-AUTO source contract for the following evidence:

- all six non-session APP-AUTO adapters import it directly;
- it provides the widest controlled event vocabulary and matching
  domain/phase/payload definitions;
- it supplies the common envelope validator, privacy rejection, deterministic
  serializer, CanonicalEvent projection, and fail-open helper;
- its companion root source test covers contract behavior, although it is not
  included in the existing root `test` script.

It is authoritative as a **source contract only**. It is not a deployed API,
transport, persistence mechanism, telemetry SDK, or product authority.

## ANDROID FOUNDATION

`DUPLICATE` and `DIVERGENT` --
[`apps/android/src/lib/observation/foundation.ts`](../../apps/android/src/lib/observation/foundation.ts)
duplicates the root envelope shape and helpers but is not source-identical and
is imported only by the Android lifecycle controller. It cannot be treated as
a second authority.

The current lifecycle-only subset is structurally compatible: its six SESSION
event names, phases, UUIDv4 requirements, nullable actor, canonical UTC
timestamp validation, 2KB scalar payload limit, key-sorted serialization, and
four-field CanonicalEvent projection match the root behavior. That limited
overlap does not make the forks interchangeable.

## IMPORTERS ROOT

`COMPLETE` -- direct root-foundation importers are:

- [`monetization.ts`](../../src/lib/observation/monetization.ts)
- [`traffic.ts`](../../src/lib/observation/traffic.ts)
- [`notifications.ts`](../../src/lib/observation/notifications.ts)
- [`content.ts`](../../src/lib/observation/content.ts)
- [`access.ts`](../../src/lib/observation/access.ts)
- [`system.ts`](../../src/lib/observation/system.ts)
- [`foundation.test.ts`](../../src/lib/observation/foundation.test.ts)
- the Android session test imports the root type only; it does not execute the
  root implementation.

The six adapters have no production call sites outside their own source/tests.

## IMPORTERS ANDROID

`PARTIAL` -- direct Android-foundation importer:

- [`sessionObservations.ts`](../../apps/android/src/lib/sessionObservations.ts)

That controller is created by [`App.tsx`](../../apps/android/App.tsx) and
receives `appOpened`, app-state transition, and authenticated actor updates.
No `onObservation` sink is supplied, so validated observations are discarded.
This is lifecycle invocation only, not transport or persistence.

## EVENT VOCABULARY

`DIVERGENT`.

The root contract has 13 generic/lifecycle event types:

`SESSION_STARTED`, `SESSION_RESUMED`, `SESSION_ENDED`, `APP_OPENED`,
`APP_BACKGROUND`, `APP_FOREGROUND`, `MONETIZATION_ACTION`,
`MONETIZATION_OUTCOME`, `TRAFFIC_SOURCE_OBSERVED`, `NOTIFICATION_OUTCOME`,
`CONTENT_PERFORMANCE`, `ACCESS_OUTCOME`, and `SYSTEM_FAILURE`.

The Android fork retains all six SESSION events but expands the other domains
to 39 additional specific events: purchase/rewarded/tip lifecycle, notification
lifecycle, content publication/availability lifecycle, access/entitlement
lifecycle, and six specific system failures. Its expanded event definitions
also use different payload allowlists. Thus Android accepts observations the
root contract rejects, and root adapters cannot safely assume Android's
vocabulary.

## SESSION IDENTITY

`COMPATIBLE` for current Android lifecycle use.

[`evidenceIdentity.ts`](../../apps/android/src/lib/evidenceIdentity.ts) creates
one UUIDv4 at module evaluation and returns it through
`getEvidenceSessionId()`. Existing ranking behavior and ranking decision
evidence already use that same process-scoped ID. The session controller reuses
it and uses it as its correlation ID. It does not create durable identity,
device identity, guest identity, or a second session store.

Authenticated actor identity is supplied as `session?.user.id` by the existing
auth context; anonymous actors remain `null`. The client value is observation
evidence only and must never replace server-derived actor identity at an
authoritative boundary.

## TIMESTAMP SEMANTICS

`COMPATIBLE` at the envelope level, `REQUIRES_BOUNDARY` for future
cross-runtime use.

Both validators require canonical ISO-8601 UTC `occurred_at`, and both
CanonicalEvent projections preserve it as `timestamp`. The Android controller
also rejects controller-local timestamp regression and assigns a shared input
timestamp to paired lifecycle events. Neither foundation adds a received/server
timestamp, ordering persistence, replay handling, or authoritative outcome
time. Those are deliberately outside this task and remain required before
server-side observation work.

## PRIVACY

`DIVERGENT`.

Both foundations reject common email, phone, bearer token, secret, password,
API-key, and signature material; both forbid nested payload values and bound
payload JSON to 2KB. The Android fork additionally exempts canonical timestamps
from sensitive-value matching, while the root does not. More importantly, the
root has a smaller context/reference allowlist and no `dedupe_key`; Android
allows `dedupe_key` and eight more reference keys (episode, short film,
campaign, referral, deep-link, notification, message, creator, and genres).
They therefore have different accepted privacy surfaces. The root allowlist is
the authoritative baseline until a single reviewed shared contract explicitly
widens it.

## CANONICALEVENT

`COMPATIBLE` only in shape, `DIVERGENT` in admissible input.

Both project:

1. `event_id` from `observation_id`;
2. `timestamp` from `occurred_at`;
3. scalar payload values plus domain/event/phase into `observable_features`;
4. source, actor/session/correlation/request/causation IDs and context into
   `context`.

Neither promotes references or IDs into observable features. Because each
foundation accepts different event/payload/context sets, equal projection code
does not establish one contract.

## DIVERGENCES

| Concern | Root | Android | Classification |
| --- | --- | --- | --- |
| Event catalog | 13 generic events | 45 events, including detailed domain lifecycles | DIVERGENT |
| Context | `source_surface`, `route`, `content_type`, `references` | Root fields plus `dedupe_key` | DIVERGENT |
| Reference allowlist | 7 keys | 16 keys | DIVERGENT |
| Payload allowlists | Generic per-domain/outcome keys | Specific lifecycle/authority/failure keys | DIVERGENT |
| Sensitive timestamp handling | Timestamp strings can match sensitive detector | Canonical UTC timestamps are exempted | DIVERGENT |
| Envelope fields/UUID/time/source checks | Same | Same | COMPATIBLE |
| Serialization | recursive key-sorted JSON | recursive key-sorted JSON | COMPATIBLE |
| CanonicalEvent shape | Same four fields | Same four fields | COMPATIBLE |
| Fail-open helper | Promise rejection callback only | Same helper plus controller swallows sink errors/rejections | DIVERGENT |
| Lifecycle/session behavior | No controller | Process-scoped controller, monotonic local timestamps | ANDROID-SPECIFIC |

## AUTHORITATIVE CONTRACT

`AUTHORITATIVE` -- the root foundation is the sole APP-AUTO contract authority.
The Android lifecycle controller is an Android producer adapter and must consume
that contract, not define or extend it. Android-specific lifecycle sequencing
may remain local, but it must emit only observations validated by the shared
contract.

## CROSS-RUNTIME BOUNDARY

`REQUIRES_BOUNDARY`.

Do not import the root file directly from Android yet. The current Android
Metro configuration declares no parent `watchFolders`, and Android TypeScript
has no cross-workspace path configuration. The Android session test's root
type-only relative import is excluded by Android `tsconfig` and is not runtime
proof. The foundation source is dependency-free, but direct cross-runtime
resolution has not been proven for Metro, Android typecheck, or a test runner.

The minimum future extraction is one dependency-free shared TypeScript module
containing only the root-authoritative types, constants, validation,
serialization, CanonicalEvent projection, and fail-open helper. Both root
adapters and Android must import that module; Metro and TypeScript resolution
must be configured and proven deliberately. No domain producer, sink, storage,
route, or session implementation belongs in that module.

Until then, the Android fork must not add event types, references, payload
fields, or privacy exceptions. It is `BLOCKED` from becoming another contract
authority.

## FILES THAT WOULD NEED CHANGE

`SAFE_TO_MERGE` only in a separately approved implementation task:

- [`src/lib/observation/foundation.ts`](../../src/lib/observation/foundation.ts)
  or its extracted shared successor;
- the six root adapters under
  [`src/lib/observation/`](../../src/lib/observation/);
- [`apps/android/src/lib/observation/foundation.ts`](../../apps/android/src/lib/observation/foundation.ts)
  (remove after consumers use the shared module);
- [`apps/android/src/lib/sessionObservations.ts`](../../apps/android/src/lib/sessionObservations.ts)
  (change only its import; preserve lifecycle semantics);
- Android Metro/TypeScript resolution configuration, if required by the chosen
  shared-module location;
- relevant focused contract and Android controller tests.

[`App.tsx`](../../apps/android/App.tsx) can remain unchanged: its controller
creation, lifecycle calls, and existing actor update are compatible with a
controller whose contract import changes. It must remain sinkless in this scope.

## TESTS REQUIRED

`REQUIRES_BOUNDARY`.

Before merging a shared module:

1. run the existing root foundation and six adapter tests explicitly, since the
   package `test` script does not include them;
2. establish a supported Android test command and execute the session controller
   test against the runtime shared module, not a root type-only import;
3. add parity cases proving session event acceptance/rejection, exact
   domain/phase/payload allowlists, reference/context rejection, PII/secret
   rejection, canonical timestamp behavior, deterministic serialization, and
   CanonicalEvent equality in both runtimes;
4. run Android typecheck with the actual shared import and Metro resolution
   validation;
5. prove fail-open sink failures do not affect lifecycle behavior, without
   adding a sink.

No test should claim transport, persistence, server authority, or Autonomous
ingestion.

## PRODUCT BEHAVIOR IMPACT

`NONE`. This reconciliation does not alter user-visible behavior. The present
App lifecycle controller remains inert beyond local validation because it has
no sink.

## TRANSPORT REQUIRED

`NO`

## PERSISTENCE REQUIRED

`NO`

## AUTONOMOUS IMPACT

`NONE`

## SAFE NEXT TASK

After Product Owner approval, perform a dedicated shared-module extraction in
an isolated worktree, with no new events or sinks. First prove Metro,
TypeScript, and focused test resolution; then make the Android controller
consume the root-authoritative contract while preserving its current lifecycle
identity and no-sink behavior.

## BLOCKER

The current root and Android foundations are untracked concurrent work with
different accepted contracts. Cross-runtime module resolution and test execution
are unproven. Privacy/authority approval is additionally required before any
future transport, persistence, server producer, or Autonomous connection.
