---
title: "0nya Design System"
version: "1.0"
status: "Visual Implementation Lock"
authority: "Companion to Product Bible v3.0 + Master User Flow v1.1 + All-Screen Wireframes v1.0"
date: "2026-08-21"
product: "0nya"
---

# 0nya DESIGN SYSTEM v1.0

**Use with:**

1. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
2. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
3. `docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md`
4. `docs/0nya_APP_ARCHITECTURE_v1.0.md`
5. `docs/0nya_BACKEND_API_CONTRACT_v1.0.md`
6. `docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md`
7. `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`

> **Bible = product rules.**  
> **Master Flow = screen movement.**  
> **Wireframes = screen structure.**  
> **This document = final visual and interaction language for the consumer app.**
>
> If this file conflicts with the Product + UI/UX Bible, the Bible wins.

---

# 1. DESIGN INTENT

0nya should feel:

```text
cinematic
intimate
premium
quiet
confident
modern
Indian without being ornamental
mobile-first
```

0nya should **not** feel:

```text
TikTok
Reels
social-media feed
gaming UI
neon cyberpunk
cheap OTT clone
over-promotional
crowded
loud
gamified
```

The interface should disappear behind the cinema.

The content is the hero.

---

# 1.1 QUIET CINEMA DIRECTION

Approved consumer visual direction:

> Artwork and video carry emotion. Typography carries hierarchy. Teal carries
> interaction. Everything else stays quiet.

0nya should feel cinematic, intimate, premium, editorial, restrained,
mobile-first, and content-dominant — not gaming, not Reels/TikTok, not neon,
not dashboard-heavy, not badge-heavy, not sales-heavy.

Locked visual decisions:

- Consumer artwork is 9:16 everywhere (Home, Continue Watching, Explore, Search,
  Series, Related, resume). Do not use 2:3 or 16:9 for consumer posters.
- Continue Watching stays 9:16 and is differentiated by progress, resume context,
  and section context. Never reintroduce Watch History as a screen.
- Typography direction (English/Latin PRIMARY): target family **0nya Sans**
  (researched as based on Plus Jakarta Sans, SIL Open Font License 1.1; target
  weights 400/500/600). This is an APPROVED DIRECTION only — NOT yet implemented
  or visually locked. Facelio is NO LONGER the consumer-UI implementation path.
  Hindi/Devanagari requires a separate selected companion typeface (TBD).
- Metadata is minimal: artwork → title → only useful supporting context.
  Ratings/descriptors remain visible where required, but not as a routine
  combined strip.
- Surfaces are matte-black, flat, and spacing-based: avoid oversized bordered
  dashboard cards, especially for Profile, Settings, Wallet, and Episode lists.
- Color is locked to `#050505`, `#E8E4DA`, `#0DD1BC`, `#4DE5D2`. Teal is for
  interaction/progress/active state only. Do not introduce an alternate player
  teal such as `#00E5CC`. No neon glow.
- Primary buttons target 48–52dp with accessible hit areas >=48dp. One dominant
  action normally. Paywall methods are option rows/cards, not three equally
  loud giant buttons.

---

# 2. DESIGN PRINCIPLES

## 2.1 Cinema first

The UI should support watching, not compete with it.

## 2.2 Quiet premium

Use restraint:

```text
fewer borders
fewer labels
fewer badges
minimal glow
controlled teal
generous negative space
```

## 2.3 Fast understanding

The viewer should always know:

```text
what to watch
where to continue
what is locked
how to unlock
how to go back
```

## 2.4 Monetisation appears in context

Home should not look like a store.

Coins / Plus / Rewarded Ad should appear when relevant to a viewing decision.

## 2.5 Backend-driven UI

Visual state must reflect resolved backend state.

Do not visually imply access that is not actually available.

---

# 3. BRAND COLOR SYSTEM

## 3.1 Core colors

```text
0nya Black
#050505

Bone White
#E8E4DA

0nya Teal
#0DD1BC

Teal Highlight
#4DE5D2
```

These are the locked brand foundation.

Do not introduce an alternate player teal such as `#00E5CC`; `#0DD1BC` is the single brand teal. No neon glow.

---

# 4. SEMANTIC COLOR TOKENS

Use semantic names in code.

Recommended conceptual tokens:

```text
color.bg.primary           #050505
color.bg.secondary         #0B0B0B
color.bg.elevated          #111111
color.bg.overlay           rgba(0,0,0,0.72)

color.text.primary         #E8E4DA
color.text.secondary       rgba(232,228,218,0.72)
color.text.muted           rgba(232,228,218,0.52)
color.text.disabled        rgba(232,228,218,0.32)

color.accent.primary       #0DD1BC
color.accent.highlight     #4DE5D2
color.accent.onPrimary     #050505

color.border.subtle        rgba(232,228,218,0.12)
color.border.strong        rgba(232,228,218,0.22)

color.surface.selected     rgba(13,209,188,0.10)
color.surface.pressed      rgba(232,228,218,0.08)
```

## 4.1 Status colors

Prefer platform/existing project semantic status colors where already established.

If none exist, create restrained semantic tokens for:

```text
success
warning
error
info
```

Do not use brand teal for destructive/error states.

---

# 5. COLOR USAGE RULES

## Use teal for

```text
primary CTA
active navigation
selected state
progress accent
focus state
important success confirmation
small interactive highlights
```

## Do not use teal for

```text
large page backgrounds
every icon
every heading
every card border
decorative gradients everywhere
full-screen washes
```

Target feeling:

```text
90% black / bone / imagery
10% accent
```

This is directional, not a literal measured ratio.

---

# 6. TYPOGRAPHY

## 6.1 Font strategy

Approved direction (PRODUCT OWNER DECISION 2026-08-31; B04 experimental sub-gate):

- English/Latin PRIMARY target: **0nya Sans**, researched as based on Plus Jakarta Sans (SIL Open Font License 1.1). Target weights 400 / 500 / 600.
- Hindi/Devanagari: deliberate Devanagari companion typeface that harmonizes with 0nya Sans — NOT yet selected/approved (TBD). Do NOT claim Plus Jakarta Sans contains Devanagari; system/Noto fallback is a technical safety net only, not the intended final Hindi typography.

Implementation status:

> 0nya Sans is an APPROVED DIRECTION only. It is NOT yet implemented, visually approved in Android, physically verified, or LOCKED. Do not document it as integrated. Facelio is NO LONGER the consumer-UI implementation path.

Do not add a paid font.

Do not add a new font dependency merely for visual polish.

Current platform behavior (pre-implementation baseline):

```text
Android:
system / existing bundled UI font (0nya Sans pending B04 typography sub-gate)

iOS:
system / existing bundled UI font

Web:
existing brand/UI stack
```

When the dedicated brand font is implemented and visually locked, update this document.

---

# 6.2 WORDMARK CANDIDATE — FACELIO

Facelio is a possible 0nya wordmark reference only.

> WORDMARK CANDIDATE — ANDROID ASSET / LICENSING STATUS NOT VERIFIED. Facelio is NOT the consumer-UI typography implementation path (0nya Sans is the approved English direction).

- Facelio is NOT currently used by the Android app.
- It is NOT specified for body or UI text.
- No Facelio font asset is bundled, copied, converted, or installed.
- Android consumer typography direction is 0nya Sans (English/Latin, pending B04 typography sub-gate); Hindi/Devanagari companion remains TBD.

---

# 7. TYPOGRAPHY SCALE

Use a small, consistent scale.

Target a restrained semantic scale close to: Display 30–34, H1 26–28, Section 18–20, Card title 14–15, Body 15–16, Button 14–15, Supporting metadata 11–12. Prefer weights 400–600; avoid widespread 700/800.

Conceptual tokens:

| Token | Size | Weight | Use |
|---|---:|---:|---|
| Display | 32 | 600 | rare hero/title emphasis |
| H1 | 28 | 600 | major screen title |
| H2 | 22 | 600 | section title |
| H3 | 18 | 600 | card/sheet title |
| Body Large | 17 | 400 | important body |
| Body | 15–16 | 400 | default copy |
| Label | 14 | 500 | controls / tabs |
| Caption | 12–13 | 400 | metadata |
| Micro | 11 | 500 | compact badge only |

Use platform scaling/accessibility.

Do not hardcode a font scale that breaks dynamic type.

---

# 8. TYPOGRAPHY RULES

## Titles

Use short titles.

Avoid all caps except tiny format labels.

## Metadata

Do not present a routine combined metadata strip (for example
`MICRO DRAMA • Hindi • U/A 13+` or `SHORT FILM • 32 min • Hindi`) as the
standard card or detail treatment.

Prefer:

```text
artwork
 -> title
 -> only useful supporting context
```

A quiet format label (MICRO DRAMA / SHORT FILM) may sit below the artwork in
muted text. Compliance ratings and descriptors must remain separately visible
where required by policy, but not as part of a combined promotional strip.

## Truncation

Card titles:

```text
maximum 2 lines
```

Row titles:

```text
1 line
```

Hero title:

```text
up to 2 lines
```

Synopsis:

```text
3–5 lines preview
expand only where supported
```

---

# 9. SPACING SYSTEM

Use a 4pt base with 8pt rhythm.

Recommended tokens:

```text
space.1   4
space.2   8
space.3   12
space.4   16
space.5   20
space.6   24
space.8   32
space.10  40
space.12  48
space.16  64
```

Avoid arbitrary spacing values unless platform safe-area/layout requires them.

---

# 10. SCREEN MARGINS

Recommended mobile horizontal margin:

```text
16px / dp
```

Larger devices:

```text
20–24
```

Do not make content hug the physical edge unless it is:

```text
video
hero artwork
intentional bleed imagery
```

---

# 11. CORNER RADIUS

Use restrained radii.

Recommended:

```text
radius.xs       6
radius.sm       8
radius.md       12
radius.lg       16
radius.sheet    20–24
radius.pill     999
```

Do not make every card heavily rounded.

Posters should generally use:

```text
8–12
```

Primary buttons:

```text
12–14
```

---

# 12. ELEVATION / SHADOW

0nya is dark; avoid heavy shadows.

Prefer:

```text
surface contrast
subtle border
background separation
```

Use shadow only when needed for:

```text
bottom sheet
floating player control
modal
temporary overlay
```

No neon glow.

No large soft teal halo.

---

# 13. IMAGE / POSTER SYSTEM

## Standard poster

Recommended ratio:

```text
9:16
```

This is the universal consumer artwork ratio for 0nya: Home, Continue
Watching, Explore, Search, Micro Dramas, Short Films, Series artwork, Related
content, and resume cards.

Use for:

```text
Micro Drama
Short Film
Explore grid
Home rows
Related content
```

Do not use 2:3 or other portrait ratios for consumer posters.

## Continue Watching

Recommended ratio:

```text
9:16
```

Use a static video-derived still from the exact resumed episode or short film.

This distinguishes resume content from standard discovery posters by source, progress, and resume metadata — not by motion.

No autoplay or moving preview in MVP.

## Spotlight (Multi-Spotlight)

The Home Spotlight uses the same universal consumer artwork ratio as the rest of Home:

```text
9:16
```

The Spotlight is a CMS-controlled horizontal poster rail of strict 9:16 posters with manual swipe only and a real next-item peek. It is editorial content, not a widescreen banner; keep it quiet, cinematic, and content-dominant. Do not crop faces aggressively. Use CMS-supplied artwork where possible. No auto-rotation, no dots, no arrows, no timer, no parallax, no decorative motion.

---

# 14. IMAGE OVERLAYS

For hero readability:

```text
subtle black vertical gradient
```

Use only as needed behind text.

Do not use large teal gradients over artwork.

Poster text should preferably live below the image, not permanently over the artwork.

---

# 15. BUTTON SYSTEM

## 15.1 Primary button

Use for one dominant action.

Examples:

```text
Watch
Continue
Unlock with 9 Coins
Send 20 Coins
Try Again
```

Visual:

```text
background: 0nya Teal
text: 0nya Black
medium weight
height: 48–52
radius: 12–14
```

## 15.2 Secondary button

Examples:

```text
Info
Share
Episodes
Restore Purchases
```

Visual:

```text
dark/elevated surface
bone text
subtle border
```

## 15.3 Text button

Examples:

```text
Not now
Cancel
Change number
Resend
```

Use sparingly.

---

# 16. BUTTON PRIORITY RULE

Every screen should generally have:

```text
1 visually dominant primary action
optional secondary action
optional text action
```

Avoid:

```text
3 equally loud buttons
```

Exception:

Dynamic Paywall may legitimately show several unlock methods.

In that case, treat methods as **option cards**, not three identical giant primary buttons.

---

# 17. BUTTON STATES

Support:

```text
default
pressed
disabled
loading
focused
```

Loading:

```text
keep button width stable
replace icon/text carefully
do not shift layout
```

Disabled state must not rely on opacity so low that text becomes unreadable.

---

# 18. ICON SYSTEM

Use existing project icon library if already present.

Do not add an icon package solely for this design system.

Recommended icon sizes:

```text
16   small inline
20   compact control
24   default
28   bottom nav / prominent control
32   rare large action
```

Use a consistent stroke style.

Avoid filled + outline icon mixtures on the same screen unless required for active/inactive state.

---

# 19. BOTTOM NAVIGATION

Locked:

```text
Home
Explore
Profile
```

## Visual

```text
matte black / near-black surface
subtle top divider
active icon + label in teal
inactive in muted bone
```

Recommended height:

```text
56–64 + safe area
```

Do not use:

```text
floating pill navigation
large center action button
4+ tabs
```

---

# 20. APP HEADER

## Standard

```text
left:
screen title or 0nya mark

right:
context action if necessary
```

Home:

```text
0nya mark
optional profile/account entry
```

Explore:

```text
Explore
```

Detail screens:

```text
Back
```

Avoid overloading headers with:

```text
wallet
Plus
search
bell
profile
more menu
```

all at once.

---

# 21. HOME VISUAL SYSTEM — H01/H02

Home hierarchy:

```text
Multi-Spotlight
Continue Watching / Start Here
Editorial rows
Bottom nav
```

## Row title

```text
H3 / 18
Bone White
24px top spacing from previous section
```

## Horizontal row

Show approximately:

```text
2.5–3 poster cards
```

depending device width.

This visually communicates horizontal scrolling.

## Authenticated Home wallet affordance

Registered Free and 0nya Plus users must have a clear, restrained Home wallet affordance (top area) that opens **C01 Wallet**. Guests must not see a misleading owned wallet balance/state. Keep monetization contextual; do not overload the Home header or turn Home into a storefront. (Android implementation belongs to a later UI batch.)

---

# 22. MULTI-SPOTLIGHT

The Home editorial stage is **Multi-Spotlight**, not a single Featured Hero.

Document:

- strict 9:16 posters
- horizontal manual swipe only
- real next-item peek (the actual next ordered CMS item)
- active footer with optional canonical title (CMS `showTitle`)
- compact **Watch** CTA
- no Info button inside Spotlight
- no Spotlight Resume (Continue Watching owns Resume/progress)
- no auto carousel / no decorative card / press / mount motion
- no `catalog[0]` fallback; ordered real CMS/API items only

Hero should feel cinematic, not like an ad banner.

---

# 23. CONTINUE WATCHING CARD

Visual:

```text
9:16 static video-derived still
small title
episode/resume metadata
thin teal progress bar 3–4px
```

When no resume history exists for the viewer, do not show an empty row. Keep the
Continue Watching section heading only if the surface expects it, and show the
compact new-user copy in place of cards:

```text
Start watching to continue here.
```

This copy is exact and must not be replaced with a Watch History screen or a
reintroduced history label. The underlying progress/resume infrastructure
remains unchanged.

Progress:

```text
track: subtle
fill: teal
height: 3–4
```

Do not add lock icon unless access is re-resolved and the UI intentionally needs it.

This card is a resume treatment, not a discovery poster. It stays static in MVP.

---

# 24. EXPLORE / SEARCH

Search input:

```text
full width
elevated dark surface
subtle border
search icon
clear action when text exists
```

Filter chips:

```text
small
scrollable row
selected = subtle teal background/border
unselected = elevated black/bone
```

Do not make every filter a full-width dropdown.

---

# 25. CONTENT GRID

Recommended portrait layout:

```text
3 columns on common phones if readable
2 columns on narrow/small devices
```

Use responsive calculation.

Do not hardcode a fixed phone width.

Poster title:

```text
below image
2 lines max
```

Format badge:

```text
small
quiet
```

---

# 26. SERIES DETAIL — D01

Hierarchy:

```text
Artwork
Title
Metadata
Synopsis
Primary Watch/Resume CTA
Episodes CTA
Related
```

This is a lightweight series hub, not an embedded episode catalog.

Episodes should feel functional, not promotional.

Episode state labels must be backend-driven.

Examples:

```text
Free
Unlocked
9 Coins
Watch Ad
Plus
Coming Soon
```

Only show states actually valid for the viewer/configuration.

---

# 27. EPISODE ROW

Recommended structure:

```text
episode number
title
duration / metadata
access state / action
```

Keep touch target at least 48 high.

Current/playing episode:

```text
subtle teal indicator
```

Do not use large padlock artwork.

For V03, use the compact same-screen Episode Tray anchored over D01, with range controls derived from the published episode collection and the initial view centered near the viewer's resume context when multiple ranges exist. Keep the tray compact and content-aware; do not imply that every episode must render at once, and do not reintroduce a giant full-screen episode browser for MVP.

---

# 28. MICRO-DRAMA PLAYER

The player is the most visually minimal screen.

Default:

```text
video only
```

Tap:

```text
controls overlay
```

Controls overlay:

```text
smooth top/bottom black gradient (no visible bands)
bone controls
teal progress position
```

Do not permanently display UI on top of the video.

No:

```text
Like
Comment
floating coin badge
bottom nav
mid-roll banner
```

---

# 29. PLAYER CONTROLS

Recommended controls:

```text
Back
Series title (primary) / Episode number (secondary)
Play/Pause
Seek
Episodes
Share
Playback settings (gear icon, outermost right: speed, quality, captions)
```

Settings stays the outermost top-right control; Share sits immediately to its
left. Do not show controls that are not actually implemented.

CC/Subtitles and Quality are not separate top-level buttons; they live inside
the Playback settings sheet. If no real subtitle tracks exist for the current
source:

```text
omit the Captions row
```

If manual quality selection is missing:

```text
omit selectable quality controls
```

rather than showing a dead button.

Current quality behavior:

```text
Guest / Free: Auto/adaptive playback with a 720p maximum ceiling
0nya Plus: Auto/adaptive playback with a 1440p / 2K maximum ceiling
```

Quality controls must render only actual available renditions or a truthful Auto/adaptive state. Do not add 4K UI.

---

# 30. PLAYER PROGRESS BAR

Use:

```text
thin track
teal active portion
larger invisible touch target
```

Do not make the bar visually thick.

On preview/locked playback, progress behavior should not misrepresent inaccessible duration.

---

# 31. AUTO-NEXT — V04

Seamless: no overlay, no countdown, no "Playing in...", no Play Now/Cancel
buttons.

```text
episode completes
-> save final progress
-> resolve next sequential episode's existing access state
-> canWatch: start immediately
-> requires access: existing EpisodeAccessOptions/paywall immediately
-> unreleased-next or true final episode: existing Replay/Back completion
   state (message only differs)
```

The transition itself should feel immediate and cinematic; no large
transition screen.

---

# 32. LOCKED PREVIEW — W01

At preview end:

```text
freeze/pause current frame
dark overlay
short locked message
See Options
```

Avoid abruptly replacing the video with a bright commerce page.

Transition into W02 should feel connected to the content.

---

# 33. DYNAMIC PAYWALL — W02

This is a decision screen, not an advertising screen.

Hierarchy:

```text
Episode context
"Choose how to unlock"
Available methods
Not now
```

## Paywall option card

Structure:

```text
icon
method name
one-line explanation
price / relevant value
chevron or CTA
```

Examples:

```text
Unlock with 9 Coins
Watch an Ad to Unlock
Get 0nya Plus
```

Only show backend-enabled methods.

---

# 34. PAYWALL VISUAL PRIORITY

If backend/product does not provide a "recommended" method:

> Do not invent one.

Render options with comparable hierarchy.

If a future backend-approved `recommended_method` is added, it may receive a subtle:

```text
Recommended
```

label.

Do not default to making Plus visually dominant merely because it generates subscription revenue.

---

# 35. COIN VISUAL LANGUAGE

Coins should feel like a simple digital utility, not a game currency.

Use:

```text
small coin glyph
numeric balance
teal/bone treatment
```

Avoid:

```text
gold casino styling
sparkles
coin explosions
confetti every purchase
slot-machine motion
```

Wallet balance can be prominent, but restrained.

---

# 36. WALLET — C01

C01 Wallet is the primary consumer-facing Micro Drama wallet / access hub.
For a locked Micro Drama episode, access methods (W02) are presented
contextually through Wallet; Add Coins is offered contextually inside Wallet
when the viewer's coin balance is insufficient.

## Wallet visual sequencing rule

```text
FUNCTIONAL CONSOLIDATION FIRST
   -> stabilize Micro Drama access journey through Wallet
   -> verify Coin / Rewarded / Plus / Add Coins / exact return-context
VISUAL REDESIGN SECOND
   -> final C01 Wallet UI/UX redesign only after functional consolidation is stable
```

The CURRENT C01 Wallet UI is **NOT FINAL VISUAL AUTHORITY**. Do not visually
redesign it during the functional consolidation pass. Do not invent the final
detailed Wallet layout until functional consolidation is complete.

## Wallet final visual principles (Quiet Cinema)

When the final Wallet visual redesign runs under B04, it must follow Quiet
Cinema:

- flat hierarchy (no oversized bordered dashboard cards)
- restrained surfaces
- strong balance readability
- clean ledger / activity presentation
- no aggressive commerce treatment
- no gamified coin styling, no confetti, no sparkles

## Existing Wallet content structure (unchanged by this pass)

Hierarchy:

```text
Wallet
Coin balance
Buy Coins
Recent activity
```

Coin balance:

```text
large number
small "Coins" label
```

Transaction rows:

```text
description
date/metadata
+/- coin amount
```

Positive/negative must not rely only on color.

Use `+` and `−`.

---

# 37. BUY COINS — C02

Pack cards should show:

```text
coin amount
localized price
```

Do not hardcode visual "best value" unless the backend/store config explicitly supports it.

Do not display fake discounts.

---

# 38. REWARDED AD — A02/A03

A02 loading:

```text
quiet loading state
Preparing your unlock...
```

Do not simulate an ad.

Use SDK/provider UI when the actual ad is shown.

A03:

```text
simple success
Episode unlocked
Continue Watching
```

No excessive celebration.

---

# 39. 0NYA PLUS VISUAL LANGUAGE

Plus should feel premium but remain within the same brand.

Use:

```text
black
bone
teal
more negative space
subtle accent line / mark
```

Do not create:

```text
gold theme
purple theme
separate brand identity
VIP crowns
```

One product, one brand.

---

# 40. PLUS OFFER — S01

Hierarchy:

```text
0nya Plus
short value statement
benefits
plans
primary Continue
Restore Purchases
Terms / Privacy / billing disclosure
```

Benefits should be short.

Example:

```text
Eligible micro-drama episodes
Short films without ads
Coins stay yours
```

Do not over-promise.

---

# 41. SHORT FILM DETAIL — D02

Short Film Detail should feel more like a film page than an episode page.

Hierarchy:

```text
Artwork
Title
SHORT FILM label
duration/language/rating
creator/director
synopsis
Play
Share
Related
```

No lock or coin UI.

---

# 42. SHORT FILM PLAYER — F01

Use the same underlying visual player language where possible.

For non-Plus users:

Ad breaks should be represented only when actually occurring.

Do not put permanent:

```text
"Ad-supported"
```

banner over the video unless later approved.

Plus viewer:

```text
no short-film ad UI
```

---

# 43. SHORT FILM END — F02

Hierarchy:

```text
Film complete
Film title
Short completion helper
Send Chai appreciation action
Share / Replay
Related (only when items exist)
Home
```

Chai may be the most distinctive post-film action, but should not feel compulsory.

---

# 44. CHAI VISUAL LANGUAGE

Chai = appreciation.

Use a simple line-style cup/steam icon or existing equivalent.

Tone:

```text
warm
human
quiet
supportive
```

Do not use:

```text
money bag
cash
UPI
₹ symbol as Chai identity
donation guilt
creator hardship messaging
```

Chai is coin-based appreciation.

Implementation sync:

- In-player Chai is a compact, text-first, dark elevated control with restrained teal accent; it appears only in the final ~10 second short-film window and never blocks playback.
- F02 Chai remains a quiet appreciation action, not a sales-heavy conversion panel.
- The Chai sheet remains compact and contextual: wallet balance, backend-provided coin amounts, and one confirmation CTA.
- Avoid emoji, gaming treatment, glow/gold styling, donation language, or cash framing.

---

# 45. CHAI AMOUNT — T01

Use configurable amount chips/cards.

Example:

```text
5
10
20
50
Coins
```

Selected amount:

```text
teal border/background tint
clear check/selected state
```

Always show wallet balance.

---

# 46. CHAI SUCCESS — T02

Success should be simple:

```text
✓
Chai sent
20 Coins
Thank you for supporting the film.
```

No confetti required.

---

# 47. PROFILE VISUAL SYSTEM

Profile should be list-based and quiet.

Use:

```text
section headers
rows
dividers
account status
```

Avoid dashboard cards everywhere. The same flat-list principle applies to
Settings, Wallet, and Episode lists: spacing-based grouping, subtle dividers,
and restrained borders rather than oversized bordered cards.

Account state should be immediately clear:

```text
Guest
Free
0nya Plus
```

---

# 48. SETTINGS ROW

Structure:

```text
label
optional helper
value / switch / chevron
```

Touch height:

```text
48 minimum
```

Use native switch behavior where possible.

Marketing notification default:

```text
OFF
```

---

# 49. MODALS / BOTTOM SHEETS

Use bottom sheets for contextual actions such as:

```text
Episode List
Chai Amount
compact account/action selection
```

Use full screens for:

```text
OTP
Coin Purchase
Plus Offer
Settings
Delete Account
```

Do not put complex billing flows into tiny bottom sheets.

---

# 50. SHEET VISUAL

Recommended:

```text
black/elevated background
20–24 top radius
drag handle optional
safe-area bottom
```

Avoid frosted-glass dependence.

---

# 51. CONTENT RATING BADGES

Use compact text badges.

Examples:

```text
U
U/A 7+
U/A 13+
U/A 16+
A
```

Style:

```text
small border
bone text
no playful color coding
```

Descriptors live beside/below as text.

---

# 52. LOADING / SKELETON

Skeletons should match final geometry.

Use:

```text
dark gray / elevated surfaces
subtle shimmer only if already supported
```

Do not introduce a package solely for shimmer.

Skeleton examples:

```text
hero
poster card
episode row
wallet balance
search result
```

---

# 53. EMPTY STATES

Empty states should be:

```text
short
helpful
actionable
```

Example:

```text
No results
Try another title, genre, or creator.
```

Do not use cartoon illustrations unless later approved.

---

# 54. ERROR STATES

Use calm language.

Avoid:

```text
Oops!
Something went terribly wrong!
```

Prefer:

```text
Playback interrupted
We couldn't continue this video.
[Try Again]
```

Primary recovery action should be obvious.

---

# 55. OFFLINE STATE

If cached content exists:

```text
show cache
small Offline indicator
```

If no usable cache:

```text
X01
```

Offline badge:

```text
muted
compact
non-blocking
```

---

# 56. MOTION SYSTEM

Motion should feel subtle and cinematic.

Recommended durations:

```text
micro interaction       120–160ms
button/selection        140–180ms
sheet/modal             220–280ms
screen transition       220–320ms
fade overlay            180–240ms
```

Use platform easing/native animation where possible.

---

# 57. MOTION RULES

Use motion for:

```text
state confirmation
screen continuity
sheet entrance
player controls
selection
```

Do not use motion for:

```text
constant decoration
coin bouncing
poster wobble
unnecessary parallax
autoplay animation on every card
```

Respect reduced-motion settings.

---

# 58. HAPTICS

Use only if existing app/platform utility already exists.

Appropriate:

```text
successful unlock
Chai sent
purchase success
critical toggle
```

Avoid haptic feedback on every tap.

Do not add a package solely for haptics unless approved.

---

# 59. FOCUS / PRESSED STATES

Every interactive element must have a visible pressed/focus state.

Pressed:

```text
slight opacity/surface change
```

Focus:

```text
teal outline or platform-native focus
```

Do not remove native accessibility focus indication.

---

# 60. ACCESSIBILITY

Target:

```text
WCAG-informed contrast
dynamic text support
clear focus order
screen reader labels
minimum touch targets
safe areas
non-color-only state
```

Recommended minimum touch target:

```text
44x44 iOS
48x48 Android
```

Where cross-platform component is shared:

```text
prefer 48x48
```

---

# 61. TEXT CONTRAST

Primary text:

```text
Bone White
```

Secondary text must remain readable.

Do not use extremely low-opacity gray for essential information.

Disabled ≠ invisible.

---

# 62. PLAYER ACCESSIBILITY

Provide accessible labels for:

```text
Play
Pause
Seek
Episodes
Playback settings
Captions
Share
Back
```

Subtitle controls must be reachable.

Do not rely only on icons with no accessible label.

---

# 63. RESPONSIVE MOBILE RULES

Design mobile-first.

Test at least:

```text
small Android phone
common 6.1–6.5" phone
large Android phone
iPhone notch/Dynamic Island class
```

Do not assume one 390px-wide artboard.

---

# 64. TABLET

Tablet is secondary for MVP.

Use responsive margins and card sizing.

Do not build a separate tablet IA unless actual usage/product scope requires it.

---

# 65. DARK MODE

The consumer app is designed as a dark-first cinematic experience.

Primary theme:

```text
dark
```

Do not create a light theme during Build 15 unless explicitly approved.

---

# 66. DESIGN TOKENS — CONCEPTUAL

Copilot should map these to the project’s existing token/theme structure.

```ts
const colors = {
  background: '#050505',
  surface: '#0B0B0B',
  elevated: '#111111',
  bone: '#E8E4DA',
  teal: '#0DD1BC',
  tealHighlight: '#4DE5D2',
}
```

Spacing:

```ts
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}
```

Radius:

```ts
const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  sheet: 24,
  pill: 999,
}
```

These are conceptual.

If equivalent tokens already exist:

> reuse them.

Do not duplicate theme systems.

---

# 67. COMPONENT STATE MATRIX

## Poster Card

```text
default
pressed
loading
unavailable
```

## Primary Button

```text
default
pressed
loading
disabled
```

## Paywall Option

```text
default
pressed
selected if needed
loading
unavailable -> usually omit
```

## Episode Row

```text
free
entitled
coin
rewarded
Plus
mixed methods
coming soon
current
```

All state labels come from actual data.

---

# 68. SCREEN-SPECIFIC VISUAL PRIORITY

## H01/H02

```text
content > monetisation
```

## E01/E02

```text
search/discovery > promotion
```

## D01

```text
watch/resume > episode browsing
```

## V01/V02

```text
video > everything
```

## W02

```text
clear unlock decision > selling
```

## C01/C02

```text
balance/transaction clarity > decoration
```

## S01

```text
value + billing clarity > hype
```

## F02/T01/T02

```text
appreciation > pressure
```

---

# 69. MICROCOPY TONE

0nya copy should be:

```text
short
calm
human
clear
non-judgmental
```

Prefer:

```text
Continue watching
Choose how to unlock
Watch an ad to unlock
Send Chai
Try again
```

Avoid:

```text
HURRY!
LIMITED TIME!!!
DON'T MISS OUT
YOU'RE LOSING ACCESS
ONLY ₹X TODAY!!!
```

unless a future approved promotion explicitly requires compliant campaign copy.

---

# 70. COMMERCE COPY

Never obscure billing.

Display:

```text
localized price
billing period
renewal behavior
store-managed status
```

where required.

Avoid dark patterns.

---

# 71. LOCK COPY

Good:

```text
Choose how to unlock
```

Avoid:

```text
PAY NOW TO CONTINUE
```

The tone should preserve the viewer’s relationship with the story.

---

# 72. ICON / LABEL FOR CONTENT FORMATS

Micro Drama:

```text
MICRO DRAMA
```

Short Film:

```text
SHORT FILM
```

Use text first.

Do not invent complex symbols requiring users to learn a new code.

---

# 73. BADGE LIMIT

Try to show no more than:

```text
1–2 small badges
```

on a card at one time.

If metadata can live below the card, prefer that.

---

# 74. DESIGN SYSTEM + EXISTING CODE RULE

Before creating a new component:

1. search for an equivalent component
2. inspect existing styling
3. reuse if appropriate
4. refactor only if necessary
5. do not replace working infrastructure for visual purity

---

# 75. NO-COST / LOW-DEPENDENCY RULE

Do not add:

```text
paid design system
paid UI kit
paid animation SDK
paid icon package
paid font
paid theme service
```

without approval.

Prefer:

```text
existing components
React Native / Expo APIs
native platform controls
existing icon package
existing animation capability
simple custom components
```

---

# 76. PLAYER IMPLEMENTATION RULE

The actual repository audit found Android playback using `expo-video`.

Therefore:

> Preserve the existing `expo-video` implementation unless a later approved technical decision changes it.

The design system does not authorize replacing the player.

If a control is not currently supported by the actual player architecture:

```text
omit or mark implementation gap
```

Do not fake it.

---

# 77. BILLING IMPLEMENTATION RULE

Real Google Play Billing is partially implemented / externally blocked in the audited repo.

Therefore:

- Preserve the current Buy Coins, 0nya Plus, and Restore / Sync surfaces.
- Preserve the development billing harness boundary, which must never make the client wallet or Plus authority.
- Keep real store purchase-token verification, acknowledge/consume, product IDs, license testers, Play Billing Lab, restore reconciliation, refunds, revocation, and subscription lifecycle as externally blocked/incomplete until Play Console setup is proven.
- Do not silently replace the Google Play/AdMob architecture during visual UI work.

---

# 78. AD IMPLEMENTATION RULE

Current production AdMob account/ad-unit configuration is externally blocked, while the rewarded unlock code path exists for development/runtime verification.

Therefore:

- Keep A02/A03 tied to user-initiated rewarded unlock and server-side SSV confirmation.
- Do not mark production AdMob live until account/ad-unit configuration is proven.
- Do not insert pre-roll, mid-roll, or post-roll ads into micro-drama playback.
- Short-film ad controls remain CMS/backend-driven and suppressed for Plus.

---

# 79. FIGMA / VISUAL DESIGN ORDER

Recommended:

```text
01 H01/H02 Home
02 E01/E02 Explore
03 D01 Series Detail
04 V01/V02 Player
05 V03/V04 Episode / Auto-next
06 W01/W02 Locked / Paywall
07 R01/R02 Auth
08 C01/C02 Wallet / Coins
09 S01/S02 Plus
10 D02/F01/F02 Short Film
11 T01/T02 Chai
12 P01/P02/P03/P04 Profile/Settings
13 P05/P06 Subscription
14 G01/G02/G03 Compliance
15 X01–X04 Errors
16 L01/Q01
```

---

# 80. HIGH-FIDELITY HANDOFF RULE

A screen is ready for implementation when it has:

```text
screen ID
wireframe reference
final layout
tokens
component states
interaction states
loading state
empty state where relevant
error state where relevant
backend data requirements
accessibility notes
```

---

# 81. COPILOT IMPLEMENTATION INSTRUCTION

Before UI implementation, Copilot must read:

```text
docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md
docs/0nya_DESIGN_SYSTEM_v1.0.md
docs/0nya_APP_ARCHITECTURE_v1.0.md
docs/0nya_BACKEND_API_CONTRACT_v1.0.md
docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md
```

Read CMS contract when work touches backend/CMS-controlled values:

```text
docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md
```

---

# 82. MASTER UI IMPLEMENTATION PROMPT

```text
Read:

1. docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
2. docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
3. docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md
4. docs/0nya_DESIGN_SYSTEM_v1.0.md
5. docs/0nya_APP_ARCHITECTURE_v1.0.md
6. docs/0nya_BACKEND_API_CONTRACT_v1.0.md
7. docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md
8. .github/copilot-instructions.md

Do not start coding immediately.

First inspect the current implementation for the screen IDs I specify.

Then report:
- existing files/components
- what can be reused
- minimum files to change
- backend/API gaps
- visual-design gaps
- any conflict with the Product Bible

Implementation rules:
- Build only the specified screen IDs.
- Reuse existing components and architecture.
- Preserve expo-video.
- Do not introduce a new billing implementation.
- Do not introduce an ad SDK.
- Do not add paid dependencies.
- Do not hardcode backend-controlled product values.
- Do not perform broad refactors.
- Use 0nya design tokens.
- Respect safe areas and accessibility.
- Implement loading/error/pressed states where applicable.
- Do not commit or push unless explicitly told.

After implementation:
- run existing lint/typecheck/tests/build relevant to changed code
- list changed files
- list requirements satisfied
- list remaining gaps
```

---

# 83. DESIGN QA CHECKLIST

## Brand

- [ ] Background is predominantly matte black.
- [ ] Bone White is primary text.
- [ ] Teal is controlled, not overused.
- [ ] No unapproved brand colors dominate.

## Navigation

- [ ] Home / Explore / Profile only.
- [ ] Search is inside Explore.
- [ ] Active nav state is obvious.

## Cards

- [ ] Posters use consistent ratio.
- [ ] Titles are legible.
- [ ] Format is identifiable.
- [ ] No fake lock/price badges.

## Player

- [ ] Video remains visually dominant.
- [ ] Controls disappear when inactive.
- [ ] No Like/Comment.
- [ ] No interruptive micro-drama ads.

## Paywall

- [ ] Only valid methods appear.
- [ ] No invented recommended method.
- [ ] Coin price comes from backend.
- [ ] Not now / dismiss path exists.

## Coins

- [ ] Utility-like, not casino-like.
- [ ] Wallet balance clear.
- [ ] No fake discounts.

## Plus

- [ ] Same 0nya brand.
- [ ] One tier.
- [ ] Billing clarity present.

## Short Films

- [ ] No coin lock.
- [ ] In-player Chai may appear in the final ~10 seconds, and F02 also offers Chai after completion.
- [ ] Plus removes ads.

## Accessibility

- [ ] Touch targets adequate.
- [ ] Contrast readable.
- [ ] Dynamic text considered.
- [ ] Icons have labels.
- [ ] State not conveyed by color alone.

---

# 84. AUTHORITY ORDER

If instructions conflict:

1. Current explicitly approved product decision
2. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
3. `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
4. `docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md`
5. `docs/0nya_DESIGN_SYSTEM_v1.0.md`
6. `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`
7. `docs/0nya_APP_ARCHITECTURE_v1.0.md`
8. `docs/0nya_BACKEND_API_CONTRACT_v1.0.md`
9. `docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md`
10. Repository AI instructions
11. Existing implementation conventions
12. AI preference

---

# 85. FINAL VISUAL DIRECTION

The test for every screen is:

> Does this feel like a premium cinema product made for the phone, or does it feel like another short-video app?

If the UI becomes:

```text
busy
badge-heavy
sales-heavy
bright
gamified
social
```

simplify it.

The intended 0nya visual experience is:

```text
matte black
beautiful imagery
bone typography
small controlled teal accents
clear actions
quiet motion
cinema first
```

---

# 86. VISUAL SIGN-OFF & FINAL ACCEPTANCE WORKFLOW

All visual sign-offs and design refinements must strictly follow the **Locked Final Acceptance Protocol** in `AGENTS.md`:

```
SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT LOOP (to tiniest detail) -> PHYSICAL ONEPLUS FINAL CHECK -> LOCK / VERIFIED COMPLETE
```

- **Emulator Screenshots:** Captured from emulator for proposed candidate states.
- **Product Owner + ChatGPT Review:** Mandatory visual refinement gate covering typography, hierarchy, spacing, alignment, margins, safe areas, geometry, image crop, icons, copy, buttons, visual balance, states, and CMS-fed presentation down to the smallest detail.
- **Physical OnePlus Check:** Hardware validation on real device (OnePlus 13R) occurs only after visual candidate approval.
- No AI coding or QA agent has authority to self-approve visual compliance or design completion.

*Final Acceptance Protocol synchronized — Product Owner approved — 2026-08-31*

---

**0nya · शून्य**

**DESIGN SYSTEM v1.0**
