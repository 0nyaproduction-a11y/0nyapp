---
title: "0nya UI Wireframes — All Consumer Screens"
version: "1.0"
status: "Low-Fidelity Implementation Specification"
authority: "Companion to Product Bible v3.0 + Master User Flow v1.1"
date: "2026-08-21"
product: "0nya"
---

# 0nya UI WIREFRAMES — ALL CONSUMER SCREENS v1.0

**Use with:**

1. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
2. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`

> **Bible = product rules.**  
> **Master Flow = screen-to-screen movement.**  
> **This document = what every consumer screen contains and how it behaves.**
>
> If this file conflicts with the Product + UI/UX Bible, the Bible wins.
>
> Do not add product behavior that is not defined by the Bible or Master Flow.

---

# 1. LOW-FIDELITY DESIGN PRINCIPLES

This is a wireframe specification, not the final visual-design system.

At this stage, prioritize:

- hierarchy
- information order
- navigation
- state transitions
- button priority
- backend-driven behavior
- reusable components
- accessibility
- error/recovery behavior

Do **not** spend implementation time yet on:

- final typography system
- elaborate animation
- complex gradients
- glow effects
- decorative motion
- moving posters
- autoplay previews
- heavy visual polish
- new paid UI/design libraries

Existing brand foundation may be used:

```text
Background     #050505
Primary text   #E8E4DA
Accent         #0DD1BC
Highlight      #4DE5D2
```

---

# 2. GLOBAL APP SHELL

Locked bottom navigation:

```text
Home | Explore | Profile
```

Do not create:

```text
Browse
Search tab
Prime tab
Wallet tab
```

Search lives inside Explore.

## Global shell wireframe

```text
┌──────────────────────────────────────┐
│ Status / Safe Area                   │
│                                      │
│ SCREEN CONTENT                       │
│                                      │
│                                      │
│                                      │
├──────────────────────────────────────┤
│   Home           Explore     Profile │
└──────────────────────────────────────┘
```

Use native safe-area handling.

Avoid nested vertical scrolling.

---

# 3. SCREEN INVENTORY

| ID | Screen |
|---|---|
| A01 | System Launch |
| H01 | Home — New / Low History |
| H02 | Home — With History |
| E01 | Explore |
| E02 | Search Results |
| D01 | Series Detail |
| D02 | Short Film Detail |
| V01 | Micro-Drama Player — Clean |
| V02 | Micro-Drama Player — Controls |
| V03 | Episode Tray / D01 overlay |
| V04 | Seamless Auto-Next |
| W01 | Locked Preview |
| W02 | Dynamic Episode Paywall |
| R01 | Phone Entry |
| R02 | OTP Entry |
| C01 | Wallet |
| C02 | Coin Purchase |
| A02 | Rewarded Ad Loading / Playback |
| A03 | Rewarded Ad Success |
| S01 | Plus Offer |
| S02 | Plus Success / Sync |
| F01 | Short Film Player |
| F02 | Short Film End |
| T01 | Chai Coin Amount |
| T02 | Chai Confirm / Success |
| P01 | Profile — Guest |
| P02 | Profile — Registered Free |
| P03 | Profile — Plus |
| P04 | Settings |
| P05 | Manage Subscription |
| P06 | Restore / Sync Purchases |
| G01 | Content Rating Slate |
| G02 | Parental Lock |
| G03 | Age Verification |
| X01 | No Internet |
| X02 | Playback Error |
| X03 | Commerce Error |
| X04 | Search Empty |
| L01 | Deep Link Routing |
| Q01 | Delete Account |

---

# 4. A01 — SYSTEM LAUNCH

## Purpose

Start the app without introducing an artificial splash delay.

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│                                      │
│                 0nya                 │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

## Behavior

```text
System Launch
 -> resolve initial app state
 -> check incoming deep link
 -> Home or Deep Link Router
```

Do not add:

- deliberate 1.8-second delay
- forced sign-in
- promotional carousel
- subscription offer

---

# 5. H01 — HOME: NEW / LOW HISTORY

## Purpose

Help the viewer start watching quickly.

## Wireframe

```text
┌──────────────────────────────────────┐
│ 0nya                         Profile │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │          FEATURED HERO           │ │
│ │                                  │ │
│ │ Title                            │ │
│ │ Short hook / metadata            │ │
│ │                                  │ │
│ │ [▶ Watch Now]      [i Info]      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Start Here                           │
│ ┌────────┐ ┌────────┐ ┌────────┐ →  │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ Trending Now                         │
│ ┌────────┐ ┌────────┐ ┌────────┐ →  │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ New Releases                         │
│ ┌────────┐ ┌────────┐ ┌────────┐ →  │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ Micro Dramas                         │
│ ┌────────┐ ┌────────┐ ┌────────┐ →  │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ Vertical Short Films                 │
│ ┌────────┐ ┌────────┐ ┌────────┐ →  │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
├──────────────────────────────────────┤
│   Home           Explore     Profile │
└──────────────────────────────────────┘
```

## Recommended row order

```text
Hero
Start Here
Trending Now
New Releases
Micro Dramas
Vertical Short Films
Staff Picks / Editorial
```

Empty rows should not render.

---

# 6. H02 — HOME: WITH HISTORY

## Purpose

Resume playback immediately.

## Wireframe

```text
┌──────────────────────────────────────┐
│ 0nya                         Profile │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │          FEATURED HERO           │ │
│ │ [▶ Watch / Resume]   [i Info]    │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Continue Watching                    │
│ ┌─────────┐  ┌─────────┐  →         │
│ │ STILL   │  │ STILL   │            │
│ │         │  │         │            │
│ │ ▰▰▰▰▱▱▱ │  │ ▰▰▰▰▰▱▱ │            │
│ │         │  │         │            │
│ └─────────┘  └─────────┘            │
│ Title        Title                  │
│ Episode N    Short Film             │
│ · Resume     · Resume               │
│                                      │
│ Recommended / Because You Watched    │
│ ┌────────┐ ┌────────┐ ┌────────┐ →  │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ Trending / New / Micro / Short Film  │
│ ...                                  │
│                                      │
├──────────────────────────────────────┤
│   Home           Explore     Profile │
└──────────────────────────────────────┘
```

## Continue Watching default logic

```text
Enter:
watched >= 5 sec
AND not complete

Complete:
>= 95%
OR within final 5 sec
```

Thresholds may be configuration-controlled.

Tap must return to exact content and resume position.

Visual treatment:

```text
9:16 static video-derived still
real progress
resume metadata
no autoplay or moving preview
dark matte fallback if no still exists
```

---

# 7. HOME HERO

## Micro Drama

```text
Watch Now
 -> resolve target episode
 -> access engine
 -> player / preview / paywall

Info
 -> D01 Series Detail
```

## Short Film

```text
Watch Now
 -> D02 Short Film Detail

Info
 -> D02 Short Film Detail
```

Do not display episode-level coin pricing on the hero.

---

# 8. STANDARD CONTENT CARD

## Wireframe

```text
┌──────────────┐
│              │
│    POSTER    │
│              │
└──────────────┘
Title
Format label
```

## Micro Drama tap

```text
resolve resume/target episode
 -> access engine
```

## Short Film tap

```text
-> D02 Short Film Detail
```

Use subtle format indicators:

```text
MICRO DRAMA
SHORT FILM
```

Do not add:

- "3 free episodes"
- episode-number lock badge
- fixed subscription-required badge
- coin price at series level

---

# 9. E01 — EXPLORE

## Purpose

Browse and search the catalog.

## Wireframe

```text
┌──────────────────────────────────────┐
│ Explore                              │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Search 0nya                    🔍│ │
│ └──────────────────────────────────┘ │
│                                      │
│ [All] [Micro Drama] [Short Film]     │
│                                      │
│ [Genre ▼] [Language ▼] [Sort ▼]     │
│                                      │
│ Discover                             │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
├──────────────────────────────────────┤
│   Home           Explore     Profile │
└──────────────────────────────────────┘
```

## Behavior

Filters should be backend/API-supported where possible.

Do not fake unsupported filtering client-side over incomplete data.

Search query analytics must be sanitized.

---

# 10. E02 — SEARCH RESULTS

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←  Search                            │
│ ┌──────────────────────────────────┐ │
│ │ aadha takiya                   × │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Results for "aadha takiya"           │
│                                      │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ Related / suggestions                │
│ ...                                  │
└──────────────────────────────────────┘
```

No results:

```text
-> X04 Search Empty
```

---

# 11. D01 — SERIES DETAIL

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←                                    │
│ ┌──────────────────────────────────┐ │
│ │          SERIES ART              │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Series Title                         │
│ MICRO DRAMA • Language • Rating      │
│ 24 episodes • 18 published          │
│ Creator / Director                   │
│ Synopsis...                          │
│                                      │
│ [▶ Resume Episode 12]                │
│ [Episodes]                           │
│                                      │
│ More Like This                       │
└──────────────────────────────────────┘
```

## Rules

- No Chai.
- D01 is the lightweight series hub / info surface.
- D01 does not render the full episode catalog inline.
- If history exists, use Resume.
- Tapping Episodes opens the same-screen Episode Tray / bottom sheet over D01; the tray does not navigate to a separate Episodes screen.
- Closing the tray returns to the exact D01 state.

---

# 12. D02 — SHORT FILM DETAIL

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←                                    │
│ ┌──────────────────────────────────┐ │
│ │         SHORT FILM ART           │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Film Title                           │
│ SHORT FILM • 14 min • Hindi          │
│ U/A 13+ • descriptors                │
│ Creator / Director                   │
│                                      │
│ Synopsis...                          │
│                                      │
│ [▶ Play / Resume]                    │
│ [Share]                              │
│                                      │
│ Related Short Films                  │
└──────────────────────────────────────┘
```

Short films are always playable subject to compliance gates.

No:

- coin lock
- subscriber-only lock

D02 CTA rule:

- Play: no valid history, <5 seconds watched, completed progress, or final-zone progress.
- Resume: valid unfinished >=5 seconds and outside completed/final zone.
- CTA action must match label (Play starts from beginning for fresh/completed; Resume continues the latest valid unfinished position).

---

# 13. V01 — MICRO-DRAMA PLAYER CLEAN

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│                                      │
│                                      │
│              VIDEO                   │
│              9:16                    │
│                                      │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

Tap screen:

```text
-> V02 controls
```

Player must not contain interruptive mid/post-roll ads.

---

# 14. V02 — MICRO-DRAMA PLAYER CONTROLS

## Wireframe

```text
┌──────────────────────────────────────┐
│ ‹  Aadha Takiya            [Share][⚙]│
│    Episode 1                         │
│                                      │
│              VIDEO                   │
│                ⏵                     │
│                                      │
│                                      │
│ 00:42 ──────●───────────────── 1:32  │
│                                      │
│ Episodes                             │
└──────────────────────────────────────┘
```

Back is icon-only (compact glyph, top-left). Series title is primary (top
line); Episode N is secondary, directly beneath it — never "EP1"/"E01". Share
and Settings gear are icon-only in the top-right cluster, both compact with
equal visual weight; Settings stays outermost right, Share immediately to its
left. Episodes is the only persistent bottom action (icon + Title Case
label); no Share/Settings text or buttons at the bottom. No Like / Comment.

Top/bottom scrims are smooth, restrained readability fades — not visibly
stacked opacity bands — and never darken the whole video; the video remains
the hero.

Press-and-hold the right side of the video temporarily plays at 1.5x: the
center Play/Pause hides, a small transient "1.5x" indicator appears away from
center (clear of the top-right icons), and releasing restores the viewer's
saved persistent speed without overwriting it.

Controls disappear after inactivity.

---

# 15. V03 — EPISODE TRAY / SAME-SCREEN SHEET

Open as a compact bottom sheet over D01; the Series Hub stays visible beneath a dim scrim.

## Wireframe

```text
┌──────────────────────────────────────┐
│ Episodes                         ×   │
│                                      │
│ [1–25]   [26–50]   [51–75]           │
│                                      │
│ [01] [02] [03] [04] [05] [06] [07] │
│ [08] [09] [10] [11] [12] [13] [14] │
│ [15] [16] [17] [18] [19] [20] [21] │
│                                      │
│ ...                                  │
└──────────────────────────────────────┘
```

The labels above are examples only.

Actual cells come from the backend's published episode collection, and range groupings are derived dynamically.

V03 is a compact same-screen Episode Tray, not a dedicated full-screen Episode Browser. It should support long series without forcing hundreds of cells on first render, and the current/resume episode should select the containing range automatically when multiple ranges exist.

Episode tap:

```text
-> access resolver
```

---

# 16. V04 — SEAMLESS AUTO-NEXT

## Behavior

No overlay, no countdown, no "Playing in...", no [Play Now]/Cancel buttons.

```text
episode completes
-> save final watch-progress
-> resolve the next sequential episode's existing access state
-> canWatch: start it immediately (no transition screen)
-> requires access: existing EpisodeAccessOptions / paywall flow immediately
-> next episode number unreleased, or no next episode: existing
   Replay / Back completion state (differentiated message only)
```

Never skip ahead to a later published episode; only "current number + 1" is
ever considered.

Do not bypass paywall/access state.

---

# 17. W01 — LOCKED PREVIEW

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│           PAUSED VIDEO FRAME         │
│                                      │
│                                      │
│ Episode locked                       │
│                                      │
│ Continue watching                    │
│                                      │
│ [See Options]                        │
└──────────────────────────────────────┘
```

If preview is disabled:

```text
skip W01
-> W02
```

---

# 18. W02 — DYNAMIC EPISODE PAYWALL

## Core rule

Only show options enabled by backend and valid for this viewer.

## Full-option example

```text
┌──────────────────────────────────────┐
│ Continue Episode 12                  │
│                                      │
│ Choose how to unlock                 │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Unlock with 9 Coins             │ │
│ │ Balance: 34                     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Watch an Ad to Unlock           │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Get 0nya Plus                   │ │
│ │ Unlock eligible episodes        │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Not now                             │
└──────────────────────────────────────┘
```

Possible layouts:

```text
Coin + Ad + Plus
Coin + Plus
Ad + Plus
Coin only
Ad only
Plus only
```

Never render unavailable methods disabled unless there is a deliberate UX reason.

Prefer omitting them.

---

# 19. R01 — PHONE ENTRY

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←                                    │
│                                      │
│ Continue with phone                  │
│                                      │
│ We'll send a one-time code.          │
│                                      │
│ +91  [__________________________]    │
│                                      │
│ [Continue]                           │
│                                      │
│ Terms • Privacy                      │
└──────────────────────────────────────┘
```

OTP is triggered only by intentional account/monetisation actions.

---

# 20. R02 — OTP ENTRY

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←                                    │
│                                      │
│ Enter verification code              │
│ Sent to +91 ••••••1234               │
│                                      │
│ [  _  _  _  _  _  _  ]             │
│                                      │
│ [Verify]                             │
│                                      │
│ Resend in 00:28                      │
│ Change number                        │
└──────────────────────────────────────┘
```

Success returns to initiating context.

Do not send to Home unless Home initiated sign-in.

---

# 21. C01 — WALLET

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←  Wallet                            │
│                                      │
│ Your Coins                           │
│                                      │
│               134                    │
│                                      │
│ [Buy Coins]                          │
│                                      │
│ Recent Activity                      │
│ Episode 12 unlock        -9           │
│ Chai: Film Title         -20          │
│ Coin purchase            +100         │
└──────────────────────────────────────┘
```

Purchased coins never expire.

Avoid exposing creator cash-equivalent promises.

---

# 22. C02 — COIN PURCHASE

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←  Buy Coins                         │
│                                      │
│ Choose a coin pack                   │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 30 Coins              ₹...      │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 50 Coins              ₹...      │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 100 Coins             ₹...      │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 250 Coins             ₹...      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Store billing disclosures            │
└──────────────────────────────────────┘
```

Pack values and localized prices come from backend/store configuration.

After purchase:

```text
return to exact originating action
```

---

# 23. A02 — REWARDED AD LOADING / PLAYBACK

## Loading state

```text
┌──────────────────────────────────────┐
│                                      │
│ Preparing your unlock...             │
│                                      │
│              spinner                 │
│                                      │
│ Please keep this screen open.        │
└──────────────────────────────────────┘
```

If no fill:

```text
return to W02
```

No penalty.

## Playback

Use ad SDK/native provider UI where required.

Do not create custom fake ad completion logic.

---

# 24. A03 — REWARDED AD SUCCESS

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│               ✓                      │
│                                      │
│ Episode unlocked                     │
│                                      │
│ [Continue Watching]                  │
└──────────────────────────────────────┘
```

Prefer automatic return after a brief confirmation.

Entitlement grant must be idempotent.

---

# 25. S01 — 0NYA PLUS OFFER

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←                                    │
│                                      │
│              0nya Plus               │
│                                      │
│ Watch more without interruption      │
│                                      │
│ ✓ Eligible micro-drama episodes      │
│ ✓ Short films without ads            │
│ ✓ Coins stay separate                │
│                                      │
│ Weekly membership                    │
│                                      │
│ [Continue]                           │
│                                      │
│ Restore Purchases                    │
│ Terms • Privacy                      │
│ Current build: purchasing unavailable│
└──────────────────────────────────────┘
```

Only one paid tier.

Do not add Prime.

MVP customer-facing cadence is weekly. Do not show monthly or yearly plan options in the consumer UI.

---

# 26. S02 — PLUS SUCCESS / SYNC

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│               ✓                      │
│                                      │
│ Welcome to 0nya Plus                 │
│                                      │
│ Your subscription is active.         │
│                                      │
│ [Continue Watching]                  │
└──────────────────────────────────────┘
```

Return to initiating content.

---

# 27. F01 — SHORT FILM PLAYER

## Wireframe

```text
┌──────────────────────────────────────┐
│ ‹  Film Title              [Share][⚙]│
│    Short Film                        │
│                                      │
│              VIDEO                   │
│                ⏵                     │
│                                      │
│                                      │
│ 00:00 ──────●───────────────── 12:00 │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

Share and Settings are icon-only in the top-right cluster (Settings
outermost right); short films have no Episodes control, so the bottom row is
empty playback chrome only.

For non-Plus:

```text
CMS mid-roll at editorial timecodes
CMS optional post-roll after completion
```

For Plus:

```text
no short-film ads
```

No coin lock.

---

# 28. F02 — SHORT FILM END

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│ Film complete                        │
│                                      │
│ Enjoyed the film?                    │
│                                      │
│ [☕ Send Chai]                       │
│ [Share] [Replay]                     │
│                                      │
│ Related Short Films (if available)   │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ [Back Home]                          │
└──────────────────────────────────────┘
```

If non-Plus post-roll is configured:

```text
film complete
 -> post-roll
 -> F02
```

F02 interaction rules:

- System Back follows navigation stack origin.
- Explicit Home intentionally navigates to Home.
- Related Short Films uses real catalog items only and is omitted cleanly when empty.

---

# 29. T01 — CHAI COIN AMOUNT

## Wireframe

```text
┌──────────────────────────────────────┐
│ Send Chai                        ×   │
│                                      │
│ Support this filmmaker with coins.   │
│                                      │
│ Your balance: 84 Coins               │
│                                      │
│ [ 5 ] [ 10 ] [ 20 ] [ 50 ]          │
│                                      │
│ Selected: 20 Coins                   │
│                                      │
│ [Continue]                           │
└──────────────────────────────────────┘
```

Allowed tip amounts come from configuration.

Chai uses the same 0nya coin wallet.

---

# 30. T02 — CHAI CONFIRM / SUCCESS

## Confirm

```text
┌──────────────────────────────────────┐
│ Confirm Chai                         │
│                                      │
│ Film: Title                          │
│ Chai: 20 Coins                       │
│                                      │
│ [Send 20 Coins]                      │
│ Cancel                               │
└──────────────────────────────────────┘
```

## Success

```text
┌──────────────────────────────────────┐
│                                      │
│               ✓                      │
│                                      │
│ Chai sent                            │
│                                      │
│ 20 Coins                             │
│                                      │
│ Thank you for supporting the film.   │
│                                      │
│ [Done]                               │
└──────────────────────────────────────┘
```

Transaction must atomically:

```text
debit viewer wallet
credit film/creator Chai ledger
```

No separate cash/UPI checkout.

---

# 31. P01 — PROFILE: GUEST

## Wireframe

```text
┌──────────────────────────────────────┐
│ Profile                              │
│                                      │
│ Guest                                │
│                                      │
│ [Sign In]                            │
│                                      │
│ Playback Settings                    │
│ Subtitle Settings                    │
│ Help                                 │
│ Report Content Issue                 │
│ Grievance                            │
│ Terms                                │
│ Privacy                              │
│ App Version                          │
│                                      │
├──────────────────────────────────────┤
│   Home           Explore     Profile │
└──────────────────────────────────────┘
```

Guest can browse/view wherever policy/access permits.

---

# 32. P02 — PROFILE: REGISTERED FREE

## Wireframe

```text
┌──────────────────────────────────────┐
│ Profile                              │
│                                      │
│ Account                              │
│ Free                                 │
│                                      │
│ Restore / Sync Purchases             │
│ Notifications                        │
│ Settings                             │
│ Help                                 │
│ Report Content Issue                 │
│ Grievance                            │
│ Terms                                │
│ Privacy                              │
│ Logout                               │
│ Delete Account                       │
│                                      │
├──────────────────────────────────────┤
│   Home           Explore     Profile │
└──────────────────────────────────────┘
```

---

# 33. P03 — PROFILE: PLUS

## Wireframe

```text
┌──────────────────────────────────────┐
│ Profile                              │
│                                      │
│ Account                              │
│ 0nya Plus                            │
│                                      │
│ Restore / Sync Purchases             │
│ Notifications                        │
│ Settings                             │
│ Help                                 │
│ Report Content Issue                 │
│ Grievance                            │
│ Terms                                │
│ Privacy                              │
│ Logout                               │
│ Delete Account                       │
│                                      │
├──────────────────────────────────────┤
│   Home           Explore     Profile │
└──────────────────────────────────────┘
```

Plus does not remove coins or permanent unlocks.

---

# 34. P04 — SETTINGS

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←  Settings                          │
│                                      │
│ Playback                             │
│ Autoplay Next              [ON]      │
│ Streaming Quality          Auto      │
│                                      │
│ Subtitles                            │
│ Default Language           Hindi     │
│                                      │
│ Notifications                        │
│ New Releases              [OFF]      │
│ Marketing                 [OFF]      │
│                                      │
│ Parental Controls                    │
│ Parental restrictions      [OFF]     │
│ Restrict                  U/A 13+    │
│ Set PIN / Change PIN                 │
│ Lock Now                             │
│                                      │
│ Privacy                              │
│ Data / Permissions                   │
└──────────────────────────────────────┘
```

Marketing notifications require explicit opt-in.

Default off.

Parental restrictions are opt-in. When OFF, U/A 13+ and U/A 16+ titles play
normally. When ON, the Restrict value is either U/A 13+ and above or U/A 16+
and above. Setting/changing a PIN does not enable restrictions by itself, and
disabling restrictions does not delete the PIN.

---

# 35. P05 — MANAGE SUBSCRIPTION

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←  Manage Subscription               │
│                                      │
│ 0nya Plus                            │
│ Active                               │
│                                      │
│ Current plan: Weekly                 │
│                                      │
│ [Manage in Store]                    │
│                                      │
│ Restore / Sync Purchases             │
│                                      │
│ Terms • Privacy                      │
└──────────────────────────────────────┘
```

If the underlying store implementation is active, use store-supported management. Do not invent or imply unimplemented billing flows.

Do not invent custom cancellation behavior that conflicts with store billing.

---

# 36. P06 — RESTORE / SYNC PURCHASES

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←  Restore Purchases                 │
│                                      │
│ Sync your purchases with this        │
│ 0nya account.                        │
│                                      │
│ [Restore / Sync]                     │
│                                      │
│ Last synced: ...                     │
└──────────────────────────────────────┘
```

## States

```text
idle
syncing
success
nothing found
failure
```

Must reconcile server-side.

---

# 37. G01 — CONTENT RATING SLATE

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│             U/A 13+                  │
│                                      │
│ Language • Violence                  │
│                                      │
│             Continue                 │
└──────────────────────────────────────┘
```

Do not over-display for every trivial transition.

Use where required by product/policy flow.

---

# 38. G02 — PARENTAL LOCK

## Wireframe

```text
┌──────────────────────────────────────┐
│ This content requires parental       │
│ access.                              │
│                                      │
│ Enter PIN                            │
│ [••••]                               │
│ [Verify]                             │
│                                      │
│ Cancel                               │
└──────────────────────────────────────┘
```

G02 appears only when parental restrictions are ON, the effective rating meets
or exceeds the configured U/A 13+ or U/A 16+ threshold, and no valid parental
unlock session exists. It must not appear merely because a title is U/A 13+.
Settings/setup remains separate; the content gate is verification only.
Successful verification resumes the exact requested content/access flow.

---

# 39. G03 — AGE VERIFICATION

Future flow for A-rated content.

## Wireframe

```text
┌──────────────────────────────────────┐
│ Age Verification                     │
│                                      │
│ This title is rated A.               │
│                                      │
│ Age verification is required.        │
│                                      │
│ [Verify Age]                         │
│                                      │
│ Cancel                               │
└──────────────────────────────────────┘
```

If reliable age verification is not built/approved:

```text
do not publish A-rated content
```

---

# 40. X01 — NO INTERNET

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│              Offline                 │
│                                      │
│ Check your connection and try again. │
│                                      │
│ [Try Again]                          │
│                                      │
│ Back                                 │
└──────────────────────────────────────┘
```

If cached Home data exists, prefer showing cache with a small offline indicator.

---

# 41. X02 — PLAYBACK ERROR

## Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│ Playback interrupted                 │
│                                      │
│ We couldn't continue this video.     │
│                                      │
│ [Try Again]                          │
│                                      │
│ Episodes                             │
└──────────────────────────────────────┘
```

Retry from same timestamp.

---

# 42. X03 — COMMERCE ERROR

## Wireframe

```text
┌──────────────────────────────────────┐
│ Payment not completed                │
│                                      │
│ Your account and existing coins are  │
│ unchanged.                           │
│                                      │
│ [Try Again]                          │
│                                      │
│ Choose another option                │
└──────────────────────────────────────┘
```

Do not falsely claim payment failed if receipt state is uncertain.

Reconcile first where necessary.

---

# 43. X04 — SEARCH EMPTY

## Wireframe

```text
┌──────────────────────────────────────┐
│ No results                           │
│                                      │
│ We couldn't find "..."               │
│                                      │
│ Try another title, genre, or creator.│
│                                      │
│ Trending on 0nya                     │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │Poster  │ │Poster  │ │Poster  │    │
│ └────────┘ └────────┘ └────────┘    │
└──────────────────────────────────────┘
```

---

# 44. L01 — DEEP LINK ROUTING

This may be mostly invisible.

## Visible fallback state

```text
┌──────────────────────────────────────┐
│ Opening on 0nya...                   │
│                                      │
│              spinner                 │
└──────────────────────────────────────┘
```

Routing order:

```text
resolve target
 -> target/release validity
 -> rating / parental / age gate
 -> access resolver
 -> player/detail/paywall
```

Deep links must never bypass access rules.

---

# 45. Q01 — DELETE ACCOUNT

## Wireframe

```text
┌──────────────────────────────────────┐
│ ←  Delete Account                    │
│                                      │
│ Delete your 0nya account?            │
│                                      │
│ This will permanently delete your    │
│ account according to the current     │
│ deletion policy.                     │
│                                      │
│ [Delete Account]                     │
│                                      │
│ Cancel                               │
└──────────────────────────────────────┘
```

Use a strong confirmation step.

Do not make the delete action visually ambiguous.

---

# 46. REUSABLE COMPONENT MAP

Prefer reusing existing components.

Suggested responsibilities:

```text
AppShell
├── BottomNavigation
├── ScreenHeader
└── SafeArea

Home
├── FeaturedHero
├── HomeRow
├── PosterCard
└── ContinueWatchingCard

Explore
├── SearchInput
├── FilterBar
└── ContentGrid

Series
├── SeriesHeader
├── EpisodeRow
└── EpisodeListSheet

Player
├── VideoSurface
├── PlayerControls
└── PlaybackProgress

Monetisation
├── DynamicPaywall
├── PaywallOption
├── CoinBalance
├── CoinPackCard
└── PlusPlanCard

Auth
├── PhoneInput
└── OTPInput

Short Films
├── ShortFilmDetail
├── ShortFilmPlayer
└── FilmEndActions

Chai
├── ChaiAmountSelector
└── ChaiConfirm

Profile
├── ProfileHeader
├── SettingsRow
└── AccountActionRow

System
├── LoadingState
├── EmptyState
└── ErrorState
```

Do not create duplicate components if equivalents already exist.

---

# 47. CLIENT / BACKEND RESPONSIBILITY

## Backend/CMS authority

Backend controls:

```text
episode free_access
coin_unlock_enabled
coin_price
rewarded_unlock_enabled
plus_access
locked_preview_seconds
publish_at

short-film midroll_enabled
short-film midroll_timecodes
short-film postroll_enabled
chai_enabled

coin packs
Plus/store plan data
Home row definitions/order
content ratings/descriptors
```

## Client responsibility

Client should:

```text
fetch state
render correct UI
trigger allowed action
preserve user context
show loading/failure states
reconcile entitlement
```

Client must not invent access policy.

---

# 48. LOADING PRINCIPLES

Prefer geometry-matched skeletons.

Examples:

```text
Hero skeleton
Poster skeleton
Episode-row skeleton
Wallet balance skeleton
```

Avoid full-screen spinner when part of the screen can safely render.

---

# 49. ERROR PRINCIPLE

Every error state should have:

```text
one dominant primary recovery CTA
optional secondary text action
```

Avoid three equally prominent buttons.

---

# 50. ACCESSIBILITY BASELINE

All screens should support:

- safe areas
- small Android screens
- readable text scale
- sufficient contrast
- meaningful labels
- accessible touch targets
- non-color-only state indicators
- keyboard/focus behavior where platform supports it
- subtitle readability
- error announcements where practical

---

# 51. DO NOT ADD DURING WIREFRAME IMPLEMENTATION

Unless explicitly approved:

- Like
- Comment
- Browse tab
- Search tab
- Prime
- cash Chai
- UPI Chai
- micro-drama mid-roll
- micro-drama post-roll
- micro-drama pre-roll
- fixed Episode 4 paywall
- first-3-free assumption
- coin-locked short films
- subscriber-only short films
- autoplaying Home video feed
- TikTok/Reels-style social feed
- expensive UI library
- new paid SaaS
- new deep-link provider
- broad architecture rewrite

---

# 52. IMPLEMENTATION ORDER

Use this sequence.

## Phase 1 — Shell / Home / Explore

```text
A01
H01
H02
E01
E02
P01
P02
P03
```

## Phase 2 — Micro Drama Core

```text
D01
V01
V02
V03
V04
W01
W02
```

## Phase 3 — Account / Monetisation

```text
R01
R02
C01
C02
A02
A03
S01
S02
P05
P06
```

## Phase 4 — Short Films / Chai

```text
D02
F01
F02
T01
T02
```

## Phase 5 — Settings / Compliance / Recovery

```text
P04
G01
G02
G03
Q01
X01
X02
X03
X04
L01
```

---

# 53. COPILOT / CLAUDE / CODEX INSTRUCTION

Before any UI/UX implementation, read:

```text
docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md
```

Then inspect the current implementation before changing code.

---

# 54. MASTER COPILOT PROMPT

Use this prompt for each implementation phase.

```text
Read first:

1. docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
2. docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
3. docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md
4. .github/copilot-instructions.md

Do not modify code until you have inspected the current implementation.

Task:
Implement only the screen IDs I specify.

Rules:
- Reuse current navigation, components, API/services, auth, player, state management and styling infrastructure wherever possible.
- Do not perform broad refactors.
- Do not change backend contracts unless genuinely required.
- Do not hardcode episode access, coin price, lock state, ad eligibility, Plus eligibility, Home row order or release state.
- Do not introduce a fixed 3-free-episode assumption.
- Do not add micro-drama interruptive ads.
- Do not add cash/UPI Chai.
- Do not add a paid dependency.
- Preserve exact user context through OTP, purchase, unlock, subscription and recoverable errors.
- Build only the requested screen IDs. Do not continue into later phases automatically.

Before editing:
1. List current relevant files.
2. Explain what can be reused.
3. Identify the minimum files that need modification.
4. Report any backend/API gap.

After editing:
1. Run relevant typecheck/lint/tests/build.
2. List changed files.
3. State which Bible/Master Flow/Wireframe requirements were satisfied.
4. Report any remaining gap.
5. Do not commit or push unless explicitly instructed.
```

---

# 55. PHASE-SPECIFIC COPILOT EXAMPLES

## Phase 1

```text
Implement only:
A01, H01, H02, E01, E02, P01, P02, P03.

Do not implement Player, Paywall, Coins, Plus, Short Film, Chai,
or compliance screens yet.
```

## Phase 2

```text
Implement only:
D01, V01, V02, V03, V04, W01, W02.

Do not alter the backend episode-access policy.
Render backend state only.
```

## Phase 3

```text
Implement only:
R01, R02, C01, C02, A02, A03, S01, S02, P05, P06.

Preserve initiating playback context through all monetisation flows.
```

## Phase 4

```text
Implement only:
D02, F01, F02, T01, T02.

Short films must remain always playable.
Non-Plus uses CMS mid/post-roll only.
Chai uses 0nya coins.
```

## Phase 5

```text
Implement only:
P04, G01, G02, G03, Q01, X01, X02, X03, X04, L01.
```

---

# 56. GLOBAL ACCEPTANCE CHECKLIST

The low-fi consumer UI is complete when:

- [ ] App opens guest-first.
- [ ] Bottom nav is exactly Home / Explore / Profile.
- [ ] Search is inside Explore.
- [ ] Home supports H01 and H02.
- [ ] Continue Watching resumes exact context.
- [ ] Series cards route into access resolver.
- [ ] Short-film cards open Short Film Detail.
- [ ] Series Detail supports access-driven episode list.
- [ ] Micro-drama player has no interruptive ads.
- [ ] Dynamic paywall renders only backend-enabled methods.
- [ ] Coin unlock is permanent.
- [ ] Rewarded-ad unlock requires verified completion.
- [ ] Plus is the only subscription tier.
- [ ] Short films are always playable.
- [ ] Non-Plus short-film mid/post-roll respects CMS config.
- [ ] Plus short films are ad-free.
- [ ] Chai uses the same coin wallet.
- [ ] Chai is short-film-only.
- [ ] OTP returns to initiating context.
- [ ] Purchase returns to initiating context.
- [ ] Restore/Sync exists.
- [ ] Profile works for guest/free/Plus.
- [ ] Account deletion exists.
- [ ] Content-rating and parental gates exist where required.
- [ ] Deep links do not bypass access/compliance.
- [ ] Loading states exist.
- [ ] Error/recovery states exist.
- [ ] No fixed "3 free episodes" logic exists.
- [ ] No fixed Episode 4 paywall exists.
- [ ] No paid dependency was added without approval.
- [ ] Existing backend/creator/CMS flows remain compatible.

---

# 57. AUTHORITY ORDER

If instructions conflict:

1. Current explicitly approved product decision
2. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
3. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
4. `docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md`
5. `.github/copilot-instructions.md` / `AGENTS.md` / `CLAUDE.md`
6. Existing implementation conventions
7. AI preference

---

**0nya / शून्य**

**UI WIREFRAMES — ALL CONSUMER SCREENS v1.0**
