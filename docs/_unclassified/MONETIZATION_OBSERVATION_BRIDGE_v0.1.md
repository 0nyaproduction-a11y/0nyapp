STATUS: UNCLASSIFIED / NOT GOVERNING

This file is retained for provenance and investigation only.

It is NOT an authoritative 0nya App architecture document.

It is NOT an authoritative 0nya Autonomous integration contract.

Canonical Autonomous integration contracts live under:

0nya_autonomous/docs/integration/

Do not use this file as governing architecture until its provenance
and relationship to the canonical bridge versions are formally resolved.

---

# MONETIZATION OBSERVATION BRIDGE v0.1

**Phase:** M1 (Design only)
**Status:** DESIGN — no code, no migrations, no behavior change
**Source of truth:** `MONETIZATION_DISCOVERY_REPORT.md` (this repo) plus verified repository facts (Next.js 16 App Router, Supabase, AdMob SSV, Mux; Dockerized `next start` on Cloud Run per `Dockerfile` + `next.config.ts`).

> This document defines the **observation infrastructure that must exist before 0nya can observe production monetization in SHADOW MODE**. It does not modify, connect, or alter any production monetization behavior.

---

## 1. CURRENT SYSTEM BASELINE

### ACTIVE (verified, executes in production today)
- **Free episodes** — `episodes.is_free`; `canUserWatchEpisode` returns true (`src/lib/entitlements.ts:269`).
- **Coin unlock (per-episode purchase)** — `purchase_episode_with_coins` RPC (`supabase/migrations/20260821000006_006_episode_access_controls.sql:41`); invoked via `src/lib/purchases.ts:43` → `src/app/api/v1/episodes/[episodeId]/purchase/route.ts`. Requires pre-existing coins.
- **Rewarded-ad unlock** — `create_rewarded_ad_attempt` / `finalize_rewarded_ad_callback` RPCs (`supabase/migrations/20260823000000_011_rewarded_ad_foundation.sql`); AdMob SSV verified (`src/app/api/webhooks/admob/ssv/route.ts`). **Real, executing third-party verification.**
- **Plus entitlement (subscription access check)** — `hasActiveSubscription` / `getUserSubscription` (`src/lib/entitlements.ts:112,65`); enforced for playback (1440p) and episode access. **Check is active; purchase path is not** (see STUB).
- **Chai tips (creator tipping with coins)** — `submit_short_film_chai_tip` / `get_short_film_chai_details` RPCs (`supabase/migrations/20260822233000_010_chai_ledger_foundation.sql`); `src/lib/chai.ts`, `src/app/api/v1/short-films/[slug]/chai/route.ts`.
- **Wallet / coin transactions** — `wallets`, `coin_transactions`; seeded by welcome grant of 100 coins (`supabase/migrations/20260825000000_018_welcome_account_grant.sql:30`); `src/lib/entitlements.ts:getUserWallet`, `src/lib/purchases.ts:getUserCoinTransactions`.
- **Episode entitlements** — `episode_entitlements` (source `purchase|rewarded_ad|promo|admin`), written by the purchase and rewarded RPCs.
- **Ad-supported locked preview** — main media → server-authorized preview
  window → backend/CMS-configured `locked_preview_seconds` → exact-frame
  lock/access flow. Separate preview clips and
  `provisionEpisodePreviewMediaAsset` are LEGACY / COMPATIBILITY only.

### FOUNDATION / STUB (schema + code present, but NOT executing end-to-end)
- **Google Play Billing** — tables `google_play_purchases`, `payment_provider_products` (`supabase/migrations/20260820123414_google_play_payment_foundation.sql`); route `src/app/api/v1/billing/google-play/route.ts` **returns `EXTERNALLY_BLOCKED_NOT_CONFIGURED` / `not_configured`** (no real verification).
- **`credit_verified_coin_purchase` RPC** — defined (`baseline_remote_schema.sql:48`, `20260820131555_allow_verified_inactive_coin_fulfillment.sql`) but **never called** from app code.
- **Coin-pack top-up checkout** — `coin_products` catalog active; `payment_orders` table present; `wallet/page.tsx` and `plans/page.tsx` render **"Coming soon" / disabled**. No checkout initiation exists.
- **Apple Store / Web payment provider** — only enums/columns exist (`payment_orders.provider`, `credit_verified_coin_purchase` provider arg). No integration.

### NOT IMPLEMENTED (no code path)
- Subscription **purchase / renewal / cancellation** writers (no app code inserts/updates `subscriptions`).
- **Fiat payment completion** (no Stripe/Razorpay/RevenueCat/Paddle anywhere in repo).
- **Refund / cancellation** writers (`payment_orders.status='refunded'`, `coin_transactions` refund types are schema-only, no writer).
- **Any business analytics / event system** (grep for `analytics|trackEvent|logEvent|posthog|segment|amplitude|plausible|gtag|mixpanel|telemetry|emitEvent` → zero matches; only `timePerf` latency markers).
- **Stripe / Razorpay / RevenueCat / Paddle** — confirmed absent.

---

## 2. MONETIZATION EVENT CONTRACT v0.1

### 2.1 `MonetizationEvent` base shape

```ts
interface MonetizationEvent {
  event_id: string;            // required, UUIDv4, globally unique
  schema_version: "0.1";       // required, semver-major.minor string
  event_type: MonetizationEventType; // required, enum (§3)
  occurred_at: string;         // required, UTC ISO-8601 (server clock)
  correlation_id: string;       // required, UUIDv4 (§5)
  source: string;              // required, emitter identifier (§2.3)
  user_id: string | null;      // required field, null allowed for guests
  episode_id: string | null;   // required field, null allowed
  short_film_id: string | null;// required field, null allowed
  offer: OfferSnapshot | null; // required field, null allowed (§2.4)
  outcome: OutcomeSnapshot | null; // required field, null allowed (§2.5)
  metadata: Record<string, unknown>; // required field, may be empty {}
}
```

### 2.2 Field rules

| Field | Required | Nullable | Type | Notes |
|-------|----------|----------|------|-------|
| `event_id` | yes | no | `string` (UUIDv4) | Primary dedup key. Generated by emitter. Must be unique across all events. |
| `schema_version` | yes | no | `"0.1"` | Pinned. Bump on breaking change. |
| `event_type` | yes | no | enum (§3) | Exact enum value. |
| `occurred_at` | yes | no | `string` ISO-8601 UTC (`yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`) | Server clock at emit. |
| `correlation_id` | yes | no | `string` (UUIDv4) | Links the opportunity→impression→intent→outcome chain (§5). Never null. |
| `source` | yes | no | `string` | E.g. `server:route:episode-purchase`, `server:webhook:admob-ssv`, `client:impression-beacon`. Identifies emitter + deployment. |
| `user_id` | yes (field present) | yes | `string` | `auth.users.id` when known; `null` only for truly anonymous surfaces. Use stable internal ID only. |
| `episode_id` | yes (field present) | yes | `string` | `episodes.id` when relevant; else `null`. |
| `short_film_id` | yes (field present) | yes | `string` | `short_films.id` when relevant; else `null`. |
| `offer` | yes (field present) | yes | `OfferSnapshot|null` | Pre-decision monetization inputs (§2.4). `null` when N/A. |
| `outcome` | yes (field present) | yes | `OutcomeSnapshot|null` | Post-action result (§2.5). `null` for opportunity/impression/intent. |
| `metadata` | yes (field present) | no (may be `{}`) | `object` | Free-form, non-secret extras; validated against size + key allowlist. |

Validation:
- `event_id` and `correlation_id` must match `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`.
- Exactly one of `episode_id` / `short_film_id` should be non-null for content events (not enforced as hard error, but flagged).
- `offer` and `outcome` are mutually constrained by event semantics (§4): opportunity/impression/intent MUST have `offer` set and `outcome=null`; success/failure/verified-provider-outcome MUST have `outcome` set.
- Maximum payload: `metadata` ≤ 4 KB serialized; total event ≤ 8 KB. Reject oversize at emitter.
- Naming: `snake_case` for all field names and `SCREAMING_SNAKE` for `event_type`. No nested `event_` prefixes inside `metadata`.

### 2.3 `source` convention
`<location>:<handler>:<detail>`, e.g.:
- `server:route:episodes.purchase`
- `server:route:episodes.rewarded`
- `server:webhook:admob.ssv`
- `server:webhook:mux` (not monetization, ignored)
- `server:route:short-films.chai`
- `client:beacon:paywall` / `client:beacon:offer`

### 2.4 `OfferSnapshot` (pre-decision inputs only)
```ts
interface OfferSnapshot {
  content_kind: "series_episode" | "short_film";
  access_kind: "free" | "coin_unlock" | "rewarded_ad" | "plus" | "chai_tip" | "unknown";
  is_free: boolean | null;
  coin_price: number | null;          // coins; fiat null until top-up live
  coin_unlock_enabled: boolean | null;
  rewarded_unlock_enabled: boolean | null;
  rewarded_access_mode: "permanent" | "session" | null;
  plus_access: boolean | null;
  chai_enabled: boolean | null;
  wallet_balance_coins: number | null; // snapshot at emit
  has_active_subscription: boolean | null;
  already_owned: boolean | null;
  currency: "COIN" | null;            // fiat currency TBD when top-up live
}
```

### 2.5 `OutcomeSnapshot` (post-action result only)
```ts
interface OutcomeSnapshot {
  status: string;          // RPC/route status, e.g. purchase_success, granted, failed, insufficient_balance
  success: boolean | null;
  remaining_balance_coins: number | null;
  provider: string | null; // "google_admob" for rewarded; null otherwise
  provider_transaction_id: string | null; // from AdMob SSV only
  entitlement_granted: boolean | null;
  amount_coins: number | null;
}
```

### 2.6 Independence
The contract is **independent of 0nya learning state**. It contains only observable facts + stable IDs. No model weights, no policy, no predicted price. 0nya consumes these events via the adapter (§13); the event store is never read back into live monetization.

---

## 3. INITIAL EVENT TAXONOMY

### 3.1 Implement now (maps to ACTIVE flows)
| Event | Category |
|-------|----------|
| `MONETIZATION_OPPORTUNITY` | opportunity |
| `PAYWALL_SHOWN` | impression |
| `OFFER_SHOWN` | impression |
| `COIN_PURCHASE_STARTED` | intent |
| `COIN_PURCHASE_COMPLETED` | success |
| `COIN_PURCHASE_FAILED` | failure |
| `REWARDED_UNLOCK_STARTED` | intent |
| `REWARDED_UNLOCK_GRANTED` | verified provider outcome |
| `REWARDED_UNLOCK_FAILED` | failure |
| `CHAI_TIP_STARTED` | intent |
| `CHAI_TIP_COMPLETED` | success |
| `CHAI_TIP_FAILED` | failure |

### 3.2 Defer (underlying product flow not live)
These MUST NOT be emitted yet. Emitting them would fabricate signals for non-existent behavior.
- `SUBSCRIPTION_STARTED` — no subscription purchase path.
- `SUBSCRIPTION_RENEWED` — no renewal writer.
- `SUBSCRIPTION_CANCELLED` — no cancellation writer.
- `FIAT_PAYMENT_COMPLETED` — no fiat provider connected.
- `REFUND_COMPLETED` — no refund writer.

When those flows go live (M2+), add the events; the contract already supports them via `event_type` extension + `OfferSnapshot`/`OutcomeSnapshot` growth.

---

## 4. EVENT SEMANTICS

| Event | Exact meaning | When it occurs | Must already be true | Emit path (proposed, §12) | IDs available | Monetization fields | Class |
|-------|---------------|----------------|----------------------|----------------------------|---------------|---------------------|-------|
| `MONETIZATION_OPPORTUNITY` | A piece of content is monetizable for this user (not free / not owned / not sub-included) | At user-visible paywall/offer mount | `canUserWatchEpisode` would be false (or offer shown) | client beacon on LockedEpisode/purchase mount | `user_id`, `episode_id` | `offer` (access_kind, flags, balance) | opportunity |
| `PAYWALL_SHOWN` | User actually rendered the locked/upgrade surface | Client beacon confirms visible paywall | content not accessible to user | client beacon (LockedEpisode) | `user_id`, `episode_id` | `offer` | impression |
| `OFFER_SHOWN` | User actually rendered a concrete purchase offer (price + unlock CTA) | Client beacon confirms visible offer | offer rendered with price | client beacon (purchase page) | `user_id`, `episode_id` | `offer` (coin_price, balance, can_buy) | impression |
| `COIN_PURCHASE_STARTED` | User intent to buy episode with coins, before atomic RPC | Inside purchase route, before `purchaseEpisodeWithCoins` | authenticated, episode_id known | `api/v1/episodes/[episodeId]/purchase/route.ts` | `user_id`, `episode_id` | `offer` snapshot | intent |
| `COIN_PURCHASE_COMPLETED` | RPC returned `purchase_success` | After RPC success | wallet debited + entitlement written | same route, on success | `user_id`, `episode_id` | `offer` + `outcome` (remaining_balance, entitlement_granted) | success |
| `COIN_PURCHASE_FAILED` | RPC returned non-success (insufficient/already_owned/invalid/failed) | After RPC result | — | same route, on non-success | `user_id`, `episode_id` | `offer` + `outcome` (status) | failure |
| `REWARDED_UNLOCK_STARTED` | Rewarded attempt created (pending) | After `createRewardedAdAttempt` success | authenticated, episode rewarded-enabled | `api/v1/episodes/[episodeId]/rewarded/route.ts` | `user_id`, `episode_id`, `custom_data` (=correlation_id) | `offer` | intent |
| `REWARDED_UNLOCK_GRANTED` | AdMob SSV verified + entitlement granted | After `finalizeRewardedAdCallback` success | valid signature, attempt pending, not expired | `api/webhooks/admob/ssv/route.ts` | `user_id`(via attempt), `episode_id`, `custom_data`, `provider_transaction_id` | `outcome` (granted, provider, txn id) | verified provider outcome |
| `REWARDED_UNLOCK_FAILED` | Attempt not granted (expired/failed/conflict/unsupported) | After finalize non-grant or invalid callback | — | same webhook | `episode_id`, `custom_data` | `outcome` (status) | failure |
| `CHAI_TIP_STARTED` | User intent to tip creator | Before `submitShortFilmChaiTip` | authenticated, short_film chai_enabled | `api/v1/short-films/[slug]/chai/route.ts` | `user_id`, `short_film_id` | `offer` (chai_enabled) | intent |
| `CHAI_TIP_COMPLETED` | Tip accepted (coins moved, ledger posted) | After RPC success | balance sufficient | same route, success | `user_id`, `short_film_id` | `offer` + `outcome` (amount_coins, remaining_balance) | success |
| `CHAI_TIP_FAILED` | Tip rejected (insufficient/error) | After RPC non-success | — | same route, failure | `user_id`, `short_film_id` | `offer` + `outcome` (status) | failure |

No ambiguous events: opportunity = "could be monetized", impression = "was shown", intent = "user acted to buy/tip", success/failure = result, verified provider outcome = server-confirmed by external party.

---

## 5. CORRELATION MODEL

### 5.1 `monetization_correlation_id` lifecycle
Goal: connect `MONETIZATION_OPPORTUNITY → PAYWALL_SHOWN → OFFER_SHOWN → COIN_PURCHASE_STARTED → COIN_PURCHASE_COMPLETED|FAILED`.

### 5.2 Generation point
- Generated **client-side at the first user-visible monetization moment** (the impression beacon), using `crypto.randomUUID()` (UUIDv4). Rationale: the server render is static/build-time (see §8), so the server cannot reliably mint a per-user, per-view correlation_id at impression time. The client beacon is the first *real* user interaction with the surface.
- For the **rewarded chain**, reuse the existing `rewarded_ad_attempts.custom_data` as the `correlation_id` (it is already a unique per-attempt token and is the natural link between start and SSV grant). No new id needed.
- For **Chai**, generate a client-side UUIDv4 at tip start and carry it via the request (header/body `idempotencyKey` already exists on the Chai route — reuse it as correlation_id).

### 5.3 Format
UUIDv4 (`^[0-9a-f]{8}-…$`). No PII.

### 5.4 Carriage through the app
- **Client → API:** send as request header `x-monetization-correlation-id`. For navigation from the paywall/offer page to `/purchase`, the beacon stores the correlation_id in the URL query (`?mcid=<uuid>`) and/or a hidden form field on the buy form, so the eventual `COIN_PURCHASE_STARTED` (server route) can read it from the header/body and reuse it. If absent, the server route generates a fresh one (chain still recorded, just not linked to impression).
- **Server actions:** `purchase/actions.ts` receives the hidden field via `FormData` and forwards to the route/emit.
- **API routes:** read `x-monetization-correlation-id`; if present and valid, use it; else mint new.
- **Webhook (AdMob):** correlation_id = `custom_data` from the attempt (looked up server-side); no client carriage needed.

### 5.5 Safest mechanism
Header for API calls; URL param / hidden field for page navigations. **Not** a cookie (cookies would wrongly correlate across unrelated offers and persist across tabs), **not** server session (none exists for monetization), **not** RSC props alone (static). Cookie is explicitly rejected for correlation because it would bleed across multiple offers/tabs.

### 5.6 Lifetime / rotation
- Lifetime: until the chain terminates (completed/failed) or 24h idle, whichever first. Store no server-side state; it is just carried by the client for one flow.
- Rotation: a **new** correlation_id is generated every time a fresh paywall/offer is shown (new navigation, new tab). Reusing the same paywall view reuses the same id (idempotent impression).
- Duplication: if the same id arrives on multiple events, they are linked (desired). If two different offers are shown, they get different ids (desired).
- Multiple simultaneous offers / multiple tabs: each tab/offer mints its own id at its own beacon → naturally separated.
- Retries: client re-sends the same id (idempotent); server dedupes on `event_id` (§6), not on correlation_id, so retries produce one stored event per unique `event_id` while still sharing the correlation_id.

---

## 6. EVENT ID + IDEMPOTENCY

### 6.1 `event_id` generation
- **App-emitted events (opportunity/impression/intent/success/failure):** `crypto.randomUUID()` (UUIDv4) generated by the emitter at emit time. Unique by construction (122-bit randomness).
- **Provider-verified events (rewarded grant/fail):** deterministically derive `event_id = sha256("REWARDED_UNLOCK_GRANTED" + "|" + custom_data + "|" + provider_transaction_id)` so **replays collapse to the same id**. (Use Node `crypto` — already a dependency via the AdMob webhook.) For events without a provider_transaction_id (e.g. invalid callback), fall back to `sha256(event_type + "|" + custom_data + "|" + occurred_at)`.

### 6.2 Deduplication
- Primary: `event_id` is the table PRIMARY KEY / UNIQUE (`ON CONFLICT DO NOTHING`). Any duplicate insert is silently dropped.
- Secondary safety: unique partial index on `(correlation_id, event_type, episode_id, short_film_id, date_trunc('minute', occurred_at))` to catch near-simultaneous duplicates from double submission where random UUIDs might (improbably) differ. This is a guard, not the main mechanism.
- Effective-once, not exactly-once: distributed systems cannot guarantee exactly-once; we achieve **effectively-once** via unique `event_id` + idempotent insert. Documented as such.

### 6.3 Scenario coverage
- Retrying HTTP requests (client/network): client re-sends same `event_id` (beacon caches it) → dedup.
- Double form submission: server route emits once per request; if client double-posts, same `event_id` (client-held) → dedup; the underlying purchase RPC is itself idempotent via `episode_entitlements` upsert + wallet `for update`.
- Next.js rerenders: server components do not re-run emits unless re-requested; client beacon emits once per mount (guarded by a module-level `Set` of emitted `event_id`s in the beacon's lifetime).
- React rendering: beacon only fires in `useEffect`/`IntersectionObserver` callback, once per visible mount.
- Server retries: emitter is wrapped; if it throws, no event; a later successful attempt with same `event_id` dedups.
- AdMob webhook retries / duplicated provider callbacks / replay: deterministic `event_id` from `custom_data`+`provider_transaction_id` → replay collapses to one row; `finalize_rewarded_ad_callback` already rejects duplicate `provider_transaction_id` (`migrations/011:277-299`).

---

## 7. TIMESTAMP LAW

### 7.1 `occurred_at`
- Generated by the **server** at emit time from the server clock (UTC, `new Date().toISOString()`), formatted `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`.
- **Server timestamp is authoritative.** Client timestamps are never trusted as `occurred_at` (clients can be wrong/forged). The impression beacon sends its observation; the *server* records `occurred_at` upon receiving the beacon request.
- **Provider timestamp:** for AdMob SSV, the provider does not supply a usable business timestamp in the current payload; `occurred_at` = webhook receipt time (server). Raw provider fields (if ever needed) go in `metadata`, never as a decision input.
- `created_at` (DB default `now()`) = storage write time; `occurred_at` = business event time. They may differ slightly; both stored.

### 7.2 Constitutional rule: feature timestamp ≤ decision timestamp
0nya is in **shadow mode** and never writes back into live monetization state. Therefore an observation event can never retro-modify an earlier decision: the live decision state (`episodes`, `wallets`, `episode_entitlements`, `subscriptions`, `coin_transactions`, `chai_*`) is **never updated by the observation pipeline**. Late-arriving events (webhook replay, delayed beacon) are written to `monetization_events` only, with their own `occurred_at`, and are **not joined back** into the decision rows. The adapter (§13) explicitly separates `observable_features` (pre-decision) from `outcome` (post-action) so no post-decision value is injected into a pre-decision feature set. This structurally satisfies the rule.

---

## 8. PAYWALL / OFFER IMPRESSION INVESTIGATION

### 8.1 Actual Next.js behavior (verified)
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx` declares `generateStaticParams` (build-time prerender of **every published episode**) and calls `canUserWatchEpisode`, rendering `LockedEpisode` **at build time** for locked episodes.
- `next/link` (used throughout, including from series/episode cards) **prefetches RSC payloads** when links enter the viewport; prefetch executes the server render (including `LockedEpisode`) without the user navigating.
- `purchase/[seriesSlug]/[episodeNumber]/page.tsx` also server-renders the offer; it can be prefetched/preloaded similarly.

### 8.2 Is server render safe to count as PAYWALL_SHOWN / OFFER_SHOWN?
**NO.**
- Build-time static rendering emits `LockedEpisode` for all locked episodes before any user exists.
- Prefetch renders the paywall/offers when a link is merely scrolled into view or hovered — the user may never see or navigate to it.
- Counting server render would massively over-count impressions and corrupt the opportunity→impression→conversion funnel.

### 8.3 Recommended impression mechanism (design, not modifying existing UI)
Add a **new, add-only client component** `MonetizationImpressionBeacon` (new file, M1.8) that:
- mounts inside the existing `LockedEpisode` and `purchase/[…]/page.tsx` surfaces (the *surfaces* are existing; the beacon is new and does not alter their logic),
- fires only after real visibility is confirmed (`IntersectionObserver` + `document.visibilityState === 'visible'`, once),
- generates `correlation_id` (UUIDv4) and emits `MONETIZATION_OPPORTUNITY` + `PAYWALL_SHOWN` / `OFFER_SHOWN` via a **new** route `POST /api/v1/monetization/impression` (new file, M1.8),
- stores `correlation_id` for the subsequent navigation (URL param / hidden field) so `COIN_PURCHASE_STARTED` can carry it.
This keeps existing UI/CMS/monetization code untouched while producing truthful impressions.

---

## 9. PERSISTENCE DESIGN (no migration yet)

### 9.1 Table `monetization_events` (append-only)
Proposed columns:
| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint` generated always as identity | surrogate PK (storage) |
| `event_id` | `uuid` | UNIQUE, from event |
| `schema_version` | `text` | `"0.1"` |
| `event_type` | `text` | enum value |
| `occurred_at` | `timestamptz` | UTC, server |
| `correlation_id` | `uuid` | link key |
| `user_id` | `uuid` null | `auth.users.id` |
| `episode_id` | `uuid` null | `episodes.id` |
| `short_film_id` | `uuid` null | `short_films.id` |
| `source` | `text` | emitter |
| `payload` | `jsonb` | full `MonetizationEvent` (offer/outcome/metadata) |
| `created_at` | `timestamptz` default now() | storage time |

### 9.2 Indexes / constraints
- `UNIQUE (event_id)` — primary dedup.
- Index `(correlation_id)`.
- Index `(user_id, occurred_at DESC)`.
- Index `(event_type, occurred_at DESC)`.
- Index `(episode_id, occurred_at DESC)`, `(short_film_id, occurred_at DESC)`.
- Partial unique index `(correlation_id, event_type, coalesce(episode_id, short_film_id), date_trunc('minute', occurred_at)) WHERE source LIKE 'client:%'` — secondary guard.
- No foreign keys enforced to `episodes`/`users` (observation must never break if those rows churn; keep loose `uuid` columns; optional FK with `ON DELETE SET NULL` if desired later, but not required for M1).
- `payload jsonb` stores the entire canonical event for replay/audit.

### 9.3 Permissions / RLS
- `ENABLE ROW LEVEL SECURITY`.
- `REVOKE ALL ON monetization_events FROM anon, authenticated`.
- `GRANT INSERT TO service_role` (and a dedicated edge/writer principal using service_role). **No SELECT/UPDATE/DELETE** to app roles.
- Application (browser/mobile) users **never** read or write this table directly.
- Normal application code **never updates or deletes** rows — append-only. Any correction is a new event, not an update.
- Retention: append-only; define a retention policy later (e.g., 24–36 months) via a separate admin job; not required for M1 launch.

---

## 10. FAILURE ISOLATION

### 10.1 Deployment reality (verified)
- `Dockerfile` runs `npm run start` (`next start`) as a **long-running Node server on Cloud Run** (PORT 8080). This is **not** Vercel-style per-request serverless functions. The process (and its event loop) persists across requests.
- Implication: within a single request, an `await`ed emit completes reliably; the instance is alive for the whole handler. Risk exists only if Cloud Run scales to zero and freezes the instance *between* requests — which does not abort an in-flight request.

### 10.2 Is "fire-and-forget" safe here?
- In this long-running Node runtime, unawaited promises are **mostly** safe, but not guarantees: if the handler returns and the instance is frozen before the microtask I/O flushes, the write could be dropped on scale-to-zero.
- **Recommended safest approach:** the emitter is `async` and **awaited inside the request** but wrapped in a bounded race:
  `await Promise.race([emit(event), timeout(750ms)]);` — on timeout or any error, swallow and `console.warn`. The response is never blocked beyond ~750ms and never fails.
- This keeps monetization latency impact minimal while ensuring the write happens within the live request on the persistent Node runtime.

### 10.3 Failure behaviors (all must leave monetization untouched)
| Failure | Behavior |
|---------|----------|
| Event storage down | emitter catches, warns, returns; request proceeds; no retry that blocks response |
| Timeout | race loses, swallow; response proceeds |
| Duplicate event | unique `event_id` → `ON CONFLICT DO NOTHING`; no error |
| Invalid event | schema validation fails before emit → dropped, warned; never reaches storage |
| Network error | same as storage down; swallowed |
| Database error | caught; swallowed; response proceeds |

**Hard rule:** observation failure is never propagated to the caller. Purchase/entitlement/rewarded/Chai/playback/auth paths are completely independent of the emit result.

---

## 11. PRIVACY / SECURITY BOUNDARY

The following MUST NEVER appear in any `MonetizationEvent` (nor in `metadata`/`payload`):
- auth tokens / Supabase session JWTs
- session tokens / `parental_sessions.token_hash`
- cookies / `document.cookie` contents
- payment tokens / Google Play `purchase_token_*` (plaintext or ciphertext)
- `google_play_purchases.purchase_token_ciphertext` / `purchase_token_key_version`
- webhook signatures / secrets (`MUX_WEBHOOK_SIGNING_SECRET`, AdMob verifier keys)
- API keys / `service_role` key / `NEXT_PUBLIC_*` secrets beyond the already-public URL
- full payment-provider payloads (store only sanitized `provider_transaction_id` + `provider`)
- passwords / `user_parental_controls.pin_hash` / `pin_salt`
- personal content not needed for monetization learning (e.g., profile display name, email) — use `user_id` only
- `wallets` balance is allowed **as a snapshot** (`wallet_balance_coins`) because it is a monetization feature, not PII; never log the user's identity alongside it beyond `user_id`.

Use stable internal IDs (`user_id`, `episode_id`, `short_film_id`, `custom_data`) everywhere.

---

## 12. CURRENT CODE INSTRUMENTATION MAP (proposed emit points)

All are **existing surfaces**; emit calls are added alongside (not inside) the monetization logic. No existing file is modified in design; implementation adds emit calls / new beacon + impression route.

### A. Coin purchase
- **PATH:** `src/app/api/v1/episodes/[episodeId]/purchase/route.ts`
- **FUNCTION:** `POST` handler (around `purchaseEpisodeWithCoins`, `src/lib/purchases.ts:43`)
- **EVENT:** `COIN_PURCHASE_STARTED` (before RPC), `COIN_PURCHASE_COMPLETED` / `COIN_PURCHASE_FAILED` (after, by `result.status`)
- **WHEN:** before/after the RPC call
- **IDs:** `auth.user.id`, `episodeId`, `correlation_id` (from header/body)
- **FIELDS:** `offer` (coin_price via catalog lookup or passed amount, balance snapshot, has_active_subscription, already_owned), `outcome` (status, remaining_balance)
- **RISK:** low; must not alter RPC result or response

### B. Rewarded unlock
- **PATH:** `src/app/api/v1/episodes/[episodeId]/rewarded/route.ts` + `src/app/api/webhooks/admob/ssv/route.ts`
- **FUNCTION:** `POST` (after `createRewardedAdAttempt`, `src/lib/rewarded-ads.ts:43`) and `POST` (after `finalizeRewardedAdCallback`, `src/lib/rewarded-ads.ts:83`)
- **EVENT:** `REWARDED_UNLOCK_STARTED` (route), `REWARDED_UNLOCK_GRANTED` / `REWARDED_UNLOCK_FAILED` (webhook)
- **WHEN:** after attempt create; after finalize success/failure
- **IDs:** `user_id` (route) / via attempt (webhook), `episode_id`, `custom_data` (= correlation_id), `provider_transaction_id`
- **FIELDS:** `offer` (rewarded flags); `outcome` (status, granted, provider, provider_transaction_id)
- **RISK:** low; webhook already signature-verified; do not change verification

### C. Chai
- **PATH:** `src/app/api/v1/short-films/[slug]/chai/route.ts`
- **FUNCTION:** `POST` (before/after `submitShortFilmChaiTip`, `src/lib/chai.ts:42`)
- **EVENT:** `CHAI_TIP_STARTED` / `CHAI_TIP_COMPLETED` / `CHAI_TIP_FAILED`
- **WHEN:** before/after RPC
- **IDs:** `auth.user.id`, `short_film_id` (resolve from slug), `idempotencyKey` (= correlation_id)
- **FIELDS:** `offer` (chai_enabled), `outcome` (amount_coins, remaining_balance, status)
- **RISK:** low

### D. Monetization opportunity
- **PATH:** existing surface `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx` (LockedEpisode) — but emit via **new** `MonetizationImpressionBeacon` (client) + **new** `POST /api/v1/monetization/impression`
- **FUNCTION:** beacon `useEffect`/`IntersectionObserver` on visible paywall
- **EVENT:** `MONETIZATION_OPPORTUNITY` + `PAYWALL_SHOWN`
- **WHEN:** confirmed user-visible render (not static/prefetch)
- **IDs:** `user_id` (if known), `episode_id`, generated `correlation_id`
- **FIELDS:** `offer` (all access flags, balance snapshot)
- **RISK:** medium — must avoid static/prefetch false positives (solved by client beacon, §8)

### E. Paywall impression
- same as D (`PAYWALL_SHOWN`).

### F. Offer impression
- **PATH:** existing surface `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx` — emit via same **new** beacon + impression route
- **FUNCTION:** beacon on visible offer (price + CTA)
- **EVENT:** `OFFER_SHOWN`
- **WHEN:** confirmed visible offer render
- **IDs:** `user_id`, `episode_id`, `correlation_id` (carried from paywall via URL/field)
- **FIELDS:** `offer` (coin_price, balance, can_buy)
- **RISK:** medium — same static/prefetch guard

---

## 13. CANONICAL EVENT MAPPING

```
MonetizationEvent  --(MonetizationEventAdapter)-->  CanonicalEvent
```

- `MonetizationEvent` = raw observation (§2). `CanonicalEvent` = 0nya's internal learning record (unchanged by this design).
- **`observable_features`** (pre-decision inputs) are populated ONLY from `offer` + stable IDs + `source` + `occurred_at` + `correlation_id`. These are facts known *before* the monetization decision (content flags, price, balance, subscription state, access kind).
- **`context`** holds everything else: `schema_version`, `source`, `metadata`, and — for result events — the `outcome` block.
- **Critical rule:** outcomes of the current action (`outcome`) MUST NOT become `observable_features` for the **same** pre-decision event. Each event is a single record; a `COIN_PURCHASE_COMPLETED` event's `outcome.remaining_balance` goes under `context.outcome`, never under `observable_features`. The adapter must never backfill a later event's `outcome` into an earlier event's `observable_features`. Because events are immutable append-only rows, this is structurally enforced.
- `event_id` → `canonical_event_id` (1:1). `correlation_id` preserved for funnel joins inside 0nya.

---

## 14. SHADOW MODE BOUNDARY

**Existing monetization remains the single authoritative system.**

0nya MAY (in shadow):
- observe events from `monetization_events`
- build/internalize state from observed events
- predict / estimate price sensitivity, conversion, churn
- measure uncertainty
- produce a `DecisionEnvelope` (its own internal artifact)
- write shadow decision logs (separate from production state)

0nya MAY NOT:
- change price
- choose/select which offer to show
- grant entitlement
- change wallet balance
- execute purchase
- alter subscriptions
- alter Chai
- alter rewarded access
- alter CMS configuration

**Hard execution boundary:** observation writes only to `monetization_events` (service_role, append-only). No code path in M1 reads `monetization_events` back into `episodes`, `wallets`, `episode_entitlements`, `subscriptions`, `coin_transactions`, `chai_*`, or any route response. The live decision code (`entitlements.ts`, purchase/rewarded/chai RPCs, routes) is untouched.

---

## 15. TEST PLAN

| # | Test | Asserts |
|---|------|---------|
| 1 | Event schema validation | invalid/missing required field → rejected before storage |
| 2 | Timestamp validity | `occurred_at` is UTC ISO-8601; reject non-UTC/future-distant |
| 3 | Correlation lifecycle | OPPORTUNITY→PAYWALL→OFFER→STARTED→COMPLETED share one `correlation_id` |
| 4 | Event dedup | same `event_id` inserted twice → one row |
| 5 | Double purchase request | two purchase POSTs same episode → one COMPLETED event (idempotent) + wallet debited once (RPC) |
| 6 | Failed purchase | insufficient balance → `COIN_PURCHASE_FAILED`, no entitlement, one event |
| 7 | Successful purchase | `COIN_PURCHASE_COMPLETED`, entitlement present, balance debited |
| 8 | Rewarded webhook replay | AdMob SSV replayed → one `REWARDED_UNLOCK_GRANTED` (deterministic `event_id`) |
| 9 | Chai success/failure | tip accepted → COMPLETED; insufficient → FAILED; ledger correct |
| 10 | Event sink unavailable | storage down → purchase still succeeds, response unchanged |
| 11 | Event sink timeout | emit race timeout → response unchanged |
| 12 | Multiple browser tabs | each tab's paywall → distinct `correlation_id` |
| 13 | Offer correlation | paywall `correlation_id` reaches `COIN_PURCHASE_STARTED` via navigation |
| 14 | Replay | replayed beacon/event → deduped |
| 15 | Privacy field rejection | event containing token/secret/cookie → validation rejects |
| 16 | **Monetization isolation proof** | With event emitter forced to throw, `COIN_PURCHASE_*` / rewarded / Chai / entitlement / playback outcomes are **byte-identical** to a run with emitter disabled |

---

## 16. IMPLEMENTATION STAGES

| Stage | Adds (new files) | Touches (existing, emit-only) | Tests | Rollback | Exit condition |
|-------|------------------|-------------------------------|-------|----------|----------------|
| M1.1 Event types/validation | `src/lib/monetization/event.ts` (types + validator) | — | #1,#2,#15 | delete file | schema validates; invalid rejected |
| M1.2 Persistence | migration (later) + `monetization_events` table; `src/lib/monetization/store.ts` (insert w/ ON CONFLICT) | — | #3,#4,#10,#11 | drop table / disable grant | append-only insert works; RLS correct |
| M1.3 Emitter | `src/lib/monetization/emitter.ts` (async, timeout, swallow) | — | #10,#11,#16 | no-op flag | emit never throws/blocks |
| M1.4 Coin instrumentation | — | `api/v1/episodes/[episodeId]/purchase/route.ts` (emit calls) | #5,#6,#7 | remove emit calls | COMPLETED/FAILED emitted |
| M1.5 Rewarded instrumentation | — | `api/v1/episodes/[episodeId]/rewarded/route.ts`, `api/webhooks/admob/ssv/route.ts` | #8 | remove emit calls | GRANTED/FAILED emitted, replay-dedup |
| M1.6 Chai instrumentation | — | `api/v1/short-films/[slug]/chai/route.ts` | #9 | remove emit calls | COMPLETED/FAILED emitted |
| M1.7 Correlation | `src/lib/monetization/correlation.ts` (header/param read+gen) | purchase route reads header/field | #3,#13 | disable | chain linked; tabs separated #12 |
| M1.8 Opportunity/impression | `MonetizationImpressionBeacon.tsx` (new client), `api/v1/monetization/impression/route.ts` (new) | (beacon mounted in existing surfaces, surfaces unchanged) | #3,#12,#13,#14 | unmount beacon / disable route | truthful OPPORTUNITY/PAYWALL/OFFER (§8) |
| M1.9 CanonicalEvent adapter | `src/lib/monetization/adapter.ts` | — | #2 semantics | disable | `observable_features`≠`outcome` enforced |
| M1.10 Shadow consumer | `scripts/` or edge consumer reading `monetization_events` (out-of-prod) | — | #16 | stop consumer | 0nya observes only; no prod write |

Rollback is per-stage (emit calls are additive and removable; new files deletable; table drop/grant-revoke). No existing monetization logic changes.

---

## 17. LAUNCH READINESS GATE

Must all pass before launch:
- [ ] Events do not affect monetization outcomes (test #16 green)
- [ ] Purchase transaction remains atomic (`purchase_episode_with_coins` unchanged)
- [ ] Entitlement behavior unchanged (`canUserWatchEpisode`/`episode_entitlements` unchanged)
- [ ] Rewarded verification unchanged (AdMob SSV + RPC unchanged)
- [ ] Chai behavior unchanged (RPC unchanged)
- [ ] `event_id` dedup works (test #4)
- [ ] Correlation works (tests #3,#13)
- [ ] Timestamps reliable (UTC server `occurred_at`, test #2)
- [ ] No secrets enter event stream (test #15 + §11)
- [ ] Observation storage survives retries (tests #8,#10,#11)
- [ ] Events are replayable (append-only + deterministic ids, test #14)
- [ ] 0nya shadow decisions cannot execute (no prod write path, §14)

---

## 18. OPEN QUESTIONS

Cannot be determined safely from the current codebase (do not guess):
- Exact Cloud Run scale-to-zero freeze timing for this project's deployed revision (deployment-specific; affects only the fine boundary of unawaited vs awaited emit — mitigated by §10.2).
- Which durable sink is preferred (Supabase `monetization_events` table vs external queue/warehouse) — design assumes Supabase table; alternate sink only changes `store.ts`.
- Whether a fiat currency/locale model will ever be needed (no `currency` collected today; `OfferSnapshot.currency` left `null`/`"COIN"`).
- Whether `correlation_id` should also span **rewarded** and **coin** chains into one cross-product funnel, or stay per-product (current design: separate per product; can be unified later by a shared client id).
- Subscription/refund event shapes are deferred until those flows are implemented (§3.2) — their `OfferSnapshot`/`OutcomeSnapshot` fields are not specifiable from absent code.
- Whether the client impression beacon's `correlation_id` should be persisted server-side for attribution beyond the in-flight flow (current design: client-carried only).

---

## 19. FINAL RECOMMENDATION

**SAFE TO IMPLEMENT M1.**

Blocking reasons: none found. The design:
- keeps all existing monetization, entitlement, purchase, rewarded, Chai, and playback behavior unchanged;
- adds observation only via append-only `monetization_events` (service_role, RLS-denied to app users);
- uses the verified long-running Node (`next start`/Cloud Run) runtime, where an awaited-with-timeout emit is reliable and safe;
- correctly identifies that server render / prefetch must NOT count as impressions (§8) and proposes a client beacon instead of modifying UI;
- enforces the shadow boundary (§14) and the timestamp/constitutional rule (§7) structurally.

Implementation must follow §16 stages with the §17 gate; no production monetization path is altered.

---

**FILES MODIFIED:**
- docs/architecture/MONETIZATION_OBSERVATION_BRIDGE_v0.1.md

NO APPLICATION SOURCE FILES WERE MODIFIED.
NO DATABASE MIGRATIONS WERE CREATED.
NO PRODUCTION MONETIZATION BEHAVIOR WAS CHANGED.
