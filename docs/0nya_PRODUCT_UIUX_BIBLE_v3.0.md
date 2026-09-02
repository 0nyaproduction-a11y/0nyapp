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
| App interface language | English default. App Language setting supports English / हिन्दी, changed later from Settings. No mandatory first-launch language chooser for MVP. (See §21A.) |
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
| Ad-unlocked item | Per-episode access after verified rewarded completion | Access is **permanent** for launch (session mode is unsupported; see §14). | Server |


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
| Multi-Spotlight | Ordered CMS/API real items; manual swipe; 9:16 posters; real next-item peek; no auto movement. |
| Trending | Editorial/manual at launch. |
| New Releases | CMS chronological/editorial. |
| Micro Dramas | Core catalog row. |
| Vertical Short Films | Dedicated row. |
| Staff Picks | Optional editorial row. |

### Home Multi-Spotlight (current approved Home editorial stage)

The single Home editorial stage is **Multi-Spotlight**, not a single Featured Hero.

- Ordered CMS/API real published items (no `catalog[0]` fallback, no fake card).
- Horizontal poster rail of strict **9:16** posters.
- Manual swipe only; **no automatic movement**, no timer, no dots, no arrows, no parallax, no decorative Home motion.
- Active poster plus a **real next-item peek** (the actual next ordered item, never a fabricated second card).
- `showTitle` is CMS-controlled; the canonical title shows only when `showTitle = true`.
- Poster tap -> Series/Short Film Detail.
- CTA label on the active footer is exactly **Watch**.
- No Info button inside Spotlight.
- Continue Watching owns Resume/progress language; Spotlight never shows "Resume".

Approved width formula: `Math.round(Math.min(260, Math.max(220, usableWidth * 0.67)))`, gap 12dp.

### Authenticated Home wallet affordance

Registered Free and 0nya Plus users must have a clear, restrained Home wallet affordance that opens **C01 Wallet**. Guest Home must not display a misleading owned wallet balance/state. This is a product requirement, not a Home commerce dashboard. (Android implementation belongs to the appropriate later UI batch.)

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
| Rewarded-ad unlock | rewarded_unlock_enabled + rewarded_access_mode | Registered user can choose a rewarded ad; verified completion grants a **permanent** episode entitlement (launch: `rewarded_access_mode` is permanent only; see §14). |
| 0nya Plus | plus_access = true (default for released micro-drama episodes) | Active Plus user plays without individual coin/ad unlock. |
| Preview | locked_preview_seconds | 0-3 second narrative preview before paywall; recommended default 2-3 seconds when enabled. |
| Release | publish_at / availability | Unreleased episode cannot be bypassed by coin/ad/Plus. |


> **LOCKED** — Allowed methods are combinable.  A locked episode may offer Coin + Rewarded Ad + Plus, Coin + Plus, Rewarded Ad + Plus, or Plus only. The paywall only shows methods enabled for that episode.

> **LOCKED** — Coin + Rewarded offered simultaneously means both alternative unlock methods are available, not a combined partial-coin plus partial-ad payment. Rewarded progress never reduces coin price, ads never generate wallet coins, and there is no ad-to-coin conversion. All availability/prices/progress/entitlements remain server/config authoritative.

> **LOCKED** — C01 Wallet is the primary consumer-facing Micro Drama wallet / access hub.  For a locked Micro Drama episode, the access experience is presented contextually through Wallet (W02 as contextual Micro Drama access) rather than by bouncing the viewer through multiple separate full-screen monetization screens. The Wallet owns Coin episode unlock, Rewarded Ad episode unlock, 0nya Plus episode access, insufficient-coin handling with Add Coins entry, permanent episode entitlements, and rewarded progress (0/2 -> 1/2 -> 2/2). Exact return to the initiating episode is required after any Wallet-initiated action.

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
| Quality | Auto/adaptive only. Guest/free playback is ceilinged at max 720p; active 0nya Plus playback is ceilinged at max 1440p/2K where the asset rendition exists. Enforced server-side via the signed Mux playback token (`max_resolution` claim), never client-trusted. No manual rendition selection. No 4K tier promise. |
| Subtitles | Toggle and remember preference; only shown when the source has real subtitle tracks. |
| Resume | Save periodically, on pause/background, and on clean exit opportunities. |
| Not in MVP | No Like/Comment, brightness/volume gestures, Previous/Next, fullscreen/landscape, wallet/coin badge, or Plus promotional overlay in the main player. |

Approved quality entitlement rule:

- Guest / Registered Free: up to 720p.
- 0nya Plus: up to 1440p / 2K where the asset rendition exists.
- This remains one 0nya Plus tier, creates no 4K promise, and is enforced by the backend/signed playback boundary.


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


When there is no watch history, Home must NOT show a Continue Watching section. Instead show the exact copy:

`Start watching to continue here.`

Keep the section heading only when history exists. Do not reintroduce Watch History.

| Rule | Final behavior |
| --- | --- |
| Enter Continue Watching | After >=5 seconds watched and content is not completed. |
| Completed episode/film | Default completion threshold = >=95% OR within final 5 seconds; backend/config may tune. |
| Resume position | Use last reliable saved position; clamp away from final credits/completed zone. |
| Series detail CTA | If history exists: 'Resume Episode N', not always 'Play Episode 1'. |
| No-history copy | When no resume history exists, show the exact compact copy: `Start watching to continue here.` Do not reintroduce a Watch History screen or label. |


# 11. Contextual Micro Drama Access (W02 / C01 Wallet)


> **LOCKED** — The paywall is dynamic, not Episode-4-specific.  It can appear on any episode when backend says the viewer lacks access.

> **LOCKED** — W02 is the contextual Micro Drama access presentation associated with C01 Wallet, not an independent standalone monetization journey.  When a Micro Drama episode is locked, the access methods are presented contextually through the Wallet; Add Coins for episode access is offered contextually inside Wallet when the viewer's coin balance is insufficient. Exact return to the originating episode is preserved after any unlock or purchase path.

| Element | Rule |
| --- | --- |
| Heading | Use actual episode context: 'Continue Episode N' / series title. |
| Rewarded ad CTA | Show only if rewarded_unlock_enabled + rewarded_access_mode and ad inventory is available. |
| Coin CTA | Show only if coin unlock enabled; display backend coin price + current balance. |
| Plus CTA | Show if Plus can unlock this episode and viewer is not currently Plus. |
| Coin shortage | Offer Add Coins contextually inside the Wallet access presentation; do not expand a wall of packs inside the first paywall. C02 standard Coin Purchase may still be used for Chai / other valid entry points. |
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


> **LOCKED** — C01 Wallet is the primary consumer-facing Micro Drama wallet / access hub.  It owns Coin episode unlock, Rewarded Ad episode unlock, 0nya Plus episode access, insufficient-coin handling with Add Coins entry, permanent episode entitlements, and rewarded progress (0/2 -> 1/2 -> 2/2). Exact return to the initiating episode is required after any Wallet-initiated action.

> **LOCKED** — Wallet visual redesign sequencing: (1) first stabilize/consolidate the Micro Drama functional access journey through Wallet; (2) verify Coin / Rewarded / Plus / Add Coins / exact return-context behavior; (3) only after functional consolidation is stable, perform the final C01 Wallet UI/UX redesign under B04. The current C01 Wallet UI is not final visual authority. The final Wallet must follow Quiet Cinema (flat hierarchy, restrained surfaces, strong balance readability, clean ledger/activity presentation, no oversized dashboard cards, no aggressive commerce treatment). Do not invent the final detailed Wallet layout until functional consolidation is complete.


# 14. Rewarded-Ad Episode Unlock


> **LOCKED** — Rewarded ads are user-initiated access, not interruptive micro-drama advertising.  When offered and completed successfully, the current episode receives an unlock entitlement.


| Rule | Behavior |
| --- | --- |
| Availability | Backend controls rewarded_unlock_enabled + rewarded_access_mode per episode; runtime ad inventory can additionally make it unavailable. |
| Registration | Guest selecting the ad option completes OTP first so the entitlement can be attached to an account. |
| Verification | Grant unlock only after verified rewarded completion/callback; repeated callbacks must be idempotent. |
| Failure/no fill | No unlock, no penalty. Return to paywall with Coin/Plus if available. |
| Persistence | Backend controls rewarded_access_mode. **Launch mode is permanent only** (session is unsupported and hidden from the operational CMS editor; `create_rewarded_ad_attempt` rejects `session` with `unsupported_pending_policy`). Permanent is the default to avoid repeat-ad friction. |
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


## 15.1 Founder-approved launch commercial configuration

This founder decision supersedes any older working-price examples elsewhere in project documentation. Prices and configuration remain backend/store driven rather than hardcoded client/layout presentation.

| Product / area | Launch configuration |
| --- | --- |
| 0nya Plus | One paid tier only. Weekly auto-renewing membership. Launch reference ₹49/week. No free trial. Localized price is Google Play / store product metadata and is authoritative in the UI when available; the offer communicates weekly auto-renew and "cancel anytime in Google Play". |
| Coin packs | 30 coins / ₹29, 50 coins / ₹49, 100 coins / ₹99, 250 coins / ₹199 — sorted 30 < 50 < 100 < 250. Coin quantities are backend-authoritative (`public.coin_products`); localized prices come from store/product metadata, not hardcoded client presentation. |
| Episode coin price | Backend/CMS controlled per episode. Working/reference default 9 coins; allowed CMS range 5–15 coins. 9 is not a global client-side price; individual episodes remain independently configured. |
| Chai | Same 0nya coin wallet, Short-Film only, coin tip only. Allowed amounts: 5 / 10 / 20 / 50 coins (backend `chai_allowed_coin_amounts`). No separate currency, no cash/UPI Chai. |

Google Play / store product creation and production purchase verification remain externally blocked (D-U-N-S / organisation setup). Until store metadata is available, the client renders the established "store price not configured" / unavailable state and must not invent prices.


# 16. Vertical Short Films


> **LOCKED** — Short films are ad-based content + optional Chai coin tips.  They are never coin-locked and never subscriber-only.

1. User taps a short-film card.
2. Film Detail opens with poster, creator/director, duration, language, rating/descriptors, synopsis, Play/Resume and Share.
3. Free/Registered Free viewer taps Play -> film plays with CMS-controlled short-film ad rules.
4. 0nya Plus viewer taps Play -> same film plays ad-free.
5. During eligible playback, a subtle Send Chai affordance may become available approximately 45 seconds before completion; film completion still leads to post-roll ad for non-Plus if enabled/available -> Chai coin prompt -> Share -> Related films.

| Film state | Free / Registered Free | 0nya Plus |
| --- | --- | --- |
| Access | Always playable | Always playable |
| Coin lock | Never | Never |
| Mid-roll ad | CMS controlled | No |
| Post-roll ad | CMS controlled | No |
| Chai coin tip | Subtle in-player affordance may appear at approximately T-45 seconds; also available after completion | Subtle in-player affordance may appear at approximately T-45 seconds; also available after completion |

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

1. During the final ~45 seconds of eligible short-film playback, show a compact in-context Send Chai affordance (optional, never auto-opens the full flow).
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


> **LOCKED** — Short Film Chai is a SEPARATE DEDICATED user flow. F02 Short Film End -> T01 Chai Coin Amount -> T02 Chai Confirm / Success. Chai is NOT migrated into C01 Wallet, and T01/T02 remain dedicated Short Film screens. Sharing the 0nya coin balance does not share the UI journey. If Chai balance is insufficient, the existing approved dedicated Chai -> Coin Purchase -> same Chai amount return flow is preserved. C02 standard Coin Purchase may still be required for Chai even if Micro Drama access presents Add Coins contextually inside Wallet.


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

Publishing a Series is an explicit bulk publication action that publishes the Series and all child Episodes after existing publish validation succeeds. Episode access configuration remains independently controlled and unchanged.

> **LOCKED** — The same-screen Episode Tray is the approved MVP behavior. It is generated from the current series' published episode collection, supports dynamic ranges without hardcoding totals and keeps D01 visible beneath a dim scrim. Do not reintroduce a separate full-screen V03 Episode Browser for MVP.


# 21. Profile, Settings & Account


| State | Top area | Items |
| --- | --- | --- |
| Guest | Sign in to keep history/unlocks | Sign In, playback/subtitle settings, Help/Legal, app version |
| Registered Free | Account + Free badge | Restore/Sync, Settings, Delete Account, Sign Out |
| 0nya Plus | Account + Plus badge | Restore/Sync, Settings, Delete Account, Sign Out |

- Logout returns to guest Home; it never forces OTP.
- Delete Account is a separate destructive flow with confirmation.
- Settings include App Language (English / हिन्दी), Subtitles → Default Language (subtitle preference, distinct from App Language), Help & Support, Report a Content Issue, Grievance/Contact, Terms, Privacy Policy and app version.
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

# 21A. App Language & Interface Localization

> **PRODUCT OWNER DECISION (2026-08-31)** — Supersedes any older "Hindi-first" launch-language wording. This is the authoritative App Language rule.

- **App interface languages:** 0nya supports two App Language settings — **English** and **हिन्दी**.
- **First-install default:** The app interface language defaults to **English** on first install.
- **No first-launch chooser:** There is NO mandatory language chooser on first launch for MVP. The user may change App Language later from **Settings**.
- **Whole-interface language:** Changing App Language changes the full APP-OWNED interface language (all app-owned strings), not a subset.
- **No intentional mixed-language UI:** Do NOT construct mixed-language app UI strings such as "Love की कहानी", "Continue देखना", or "My प्रोफ़ाइल". App-owned interface strings must be coherent within the selected language (e.g. English: Continue Watching / Profile / Settings / Watch; Hindi: coherent Hindi equivalents). This task defines the architecture/product rule, not a translation dictionary — do not prescribe final Hindi strings here.
- **App Language vs Subtitle Language:** App Language (English / हिन्दी) is a SEPARATE concept from the existing Settings **Subtitles → Default Language** preference. Do not rename subtitle language into app language. Both may be present and must be represented distinctly in Settings.
- **CMS-authored metadata boundary:** App Language does NOT translate or fabricate CMS-authored content. Series titles, Short Film titles, creator names, synopses, and other CMS-fed metadata remain exactly as authored by the CMS unless the backend/CMS later provides explicit localized fields. Do not concatenate English and Hindi fragments merely because the UI language changes. Localized CMS metadata is a separate future product/backend capability unless current repository evidence already proves it exists.
- **Product decision vs implementation status:** The above are PRODUCT DECISIONS. This document does NOT state that App Language switching or Hindi localization is technically implemented. Implementation/visual acceptance is pending (see §21B and the roadmap B04 typography sub-gate).

# 21B. Typography Direction

> **PRODUCT OWNER DECISION (2026-08-31)** — Approved typography direction / B04 experimental sub-gate. NOT yet implemented, visually approved, physically verified, or LOCKED.

- **English / Latin — PRIMARY:** The primary typography design direction is English/Latin. The approved target family is **0nya Sans**, researched as based on the legally modifiable **Plus Jakarta Sans** (SIL Open Font License 1.1). Target semantic weights: Regular 400, Medium 500, SemiBold 600.
- **Implementation status:** 0nya Sans is an APPROVED DIRECTION only. It is NOT yet implemented, visually approved in Android, physically verified, or LOCKED/VERIFIED COMPLETE. Do not document it as already integrated.
- **Facelio:** Facelio is NO LONGER the implementation path for the consumer UI. Do not retain wording implying Facelio is the planned final Android font.
- **Hindi / Devanagari:** Hindi interface mode will use a deliberately selected Devanagari companion typeface that visually harmonizes with 0nya Sans. That companion has NOT yet been selected/approved. Do NOT claim Plus Jakarta Sans contains Devanagari, and do NOT describe random Android/system glyph fallback as the intended final Hindi typography design. System/Noto fallback may exist as a technical safety fallback, but final Hindi mode requires an explicitly chosen Devanagari typography treatment before visual lock.

# 23. Content Classification, Parental Controls & Age Gates


> **POLICY** — India OTT classification support is mandatory.  CMS and consumer UI must support U, U/A 7+, U/A 13+, U/A 16+ and A classifications, descriptors, parental controls where required, and age verification for A-rated content.


| Requirement | Implementation rule |
| --- | --- |
| Classification fields | Series/film rating + content descriptors; episode override if needed. |
| Display | Show rating/descriptors clearly before viewing and in relevant detail/metadata surfaces. |
| U/A 13+ / U/A 16+ | Support opt-in parental restrictions. Normal playback is not interrupted unless parental restrictions are ON and the configured threshold applies. |
| Parental Controls settings | User can turn restrictions ON/OFF, choose U/A 13+ and above or U/A 16+ and above, set/change PIN, and Lock Now. |
| PIN vs restrictions | Setting/changing a PIN does not enable restrictions by itself. Disabling restrictions preserves the PIN. |
| G02 | Verification gate only when parental restrictions are ON, effective rating meets/exceeds the configured threshold, and no valid parental unlock session exists. |
| A-rated content | Requires reliable age verification before view. |
| MVP cost rule | Do not publish A-rated content until reliable age verification has been built and approved. |
| Deep links | Cannot bypass an applicable configured parental/access/age gate. |
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


## 0nya Quiet Cinema

Artwork and video carry emotion. Typography carries hierarchy. Teal carries interaction. Everything else stays quiet. The full visual language lives in `docs/0nya_DESIGN_SYSTEM_v1.0.md`.

Do not present a routine combined metadata strip (e.g. `MICRO DRAMA • Hindi • U/A 13+`) on cards or detail; show ratings/descriptors separately where required by policy.

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

## Quiet Cinema visual direction

Approved consumer visual direction:

> Artwork and video carry emotion. Typography carries hierarchy. Teal carries
> interaction. Everything else stays quiet.

0nya is cinematic, intimate, premium, editorial, restrained, mobile-first and
content-dominant — not gaming, not Reels/TikTok, not neon, not dashboard-heavy,
not badge-heavy, not sales-heavy.

Locked visual decisions:

- Consumer artwork is universal 9:16 (Home, Continue Watching, Explore, Search, Micro Dramas, Short Films, Series artwork, Related content, resume cards). Do not use 2:3 or 16:9 for consumer posters.
- Surfaces are matte-black, flat, spacing-based: avoid oversized bordered dashboard cards, especially Profile, Settings, Wallet and episode lists.
- Color stays `#050505` / `#E8E4DA` / `#0DD1BC` / `#4DE5D2`; teal is interaction/progress/active state only; no neon glow; no alternate player teal.
- Primary buttons target 48–52dp with accessible hit areas >=48dp; one dominant action normally.

## Metadata presentation

- Prefer artwork → title → only useful supporting context.
- Do not present a routine combined metadata strip (for example `MICRO DRAMA • Hindi • U/A 13+` or `SHORT FILM • 32 min • Hindi`) as the standard card or detail treatment.
- Compliance rating/descriptors must remain separately visible where required; they are not removed, only pulled out of any combined promotional strip.
- A quiet format label (MICRO DRAMA / SHORT FILM) may sit below the artwork in muted text.


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
| W02 | Contextual Micro Drama Access (associated with C01 Wallet) | Guest/Free | Only valid methods; Add Coins contextual |
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
- Restrictions OFF -> U/A 13+ and U/A 16+ play normally.
- Restrictions ON + U/A 13+ threshold -> U/A 13+ and U/A 16+ require parental access when the session is locked.
- Restrictions ON + U/A 16+ threshold -> U/A 13+ plays normally; U/A 16+ requires parental access when the session is locked.
- Successful parental PIN verification shares the account-scoped unlock across Series and Short Films while valid.
- Lock Now re-locks parental access so the next applicable title requires PIN again.
- A-rated content cannot publish to MVP unless age verification feature is enabled/approved.
- Deep link cannot bypass an applicable configured gate.

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

---

## Multi-Rewarded Unlock (V1 Launch Policy)

Implemented on top of the existing verified rewarded foundation (`rewarded_ad_attempts`,
`create_rewarded_ad_attempt`, `finalize_rewarded_ad_callback`). No new progress ledger was
created; verified progress is derived from granted attempt rows bound to the active
required-count snapshot.

- **Required count is backend/CMS controlled.** Field `episodes.required_rewarded_completions`
  (integer, NOT NULL, default 1, range 1–2). Android is told the value via
  `requiredRewardedCompletions` on the episode; it never derives it from coin price.
- **Launch maximum is 2.** No 3- or 4-ad unlocks at launch. If an episode is too valuable for
  two ads, Rewarded is disabled and Coin + Plus (or another CMS combination) is used.
- **Permanent only at launch.** `rewarded_access_mode` still permits `session` in the DB for
  migration compatibility, but the operational CMS editor no longer offers Session and
  `create_rewarded_ad_attempt` rejects `session` with `unsupported_pending_policy`.
- **Commercial guideline (editorial, NOT code):** 5–7 coins ~ usually 1 ad; 8–15 coins ~
  usually 2 ads. CMS/backend owns the actual value; there is no automatic
  `coin_price -> required_ads` mapping.
- **No automatic chained ads.** 0/2 -> explicit Watch Ad -> Ad1 verified -> 1/2 -> controlled
  0nya screen -> explicit Watch next Ad -> Ad2 verified -> 2/2 -> permanent entitlement.
  Ad 2 is never auto-launched.
- **Partial progress is preserved** across no-fill, network failure, background, app close,
  app kill, and later return. Backend remains authoritative; Android recovers 1/2 from
  `GET /api/v1/episodes/:id/rewarded/progress` on mount/focus.
- **SSV/idempotency preserved.** Google AdMob SSV ECDSA/SHA-256 verification, service-role-only
  finalize, unique `provider_transaction_id`, row locking, entitlement uniqueness, and
  user/episode binding are unchanged. Replayed transactions do not increase progress; a
  transaction reused on another attempt is rejected (`transaction_conflict`).
- **Abuse control:** `create_rewarded_ad_attempt` reuses a non-expired pending attempt for the
  same user+episode+snapshot instead of flooding pending rows.
- **Production ad-unit pinning is fail-closed.** In `NODE_ENV=production`,
  `ADMOB_REWARDED_AD_UNIT_ID` must be configured and the SSV `ad_unit` must match it; otherwise
  the callback is rejected. Dev/test uses safe test configuration.
- **Client is never entitlement-authoritative.** Navigation to Watch happens only after the
  backend confirms `verifiedProgress >= requiredCompletions`.
- **Analytics:** internal `rewarded_monetization_events` table + `record_rewarded_event` RPC
  (server-side) and `POST /api/v1/monetization/rewarded-events` (client-offer/CTA/no-fill).
  No auth tokens, OTP, receipts, or provider secrets are stored; analytics is not a financial
  authority — the attempt/entitlement tables remain authoritative.

---

## 34. Product & UI Final Acceptance Authority

Final product and visual acceptance of consumer App screens and CMS editorial surfaces is governed strictly by the **Locked Final Acceptance Protocol** in `AGENTS.md`.

- **Consumer App:** `SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT -> PHYSICAL ONEPLUS -> LOCK`.
- **CMS:** `CMS SOURCE/CONFIG -> DEPLOYED QA/API -> CMS WEBSITE -> SCREENSHOTS -> OWNER+CHATGPT REVIEW -> OWNER HANDS-ON CMS CHECK -> LOCK`.
- No AI coding or QA agent has authority to self-approve final visual or operational deliverables. Final visual candidate approval belongs exclusively to Product Owner + ChatGPT, followed by physical hardware validation.

*Final Acceptance Protocol synchronized — Product Owner approved — 2026-08-31*

---

## 36. 0nya Plus Play Together / 0chat (SOURCE FOUNDATION; CONSUMER RELEASE DEFERRED)

> **STATUS: APPROVED / SOURCE FOUNDATION PRESENT / RUNTIME AND ANDROID UI
> UNVERIFIED — REQUIRES PRODUCT OWNER ACTIVATION FOR CONSUMER RELEASE**
>
> Current uncommitted source contains backend/migration preparation for the
> feature. That is not deployed runtime, realtime Android synchronization, or
> Android chat UI evidence. Do not enable or surface it to consumers before the
> required activation and acceptance evidence exists.

### Terminology

The hierarchy is:

```
0nya Plus
   ↓
Play Together
   ↓
0chat
```

- **0nya Plus** — the single paid subscription tier (see §15). An active Plus member may CREATE a Play Together room.
- **Play Together** — synchronized private co-viewing within a room (exactly 1 Host + maximum 1 Guest). Not a renaming of any existing feature.
- **0chat** — the minimal private text communication layer inside an active Play Together room. It is NOT the name of the entire Play Together feature. *(Previous internal name "Wanna Chat" is superseded; do not retain "Wanna Chat" as the current product name.)*

### Play Together V1 (locked rules)

- Maximum 2 accounts per room; exactly 1 Host + maximum 1 Guest.
- 0chat capability (including room creation) is granted by the backend access resolver — active 0nya Plus includes 0chat access; Coin / Rewarded are alternative configured access paths for non-Plus users. The exact CREATE-vs-JOIN scope for Coin / Rewarded initiation is a **PRODUCT DECISION REQUIRED BEFORE PX01 IMPLEMENTATION**.
- A Registered Free or Plus account with backend-confirmed 0chat access may JOIN an invitation.
- The Guest does not need Plus merely to join.
- Every participant retains independent content entitlement; the Host's Plus entitlement NEVER transfers to the Guest.
- The backend remains authoritative for access.
- Micro-Drama episodes only in V1; Short Films are excluded from V1.
- The Host controls Play / Pause / Seek / episode transition; the Guest follows Host playback state.
- Every participant independently passes release / access / parental / playback authorization.
- Auto-Next uses one authoritative room advance: current episode complete ->
  next sequential published episode -> per-participant authorization ->
  synchronized room transition. Do not create two independent Auto-Next state
  machines.
- If the Guest lacks access, the room waits while the Guest completes normal access; a successful Auth / OTP / unlock returns the Guest to the SAME pending room.
- Play Together must never bypass entitlement.

### 0chat V1 (locked rules)

0chat V1 is deliberately minimal:

```
PRIVATE
TWO PARTICIPANTS
TEXT ONLY
ROOM SCOPED
EPHEMERAL
```

Allowed:

- send text
- receive text
- restrained transient player message
- compact chat panel
- functional system messages

System-message examples (room-scoped, ephemeral):

```
Priya joined
Priya left
Synced
Priya is buffering…
Waiting for Priya…
Episode 5 starting
```

NOT in V1:

- public comments
- general-purpose DMs
- followers / friends graph
- public rooms / group rooms
- voice calls / video calls
- image/file messages
- permanent messaging inbox
- reactions economy
- social feed
- Likes / Comments

Room completion must not silently create a general-purpose messaging system.

### Feature-activation boundary

When Play Together is eventually implemented, it must be gated behind an explicit server/config-controlled activation boundary conceptually equivalent to `play_together_enabled = false` at launch. The feature must remain invisible to consumers until explicitly activated by the Product Owner. No runtime flag is introduced during this documentation-only step.

### 0chat visual identity (future)

Future consumer identity is a chat-bubble silhouette with a centered `0`,
using the existing 0nya Teal `#0DD1BC`, in a quiet/cinematic treatment. No neon
glow, no multicolor social styling, no oversized floating social-media button.
The compact icon does not require the written word "0chat" beside it. Accessible
touch target; video remains visually dominant. No icon asset is created during
this documentation-only step — final geometry/placement belongs to future PX01 UI
refinement.

### Connection model — link first

0chat connects users primarily through a private invite link / room invite. No
friends list, no follower graph, no public usernames, no contact discovery, no
public rooms. V1 room capacity remains maximum 2 participants.

### 0chat access resolver

0chat capability is granted by a **backend/config-controlled** access resolver,
not by the client. The future access surface should be capable of showing only
methods currently enabled by backend/config:

```
0chat access:
      ↓
Coin
OR
Rewarded
OR
0nya Plus
```

- **0nya Plus** — Plus includes 0chat access (no additional Coin or Rewarded
  payment for the same eligible use). Do NOT create a second Plus tier, a 0chat
  subscription, or a separate currency.
- **Coin** — conceptual controls `0chat_coin_access_enabled` /
  `0chat_coin_price` (conceptual names only; do NOT create schema/runtime config
  now). The Android client must NOT hardcode the amount. Exact commercial
  duration/scope of a Coin 0chat unlock is a **PRODUCT DECISION REQUIRED BEFORE
  PX01 IMPLEMENTATION**. Do NOT silently define lifetime access.
- **Rewarded** — may be offered when backend/config enables it. Tap Watch Ad →
  explicit rewarded ad → trusted verification (AdMob SSV) → backend confirms
  0chat access. Never a client timer or ad-close callback. Number of rewards and
  grant duration/scope remain configurable / future PX01 decisions.

### Two independent access gates

0chat access and content/episode access are **separate** gates. A participant
may need BOTH.

```
0CHAT ACCESS  →  Coin / Rewarded / Plus
     AND
CONTENT ACCESS → Free / Coin entitlement / Rewarded entitlement / Plus / release state
```

- Passing 0chat access does NOT unlock an episode.
- Passing episode access does NOT automatically grant 0chat.
- The Host's Plus entitlement NEVER transfers to the Guest.
- The invite link never grants content entitlement.

### Guest discovery

A Guest user may SEE the `0chat` icon. This is **feature discovery only**. Guest
visibility does NOT mean the anonymous Guest owns a wallet, owns coins, owns
Plus, has 0chat entitlement, or has episode entitlement, or can bypass
authentication or backend access. If dismissed: continue playback normally, no
forced registration, no punishment, no repeated harassment. Exact dismissal
persistence / cooldown is a future UX decision.

### Terminal waiting → friendly connected transition

- **Waiting (terminal):** before the second participant connects, 0chat uses a
  restrained command-line / terminal-inspired visual state with functional
  system progression messages (e.g. `> Waiting for connection…`). This is a
  visual language for system feedback, NOT a requirement for users to type
  `/connect` / `/join` / `/play` / `/pause`.
- **Connected (friendly):** after successful connection, the interface
  transitions to a simple, human-readable chat experience.

### Guest → Auth → Access return

A Guest discovering 0chat and choosing an access path that requires identity
must return to the EXACT same 0chat intent after Sign In / OTP. Do NOT return to
Home and lose the invitation, room, intended participant, current
episode/context, or selected 0chat access path. Reuse the completed
return-to-origin system. No separate 0chat authentication architecture.

### Existing 100 welcome coins

Preserve the existing account rule: a new eligible registered account receives
100 welcome coins, once, server-side, idempotently. 0chat must NOT create
another 100-coin grant. Do NOT document "0chat bonus = 100 coins." Do NOT grant
coins for seeing, tapping, inviting to, or joining 0chat or for watching
together. An anonymous Guest does NOT own a wallet.

### Invite link security / context

The invite link is a connection mechanism, NOT entitlement. It may identify
enough server-side context to resolve room / content / episode target / pending
join. Do not expose secrets or trusted entitlement data client-authoritatively.
Opening a link must resolve, server-side:

```
Room valid? → Identity? → 0chat access? → Episode access?
→ Compliance / parental gates? → Playback authorization? → Connect
```

### Deferred commercial / policy questions

The following remain **POLICY / IMPLEMENTATION DECISION REQUIRED BEFORE PX01
RELEASE** — do NOT invent answers:

- 0chat Coin access duration / scope.
- 0chat Rewarded entitlement duration / scope.
- Exact Coin / Rewarded CREATE-vs-JOIN room scope if still unresolved.
- 0chat / Play Together message retention, room retention, room TTL, invitation
  expiry, invitation abuse/spam, block/report behavior, moderation, message
  length, rate limits, reconnect window, age/parental interaction.
