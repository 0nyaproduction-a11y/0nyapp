# OBS-BRIDGE-INFRA-00 -- DEV Environment Ownership Decision

**Date:** 2026-09-06  
**Status:** `BLOCKED`

## Decision

No DEV Bridge target is approved or provisionable from current evidence.
No resource was created, deployed, altered, or targeted.

The authenticated account can enumerate several Google Cloud projects, but
none is documented or verified as an isolated DEV Bridge project. The current
selected project, `nya-app-c9823` (`0nya App`), contains the active
`onya-qa-api` Cloud Run service and `onya-qa-api-runtime` identity. It is
therefore disqualified from use as the required isolated DEV Bridge project.

The repository Supabase configuration names `0nyapp`, the existing Consumer
App datastore. It is disqualified from reuse by the Bridge.

## Ownership fields awaiting owner approval

| Required decision | Verified state |
| --- | --- |
| Dedicated DEV GCP project ID | Unknown / not approved |
| Project and billing owner | Unknown / not approved |
| Approved Cloud Run region | Unknown / not approved |
| QA/production workload absence | Unknown for candidate projects; confirmed false for `nya-app-c9823` because QA exists |
| Dedicated Bridge datastore | Unknown / not approved |
| Datastore owner and region | Unknown / not approved |
| Secrets owner | Unknown / not approved |
| Product-backend producer principal | Not created or designated |
| Bridge runtime principal | Not created or designated |
| Deployer principal | Not designated |

## Non-negotiable target constraints

- The DEV GCP project must have no QA or production product workload.
- The Bridge datastore must be a dedicated Supabase project or dedicated
  Postgres instance, never the `0nyapp` Consumer App datastore.
- The product backend receives Cloud Run Invoker only; Android, user tokens,
  Supabase anon keys, and shared API keys are not Bridge producer credentials.
- The Bridge runtime identity receives datastore-only least privilege and no
  App datastore or Autonomous permissions.
- The approved deployer owns DEV deployment, IAM bindings, Secret Manager
  bindings, and Bridge-local schema creation.

## Required owner decision

Provide the dedicated DEV GCP project ID, billing/project owner, region,
dedicated datastore name/owner/region, secrets owner, product-backend producer
principal, Bridge runtime principal, and deployer principal. Explicitly confirm
that billing and DEV infrastructure are approved and that the selected project
contains no QA/production workloads.
