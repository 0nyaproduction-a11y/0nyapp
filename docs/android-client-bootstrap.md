# Android Client Bootstrap

Build #11 adds an isolated Expo React Native app in `apps/android`. The web app
and Next.js API remain the backend authority.

## Project Structure

```text
apps/android/
  App.tsx
  src/
    components/
    config/
    lib/
    navigation/
    screens/
    types/
```

The Android package has its own `package.json`, `package-lock.json`, Expo config,
TypeScript config, and public environment variable example.

## Environment

Create a local Expo environment file when running the app:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_ONYA_API_BASE_URL=http://localhost:3000
```

Only publishable client configuration belongs in the mobile app. Service-role
credentials, payment provider secrets, Twilio credentials, and verification
keys must never be included.

## Auth Flow

The mobile app signs in with Supabase using the publishable key and persists the
Supabase session through Expo SecureStore. The app never stores service-role
credentials and never asks the user or API caller to provide a `user_id`.

Email/password is present only as the simplest development sign-in path while
the production phone OTP plan remains unchanged.

## Bearer API Flow

Authenticated API requests attach the current Supabase access token as:

```text
Authorization: Bearer <Supabase access token>
```

The Next.js API validates the token with Supabase, derives the user from that
token, and performs database reads with a request-scoped Supabase client that
preserves the Bearer user's RLS context.

## Screens

The app includes minimal foundation screens:

- Sign In
- Home/catalog
- Series detail
- Account
- Wallet
- Watch placeholder

Episode ownership and access state come from `/api/v1/series/[slug]`. The mobile
client does not calculate entitlements locally.

## Deferred Work

- Real successful Bearer-token API verification from a running Expo session.
- Native video playback.
- Google Play Billing.
- Purchase verification backend adapter.
- Push notifications and deep/universal links.

## Security Notes

- No payment checkout is implemented.
- No trusted wallet credit function is exposed.
- No entitlement grant is exposed.
- No direct wallet or subscription writes are added.
- Coin pack buttons remain unavailable until real store/provider integration is
  designed.
