---

title: "0nya Security, Privacy & Compliance Release"
version: "1.0"
status: "Governance + Release Gate"
authority: "Companion to Product Bible v3.0 and technical architecture docs"
date: "2026-08-21"
product: "0nya"
scope: "Android-first consumer app; India OTT; future iOS-aware"
---

# 0nya SECURITY + PRIVACY + COMPLIANCE RELEASE v1.0

**Read with:**

1. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
2. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
3. `docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md`
4. `docs/0nya_DESIGN_SYSTEM_v1.0.md`
5. `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`
6. `docs/0nya_APP_ARCHITECTURE_v1.0.md`
7. `docs/0nya_BACKEND_API_CONTRACT_v1.0.md`
8. `docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md`

> This is the final internal governance/release-gate document.
>
> It does not replace legal advice or Google Play / Apple / Government policy text.
> Current official policy always wins if a requirement changes.

---

# 1. WHY THIS FILE EXISTS

0nya contains security-sensitive and regulated product areas:

```text
phone / OTP authentication
watch history
wallet / coins
permanent episode entitlements
Chai ledger
subscription entitlement
creator data
CMS/admin
content ratings
parental controls
video playback
analytics
advertising
account deletion
```

This document defines:

```text
SECURITY controls
PRIVACY/data-governance controls
INDIA OTT controls
GOOGLE PLAY release requirements
public legal/support surfaces
release blockers
incident/operational minimums
```

Do not create a separate document for each small compliance feature.

---

# 2. IMPLEMENTATION STATUS LANGUAGE

When this document is audited against code, use only:

```text
IMPLEMENTED
PARTIALLY IMPLEMENTED
MISSING
EXTERNALLY BLOCKED
NOT APPLICABLE
UNKNOWN / NOT PROVEN
```

Do not mark a control implemented because a database column, package, or placeholder screen exists.

---

# 3. SECURITY TRUST MODEL

## Core principle

```text
Client = untrusted presentation layer
Backend = authoritative business/security layer
Database = protected through server rules/RLS/functions
CMS = privileged administrative surface
```

The mobile client must never be the sole authority for:

```text
wallet balance
coin deduction
Chai credit
episode entitlement
Plus entitlement
purchase verification
rewarded-ad entitlement
content release state
age/parental enforcement where server verification is required
```

---

# 4. AUTHENTICATION / SESSION SECURITY

Required controls:

```text
OTP verification handled by trusted auth/backend
OTP values never logged to analytics
phone numbers not exposed unnecessarily
session tokens stored using platform-appropriate secure mechanisms
logout invalidates/removes local authenticated session
expired/revoked sessions handled cleanly
authenticated API calls reject missing/invalid sessions
```

Do not put:

```text
OTP
access token
refresh token
service-role key
purchase receipt
```

into analytics events.

---

# 5. SUPABASE / DATABASE SECURITY

Where Supabase is used, audit:

```text
RLS enabled on user-sensitive tables
policies scoped to the authenticated user
service-role key server-side only
no service-role key in Expo/public client
functions use correct SECURITY DEFINER behavior where applicable
search_path controlled for privileged SQL functions where applicable
wallet/ledger tables protected against arbitrary client writes
creator/private data protected
admin/CMS writes permission-controlled
```

Never expose privileged secrets through:

```text
EXPO_PUBLIC_*
NEXT_PUBLIC_*
client bundles
Git repository
logs
screenshots
documentation examples
```

---

# 6. WALLET / COIN / CHAI SECURITY

Wallet operations must be server-authoritative.

Required:

```text
atomic balance mutation
immutable or append-only transaction evidence where practical
idempotency for purchase credits
idempotency for entitlement creation
no negative balance caused by race conditions
server validation of available balance
transaction reason/source recorded
reversal capability for operational corrections
new accounts receive 100 welcome coins once, server-side and idempotent
welcome coins remain wallet credits in the same 0nya wallet used for episodes and Chai
no fixed INR/₹ cash-value promise is attached to the welcome grant
login, recovery, or reinstall does not re-issue the same account grant
```

Chai transaction must atomically:

```text
debit viewer coin wallet
+
credit creator/film Chai ledger
```

Do not implement Chai as:

```text
client-only balance update
separate hidden currency
direct cash/UPI viewer payment
```

---

# 7. EPISODE ENTITLEMENT SECURITY

Access must not be granted merely because the client sends:

```text
"unlocked": true
```

Server/backend must protect entitlement creation.

Permanent entitlement sources may include:

```text
coin unlock
verified rewarded-ad unlock
approved grant/admin migration
```

Plus is a current subscription entitlement and should remain conceptually separate from permanent episode ownership.

---

# 8. PURCHASE / BILLING SECURITY

Current repo audit status:

```text
backend wallet/order foundation = present
native Google Play Billing = not yet implemented / deferred
production Play verification = incomplete
Restore / Sync = not yet implemented
```

When Play Billing implementation resumes:

```text
purchase token must be verified through trusted backend/provider logic
duplicate token must not credit twice
coin purchase credit must be idempotent
subscription entitlement must be reconciled server-side
refund/revocation/expiry state must eventually reconcile
Restore/Sync must associate purchases with the correct 0nya account
```

Do not implement native billing casually during unrelated UI work.

---

# 9. REWARDED-AD SECURITY

When rewarded ads are implemented:

```text
viewer intentionally chooses reward
ad provider completion must be verified through supported trusted signal
grant endpoint must be idempotent
no-fill does not unlock
failed/interrupted ad does not silently unlock
```

Do not award:

```text
coins
episode entitlement
```

from a timer or client-side `onClose` assumption alone.

---

# 10. API SECURITY

Audit every state-changing API for:

```text
authentication
authorization
input validation
rate limiting / abuse protection where appropriate
idempotency where monetary/entitlement state changes
safe error responses
PII-safe logging
```

High-risk endpoints/functions:

```text
OTP request / verify
wallet credit/debit
purchase verify
episode unlock
rewarded unlock
Chai tip
subscription sync
account deletion
admin/CMS mutation
```

---

# 11. RATE LIMIT / ABUSE PROTECTION

At minimum plan protections for:

```text
OTP spam
login abuse
search scraping
reward endpoint replay
Chai replay
purchase verification replay
API enumeration
admin login attempts
```

Prefer existing hosting/backend controls before adding a paid security SaaS.

---

# 12. CLIENT SECRET RULE

Never ship:

```text
Supabase service role
Google Play service credentials
ad-server secrets
private API signing secrets
CMS admin secret
database password
```

in the app.

Public client keys that are designed to be public must still rely on server/database authorization.

---

# 13. LOGGING / OBSERVABILITY SECURITY

Logs should be operationally useful without becoming a privacy database.

Never log raw:

```text
OTP
full access/refresh tokens
payment receipt
purchase credentials
service credentials
full phone number unless operationally necessary and access-controlled
```

Prefer:

```text
internal user UUID
request ID
transaction ID
content ID
sanitized error code
```

---

# 14. ADMIN / CMS SECURITY

CMS is a privileged surface.

Required:

```text
authenticated admin access
role-based permission appropriate to current architecture
commercial fields restricted
auditability for critical config changes
creator/private viewer data separated
```

Higher-risk CMS changes:

```text
episode coin price
free_access
Plus eligibility
rewarded unlock eligibility
release scheduling
content rating
short-film ad timecodes
Chai mapping
```

---

# 15. DEPENDENCY / SUPPLY-CHAIN SECURITY

Before adding packages:

```text
confirm existing dependency cannot solve need
prefer mature maintained package
avoid abandoned package
avoid unnecessary native dependency
review permission/SDK behavior
```

Maintain:

```text
lockfile
reproducible installs
dependency update process
```

Do not add security, analytics, attribution, or UI SaaS just because an AI agent suggests it.

---

# 16. PRIVACY DATA INVENTORY

The final privacy policy and Play Data Safety declaration must reflect what the app **actually** collects.

Audit at least:

| Data category | Typical 0nya purpose | Final status must be verified |
|---|---|---|
| Phone number | OTP/account authentication | VERIFY |
| Internal user ID | account/session | VERIFY |
| Watch history/progress | Continue Watching | VERIFY |
| Search query | search/service improvement | VERIFY |
| Content interactions | playback/product analytics | VERIFY |
| Coin wallet balance | digital entitlement economy | VERIFY |
| Coin transactions | accounting/fraud/support | VERIFY |
| Chai transactions | creator ledger/support | VERIFY |
| Subscription status | Plus entitlement | VERIFY |
| Purchase/provider identifiers | billing verification | VERIFY |
| Device/app diagnostics | reliability | VERIFY |
| Ad-related data | rewarded/short-film ads when SDK exists | FUTURE / VERIFY |
| Notification token | push notifications when implemented | FUTURE / VERIFY |
| Support/grievance information | user support/legal process | VERIFY |

Do not declare hypothetical future SDK collection as already collected.

---

# 17. DATA PURPOSE / MINIMISATION

For every collected field document:

```text
what is collected
why
source
where stored
who can access
which processor/SDK receives it
retention rule
deletion behavior
legal/security retention exception if any
```

Do not collect a field simply because it might be useful later.

---

# 18. DATA RETENTION

Do not invent arbitrary retention periods in code or policy.

Before public launch, approve retention rules for:

```text
account/profile data
watch history
search analytics
OTP/security logs
wallet/coin transactions
Chai ledger
billing/order records
support/grievance correspondence
analytics events
```

Financial/fraud/regulatory records that must be retained after account deletion must be disclosed appropriately.

---

# 19. ACCOUNT DELETION — GOOGLE PLAY RELEASE GATE

Because the app supports account creation, Google Play currently requires a readily discoverable account-deletion option:

```text
inside the app
AND
outside the app through a web resource
```

The deletion flow must delete associated account data, subject to legitimate disclosed retention needs; merely freezing/deactivating the account is not sufficient.

Required product surfaces:

```text
Q01 Delete Account
external delete-account webpage
Privacy Policy explanation of retention exceptions
```

Reference:
`https://support.google.com/googleplay/android-developer/answer/10144311`

---

# 20. PUBLIC PRIVACY POLICY — GOOGLE PLAY RELEASE GATE

Google Play currently requires:

```text
privacy policy link in Play Console
+
privacy policy link/text available inside app
```

The policy must accurately disclose actual data access, collection, use, and sharing.

Reference:
`https://support.google.com/googleplay/android-developer/answer/10144311`

---

# 21. GOOGLE PLAY DATA SAFETY

Before production publication, complete the Play Console Data Safety declaration from the **actual audited data/SDK inventory**.

Do not fill the form from memory or marketing language.

Audit all third-party SDKs first.

Examples to check when present:

```text
Supabase
analytics
crash reporting
ads
push notifications
billing
attribution
support SDK
```

The developer remains responsible for third-party SDK data behavior.

---

# 22. GOOGLE PLAY TARGET API — CURRENT 2026 RELEASE GATE

Current Google Play requirement effective **31 August 2026**:

```text
new mobile apps and app updates:
target Android 16 / API level 36 or higher
```

There is an extension path to 1 November 2026 for eligible impacted apps.

Reference:
`https://support.google.com/googleplay/android-developer/answer/11926878`

This requirement can change yearly. Re-check immediately before release.

---

# 23. GOOGLE PLAY ORGANISATION / D-U-N-S

Current project status:

```text
D-U-N-S / organisation Play setup = externally blocked / deferred
native Play Billing = deferred
```

Treat this as a business/release dependency, not an application-code bug.

Do not let an AI agent attempt to "solve" the D-U-N-S requirement in code.

---

# 24. GOOGLE PLAY CONTENT / APP DECLARATIONS

Before production submission, review the current Play Console declarations applicable to the final app, including:

```text
app content / content rating
Data Safety
ads declaration
app access / reviewer access if applicable
privacy policy
account deletion URL
target audience / children-related declarations
financial/billing declarations where applicable
```

Use the current Play Console policy pages at release time.

---

# 25. INDIA OTT — CONTENT CLASSIFICATION

Under the current IT Rules framework for publishers of online curated content, classification categories include:

```text
U
U/A 7+
U/A 13+
U/A 16+
A
```

Relevant descriptors include themes/messages, violence, nudity, sex, language, drugs/substance abuse, and horror.

The rating and relevant descriptor information must be prominently presented so the viewer is aware before watching.

Reference:
`https://www.mib.gov.in/sites/default/files/2026-05/it-rules-2021-2.pdf`

---

# 26. INDIA OTT — PARENTAL / AGE CONTROL

Current rules require:

```text
U/A 13+ or higher:
access control mechanisms including parental locks must be available

A-rated:
reliable age verification mechanism
```

A-rated content should remain unpublished in the MVP until reliable approved age verification exists.

Reference:
`https://www.mib.gov.in/sites/default/files/2026-05/it-rules-2021-2.pdf`

---

# 27. INDIA OTT — GRIEVANCE MECHANISM

Current rules require the publisher-level grievance mechanism to include:

```text
Grievance Officer based in India
name/contact details displayed on website/interface
publisher-level grievance process
decision on grievance within 15 days
membership in a self-regulating body under the applicable rules
```

This is an operational/legal release item, not merely a Profile menu link.

Required public surface:

```text
Grievance page
Grievance Officer name/contact
submission/contact method
process/SLA
```

Reference:
`https://www.mib.gov.in/sites/default/files/2026-05/it-rules-2021-2.pdf`

---

# 28. INDIA OTT — ACCESSIBILITY

Current OTT rules state publishers should, to the extent feasible, make reasonable efforts to improve accessibility through access services.

Plan/support where feasible:

```text
subtitles / closed captions
readable player controls
screen-reader-friendly app UI
future audio description where content/product scope permits
```

---

# 29. DPDP — PHASED COMMENCEMENT

The Digital Personal Data Protection Act/Rules have phased commencement.

The November 2025 Gazette notification brought some provisions into force immediately, specified a one-year commencement for certain provisions, and an eighteen-month commencement for many core data-processing rights/obligations.

Therefore:

> Do not treat all DPDP provisions as having the same effective date.

Maintain a compliance tracker and re-check the operative provisions before public launch and as commencement dates arrive.

Official Gazette reference:
`https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf`

---

# 30. PUBLIC WEB / LEGAL SURFACES

Before production Play launch, prepare and publish at minimum:

```text
/privacy
/terms
/delete-account
/grievance
```

Use the final owned 0nya web domain.

Also provide in-app access to:

```text
Privacy
Terms
Delete Account
Help
Report Content Issue
Grievance
```

Do not hide legal/support routes behind login unless truly required.

---

# 31. PRIVACY POLICY CONTENT CHECKLIST

Public Privacy Policy should accurately cover as applicable:

```text
company/data-controller identity
contact
data categories
collection sources
purposes
service providers/processors
analytics
advertising when implemented
billing/order data
security/fraud
retention
account deletion
data retained after deletion and reason
user rights/process
children/minors position
international processing if applicable
policy changes
grievance/privacy contact
```

Have final legal wording reviewed before launch.

---

# 32. TERMS OF USE CHECKLIST

Terms should eventually cover as applicable:

```text
service eligibility
account rules
content licence/viewing rights
coins
permanent episode unlock meaning
0nya Plus
billing/renewal
refund/store handling
Chai coin tipping
prohibited misuse
content/IP
user support
account suspension/termination
disclaimers
governing law/dispute terms
contact
```

Do not use this internal file as the public Terms.

---

# 33. ANALYTICS PRIVACY

Allowed analytics should avoid unnecessary personal data.

Never include:

```text
phone number
OTP
full payment receipt
raw purchase token
access token
refresh token
private support message
```

Preferred:

```text
pseudonymous user ID
content ID
episode ID
screen ID
event name
sanitized error code
```

Search analytics should be sanitized and reviewed for accidental PII.

---

# 34. AD PRIVACY

When an ad SDK is introduced:

Before release:

```text
audit SDK data collection
audit permissions/device identifiers
update Data Safety
update Privacy Policy
implement consent/choice where required
ensure rewarded-ad verification is secure
```

Do not add an ad SDK during UI-only work.

---

# 35. PUSH NOTIFICATION PRIVACY

When push is implemented:

```text
OS permission required
marketing opt-in explicit
marketing default OFF
transactional/service messages separated where appropriate
token lifecycle handled securely
```

Do not treat push permission as marketing consent automatically.

---

# 36. VIDEO / CDN SECURITY — RELEASE REQUIREMENTS

Production media delivery is not complete in the current audited repo.

Before production-scale streaming, settle:

```text
origin/storage
transcoding
HLS/ABR outputs
CDN
playback URL authorization
signed/tokenized URL strategy
URL/token expiration
CORS/origin rules
hotlink resistance
cache policy
subtitle delivery
takedown/deletion propagation
bandwidth/egress monitoring
```

This should be captured later in:

```text
docs/0nya_MEDIA_CDN_DELIVERY_SECURITY_v1.0.md
```

Do **not** create/choose a paid CDN merely to satisfy documentation.

Create that file when production streaming implementation starts.

---

# 37. BACKUP / RECOVERY MINIMUM

Before launch, document operational recovery for:

```text
database backup
wallet/ledger restoration
CMS content recovery
accidental content deletion
secret/key rotation
failed deployment rollback
```

Prefer existing Supabase/Vercel/provider capabilities.

---

# 38. SECURITY INCIDENT MINIMUM

Define who acts when:

```text
account compromise
admin credential compromise
service secret exposure
wallet/ledger anomaly
purchase fraud spike
data exposure
malicious CMS change
video URL leakage
```

Minimum response:

```text
contain
revoke/rotate
preserve evidence/logs
assess affected users/data
restore service
meet applicable notification/legal obligations
post-incident remediation
```

A separate long incident-runbook document is not required for MVP unless operations complexity grows.

---

# 39. SECRET-ROTATION CHECKLIST

Maintain an inventory of secret/config **names**, not secret values.

Examples when applicable:

```text
Supabase service credentials
database credentials
email/OTP provider secret
future Google Play server credential
future ad verification secret
signing credentials
CMS/admin integrations
```

Never copy actual secrets into this document.

---

# 40. SECURITY TEST / PRE-RELEASE CHECK

Before production:

```text
run dependency audit
verify no secrets committed
review Expo/public env variables
verify authenticated API authorization
verify RLS/policies
test account isolation
test wallet double-spend/race behavior
test entitlement replay
test Chai replay
test logout/session expiry
test account deletion
test parental gate
test deep-link access bypass attempts
test payment/reward endpoint idempotency when implemented
```

---

# 41. RELEASE BLOCKERS — MUST NOT SHIP

Do not production-launch if any applicable item is unresolved:

```text
privacy policy missing
in-app account deletion missing for account-creating app
external account deletion route missing
Play Data Safety not completed/verified
target API requirement not met
content rating missing
U/A 13+ parental controls missing for such content
A-rated content published without reliable age verification
India grievance process/Officer requirement unresolved
wallet allows unauthorized client mutation
privileged secret present in app/client
known cross-account data access
production purchase flow can double-credit
production Chai can double-debit/credit
```

---

# 42. DEFERRED / NOT A UI BLOCKER

These may remain deferred until their implementation phase, provided they are not advertised as live:

```text
native Google Play Billing while Play setup remains blocked
rewarded-ad production SDK
short-film production ad SDK
advanced analytics
production CDN/signed-stream architecture
A-rated catalogue
advanced attribution
```

The UI may be designed, but production capability must not be falsely represented.

---

# 43. BUILD 15 SECURITY / PRIVACY IMPLEMENTATION RULE

UI work may proceed now.

However, every Build 15 implementation must preserve:

```text
server authority
no hardcoded entitlement trust
no secret in client
PII-safe analytics
account deletion routes
content-rating gates
parental/access controls
backend-controlled commerce/access state
```

If a screen requires a missing secure backend function:

```text
implement UI state safely
mark backend gap
do not fake successful server behavior
```

---

# 44. COPILOT AUDIT PROMPT

Run this once after placing this document in `docs/`.

```text
Read:

1. docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
2. docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
3. docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md
4. docs/0nya_DESIGN_SYSTEM_v1.0.md
5. docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md
6. docs/0nya_APP_ARCHITECTURE_v1.0.md
7. docs/0nya_BACKEND_API_CONTRACT_v1.0.md
8. docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md
9. docs/0nya_SECURITY_PRIVACY_COMPLIANCE_RELEASE_v1.0.md
10. .github/copilot-instructions.md

Do not modify application code.
Do not install packages.
Do not create database migrations.
Do not commit or push.

Perform one final repository-backed SECURITY / PRIVACY / RELEASE audit.

For every relevant control in

---

# 45. REPOSITORY AUDIT — BUILD 15 BASELINE (REPO-BACKED STATUS)

This section is the final repository-backed baseline for the current 0nya codebase and should be treated as the audit status as of the last repository review.

## 45.1 Summary verdict

```text
Status: NOT READY FOR production Play launch
Status: PARTIALLY READY for server-authoritative wallet/entitlement foundation
Status: MISSING for final legal/privacy/public release surfaces
Status: EXTERNALLY BLOCKED for Play org / D-U-N-S / billing setup
Status: PARTIALLY IMPLEMENTED for playback foundation only
```

## 45.2 Evidence reviewed

Repo evidence reviewed for this baseline includes:

```text
apps/android/app.json
apps/android/package.json
apps/android/.env.local
src/lib/supabase/env.ts
src/lib/payments.ts
src/lib/purchases.ts
src/types/database.ts
supabase/002_content_catalog.sql
supabase/003_entitlements_monetization.sql
supabase/004_coin_transactions.sql
supabase/005_wallet_topups.sql
src/app/account/page.tsx
src/app/wallet/page.tsx
apps/android/src/player/devSources.ts
apps/android/src/player/usePlaybackController.ts
```

## 45.3 Security and privacy status

### Authentication / sessions

```text
Status: PARTIALLY IMPLEMENTED
```

Repo evidence shows authenticated flows using Supabase auth and server-side `getUser()` checks in Next.js pages and server routes. The repo contains a login flow and sign-out flow. However, no explicit repo evidence was found for full public legal/consent surfaces, session token rotation, or a full security review of OTP/logging hygiene beyond design guidance.

### Public secrets and environment hygiene

```text
Status: PARTIALLY IMPLEMENTED
```

The Android app includes a local `.env.local` with:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_ONYA_API_BASE_URL
```

This is consistent with a public client configuration model. The repo does not show a committed `service_role` secret or database password. However, the local Android public env file was present in the working tree and is not a production-safe release artifact; it should be managed via secure environment control before production publication.

### Wallet / coin / transaction security

```text
Status: IMPLEMENTED (server-authoritative foundation)
```

The repo contains server-side wallet, coin products, payment orders, and transaction tables in SQL and strongly-enforced payment logic in `public.credit_verified_coin_purchase(...)`.

Evidence includes:

```text
unique indexes on provider + transaction_id
unique credit-per-payment-order protection
wallet balance update logic in SQL
wallet and payment order access model via RLS
coin product placeholder definitions
```

This is a solid foundation for a backend-authoritative economy. It is not equivalent to a live, production billing implementation.

### Purchase verification / Google Play billing

```text
Status: MISSING / EXTERNALLY BLOCKED
```

The repo does not contain a native Google Play Billing integration. There is no evidence of:

```text
com.android.billingclient:billing
Google Play Billing client setup
purchase token verification endpoint tied to Play
Restore/Sync Purchases flow
Google Play Console org / D-U-N-S setup
```

The payment-order schema references `provider = 'google_play'`, but the actual Play verification stack is not implemented in this repository.

### Rewarded ads / entitlement security

```text
Status: MISSING / NOT PROVEN
```

The repo contains entitlement types and wallet logic, but no rewarded-ad provider implementation, completion verification flow, or production grant endpoint evidence. This remains a future implementation item and must not be treated as live.

### Account deletion / privacy/legal surfaces

```text
Status: MISSING
```

No public privacy-policy, terms, delete-account page, grievance page, or app-internal legal access flows were found in the repository evidence reviewed. This is a release blocker for the public app and also a Google Play requirement for an account-creating app.

### Data Safety / Play policy

```text
Status: MISSING / NOT PROVEN
```

No Play Data Safety declaration, app privacy route, or app-level data inventory evidence was found in the repo. The repository is not yet ready for a production Play submission without this being prepared and audited against the actual SDK/data inventory.

### Content classification / rating / parental controls

```text
Status: MISSING / NOT PROVEN
```

The SQL content seed includes titles and episode metadata but no content-rating metadata, parental gate, age-verification mechanism, or India OTT classification workflow. That means the app cannot claim rating compliance or reliable age gating at this time.

### Grievance / India OTT compliance

```text
Status: MISSING / EXTERNALLY BLOCKED
```

The repo does not contain the required public grievance mechanism or officer contact details. This is an operational/legal release item and not a code bug; it must be provided via the final legal/public web and app surfaces before release.

### Video playback security and production delivery

```text
Status: PARTIALLY IMPLEMENTED
```

The Android app includes `expo-video`, and the repo includes development video source examples in `apps/android/src/player/devSources.ts`. The web app includes a custom player shell but no production media/CDN pipeline evidence. There is no evidence of:

```text
signed streaming URLs
tokenized playback authorization
CDN hardening / hotlink protection
media storage + transcode pipeline
CORS and origin controls for production media
subtitle access/distribution policy
```

This is a workable foundation for dev playback, not production media delivery.

## 45.4 Release gate conclusion

The current repository should be considered a strong backend + UX foundation, but not a launch-ready consumer OTT release. The most important unresolved release gates are:

```text
missing public legal surfaces (Privacy / Terms / Delete Account / Grievance)
no Google Play Billing implementation in code
no verified Play org / D-U-N-S / billing setup evidence
no Data Safety / Play policy completion
no content rating / parental gate implementation evidence
no production CDN / signed-URL playback architecture
```

## 45.5 Current compliance posture

```text
Server-authoritative business logic: PRESENT
Public legal surfaces: MISSING
Native Play Billing: MISSING
Production release controls: INCOMPLETE
Operational/legal compliance surfaces: MISSING / EXTERNALLY BLOCKED
```

This repository is appropriate for continued Build 15 product and backend architecture work, but it is not yet a production-ready release baseline from a security, privacy, or Google Play compliance perspective.

---


0nya_SECURITY_PRIVACY_COMPLIANCE_RELEASE_v1.0.md,
mark the current repository state as:

IMPLEMENTED
PARTIALLY IMPLEMENTED
MISSING
EXTERNALLY BLOCKED
NOT APPLICABLE
UNKNOWN / NOT PROVEN

Inspect actual repository evidence for:

- auth/session handling
- environment/secrets exposure
- Supabase RLS and privileged functions
- API authorization
- wallet/ledger mutation security
- entitlement/idempotency protection
- Chai security if present
- purchase verification foundations
- analytics/logging PII
- account deletion
- Privacy/Terms/Grievance routes
- content rating fields
- parental/age gates
- Play/Data Safety preparation visible in repo
- targetSdk/Android build configuration
- dependency/security concerns
- video URL/security behavior

Create or update ONLY a section at the bottom of:
docs/0nya_SECURITY_PRIVACY_COMPLIANCE_RELEASE_v1.0.md

named:

REPOSITORY AUDIT — BUILD 15 BASELINE

For each gap include:
- control
- current evidence
- source files
- status
- Build 15 impact
- severity: BLOCKER / HIGH / MEDIUM / LOW

Do not invent compliance.
Do not mark legal/business requirements complete from code alone.
For requirements such as D-U-N-S, Grievance Officer, public legal pages,
self-regulatory-body membership, or Play Console declarations,
mark UNKNOWN / EXTERNALLY BLOCKED unless repository evidence proves them.

Documentation-only audit.
```

---

# 45. COPILOT IMPLEMENTATION AUTHORITY

For Build 15 implementation, Copilot should now read:

```text
PRODUCT
docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md

FLOW
docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md

SCREEN STRUCTURE
docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md

VISUAL DESIGN
docs/0nya_DESIGN_SYSTEM_v1.0.md

CMS
docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md

ACTUAL TECH
docs/0nya_APP_ARCHITECTURE_v1.0.md
docs/0nya_BACKEND_API_CONTRACT_v1.0.md
docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md

SECURITY / PRIVACY / RELEASE
docs/0nya_SECURITY_PRIVACY_COMPLIANCE_RELEASE_v1.0.md
```

Do not add another authority document unless a genuinely new subsystem requires one.

---

# 46. RELEASE SOURCE REFERENCES

Official sources to re-check before release:

### Google Play — User Data / Privacy / Account Deletion
`https://support.google.com/googleplay/android-developer/answer/10144311`

### Google Play — Target API Requirements
`https://support.google.com/googleplay/android-developer/answer/11926878`

### Google Play — Current Policy Updates
`https://support.google.com/googleplay/android-developer/answer/17134731`

### India — IT Rules / Digital Media Ethics Code
`https://www.mib.gov.in/sites/default/files/2026-05/it-rules-2021-2.pdf`

### MeitY — DPDP commencement notification
`https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf`

Policies and laws can change.

Re-check official sources immediately before production submission.

---

# 47. FINAL RULE

After the repository audit in Section 44:

> Stop creating planning/governance documents.

Next sequence:

```text
Design System is locked
        ↓
Implement Build 15 screen phases
        ↓
Security/privacy checks alongside each phase
        ↓
Production media/CDN design when streaming moves beyond development
        ↓
Store/legal launch checklist immediately before submission
```

---

**0nya · शून्य**

**SECURITY + PRIVACY + COMPLIANCE RELEASE v1.0**

---

# 48. G02 SERVER-VERIFIABLE PARENTAL SESSION BASELINE

```text
Status: PARTIALLY IMPLEMENTED
```

- Registered parental PIN verification now issues an opaque server parental session.
- Guest parental PIN flows now use a pseudonymous server record plus an in-memory session proof on Android.
- Guest SecureStore keeps only the opaque guest credential; legacy guest hash storage is transitional only.
- Setup and verification are separate flows: `hasPin=false` means no content gate is required, while `hasPin=true` requires a valid parental session before protected playback.
- Maximum parental-session lifetime is 8 hours.
- The playback boundary still needs the future signed-playback enforcement route.
