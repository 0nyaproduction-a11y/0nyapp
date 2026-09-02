---
title: "0nya Master User Flow — All in One"
version: "1.1"
status: "Implementation Companion"
authority: "Use with 0nya Product + UI/UX Bible v3.0"
date: "2026-08-21"
product: "0nya"
---

# 0nya MASTER USER FLOW v1.1 — ALL IN ONE

**Read together with:** `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`

> **Bible = product rules.**  
> **This file = complete user movement through the app.**
>
> For UI, UX, navigation, screen transition, player, paywall, wallet, Chai, subscription, short-film, deep-link, account, or error work, read this file before changing code.
>
> If this file conflicts with the Product + UI/UX Bible, the Bible wins.

---

# 1. THE WHOLE APP IN ONE FLOW

```mermaid
flowchart TD

    START[App Open] --> A01[A01 System Launch]
    A01 --> DEST{Incoming deep link?}

    DEST -- No --> HOME[H01/H02 Home]
    DEST -- Yes --> L01[L01 Deep Link Router]

    HOME --> MICRO{Tap content}
    MICRO -- Micro Drama --> ACCESS[Resolve Episode Access]
    MICRO -- Short Film --> D02[D02 Short Film Detail]

    HOME --> EXP[E01 Explore]
    EXP --> SEARCH[E02 Search Results]
    SEARCH --> MICRO

    HOME --> PROF{Profile}
    PROF --> P01[P01 Guest Profile]
    PROF --> P02[P02 Free Profile]
    PROF --> P03[P03 Plus Profile]

    ACCESS --> PUB{Published?}
    PUB -- No --> SOON[Coming Soon]
    PUB -- Yes --> ENT{Already entitled?}

    ENT -- Yes --> PLAYER[V01/V02 Micro Drama Player]
    ENT -- No --> FREE{free_access?}

    FREE -- Yes --> PLAYER
    FREE -- No --> PREVIEW{Preview enabled?}

    PREVIEW -- Yes --> W01[W01 Play Preview then Pause]
    PREVIEW -- No --> W02[W02 Contextual Micro Drama Access via C01 Wallet]
    W01 --> W02

    W02 --> COIN{Coin enabled?}
    W02 --> AD{Rewarded Ad enabled?}
    W02 --> PLUS{Plus enabled?}

    COIN -- Yes --> REGISTER1{Registered?}
    REGISTER1 -- No --> OTP1[R01/R02 OTP]
    REGISTER1 -- Yes --> BAL{Enough coins?}
    OTP1 --> BAL
    BAL -- Yes --> CU[Permanent Coin Unlock]
    BAL -- No --> ADD[Add Coins contextual in Wallet]
    ADD --> CU
    CU --> PLAYER

    AD -- Yes --> REGISTER2{Registered?}
    REGISTER2 -- No --> OTP2[R01/R02 OTP]
    REGISTER2 -- Yes --> A02[A02 Rewarded Ad]
    OTP2 --> A02
    A02 --> VERIFY{Verified completion?}
    VERIFY -- Yes --> AU[Ad Unlock Entitlement]
    VERIFY -- No --> W02
    AU --> PLAYER

    PLUS -- Yes --> REGISTER3{Registered?}
    REGISTER3 -- No --> OTP3[R01/R02 OTP]
    REGISTER3 -- Yes --> S01[S01 Plus Offer]
    OTP3 --> S01
    S01 --> SUB{Purchase success?}
    SUB -- No --> S01
    SUB -- Yes --> SYNC[Server Entitlement Sync]
    SYNC --> PLAYER

    PLAYER --> END{Episode complete?}
    END -- No --> SAVE[Save Resume Position]
    SAVE --> PLAYER
    END -- Yes --> V04[V04 Auto Next]
    V04 --> ACCESS

    D02 --> SFPLAY[F01 Short Film Player]
    SFPLAY --> SFPLUS{Plus user?}
    SFPLUS -- Yes --> FILM[Play Film Ad-Free]
    SFPLUS -- No --> MID[Play Film + CMS Mid-rolls]
    MID --> COMPLETE[Film Complete]
    FILM --> COMPLETE

    COMPLETE --> POST{Non-Plus + post-roll enabled?}
    POST -- Yes --> POSTAD[Post-roll Ad]
    POST -- No --> F02[F02 Short Film End]
    POSTAD --> F02

    F02 --> CHAI{Chai enabled / user chooses tip?}
    CHAI -- No --> RELATED[Share / Related / Home]
    CHAI -- Yes --> T01[T01 Choose Chai Coin Amount]

    T01 --> REGCHAI{Registered?}
    REGCHAI -- No --> OTP4[R01/R02 OTP]
    REGCHAI -- Yes --> CHBAL{Enough coins?}
    OTP4 --> CHBAL

    CHBAL -- Yes --> T02[T02 Confirm Coin Tip]
    CHBAL -- No --> C02B[C02 Buy Coins]
    C02B --> T02
    T02 --> LEDGER[Debit Viewer + Credit Creator Ledger]
    LEDGER --> RELATED

    L01 --> GATE{Rating / configured parental / age gate?}
    GATE -- Applicable configured gate --> G02[G01/G02/G03 Compliance Gate]
    GATE -- No applicable gate --> LINKTYPE{Target type}
    G02 --> LINKTYPE

    LINKTYPE -- Micro Drama --> ACCESS
    LINKTYPE -- Short Film --> D02

    P01 --> SIGN[Sign In]
    SIGN --> OTP5[R01/R02 OTP]
    OTP5 --> P02

    P02 --> SETTINGS[P04 Settings]
    P02 --> RESTORE[P06 Restore / Sync Purchases]
    P02 --> DELETE[Q01 Delete Account]

    P03 --> RESTORE[P06 Restore / Sync Purchases]
    P03 --> SETTINGS
    P03 --> DELETE
```

---

# 2. GLOBAL RULES — NEVER REINTERPRET

1. **No mandatory first-3-free-episodes rule.**
2. Every micro-drama episode is independently controlled from backend/CMS.
3. A micro-drama episode may expose any valid combination of:
   - Free
   - Coin unlock
   - Rewarded-ad unlock
   - 0nya Plus
4. Coin price is backend/CMS controlled.
5. Coin-unlocked episodes are permanent entitlements.
6. Micro-dramas have **no pre-roll, mid-roll, or post-roll ads**.
7. Rewarded ads in micro-drama are explicit user-selected unlock actions only.
8. Short films are always playable.
9. Short-film ads are CMS-controlled **mid-roll/post-roll only** for non-Plus users.
10. Plus users watch short films ad-free.
11. Short films are never coin-locked or subscriber-only.
12. Chai is an **0nya coin tip**.
13. There is no separate cash/UPI Chai checkout.
14. Bottom navigation is **Home / Explore / Profile**.
15. Search lives inside Explore.
16. Series card tap goes directly to play/resume.
17. Short-film card tap goes to Short Film Detail first.
18. OTP happens only on an intentional account/monetisation action.
19. OTP success creates/recovers the account independently of later payment/ad success.
20. Return the user to the exact initiating content/context after OTP, unlock, purchase, subscription, or recoverable failure.

---

# 2A. TWO DISTINCT CONSUMER MONETIZATION SYSTEMS

There are two distinct, non-mergeable consumer monetization systems. They share the same server-authoritative 0nya coin balance but have **separate dedicated user flows**.

## A. Micro Drama Access System (Wallet is the Access Hub)

C01 Wallet is the primary consumer-facing Micro Drama wallet / access hub. For a locked Micro Drama episode, the access experience (W02) is presented **contextually through Wallet** rather than by bouncing the viewer through multiple separate full-screen monetization screens.

A locked episode may expose any backend-valid combination of **Coin**, **Rewarded Ad**, and **0nya Plus** as **alternative** access methods:

```
Coin + Rewarded  =  both methods offered simultaneously as alternatives
                  (NOT partial-coin + partial-ad payment,
                   NOT rewarded progress reducing coin price,
                   NOT ads generating wallet coins,
                   NOT ad-to-coin conversion)
```

The Micro Drama Access System owns:

- Coin episode unlock
- Rewarded Ad episode unlock
- 0nya Plus episode access
- insufficient-coin handling
- **Add Coins** entry for episode access (presented contextually inside Wallet)
- permanent episode entitlements
- rewarded progress (0/2 -> 1/2 -> 2/2)
- exact return to the initiating episode

Rewarded multi-completion is explicit-tap only. If Rewarded requires two verified completions: `0/2 -> explicit user tap -> 1/2 -> explicit second user tap -> 2/2 -> entitlement`. Ad 2 is never auto-launched. B03 rewarded semantics are not redefined.

## B. Short Film Chai System (Protected, Separate)

Short Film Chai MUST remain a separate, dedicated user flow. Do NOT migrate Chai into C01 Wallet.

```
F02 Short Film End
 -> T01 Chai Coin Amount
 -> T02 Chai Confirm / Success
```

- Short Films remain always playable, never Coin locked, never subscriber-only.
- Chai uses the same server-authoritative 0nya coin balance, but sharing the balance does NOT share the UI journey.
- T01/T02 remain dedicated Short Film screens; they are not redefined as Wallet states.
- If Chai balance is insufficient, the existing approved dedicated Chai -> C02 standard Coin Purchase -> same Chai amount return flow is preserved.
- **C02 / standard Coin Purchase may still be required for Chai**, even if Micro Drama access presents Add Coins contextually inside Wallet.

---

# 3. FLOW 01 — APP OPEN / HOME / DISCOVERY

```mermaid
flowchart LR
    A[App Open] --> B[A01 System Launch]
    B --> C{Deep Link?}
    C -- No --> D[H01/H02 Home]
    C -- Yes --> E[L01 Deep Link Router]

    D --> F[Micro Drama Card]
    D --> G[Short Film Card]
    D --> H[E01 Explore]
    D --> I[Profile]

    F --> J[Resolve Episode Access]
    G --> K[D02 Short Film Detail]
    H --> L[E02 Search Results]
    L --> F
    L --> G
```

### Home behavior

**H01 — New / Low History**

- Start Here
- Featured / New
- Trending
- New Releases
- Micro Dramas
- Vertical Short Films
- Staff Picks

**H02 — Has History**

- Continue Watching — first row
- remaining editorial rows below it

### Home Spotlight (Multi-Spotlight)

The Home editorial stage is **Multi-Spotlight**, not a single Featured Hero.

- Ordered real CMS/API items; manual horizontal swipe only.
- Strict 9:16 posters; active poster plus a real next-item peek (the actual next ordered item).
- No automatic movement, no dots, no arrows, no timer, no parallax, no decorative Home motion.
- Poster tap -> Detail (Series or Short Film).
- Active footer CTA -> **Watch** -> resolve target/access -> player / preview / paywall as appropriate.
- `showTitle` is CMS-controlled; the canonical title shows only when `showTitle = true`.
- No Info button inside Spotlight; Continue Watching owns Resume/progress language.

### Authenticated Home wallet affordance

Registered Free and 0nya Plus users must have a clear, restrained Home wallet affordance that opens **C01 Wallet**. Guest Home must not display a misleading owned wallet balance/state. (Android implementation belongs to a later UI batch.)

### Bottom navigation

```text
Home | Explore | Profile
```

No permanent Browse tab.  
No permanent Search tab.

---

# 4. FLOW 02 — MICRO-DRAMA ACCESS ENGINE

Every entry into an episode must pass through the same access resolver.

Entry sources:

- Home
- Continue Watching
- Explore/Search
- Series Detail
- D01 Episodes Tray (same-screen)
- Auto-next
- Deep link

```mermaid
flowchart TD
    A[Episode N requested] --> B[Fetch episode + viewer access]
    B --> C{Published?}

    C -- No --> D[Coming Soon]
    C -- Yes --> E{Existing entitlement?}

    E -- Yes --> P[PLAY]
    E -- No --> F{free_access?}

    F -- Yes --> P
    F -- No --> G{locked_preview_seconds > 0?}

    G -- Yes --> H[Play preview]
    H --> I[Pause on current frame]
    I --> W[W02 Contextual Micro Drama Access]

    G -- No --> W
```

### Backend is authority

The client must not assume:

```text
Episode 1 = Free
Episode 2 = Free
Episode 3 = Free
Episode 4 = Locked
```

That logic is prohibited.

The client must resolve access from backend/CMS.

---

# 5. FLOW 03 — DYNAMIC EPISODE PAYWALL (CONTEXTUAL MICRO DRAMA ACCESS VIA C01 WALLET)

W02 is the **contextual Micro Drama access presentation associated with C01 Wallet**, not an independent standalone monetization journey. For a locked Micro Drama episode, access methods are presented contextually through Wallet; Add Coins for episode access is offered contextually inside Wallet when the viewer's coin balance is insufficient.

```mermaid
flowchart TD
    W[W02 Contextual Micro Drama Access (C01 Wallet)] --> A{rewarded_unlock_enabled?}
    W --> C{coin_unlock_enabled?}
    W --> P{plus_access?}

    A -- Yes --> A1[Show Watch Ad]
    C -- Yes --> C1[Show Unlock with X Coins]
    P -- Yes --> P1[Show Get 0nya Plus]
```

The UI renders **only valid methods**.

Allowed examples:

```text
Coin + Ad + Plus
Coin + Plus
Ad + Plus
Plus only
Coin only
Ad only
```

Never hardcode three buttons.

---

# 6. FLOW 04 — COIN EPISODE UNLOCK (CONTEXTUAL ADD COINS VIA C01 WALLET)

```mermaid
flowchart TD
    A[Tap Unlock with Coins in Wallet context] --> B{Registered?}
    B -- No --> C[R01/R02 OTP]
    B -- Yes --> D{Enough coins?}
    C --> D

    D -- No --> E[Add Coins contextual in Wallet]
    E --> F{Purchase success?}
    F -- No --> E
    F -- Yes --> G[Return to same episode unlock in Wallet context]

    D -- Yes --> H[Confirm coin unlock]
    G --> H

    H --> I[Debit wallet]
    I --> J[Create permanent episode entitlement]
    J --> K[Resume exact episode position]
```

### Important return rule

```text
Micro Drama Access (W02 via C01 Wallet)
 -> Add Coins (contextual in Wallet)
 -> Purchase Success
 -> Same Episode
 -> Coin Unlock
 -> Player Resume
```

Never:

```text
Add Coins -> Home
```

> **Note:** C02 standard Coin Purchase may still be used for the dedicated Short Film Chai flow when the Chai tip amount exceeds the wallet balance. Add Coins is contextual to Micro Drama Wallet access; it does not replace C02 for Chai. See §2A Two Distinct Consumer Monetization Systems.

---

# 7. FLOW 05 — REWARDED AD EPISODE UNLOCK

```mermaid
flowchart TD
    A[Tap Watch Ad to Unlock] --> B{Registered?}

    B -- No --> C[R01/R02 OTP]
    B -- Yes --> D[A02 Load Rewarded Ad]
    C --> D

    D --> E{Ad available?}
    E -- No --> W[Return to W02 Paywall]
    E -- Yes --> F[Play Rewarded Ad]

    F --> G{Verified completion?}
    G -- No --> W
    G -- Yes --> H[Create episode entitlement]
    H --> I[A03 Success]
    I --> J[Resume exact episode]
```

No-fill:

- no penalty
- no unlock
- no forced retry
- keep Coin/Plus methods available

### Rewarded multi-completion (1 or 2 ads)

Required completions are backend/CMS controlled (`requiredRewardedCompletions`, 1–2).

- required = 1: explicit tap -> ad -> verified completion -> permanent entitlement.
- required = 2: explicit tap -> Ad 1 -> verified -> 1/2 state -> NO entitlement yet -> viewer explicitly taps again -> Ad 2 -> verified -> 2/2 -> one permanent entitlement.
- Ad 2 is never auto-launched.
- Entitlement is granted only after the required threshold is reached and the backend confirms verified progress.
- No ad-to-coin conversion.

---

# 8. FLOW 06 — 0NYA PLUS

```mermaid
flowchart TD
    A[Tap Get 0nya Plus] --> B{Registered?}
    B -- No --> C[R01/R02 OTP]
    B -- Yes --> D[S01 Plus Offer]
    C --> D

    D --> E[Store-compliant Purchase]
    E --> F{Success?}

    F -- No --> D
    F -- Yes --> G[Server entitlement sync]
    G --> H[S02 Plus Success]
    H --> I[Return to exact initiating content]
    I --> J[Play / Resume]
```

Plus:

- one paid tier
- unlocks applicable released micro-drama episodes
- removes short-film mid/post-roll ads
- raises the server-authorized playback ceiling from Free/Guest 720p to 1440p / 2K where the asset rendition exists
- does not remove coins
- does not remove permanent coin/ad unlocks

---

# 9. FLOW 07 — MICRO-DRAMA PLAYER / SEAMLESS AUTO-NEXT

```mermaid
flowchart TD
    A[V01 Player Clean] --> B[V02 Controls on Tap]

    B --> C[D01 same-screen Episode Tray]
    B --> D[Share]
    B --> E[Playback Settings: Speed / Quality / Captions]

    A --> F{Episode complete?}

    F -- No --> G[Save resume position]
    G --> A

    F -- Yes --> H[Save final progress]
    H --> N{Next sequential episode published?}

    N -- No --> O[Replay / Back completion state\n unreleased-next or true final episode]
    N -- Yes --> K[Resolve next episode access]

    K --> L{Accessible?}
    L -- Yes --> A
    L -- No --> M[Preview / Paywall]
```

Seamless: no countdown, no "Playing in...", no Play Now/Cancel step. The
transition to the next sequential episode (never a later published episode)
happens immediately based on its existing access state.

No rating screen between episodes.
No recommendation interruption between episodes.

---

# 10. FLOW 08 — CONTINUE WATCHING

```mermaid
flowchart TD
    A[Playback starts] --> B{Watched >= 5 sec?}
    B -- No --> C[Do not add yet]
    B -- Yes --> D{Completed?}

    D -- Yes --> E[Remove/mark completed]
    D -- No --> F[Add/update Continue Watching]

    F --> G[H02 Continue Watching first row]
    G --> H[Tap]
    H --> I[Resume exact saved position]
```

Default completion:

```text
>=95% watched
OR
within final 5 seconds
```

---

# 11. FLOW 09 — SHORT FILM

```mermaid
flowchart TD
    A[Short Film Card] --> B[D02 Short Film Detail]
    B --> C[Tap Play]

    C --> D{Plus?}

    D -- Yes --> E[Play Ad-Free]
    D -- No --> F[Play with CMS-controlled ad rules]

    F --> G{Reach editorial mid-roll timecode?}
    G -- Yes --> H[Mid-roll Ad]
    H --> F

    G -- No --> I{Film complete?}
    E --> I

    I -- No --> F
    I -- Yes --> J{Non-Plus + postroll enabled?}

    J -- Yes --> K[Post-roll Ad]
    J -- No --> L[F02 Film End]
    K --> L

    L --> M[Chai Coins]
    L --> N[Share]
    L --> O[Related Films]
```

### Short-film rules

- Always playable.
- Never coin-locked.
- Never subscriber-only.
- Non-Plus may receive CMS mid/post-roll ads.
- Plus is ad-free.
- No blind 50% mid-roll if editorial timecodes are available.
- The Chai affordance can reveal in the final ~45 seconds of playback, but it must stay in-context and not auto-open a full-screen T01/T02 flow.
- If ignored, the user can still reach the same compact sheet from the film-end state without changing completion or wallet authority.
- D02 CTA is dynamic: Play for no-valid-progress, completed, or final-zone; Resume for valid unfinished >=5 seconds outside final-zone.
- D02 CTA action must match label: Play starts from beginning for completed/fresh entry; Resume continues latest valid unfinished position.
- F02 hierarchy: Film complete -> film title -> short helper -> Send Chai -> Share/Replay -> Related Short Films (only when real items exist) -> Home.
- System Back from F02 follows navigation stack origin; explicit Home intentionally resets to Home.
- Related Short Films on F02 is catalog/editorial fallback, not semantic recommendation ranking.

---

# 12. FLOW 10 — CHAI COIN TIP (DEDICATED SHORT FILM FLOW — NOT WALLET-MIGRATED)

Chai is a **separate, dedicated Short Film flow**. It is NOT migrated into C01 Wallet. F02 Short Film End -> T01 Chai Coin Amount -> T02 Chai Confirm / Success remain dedicated Short Film screens. C02 standard Coin Purchase is used here when the Chai tip amount exceeds the wallet balance.

```mermaid
flowchart TD
    A[F02 Film End] --> B[T01 Select Chai Coin Amount]
    B --> C{Registered?}

    C -- No --> D[R01/R02 OTP]
    C -- Yes --> E{Enough coins?}
    D --> E

    E -- No --> F[C02 Buy Coins]
    F --> G[Return to same Chai amount]

    E -- Yes --> H[T02 Confirm]
    G --> H

    H --> I[Atomic transaction]
    I --> J[Debit viewer coin wallet]
    I --> K[Credit film/creator Chai ledger]
    J --> L[Success]
    K --> L
    L --> M[Return to Film End]
```

No separate Chai cash checkout.

---

# 13. FLOW 11 — PROFILE / WALLET / ACCOUNT

```mermaid
flowchart TD
    A[Profile Tab] --> B{Account state}

    B -- Guest --> P1[P01 Guest Profile]
    B -- Free --> P2[P02 Free Profile]
    B -- Plus --> P3[P03 Plus Profile]

    P1 --> S[Sign In]
    S --> OTP[R01/R02 OTP]
    OTP --> P2

    P2 --> W[C01 Wallet]
    P2 --> BC[C02 Buy Coins]
    P2 --> PL[S01 Get Plus]
    P2 --> ST[P04 Settings]
    P2 --> RS[P06 Restore / Sync Purchases]
    P2 --> DEL[Q01 Delete Account]

    P3 --> W
    P3 --> MS[P05 Manage Subscription]
    P3 --> ST
    P3 --> RS
    P3 --> DEL
```

Logout:

```text
Registered / Plus
 -> Logout
 -> Guest Home
```

Never:

```text
Logout -> forced registration
```

P04 Settings exposes an **App Language** selection (English / हिन्दी). There is NO
first-launch language chooser for MVP. Changing App Language applies to the
app-owned interface and remains in Settings. App Language is SEPARATE from the
existing **Subtitles → Default Language** preference.

```text
Profile -> Settings
  -> App Language           English / हिन्दी
  -> Subtitles
       Default Language     <subtitle preference>
  (no first-launch chooser; change later from Settings)
```

---

# 14. FLOW 12 — DEEP LINKS / COMPLIANCE

```mermaid
flowchart TD
    A[L01 Deep Link] --> B[Resolve Target]

    B --> C{Target exists + published?}
    C -- No --> X[Fallback / unavailable]
    C -- Yes --> D{Rating / access gate required?}

    D -- Yes --> E[G01/G02/G03 Gate]
    D -- No --> F{Content type}
    E --> F

    F -- Micro Drama --> M[Episode Access Resolver]
    F -- Short Film --> S[D02 Short Film Detail]
```

A deep link cannot bypass:

- content rating
- parental control when restrictions are ON and the configured threshold applies
- age verification when applicable
- release state
- entitlement/access rules

---

# 15. FLOW 13 — ERRORS / RECOVERY

```mermaid
flowchart LR
    A[Failure] --> B{Type}

    B -- Network --> X1[X01 No Internet -> Retry same context]
    B -- Playback --> X2[X02 Playback Error -> Retry same timestamp]
    B -- Commerce --> X3[X03 Commerce Error -> clarify status]
    B -- Search --> X4[X04 Empty -> suggestions]
    B -- Reward Ad --> X5[Return to W02]
    B -- OTP --> X6[Remain in OTP -> resend/edit]
```

Never dump the user at Home after a recoverable error unless Home is explicitly chosen.

---

# 16. SCREEN ID QUICK MAP

| ID | Screen |
|---|---|
| A01 | System Launch |
| H01 | Home — New/Low History |
| H02 | Home — With History |
| E01 | Explore |
| E02 | Search Results |
| D01 | Series Detail |
| D02 | Short Film Detail |
| V01 | Player Clean |
| V02 | Player Controls |
| V03 | Episode Tray / D01 overlay |
| V04 | Auto-next |
| W01 | Locked Preview |
| W02 | Contextual Micro Drama Access (C01 Wallet) |
| R01 | Phone Entry |
| R02 | OTP |
| C01 | Wallet |
| C02 | Buy Coins |
| A02 | Rewarded Ad |
| A03 | Rewarded Ad Success |
| S01 | Plus Offer |
| S02 | Plus Success |
| F01 | Short Film Player |
| F02 | Short Film End |
| T01 | Chai Coin Amount |
| T02 | Chai Confirm / Success |
| P01 | Guest Profile |
| P02 | Free Profile |
| P03 | Plus Profile |
| P04 | Settings |
| P05 | Manage Subscription |
| P06 | Restore / Sync Purchases |
| G01 | Rating / Descriptors |
| G02 | Parental Gate |
| G03 | Age Verification |
| X01 | No Internet |
| X02 | Playback Error |
| X03 | Commerce Error |
| X04 | Search Empty |
| L01 | Deep Link Router |
| Q01 | Delete Account |

G02 is verification only when parental restrictions are ON, the effective rating
meets or exceeds the configured U/A 13+ or U/A 16+ threshold, and no valid
parental unlock session exists. A stored PIN alone does not enable restrictions.
After successful PIN verification, resume the exact requested content/access
flow; episode entitlement/paywall logic still runs separately.
Parental setup remains a separate Settings action and must not be forced from
the content-access flow when no PIN exists.

---

# 17. FIGMA / BUILD ORDER

Implement in this order:

```text
01 Navigation Shell
   A01 -> H01/H02 -> E01/E02 -> P01/P02/P03

02 Micro Drama Core
   V01 -> V02 -> V03 -> V04 -> W01 -> W02

03 Monetisation
   R01 -> R02 -> C01 -> C02 -> A02 -> A03 -> S01 -> S02

04 Short Films
   D02 -> F01 -> F02 -> T01 -> T02

05 Account / Compliance
   P04 -> P05 -> P06 -> G01 -> G02 -> G03 -> Q01

06 Recovery / Deep Link
   X01 -> X02 -> X03 -> X04 -> L01
```

---

# 18. COPILOT / CLAUDE / CODEX RULE

Before implementing UI or user flow, AI must read:

```text
docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
```

Then it must inspect existing code before modifying anything.

AI must not:

- recreate the architecture unnecessarily
- introduce a fixed 3-free-episode rule
- create an Episode-4-specific paywall
- hardcode coin price
- hardcode which unlock methods are visible
- put mid/post-roll ads in micro-drama
- create cash/UPI Chai checkout
- coin-lock short films
- create Prime
- add permanent Browse/Search tabs
- add paid services or packages without approval
- send users to Home after an action that should return to playback
- perform broad refactors merely because generated code prefers another pattern

---

# 19. CONFLICT ORDER

If instructions conflict:

1. Current explicitly approved product decision
2. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
3. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
4. `.github/copilot-instructions.md` / `AGENTS.md` / `CLAUDE.md`
5. Existing implementation conventions
6. AI preference

---

**0nya / शून्य**

**MASTER USER FLOW v1.1 — ALL IN ONE**

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

## User Flow Final Acceptance Authority

User flow implementation and screen transitions are not locked until verified through the **Locked Final Acceptance Protocol** in `AGENTS.md`:

```
SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT -> PHYSICAL ONEPLUS -> LOCK
```

Flow correctness on emulator must be visually approved by Product Owner + ChatGPT before physical hardware validation on OnePlus 13R.

*Final Acceptance Protocol synchronized — Product Owner approved — 2026-08-31*

---

## PX01 Play Together / 0chat future room flow

PX01 source foundation is not a current Android realtime/chat UI. When
consumer-activated, the room flow is: secure invite/redeem -> room and
participant validation -> separate backend-controlled room acquisition/access
and per-participant episode authorization -> Host-controlled playback intent ->
canonical room timeline -> synchronized transition. Host entitlement never
transfers to a Guest; an invite never grants episode entitlement.

Room Auto-Next is singular: current episode complete -> next sequential
published episode -> per-participant authorization -> synchronized room
transition. It must not run two independent participant state machines.
