# Mobile API Readiness

## Purpose

Build #10 prepares the existing 0nya web backend for a future native Android
client without changing the current payment, entitlement, or content authority.
The web app remains the primary client today.

## Shared Architecture

The intended boundary is:

```text
Web UI / future Android API layer
  -> shared domain helpers
  -> Supabase
```

Catalog, account, wallet, subscription, entitlement, purchase, payment, profile,
and watch-progress reads should continue to move through shared helpers in
`src/lib`. UI components and route handlers should not duplicate access rules.

## Future Android Auth

Android should authenticate with Supabase and send its current user access token
to 0nya API routes as:

```text
Authorization: Bearer <supabase-user-access-token>
```

API auth derives the user from Supabase token validation. Clients must never send
or choose a `user_id` for protected resources.

Existing web cookie sessions remain supported for same-origin browser requests.

A successful real Bearer-token request must still be verified before native
Android integration begins; Build #10 verifies the code path and failure modes
without weakening authentication.

## API Response Shape

Successful responses use:

```json
{ "data": {} }
```

Error responses use:

```json
{
  "error": {
    "code": "not_authenticated",
    "message": "Authentication is required."
  }
}
```

Responses must not expose SQL errors, stack traces, secrets, cookies, access
tokens, or refresh tokens.

## Endpoints Added

- `GET /api/v1/catalog`
  - Public.
  - Returns published catalog data.

- `GET /api/v1/series/[slug]`
  - Public.
  - Returns published series metadata and episodes.
  - If authenticated, includes derived episode access state.

- `GET /api/v1/me`
  - Authenticated.
  - Returns safe account data: user id, display name, safe identifier, wallet
    summary, and subscription summary.

- `GET /api/v1/wallet`
  - Authenticated.
  - Returns wallet balance, active coin products, recent coin transactions, and
    recent top-ups.
  - Read-only.

- `GET /api/v1/watch-progress`
  - Authenticated.
  - Returns only the authenticated user's watch progress.
  - Read-only in this build.

## Endpoints Intentionally Not Exposed

- Wallet credit.
- Payment verification.
- Entitlement grant.
- Subscription mutation.
- Direct wallet mutation.
- Service-role operations.

Watch-progress writes remain deferred for the Android API until native client
resume behavior, write cadence, and validation rules are finalized. The existing
web player can continue using its current authenticated watch-progress authority.

## Episode Access Rule

Playback access remains:

```text
free episode
OR valid episode entitlement
OR active subscription
```

This rule is shared by the web watch route, series page badges, and the API
series response. Paid episode access must never be unlocked by client state,
query parameters, or wallet balance alone.

## Payment Readiness

Google Play Billing is not integrated in Build #10.

Future Android top-up flow:

```text
Google Play purchase
  -> trusted backend verifies purchase token
  -> trusted backend calls service-role-only credit function
  -> payment_order and linked coin transaction are recorded
  -> wallet balance increases exactly once
```

The service-role credential must only live in trusted server/provider
verification infrastructure. It must never ship in browser or mobile client code.

The existing provider-neutral payment order and ledger model also leaves room for
future iOS StoreKit and web provider verification.

## CORS

No broad CORS policy is added in Build #10. When a separate Android-facing host
or web domain is introduced, allowed origins and platform-specific request
headers should be configured deliberately rather than with `*`.

## Security Rules

- Use Supabase RLS for user-scoped reads.
- Derive the user from cookies or validated Bearer tokens.
- Never trust `user_id` from request bodies or query strings.
- Keep money and entitlement writes behind trusted server/database authority.
- Do not expose raw auth metadata, cookies, session tokens, or refresh tokens.
- Keep API routes versioned under `/api/v1`.
