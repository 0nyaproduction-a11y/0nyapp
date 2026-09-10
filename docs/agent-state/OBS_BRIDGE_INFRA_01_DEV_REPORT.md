# OBS-BRIDGE-INFRA-01 -- DEV Provisioning Disposition

**Date:** 2026-09-06  
**Status:** `BLOCKED`

## Safety disposition

No infrastructure was created or changed.

The authenticated Google Cloud project is named `0nya App` and currently
contains the active QA service `onya-qa-api` plus its QA runtime identity.
Neither the project labels nor the existing Cloud Run service inventory proves
that it is an isolated DEV environment. Creating a Bridge service, IAM
identities, secrets, or datastore there would risk violating the explicit
DEV-only scope and the required QA/App isolation.

The repository's existing Supabase configuration is linked to project
`0nyapp`, which is the Consumer App datastore. It must remain untouched.
There is no proven dedicated DEV Bridge Supabase/Postgres project available for
the Bridge-owned schema. The local Supabase CLI wrapper could not enumerate
remote projects in this shell, so it cannot establish a safe target.

## Verified read-only evidence

- Google Cloud CLI is authenticated to project `nya-app-c9823`.
- Required Cloud Run, IAM Credentials, and Secret Manager APIs are enabled.
- Existing Cloud Run inventory includes `onya-qa-api`; no Bridge service exists.
- Existing runtime identity includes `onya-qa-api-runtime`; no dedicated Bridge
  runtime or producer identity exists.
- The repository Supabase link is `0nyapp`, not a dedicated Bridge datastore.
- No Consumer App producer, Android client, Autonomous component, schema, API,
  deployment, secret, or IAM policy was changed.

## Required unblock inputs

1. An explicitly designated DEV Google Cloud project ID and approved Cloud Run
   region, separate from the QA product service.
2. A dedicated DEV Bridge Supabase/Postgres project/connection approved for
   Bridge-only ownership, including an approved secret-management path.
3. The principal that will deploy the Consumer App backend and therefore needs
   Cloud Run Invoker on the DEV Bridge service.

After those are supplied, provision only the dedicated DEV Cloud Run service,
Bridge runtime identity, producer invoker identity, Bridge-local schema, and
secret bindings; then verify IAM rejection/acceptance and datastore
idempotency before wiring any producer.
