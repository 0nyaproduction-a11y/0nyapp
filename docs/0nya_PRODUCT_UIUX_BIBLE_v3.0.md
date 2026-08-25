---
title: "0nya FINAL Product + UI/UX Bible v3.0"
version: "3.0"
status: "IMPLEMENTATION LOCK"
authority: "Build 15 onward"
date: "2026-08-21"
product: "0nya"
---

# 0nya FINAL Product + UI/UX Bible v3.0

**IMPLEMENTATION LOCK — BUILD 15 ONWARD**

> Consumer App • UI/UX • User Flow • Monetisation States • CMS Contract • QA
## AI coding guardrail

> GPT, GitHub Copilot, coding agents and developers must treat `LOCKED` rules as non-negotiable implementation requirements. They may not add paid SaaS/services, redefine user flows, hardcode backend-controlled business rules, or alter monetisation/access behavior without an approved Bible revision.


> **Authority:** From Build 15 onward, Figma, GPT/Copilot coding prompts, mobile code, backend access rules and QA must follow this document. Conflicting consumer-app rules in earlier MVP documents are superseded.


| 0nya FINAL PRODUCT + UI/UX BIBLE v3.0  \|  IMPLEMENTATION LOCK  \|  BUILD 15 ONWARD Consumer App • UI/UX • User Flow • Monetisation States • CMS Contract • QA 21 August 2026 |
| --- |


> **AUTHORITY** — This is the final consumer implementation authority.  Fourteen internal builds already exist. From Build 15 onward, Figma, GPT/Copilot coding prompts, mobile code, backend access rules and QA must follow this document. Conflicting consumer-app rules in earlier MVP documents are superseded.


> **SCOPE** — Creator/CMS work is preserved.  Existing filmmaker submission, creator dashboard and internal editorial workflows remain valid unless this Bible explicitly changes a shared data/monetisation rule. Consumer UI changes must not break those existing systems.


# READ THIS FIRST


> **LOCKED** — Product/user-flow behavior is frozen.  A LOCKED rule cannot be changed by a designer, developer, AI coding assistant or library default. Change requires product approval and an updated Bible version.


> **CONFIG** — Backend/CMS decides values and availability.  Episode access, coin price, ad eligibility, release state, paywall options, short-film ad timecodes, row order and commercial values must be data-driven. Do not hardcode them into the app.


> **LEAN** — No-cost / low-cost build principle.  Prefer native platform APIs, open-source libraries, existing infrastructure and free tiers. No new paid SaaS, analytics, deep-link service, CMS, design dependency or AI subscription may be introduced without explicit approval.


> **POLICY** — Store/legal rules override convenience.  Billing, privacy, content classification, parental controls, age gates and account deletion must follow the current platform/law requirements at release time.


## The 10 rules nobody may reinterpret


| # | Final rule |
| --- | --- |
| 1 | There is NO mandatory '3 free episodes' rule. Every micro-drama episode is controlled independently from the backend/CMS. |
| 2 | A micro-drama episode may be Free, Coin-unlockable, Rewarded-ad unlockable, Plus-entitled, or any allowed combination configured by backend. |
| 3 | Coin amount is always backend/CMS controlled. Coin unlock is permanent for that account. |
| 4 | Micro-dramas never contain interruptive pre/mid/post-roll ads. A rewarded ad may appear only because the viewer explicitly chooses it as an unlock method. |
| 5 | Vertical short films are always accessible content: Free users watch with CMS-controlled mid/post-roll ads; Plus users watch ad-free. |
| 6 | Vertical short films are NOT coin-locked and NOT subscriber-only. |
| 7 | Audience Chai is a COIN TIP, not a separate cash payment. Viewer tips coins from the 0nya wallet to the filmmaker/film ledger. |
| 8 | 0nya Plus is one paid tier. While active it unlocks released micro-drama episodes and removes short-film ads. |
| 9 | Guest browsing/viewing is allowed wherever policy and episode access permit. Registration happens on intentional account/monetisation actions, not at app open. |
| 10 | This Bible is the source of truth for UI/UX and user-flow implementation; AI-generated code must conform to it, never redefine it. |


## Decision tags


| Tag | Meaning |
| --- | --- |
| LOCKED | Frozen user-flow / product behavior. |
| CONFIG | Value or availability is backend/CMS/remote-config driven. |
| FEATURE FLAG | May ship on/off without changing core flow. |
| DEFERRED | Not a Build-15 launch dependency. |
| POLICY GATE | Needs current legal/store compliance review before release. |


# Contents

1. Product Definition & Experience Principles
2. Lean Build / AI-Assisted Engineering Guardrails
3. Launch Scope & Deferred Scope
4. User, Account & Entitlement States
5. Information Architecture
6. First Open & Home
7. Content Cards & Discovery
8. Micro-Drama Episode Access Engine
9. Micro-Drama Player Flow
10. Auto-Next & Resume
11. Dynamic Episode Paywall
12. Registration & OTP
13. Coins & Wallet
14. Rewarded-Ad Episode Unlock
15. 0nya Plus
16. Vertical Short Films
17. Short-Film Ad Rules
18. Audience Chai = Coin Tipping
19. Explore & Search
20. Series Detail & Episode List
21. Profile, Settings & Account
22. Sharing & Deep Links
23. Content Classification, Parental Controls & Age Gates
24. Privacy & Data Lifecycle
25. Push Notifications
26. Errors & Recovery
27. Visual / Accessibility Rules
28. Figma Screen Inventory
29. State & Access Matrix
30. CMS / Backend Contract
31. Analytics
32. QA Golden Paths
33. Release Gates
34. Change Control
35. Compliance References

# 1. Product Definition & Experience Principles


> **LOCKED** — Consumer product name: 0nya.  Do not use '0nya Shorts' as the primary app name in consumer UI. Use 0nya consistently in Home, player, paywall, notifications and account surfaces.


| Element | Final launch rule |
| --- | --- |
| Product | Premium mobile-first vertical cinema platform. |
| Primary content | Original micro-drama series. |
| Secondary content | Curated vertical short films. |
| Primary format | 9:16 narrative viewing on mobile. |
| Launch language | Hindi-first; architecture may support additional languages later. |
| Experience promise | Open quickly, find a story quickly, stay in playback, and never lose narrative position after an interruption. |
| Visual tone | Quiet, cinematic, premium; not a noisy social feed. |

- No forced registration at app launch.
- Series card tap goes directly to playback unless user deliberately opens Info/Details.
- Short-film card tap opens the film detail page before playback.
- Player is the center of the product. Paywalls, OTP and episode-list interactions should return to the same player context.
- Do not expose coins, plan upsells or ads when the viewer does not need them.

# 2. Lean Build / AI-Assisted Engineering Guardrails

The app is being built with a minimal-cost philosophy and AI-assisted development.


> **LEAN** — No paid dependency by default.  Use an existing service, native platform capability, open-source package or free tier first. Any new recurring paid dependency requires explicit approval and must solve a problem that cannot reasonably be solved in the current stack.


| Area | Implementation rule |
| --- | --- |
| AI coding | GPT/GitHub Copilot may generate code, but prompts must reference this Bible's screen IDs, states and acceptance rules. |
| Dependencies | AI must not add packages/services casually. Every new package requires a purpose, maintenance check and license check. |
| Analytics | Prefer existing/free analytics. Event schema is locked; analytics vendor is replaceable. |
| Deep links | Prefer owned domain + native Universal Links/App Links. Paid deferred-link services are not required for MVP. |
| UI components | Prefer native/custom components in the existing app stack. Avoid paid UI kits. |
| Feature flags | Use backend/config fields already available before adding a paid remote-config product. |
| Testing | Golden paths in Section 32 are acceptance truth; 'it compiles' is not acceptance. |
| Documentation | When AI changes a LOCKED flow, reject the code unless the Bible was officially updated first. |


# 3. Launch Scope & Deferred Scope


| Launch-required | Status |
| --- | --- |
| Guest-first Home / Explore / Profile | Required |
| 9:16 micro-drama player | Required |
| Backend-driven episode access rules | Required |
| Coin wallet and permanent episode unlocks | Required |
| Rewarded-ad unlock where CMS enables it | Required if ad inventory/integration ships |
| 0nya Plus one-tier subscription | Required |
| Vertical short films with mid/post-roll ads for non-Plus | Required |
| Audience Chai coin tipping | Required if creator ledger/payout reporting is operational |
| OTP registration / account recovery | Required |
| Continue Watching / resume | Required |
| Search / Explore | Required |
| Content ratings / parental controls | Required as applicable |
| Account deletion + privacy links | Required |
| Error/recovery states | Required |
| Analytics / QA events | Required |


## Non-blocking / deferred

- Prime tier and 4K subscription differentiation.
- Offline DRM downloads.
- Likes, comments, public follower/social graph.
- Moving poster previews.
- Limited-time countdown sales.
- Share-to-unlock growth loop.
- Deferred deep link that survives app install.
- Algorithmic For You ranking.
- A-rated content until reliable age verification is implemented and approved.

# 4. User, Account & Entitlement States


| State | Identity | Capabilities | Persistence |
| --- | --- | --- | --- |
| Guest | Anonymous installation/session ID | Browse; play any Free episode; play ad-supported short films; local resume; reach paywall | Local |
| Registered Free | Verified phone account | Guest + server history + wallet + coin purchases/unlocks + rewarded unlocks + Chai tips | Server |
| 0nya Plus | Registered + active subscription | Access to Plus-enabled micro-drama episodes; ad-free short films; wallet remains independent | Server + store reconciliation |
| Coin-unlocked item | Per-episode entitlement | Permanent access to that micro-drama episode | Server |
| Ad-unlocked item | Per-episode access after verified rewarded completion | Access duration follows backend rewarded_access_mode (permanent or session). | Server |


## Guest-to-account merge

1. Create an anonymous installation identity on first launch.
2. Store guest resume/history and access events against that identity.
3. OTP success creates or recovers the 0nya account.
4. Merge guest watch history into the verified account without duplicating permanent unlocks.
5. Transaction failure never reverses successful account creation.

# 5. Information Architecture


> **LOCKED** — Bottom navigation: Home / Explore / Profile.  Search is inside Explore. Player hides bottom navigation.


| Destination | Purpose |
| --- | --- |
| Home | Editorial discovery + Continue Watching. |
| Explore | Search + format/genre filters + catalog grid. |
| Profile | Account and settings, plus restore/sync and privacy/help. Wallet is a separate root commerce route. |

- Back from player should return to the originating surface and preserve scroll position where feasible.
- Deep links may bypass Home and open target content directly after policy/access checks.
- Do not duplicate Search as both a permanent bottom tab and a global top icon.

# 6. First Open & Home


> **LOCKED** — System launch screen -> Home. No deliberate 1.8-second custom splash delay.  A brand animation may be used only if it does not delay Home becoming usable.

1. Cold launch uses the platform/system launch screen.
2. Home appears without registration, onboarding carousel, genre questionnaire or notification permission prompt.
3. New viewers see an editorial Start Here row.
4. Continue Watching appears only after watch history exists, then becomes the first row.
5. Notification permission is requested later after clear value is established.

| Home row | Rule |
| --- | --- |
| Continue Watching | First row when history exists. |
| Start Here | New/low-history viewers. Exit threshold is CONFIG. |
| Featured / New | Editorial/CMS controlled. |
| Trending | Editorial/manual at launch. |
| New Releases | CMS chronological/editorial. |
| Micro Dramas | Core catalog row. |
| Vertical Short Films | Dedicated row. |
| Staff Picks | Optional editorial row. |

- H02 Continue Watching cards use 9:16 static video-derived stills from the exact resume target, with real progress and resume metadata; no autoplay or moving preview in MVP.


> **CONFIG** — Start Here exit threshold.  Use a backend-configured completion threshold such as 5 completed content items. Do not hardcode '5 films'.


# 7. Content Cards & Discovery


| Rule | Micro-drama | Vertical short film |
| --- | --- | --- |
| Aspect | 9:16 poster | 9:16 poster |
| Primary tap | Play/resume immediately | Open detail page |
| Info | Info affordance opens series detail | Card itself is the detail entry |
| Pricing on Home | Do not show complex paywall/pricing on Home cards | No coin price because films are not coin-locked |
| View count | Optional | Optional |
| Moving preview | Feature-flagged; static poster fallback | Feature-flagged; static poster fallback |

- H02 Continue Watching is separate from discovery cards. It uses a 9:16 static video-derived still, real progress, and resume metadata; it never uses a discovery poster or autoplay/moving preview for MVP.

- Do not duplicate or pad content just to fill a row.
- Use shimmer/skeleton for feed/catalog loading.
- Touch targets remain accessible over artwork.

# 8. Micro-Drama Episode Access Engine

This replaces the old mandatory 'first three free' model.


> **LOCKED** — Every episode is independently controlled from backend/CMS.  The app must never assume Episode 1-3 are free or Episode 4 is locked. Backend state is authoritative for every episode.


| Episode access capability | Backend control | User effect |
| --- | --- | --- |
| Free | free_access = true | Any guest/user can play without OTP or paywall. |
| Coin unlock | coin_unlock_enabled + coin_price | Registered user can permanently unlock the episode for the configured coin amount. |
| Rewarded-ad unlock | rewarded_unlock_enabled + rewarded_access_mode | Registered user can choose a rewarded ad; verified completion grants episode access according to rewarded_access_mode. |
| 0nya Plus | plus_access = true (default for released micro-drama episodes) | Active Plus user plays without individual coin/ad unlock. |
| Preview | locked_preview_seconds | 0-3 second narrative preview before paywall; recommended default 2-3 seconds when enabled. |
| Release | publish_at / availability | Unreleased episode cannot be bypassed by coin/ad/Plus. |


> **LOCKED** — Allowed methods are combinable.  A locked episode may offer Coin + Rewarded Ad + Plus, Coin + Plus, Rewarded Ad + Plus, or Plus only. The paywall only shows methods enabled for that episode.


> **CONFIG** — Coin price and ad eligibility are content data.  Editorial/backend may change an episode coin price or ad eligibility without an app release. The client renders returned values only.


# 9. Micro-Drama Player Flow


1. User taps a series card or Continue Watching entry.
2. App resolves the target episode and asks backend for access state/entitlements.
3. If Free, Coin-unlocked, Ad-authorized/unlocked or Plus-entitled: play immediately.
4. If locked and a preview is configured: play that short preview, then pause on the current frame.
5. Blur/dim the paused video and open the dynamic episode paywall.
6. After a successful unlock/subscription, dismiss the paywall and resume from the exact preview stop position.

> **LOCKED** — No interruptive ad rolls inside micro-drama playback.  No pre-roll, mid-roll or post-roll ads between or inside micro-drama episodes. The only micro-drama ad is an explicit rewarded ad the viewer chooses as an unlock method.


| Player area | Rule |
| --- | --- |
| Format | 9:16 portrait; adaptive HLS. |
| Controls | Tap show/hide; play/pause; scrub; back; playback settings (speed, quality, captions). Top row: Back (left); series title (primary) + Episode N (secondary, never "EP1"/"E01"); Share then Settings gear (Settings outermost right). |
| Bottom action | Episodes is the only persistent bottom action (icon + Title Case label). No Share/Settings text or buttons at the bottom. |
| Quick speed | Press-and-hold the right-side video area for temporary 1.5x; releasing restores the viewer's saved persistent speed without overwriting it. Center Play/Pause hides and a small transient "1.5x" indicator shows away from center while active. |
| Auto-hide | Approx. 3 seconds of inactivity, respecting accessibility focus. |
| Quality | Auto/adaptive only. Guest 720p / Plus 1440p ceilings are approved future policy, not yet server-enforced. No manual rendition selection. No 4K tier promise. |
| Subtitles | Toggle and remember preference; only shown when the source has real subtitle tracks. |
| Resume | Save periodically, on pause/background, and on clean exit opportunities. |
| Not in MVP | No Like/Comment, brightness/volume gestures, Previous/Next, fullscreen/landscape, wallet/coin badge, or Plus promotional overlay in the main player. |


# 10. Auto-Next & Resume


| Next episode state | Behavior |
| --- | --- |
| Free / permanently unlocked / Plus | Seamless auto-next: starts immediately on completion, no countdown or confirmation step. |
| Locked + preview enabled | Start preview -> pause -> paywall. |
| Locked + no preview | Open paywall at transition without showing locked content. |
| Not released (next episode number exists in the series' planned count but is not yet published) | Existing Replay/Back completion state with an "unreleased" message; never skip ahead to a later published episode. |
| Error | Stay in player, preserve completed state, Retry. Never silently skip episodes. |


> **LOCKED** — No rating/recommendation interruption between normal episodes. Auto-Next is a continuity mechanism, not a countdown UI: the next sequential episode's existing access state decides the transition. Do not insert an end card or countdown between episodes.


## Continue Watching exact rules


| Rule | Final behavior |
| --- | --- |
| Enter Continue Watching | After >=5 seconds watched and content is not completed. |
| Completed episode/film | Default completion threshold = >=95% OR within final 5 seconds; backend/config may tune. |
| Resume position | Use last reliable saved position; clamp away from final credits/completed zone. |
| Series detail CTA | If history exists: 'Resume Episode N', not always 'Play Episode 1'. |


# 11. Dynamic Episode Paywall


> **LOCKED** — The paywall is dynamic, not Episode-4-specific.  It can appear on any episode when backend says the viewer lacks access.


| Element | Rule |
| --- | --- |
| Heading | Use actual episode context: 'Continue Episode N' / series title. |
| Rewarded ad CTA | Show only if rewarded_unlock_enabled + rewarded_access_mode and ad inventory is available. |
| Coin CTA | Show only if coin unlock enabled; display backend coin price + current balance. |
| Plus CTA | Show if Plus can unlock this episode and viewer is not currently Plus. |
| Coin shortage | Open a dedicated coin-purchase sheet; do not expand a wall of packs inside the first paywall. |
| Dismiss | Close sheet; locked player remains paused. Back exits to previous surface. |
| Unavailable ad | Do not consume entitlement; hide/disable ad option cleanly and keep other options. |


> **CONFIG** — Option visibility comes from backend + entitlement + runtime inventory.  Do not hardcode three buttons. The UI must gracefully render one, two or three valid unlock methods.


# 12. Registration & OTP


> **LOCKED** — OTP success = account success.  Ad/purchase/subscription success is a separate state. Failed commerce never un-registers the user.

1. Guest taps Coin Unlock, Rewarded Ad Unlock, Plus, Chai, or Sign In.
2. Phone entry sheet opens.
3. User requests OTP.
4. OTP screen supports resend timer, edit number and recoverable error states.
5. OTP verifies -> create/recover account -> merge guest history.
6. Return to the exact initiating context and continue the selected action.

| OTP state | Required handling |
| --- | --- |
| Sending | Prevent duplicate requests while request is in flight. |
| Wrong OTP | Inline error; keep phone context. |
| Expired | Resend action. |
| Too many attempts | Rate-limit with human-readable retry timing. |
| Provider delay | Allow resend per provider rules; do not expose raw provider errors. |
| Existing account | Automatic account recovery/sign-in after verification. |


> **LEAN** — OTP is a real variable cost.  Minimize unnecessary sends/resends and do not trigger OTP before clear user intent.


# 13. Coins & Wallet


> **LOCKED** — Coins are the single in-app value unit for episode unlocks and Chai tips.  Do not create a second 'Chai currency'. Chai is a purpose/transaction type using the same 0nya coin balance.


| Rule | Behavior |
| --- | --- |
| Purchased coins | Never expire. |
| Coin packs | Backend/store configured; localized price comes from commerce layer. |
| Episode coin price | Backend/CMS configured per episode. |
| Coin episode unlock | Permanent entitlement for that episode. |
| Chai tip | Deduct coins from viewer wallet and credit a Chai ledger entry to the film/creator. |
| Subscription relationship | Plus never deletes coins or permanent coin unlocks. |
| Wallet history | Purchased / spent on episode / Chai tipped / refunded or adjusted. |
| Promotional coins | Deferred unless explicitly implemented; must be clearly distinguishable if expiry rules differ. |


# 14. Rewarded-Ad Episode Unlock


> **LOCKED** — Rewarded ads are user-initiated access, not interruptive micro-drama advertising.  When offered and completed successfully, the current episode receives an unlock entitlement.


| Rule | Behavior |
| --- | --- |
| Availability | Backend controls rewarded_unlock_enabled + rewarded_access_mode per episode; runtime ad inventory can additionally make it unavailable. |
| Registration | Guest selecting the ad option completes OTP first so the entitlement can be attached to an account. |
| Verification | Grant unlock only after verified rewarded completion/callback; repeated callbacks must be idempotent. |
| Failure/no fill | No unlock, no penalty. Return to paywall with Coin/Plus if available. |
| Persistence | Backend controls rewarded_access_mode = permanent or session. Permanent is the recommended default to avoid repeat-ad friction. |
| No ad-to-coin conversion | MVP rewarded flow unlocks the episode directly; do not make viewers watch ads merely to earn wallet coins. |


# 15. 0nya Plus


> **LOCKED** — One paid tier: 0nya Plus.  No Prime tier in MVP.


| Benefit/rule | Final behavior |
| --- | --- |
| Micro-dramas | Unlock all released episodes for which plus_access is enabled; default is enabled. |
| Short films | Ad-free viewing. Chai coin tipping remains available. |
| Coins | Wallet balance and coin unlocks remain independent. |
| Free trial | No free trial unless later approved. |
| Billing cycles | MVP customer-facing cadence is weekly. Do not present monthly/yearly options in the consumer UI. |
| Price copy | Use localized store/provider price strings only if a supported store flow is active; otherwise clearly state that purchasing is unavailable in this build. |
| Cancellation | Preserve any current manage route only when the underlying store implementation is active; do not invent billing-management flows. |
| Restore / Sync Purchases | Provide a restore/sync action and reconcile server entitlements. |


> **POLICY** — Subscription purchase UI must remain truthful to the active implementation. In the current MVP build, Plus is a weekly membership model and the app must not invent or display fake monthly/yearly pricing or renewal claims.


# 16. Vertical Short Films


> **LOCKED** — Short films are ad-based content + optional Chai coin tips.  They are never coin-locked and never subscriber-only.

1. User taps a short-film card.
2. Film Detail opens with poster, creator/director, duration, language, rating/descriptors, synopsis, Play/Resume and Share.
3. Free/Registered Free viewer taps Play -> film plays with CMS-controlled short-film ad rules.
4. 0nya Plus viewer taps Play -> same film plays ad-free.
5. Film completes -> post-roll ad for non-Plus if enabled/available -> Chai coin prompt -> Share -> Related films.

| Film state | Free / Registered Free | 0nya Plus |
| --- | --- | --- |
| Access | Always playable | Always playable |
| Coin lock | Never | Never |
| Mid-roll ad | CMS controlled | No |
| Post-roll ad | CMS controlled | No |
| Chai coin tip | Available after completion | Available after completion |

D02 CTA state uses the shared resume/completion rule:

- No valid history or <5 seconds watched -> Play.
- Valid unfinished progress >=5 seconds and outside completed/final zone -> Resume.
- Completed or final-zone progress -> Play.
- A completed film started again should return to Resume after a new valid unfinished >=5 second rewatch position exists.


# 17. Short-Film Ad Rules


> **LOCKED** — Mid-roll and post-roll ads belong only to Vertical Short Films.  They must never be inserted into micro-drama episodes.


| Ad type | Short-film rule |
| --- | --- |
| Mid-roll | Optional. CMS supplies editorially safe timecode(s). Do not auto-cut dialogue at a blind percentage. |
| Post-roll | Optional. Runs after film completion and before Chai/Share for non-Plus viewers. |
| Pre-roll | Not part of the locked MVP flow unless explicitly added later. |
| Ad failure/no fill | Continue the film/end flow. Never trap the viewer. |
| Frequency | CMS/config controlled; keep reasonable for 5-20 minute films. |
| Plus | No mid/post-roll ads. |
| Player chrome | No banner/native ad overlays on active film frames. |


# 18. Audience Chai = Coin Tipping


> **LOCKED** — Chai is a coin transaction. A viewer tips 0nya coins to a Vertical Short Film from the same wallet flow; there is no separate cash/UPI Chai checkout inside the viewer flow.

1. During the final ~10 seconds of eligible short-film playback, show a compact in-context Send Chai affordance (optional, never auto-opens the full flow).
2. Film completes.
3. Non-Plus post-roll runs first if enabled and available.
4. F02 still surfaces Send Chai, Share, Replay, optional Related films, and Home.
5. Show Chai prompt with configurable coin amounts.
6. Viewer chooses a coin amount.
7. If guest -> OTP -> return to Chai.
8. If wallet has enough coins -> confirm -> deduct coins -> create Chai ledger entry -> success.
9. If wallet is insufficient -> open standard Coin Purchase -> return to the same Chai amount -> confirm.

| Chai rule | Behavior |
| --- | --- |
| Applies to | Vertical Short Films only. |
| Currency | 0nya coins. |
| Amounts | CONFIG; coin amounts, not cash labels. |
| Creator view | Creator dashboard/report shows Chai coins received per film; no viewer identity. |
| Payout accounting | Back-office/finance converts eligible creator earnings according to the creator agreement and net revenue rules; do not promise 1 coin = fixed cash in viewer UI. |
| Refund/adjustment | Ledger must support reversals/adjustments without corrupting viewer or creator totals. |


# 19. Explore & Search


| Area | Rule |
| --- | --- |
| Search | Top of Explore. |
| Search fields | Title, series, creator/director, cast where metadata exists, genre. |
| Recent | Local recent searches + clear action. |
| Format filter | All / Micro Dramas / Short Films. |
| Genres | CMS driven. |
| Sort | Trending / Newest / Most Watched / Staff Picks where supported. |
| Results | 9:16 grid; preserve type-specific tap behavior. |
| No results | Clear message + editorial suggestions. |
| Analytics privacy | Redact/avoid storing obvious PII patterns in raw search telemetry. |


# 20. Series Detail & Episode List

> **LOCKED** — D01 remains the lightweight Series Hub / Series Info surface. It shows series artwork, title, language, rating/descriptors, total/published episode count, primary creator/director credit, concise synopsis, a primary Resume/Start CTA, a secondary Episodes › CTA and optional related titles. The Episode Tray opens as a compact same-screen overlay over D01; it does **not** navigate to a separate Episodes screen.


| Area | Final rule |
| --- | --- |
| Series CTA | New viewer: Play/Start. Returning viewer: Resume Episode N. |
| Episodes entry | Tapping Episodes › opens a compact same-screen Episode Tray / bottom sheet over D01. The Series Hub remains visible behind a dim scrim; closing the tray returns to the exact D01 state. |
| Tray behavior | Compact, content-aware height, approximately 35–45% of the usable Android screen height, matte-black surface, Android-safe-area aware, close dismisses the tray, no separate Episode screen navigation. |
| Episode cells | Compact square episode-number cells sized for touch target >=44dp; approximately 5–7 columns depending available Android width; no titles/durations inside cells; small monochrome lock for access-required state; subtle teal highlight for current/resume episode. |
| Data source | The tray is generated from the current series' actual published episode collection returned by backend. Do not hardcode totals, last episode, planned total count, or specific episode numbers. |
| Range selectors | Derived dynamically from published episodes; hide when only one range exists; approximately 25 published episodes per range; automatically select the containing range for the current/resume episode when multiple ranges exist. |
| Free episode tap | Play. |
| Unlocked/Plus tap | Play. |
| Locked tap | If preview allowed: preview -> paywall. Otherwise paywall directly. |
| Coin amount | Show backend value only where useful; do not duplicate excessive pricing across Home. |
| Access policy | The tray does not decide access. Each episode remains independently backend/CMS controlled, and each tap delegates to the existing access/playback resolver. |
| No jump control | No episode-number search field, no GO button, no giant full-screen list. |
| Chai | Never show on series or episodes. |
| Related | Editorial related series. |

> **LOCKED** — The same-screen Episode Tray is the approved MVP behavior. It is generated from the current series' published episode collection, supports dynamic ranges without hardcoding totals and keeps D01 visible beneath a dim scrim. Do not reintroduce a separate full-screen V03 Episode Browser for MVP.


# 21. Profile, Settings & Account


| State | Top area | Items |
| --- | --- | --- |
| Guest | Sign in to keep history/unlocks | Sign In, local history controls, playback/subtitle settings, Help/Legal, app version |
| Registered Free | Account + Free badge | Restore/Sync, Settings, Delete Account, Sign Out |
| 0nya Plus | Account + Plus badge | Restore/Sync, Settings, Delete Account, Sign Out |

- Logout returns to guest Home; it never forces OTP.
- Delete Account is a separate destructive flow with confirmation.
- Settings include Help & Support, Report a Content Issue, Grievance/Contact, Terms, Privacy Policy and app version.
- Do not show Downloads UI unless offline downloads are actually built and enabled.

# 22. Sharing & Deep Links


> **LOCKED** — Use owned-domain Universal Links / Android App Links for MVP.  Do not use Firebase Dynamic Links; the service shut down in 2025. Paid deep-link services are not required for the basic installed-app flow.


| Capability | MVP |
| --- | --- |
| Share series/episode/film link | Yes |
| Open installed app to target content | Yes |
| Target timestamp | May be supported if reliable; not required for every share. |
| Install then restore exact target | Deferred. |
| Share-to-unlock | Deferred / feature flag. |
| Canonical link host | CONFIG but must be one owned 0nya domain consistently used by web + mobile association files. |

- Deep link routing order: resolve target -> content rating/parental gate -> release/access check -> player/detail/paywall.
- A deep link must never bypass parental controls, age gates or entitlements.
- Shared recipients may remain guests for Free content.

# 23. Content Classification, Parental Controls & Age Gates


> **POLICY** — India OTT classification support is mandatory.  CMS and consumer UI must support U, U/A 7+, U/A 13+, U/A 16+ and A classifications, descriptors, parental controls where required, and age verification for A-rated content.


| Requirement | Implementation rule |
| --- | --- |
| Classification fields | Series/film rating + content descriptors; episode override if needed. |
| Display | Show rating/descriptors clearly before viewing and in relevant detail/metadata surfaces. |
| U/A 13+ and higher | Support parental lock/access-control mechanism. |
| Parental setup | Separate Settings/setup action; do not force PIN creation from the content-access flow. |
| G02 | Verification gate only for applicable/configured parental-control users with an existing PIN/session. |
| A-rated content | Requires reliable age verification before view. |
| MVP cost rule | Do not publish A-rated content until reliable age verification has been built and approved. |
| Deep links | Cannot bypass classification/access gates. |
| Promotional surfaces | Where feasible, include the classification on promotional/content detail surfaces. |


# 24. Privacy & Data Lifecycle


> **POLICY** — Privacy is a product flow, not just a policy page.  The app handles phone number, watch history, purchases, search/engagement events and device/session identifiers. Data collection and user rights must be explained clearly and implemented in-app.


| Area | Rule |
| --- | --- |
| Privacy notice | Clear, plain-language notice describing categories of personal data and purposes. |
| Consent/permissions | Ask only when needed; withdrawal/controls should be reasonably accessible. |
| Account deletion | Initiable inside the app; backend deletes/de-identifies data subject to legitimate retention requirements. |
| Web deletion route | Maintain an external web account-deletion request path for Play policy requirements. |
| Analytics IDs | Use pseudonymous internal IDs; avoid raw device fingerprints. |
| Search logs | Redact obvious phone/email/PII patterns; apply retention limits. |
| Security | Do not expose OTP/provider/store receipt data in analytics payloads or client logs. |


# 25. Push Notifications


> **LOCKED** — Push permission is permission-based, not automatically 'on'.  Marketing consent is separate from OS notification permission.


| Type | Rule |
| --- | --- |
| Continue Watching | Service/re-engagement notification after configured inactivity, if permission granted. |
| New content | Batched; not one push per upload. |
| Billing failure / subscription | Transactional/service notification as applicable. |
| Marketing/promotional | Explicit opt-in control; default off until consent. Frequency cap is CONFIG. |
| Deep link | Notification opens the exact relevant screen/resume context after gates. |
| Creator notifications | Outside consumer app; continue through creator dashboard/web systems. |


# 26. Errors & Recovery


| State | Primary behavior | Secondary option if needed |
| --- | --- | --- |
| No internet | Retry | - |
| Slow connection | Keep waiting / Auto quality | Change quality |
| Video failure | Retry | Back |
| Payment pending | Check/Wait | Help if unusually delayed |
| Payment failed | Retry | Choose another available method |
| Rewarded ad no-fill | Return to paywall | Coin / Plus if enabled |
| OTP failure | Retry/Resend | Edit number |
| No search results | Explore suggestions | Clear query |
| Coin shortage | Buy Coins | Back to paywall/Chai |


> **LOCKED** — One visually dominant primary action.  A secondary text action is allowed when recovery genuinely requires it. Never show raw SDK/HTTP/provider errors.


# 27. Visual / Accessibility Rules


| Token/principle | Rule |
| --- | --- |
| Primary teal | #0DD1BC |
| Teal highlight | #4DE5D2 |
| Bone white | #E8E4DA |
| Matte black | #050505 |
| Background | Near-black; avoid bright white consumer surfaces except system/store UI. |
| Typography | Clean modern sans; cinematic hierarchy. |
| Motion | Short, purposeful; never delay playback for decoration. |
| Glow | Sparse; primary focus only. |
| Poster | 9:16. |
| Tap targets | Accessible target sizes even over poster art. |
| Font scaling | Paywall/OTP/content rating/parental screens must survive larger system text. |
| Contrast | Do not rely on teal-on-black alone for critical meaning. |


# 28. Figma Screen Inventory

Frame names must use these IDs and state suffixes.


| ID | Screen / sheet | State | Responsibility |
| --- | --- | --- | --- |
| A01 | System Launch -> Home | All | Routing only; no forced custom splash delay |
| H01 | Home - New/Low History | Guest | Start Here; no Continue Watching |
| H02 | Home - With History | All | Continue Watching first |
| E01 | Explore | All | Search + filters + grid |
| E02 | Search Results | All | Results/empty |
| D01 | Series Detail | All | Series hub / resume-start / Episodes entry |
| D02 | Short Film Detail | All | Play + metadata + rating |
| V01 | Player - Clean | All | Video only |
| V02 | Player - Controls | All | Playback controls |
| V03 | Episode Tray / D01 overlay | All | Same-screen tray / published-episode collection / access states |
| V04 | Seamless Auto-Next | All | No overlay/countdown; immediate transition or existing access resolver |
| W01 | Locked Preview | Guest/Free | Paused blurred frame |
| W02 | Dynamic Episode Paywall | Guest/Free | Only valid methods |
| R01 | Phone Entry | Guest | OTP start |
| R02 | OTP Entry | Guest | Verify/resend/errors |
| C01 | Wallet | Registered | Balance + ledger |
| C02 | Coin Purchase | Registered | Store/provider coin packs |
| A02 | Rewarded Ad Loading | Registered Free | Ad lifecycle |
| A03 | Rewarded Ad Success | Registered Free | Unlock -> resume |
| S01 | 0nya Plus Offer | Registered Free | Benefits + store price/terms |
| S02 | Plus Success / Sync | Registered | Entitlement -> return |
| F01 | Short Film Player | All | Mid-roll handling for non-Plus |
| F02 | Short Film End | All | Post-roll -> Chai -> Share -> Related |
| T01 | Chai Coin Amount | All | Coin amount selection |
| T02 | Chai Coin Confirm / Success | Registered | Ledger update |
| P01 | Profile - Guest | Guest | Sign In + settings |
| P02 | Profile - Free | Registered | Account + settings + restore/sync |
| P03 | Profile - Plus | Subscriber | Account + settings + restore/sync |
| P04 | Settings | All | Playback/privacy/notifications/legal |
| P05 | Manage Subscription | Subscriber | Provider/store route |
| P06 | Restore / Sync Purchases | Registered | Reconcile entitlements |
| G01 | Content Rating Slate | All | Rating + descriptors before viewing |
| G02 | Parental Lock | Applicable users | PIN/access-control |
| G03 | Age Verification | Future A-rated content | Deferred until implemented |
| X01 | No Internet | All | Retry |
| X02 | Playback Error | All | Retry |
| X03 | Commerce Error | Registered | Charge/deduction clarity |
| X04 | Search Empty | All | Suggestions |
| L01 | Deep Link Routing | All | Gate -> target |
| Q01 | Delete Account | Registered | Confirm + request |


# 29. State & Access Matrix


| Capability | Guest | Registered Free | 0nya Plus |
| --- | --- | --- | --- |
| Play backend-Free micro-drama episode | Yes | Yes | Yes |
| Play locked episode without action | No | No | Yes if plus_access |
| Coin unlock enabled episode | OTP first | Yes | Not needed while Plus active |
| Rewarded unlock enabled episode | OTP first | Yes | Not needed while Plus active |
| Coin unlock persists after Plus ends | N/A until registered | Yes | Yes |
| Short film access | Yes with ads | Yes with ads | Yes ad-free |
| Short film coin lock | Never | Never | Never |
| Chai coin tip | OTP first | Yes | Yes |
| Wallet visible | No | Yes | Yes |
| Server Continue Watching | No (local) | Yes | Yes |
| Restore/Sync purchases | Sign in first | Yes | Yes |
| Manage Plus | Offer | Offer | Manage |
| Logout | N/A | Guest Home | Guest Home |
| Rewarded ad access persistence | Backend mode applies | Backend mode applies | Backend mode applies |


# 30. CMS / Backend Contract


> **LOCKED** — CMS is the access authority.  The app does not decide which episode is free/coin/ad/Plus. It renders the access contract returned by backend.


| Object | Minimum fields / controls |
| --- | --- |
| Series | id, title, synopsis, poster_9x16, genre[], language, creator/director, total/published episode counts, rating/descriptors, featured/editorial flags |
| Episode | id, series_id, number, title, duration, HLS, subtitles, publish_at, free_access, coin_unlock_enabled, coin_price, rewarded_unlock_enabled + rewarded_access_mode, plus_access, locked_preview_seconds, rating override optional |
| Short film | id, title, synopsis, poster_9x16, creator/director, duration, HLS, subtitles, rating/descriptors, midroll_enabled, midroll_timecodes[], postroll_enabled, chai_enabled |
| Coin pack | store/product id, coin amount, localized display price from commerce layer, enabled flag |
| Chai config | allowed coin tip amounts, chai_enabled per film, creator ledger mapping |
| Home | row definitions, order, membership, Start Here threshold/config |
| Feature flags | moving previews, share-to-unlock, deferred deep links, rating prompt, future A-rated content |
| Notifications | templates, targeting, frequency caps, marketing consent requirement |


## Backend invariants

- Entitlement-changing operations are idempotent.
- Store purchase receipts/transactions are validated/reconciled server-side.
- Coin balance changes use a ledger, not only a mutable total.
- Chai coin tips create both viewer debit and creator/film credit records atomically.
- Changing episode price/access in CMS must not require a mobile app release.
- Existing creator dashboard/submission flows must remain compatible with the shared content IDs and Chai ledger.

# 31. Analytics


| Event | Minimum properties |
| --- | --- |
| app_open | launch_type, app_version |
| home_view | history_state, rows_rendered |
| content_impression | content_id, type, row_id, position |
| content_card_tap | content_id, type, source, action |
| episode_access_resolved | episode_id, free/coin/ad/plus flags, rewarded_access_mode, entitlement_state |
| episode_start | series_id, episode_id, source |
| episode_complete | episode_id, watch_ms |
| film_start | film_id, plus_state |
| film_midroll_shown | film_id, timecode |
| film_complete | film_id, watch_ms |
| film_postroll_shown | film_id |
| paywall_shown | episode_id, methods_visible, coin_price |
| paywall_cta_tap | episode_id, method |
| otp_start / success / failure | source_context, reason_category |
| coin_purchase_success/failure | pack_id, coin_amount |
| coin_unlock_success | episode_id, coin_price |
| ad_unlock_start/success/failure | episode_id, reason_category |
| subscription_offer/success/failure | plan_id, cycle, source |
| purchase_restore_sync | result |
| chai_prompt_view | film_id |
| chai_tip_success | film_id, coin_amount |
| search_submit | sanitized_query, result_count |
| share_tap | content_id, destination |
| deep_link_open | target_type, target_id |
| playback_error | content_id, error_category, network_type |
| buffering_start/end | content_id, duration_ms |
| notification_open | notification_type, target |
| account_delete_request | source |

- Do not send phone number, OTP, full payment data or raw store receipt content to analytics.
- Use pseudonymous internal IDs.
- Analytics provider may change; event names and product meaning stay stable.

# 32. QA Golden Paths


### GP-01 Backend Free Episode

- CMS marks Series A Episode 1 Free.
- Guest taps card -> Episode 1 plays without OTP.
- Changing Episode 2 to Free in CMS changes behavior without app release.

### GP-02 Coin-Locked Episode

- CMS enables coin unlock and sets price X.
- Registered Free sees X coins.
- Successful coin spend permanently unlocks episode.
- Changing price later does not relock already-unlocked users.

### GP-03 Rewarded-Ad Episode

- CMS enables rewarded unlock.
- Guest selects ad -> OTP -> return.
- Verified reward callback grants access according to the configured rewarded_access_mode.
- No-fill returns to paywall without entitlement.

### GP-04 Mixed Methods

- Episode exposes Coin + Ad + Plus.
- Paywall shows exactly these three.
- Disable Ad in CMS -> same build shows Coin + Plus only.

### GP-05 Plus

- Subscribe -> entitlement sync -> return to exact locked episode.
- Episode plays immediately.
- Other released plus_access episodes play.
- Short films become ad-free.

### GP-06 Resume

- Close mid-episode after >=5 sec.
- Reopen -> Continue Watching first.
- Resume near saved position.
- Series detail says Resume Episode N.

### GP-07 Short Film Ads

- Free user plays film.
- Only configured mid-roll(s) fire at editorial timecodes.
- Configured post-roll fires after completion.
- No coin lock appears.
- Plus user sees no mid/post-roll.

### GP-08 Chai Coin Tip

- Film completes.
- Chai prompt appears if enabled.
- Enough coins -> debit viewer / credit creator ledger atomically.
- Insufficient coins -> Coin Purchase -> return to same tip amount.
- No cash/UPI Chai screen exists.

### GP-09 Episode Tray

- Tap Episodes › -> open same-screen tray over D01.
- Tap Free -> play.
- Tap unlocked -> play.
- Tap locked with preview -> preview/paywall.
- Tap locked without preview -> paywall.
- Close tray -> return to the exact D01 state.

### GP-10 Policy Gates

- Rating/descriptors display before viewing.
- U/A 13+ or higher path supports parental lock.
- A-rated content cannot publish to MVP unless age verification feature is enabled/approved.
- Deep link cannot bypass gate.

### GP-11 Commerce Failure

- OTP success followed by coin/subscription failure leaves account registered.
- No double charge/unlock on retry.
- Restore/Sync recovers valid store entitlements.

### GP-12 Network Recovery

- Kill network during playback/paywall/ad/commerce.
- State is recoverable.
- Playback position and existing entitlements are not lost.

# 33. Release Gates


| Gate | Pass condition |
| --- | --- |
| Flow | All GP-01 through GP-12 pass on supported Android/iOS versions. |
| Backend control | Free/coin/ad/Plus flags and coin prices can change from CMS without app release. |
| Commerce | No double charge, double coin debit, lost entitlement or duplicate Chai ledger entry. |
| Ads | No mid/post-roll appears in micro-drama. Short-film ad timecodes behave as configured. |
| Player | Resume, auto-next, locked preview and paywall transitions survive background/foreground. |
| Policy | Content classification/parental/account deletion/billing implementation cleared for release. |
| Accessibility | Large text and small devices do not clip paywall, OTP, rating or parental screens. |
| Privacy | No prohibited/sensitive payloads in analytics/client logs. |
| Lean stack | No unapproved paid dependency added by AI or developer. |


# 34. Change Control


1. Every requested behavior change references a Bible section and affected Figma screen IDs.
2. Product classifies it as LOCKED, CONFIG, FEATURE FLAG, DEFERRED or POLICY GATE.
3. LOCKED behavior changes require an updated Bible version before implementation.
4. CONFIG changes should happen through backend/CMS/store configuration wherever possible.
5. GPT/Copilot prompts must not silently override LOCKED rules.
6. Figma prototype and QA golden paths are updated in the same change.

> **AUTHORITY** — Build 15 onward rule.  If code and Bible disagree, fix the code unless a formally approved Bible update says otherwise.


# 35. Compliance References

Last cross-verified 21 August 2026. Re-check store/law requirements before public release.


C1  Apple App Review Guidelines - Payments / In-App Purchase / tipping / non-expiring IAP currency / restore  Official source

C2  Apple In-App Purchase - purchase management / restore  Official source

C3  Google Play - alternative billing for users in India  Official source

C4  Firebase Dynamic Links deprecation FAQ - shutdown 25 August 2025  Official source

C5  Ministry of Information & Broadcasting - IT Rules 2021 / online curated content classification  Official source

C6  MeitY - Digital Personal Data Protection Rules, 2025  Official source


## Source reconciliation

This FINAL v3.0 Bible supersedes conflicting consumer-app/UI/user-flow rules in the earlier 22-page MVP specification and the interim v2.0 Bible. Existing filmmaker submission, creator dashboard and internal editorial/CMS implementation remain active unless a shared rule is explicitly replaced here (for example episode access fields, short-film monetisation, Chai coin ledger or consumer entitlement behavior).


0nya / शून्य

FINAL PRODUCT + UI/UX BIBLE v3.0 — IMPLEMENTATION LOCK
