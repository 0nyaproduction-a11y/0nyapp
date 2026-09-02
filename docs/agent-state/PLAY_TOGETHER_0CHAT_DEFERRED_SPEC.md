# 0nya Plus Play Together / 0chat — Source Foundation and Integration Specification

> **IMPLEMENTATION PREPARATION / NAVIGATION AID ONLY**
>
> This document is a **preparation** artifact, not a product authority. It sits
> behind this authority ladder (highest first):
>
> 1. Explicitly approved current product decisions.
> 2. Root `AGENTS.md`.
> 3. `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md` §36 (the locked Play Together / 0chat rules).
> 4. `docs/agent-state/APP_COMPLETION_ROADMAP.md` §20 (PX01 roadmap placement).
> 5. This document (integration preparation).
> 6. Current verified implementation.
>
> This document does not activate or deploy PX01. Current uncommitted source
> includes a backend/migration foundation; it remains distinct from applied
> runtime, realtime Android synchronization, and Android chat UI, which are
> unverified/not implemented.
>
> **Name note:** The previous internal name "Wanna Chat" is superseded by
> **0chat**. Do not retain "Wanna Chat" as the current product name anywhere in
> this specification. Any historical reference to "Wanna Chat" exists only to
> document the supersession.

---

## 1. Status

```
APPROVED / SOURCE FOUNDATION PRESENT
RUNTIME, REALTIME AND ANDROID CHAT UI UNVERIFIED
REQUIRES PRODUCT OWNER ACTIVATION FOR CONSUMER RELEASE
```

The current active roadmap batch remains **B02 — Auth Integrity and Context Preservation**.
PX01 does not alter, pause, or reclassify any existing batch.

See `docs/agent-state/APP_COMPLETION_ROADMAP.md` §20 for the activation-gated
implementation plan (PX01-A through PX01-I).

---

## 2. Project locations (repository-relative)

All paths are relative to the Git repository root
(`C:/Users/Akash/Documents/0nyapp`).

| Subsystem | Path | Role |
| --- | --- | --- |
| Android consumer app | `apps/android/` | React Native / Expo (SDK 57) |
| Android source | `apps/android/src/` | Screens, navigation, player |
| Android screens | `apps/android/src/screens/` | Screen components |
| Android player | `apps/android/src/player/` | `expo-video` player (PRESERVE) |
| Android navigation | `apps/android/src/navigation/` | React Navigation, deep links |
| Android API/client layer | `apps/android/src/lib/`, `apps/android/src/types/` | API facade, types, billing |
| Web/backend/API | `src/` | Next.js (App Router) root |
| API routes | `src/app/api/v1/` | Android-facing API routes |
| Backend/domain helpers | `src/lib/` | Entitlements, playback, monetization, catalog |
| CMS/admin | `src/app/admin/`, `src/components/cms/`, `src/lib/cms/` | Editorial CMS |
| Supabase | `supabase/` | Schema + migrations + local config |
| Supabase migrations | `supabase/migrations/` | Numbered SQL migrations |
| Canonical docs | `docs/` | Authority documents |
| Agent state | `docs/agent-state/` | Current-state snapshots |

**QA / remote:**

```
QA API / backend:   https://onya-qa-api-gwkke6nq5a-el.a.run.app  (Google Cloud Run)
QA CMS / admin:     same host, /admin/login
Database/data:      Supabase
Video/media:        Mux (approved)
Android playback:   expo-video (preserve)
```

**Out of scope for this task:** `0nya_autonomous/**` is a separate system and is
not the authority or location for any part of this specification. Do not inspect
or modify it unless the Product Owner explicitly assigns an Autonomous task.

---

## 3. Terminology

```
0nya Plus
   ↓
Play Together
   ↓
0chat
```

- **0nya Plus** — the single paid subscription tier (see Bible §15). An active Plus member has 0chat access included.
- **Play Together** — synchronized private co-viewing within a room (1 Host + max 1 Guest). NOT a renaming of any existing feature.
- **0chat** — the minimal private text communication layer inside an active Play Together room. It is NOT the name of the entire Play Together feature. (Supersedes the previous internal name "Wanna Chat".)

---

## 4. Locked V1 Product Rules

These are product decisions, locked in `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md` §36.
This section restates them for integration-planning context only; the Bible
always wins.

### Play Together V1

- Maximum 2 accounts per room; exactly 1 Host + maximum 1 Guest.
- 0chat capability (including room creation) is granted by the backend access resolver — active 0nya Plus includes 0chat access; Coin / Rewarded are alternative configured access paths for non-Plus users. The exact CREATE-vs-JOIN scope for Coin / Rewarded initiation is a **PRODUCT DECISION REQUIRED BEFORE PX01 IMPLEMENTATION**.
- A Registered Free or Plus account with backend-confirmed 0chat access may JOIN an invitation.
- The Guest does not need Plus merely to join.
- Every participant retains independent content entitlement; the Host's Plus entitlement NEVER transfers to the Guest.
- The backend remains authoritative for access.
- Micro-Drama episodes only in V1; Short Films are excluded from V1.
- The Host controls Play / Pause / Seek / episode transition; the Guest follows
  Host playback intent through one canonical room timeline/state.
- Every participant independently passes release / access / parental / playback authorization.
- Auto-Next has one authoritative room advance: current episode complete ->
  next sequential published episode -> per-participant authorization ->
  synchronized room transition. No two independent Auto-Next state machines.
- If the Guest lacks access, the room waits while the Guest completes normal access; a successful Auth / OTP / unlock returns the Guest to the SAME pending room.
- Play Together must never bypass entitlement.

### 0chat V1

0chat V1 is deliberately minimal:

```
PRIVATE
TWO PARTICIPANTS
TEXT ONLY
ROOM SCOPED
EPHEMERAL
```

Allowed: send text, receive text, restrained transient player message, compact chat panel, functional system messages.

NOT in V1: public comments, general-purpose DMs, followers/friends graph, public/group rooms, voice/video calls, image/file messages, permanent messaging inbox, reactions economy, social feed, Likes/Comments.

Room completion must not silently create a general-purpose messaging system.

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

0chat capability is granted by a backend/config-controlled access resolver,
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

- **0nya Plus** — Plus includes 0chat access (no additional Coin or Rewarded payment for the same eligible use). Do NOT create a second Plus tier, a 0chat subscription, or a separate currency.
- **Coin** — conceptual controls `0chat_coin_access_enabled` / `0chat_coin_price` (conceptual names only). The Android client must NOT hardcode the amount. Exact commercial duration/scope of a Coin 0chat unlock is a **PRODUCT DECISION REQUIRED BEFORE PX01 IMPLEMENTATION**.
- **Rewarded** — may be offered when backend/config enables it. Tap Watch Ad → explicit rewarded ad → trusted verification (AdMob SSV) → backend confirms 0chat access. Never a client timer or ad-close callback. Number of completions and grant duration/scope remain configurable / future PX01 decisions.

### Two independent access gates

0chat access and content/episode access are **separate** gates. A participant may
need BOTH.

```
0CHAT ACCESS   →  Coin / Rewarded / Plus
     AND
CONTENT ACCESS →  Free / Coin entitlement / Rewarded entitlement / Plus / release state
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

---

## 5. Current source foundation and room model

Uncommitted source includes additive PX01 migrations and API/domain work for
secure invite/redeem, rooms and participants, ordered room-scoped 0chat
messages, and backend-controlled access acquisition. Current source records
the approved backend-controlled Coin price and Plus bypass; the client must not
hardcode either. Room acquisition/access is separate from episode entitlement:
Host entitlement never transfers to a Guest and an invite never grants episode
entitlement.

This is not evidence that migrations have been applied, routes deployed, or
that realtime Android playback synchronization/chat UI exists.

The following model describes the required state behavior. It is not evidence
of deployed runtime behavior.

```
room_id
host_user_id
guest_user_id
content_id
episode_id
status
host_position
host_playback_state
state_version
created_at
expires_at
```

### Conceptual room states

```
waiting            — Host ready, waiting for Guest to join / 0chat access resolving
active             — Both participants present, playback synchronized
paused             — Host paused; Guest follows
waiting_for_access — A participant is completing 0chat or episode access; room holds
reconnecting       — A participant is temporarily unreachable
ended              — Host ended the room (or all participants left)
expired            — Room TTL elapsed
```

### Conceptual synchronization events

```
JOIN
LEAVE
PLAY
PAUSE
SEEK
SYNC
BUFFERING
EPISODE_CHANGE
WAITING_FOR_ACCESS
RECONNECT
END_ROOM
```

### Required synchronization hardening

Before production, specify and verify Host playback-intent authority, a
canonical state version/time reference, heartbeat/offset measurement, measured
drift correction, and buffering/reconnect/control policy. Do not hardcode a
drift threshold.

### Conceptual 0chat message

```
room_id
sender_user_id
message
sequence
created_at
```

### Account deletion/data verification

Before production 0chat, verify account deletion behavior for hosted and joined
rooms, participants, and messages, including actual FK/nullability behavior.
Do not invent retention or deletion-grace rules.

---

## 6. Prepared integration seams

Future Play Together reuses each existing subsystem rather than duplicating it.
No parallel systems are introduced.

```
Existing Auth
      ↓
Room participant identity  (Supabase Auth identity via getApiAuth, server-verified)

Existing 0chat access resolver
      ↓
Room capability / create / join permission  (Coin / Rewarded / Plus, fail-closed)

Existing 0nya Plus entitlement
      ↓
Included 0chat access (no extra payment for Plus)

Existing episode access resolver
      ↓
Independent participant content access  (canUserWatchEpisode per participant, server-side)

Existing playback authorization
      ↓
Independent playable source  (src/lib/playback.ts → Mux signed URLs)

Existing expo-video player
      ↓
Host-controlled synchronization  (Guest follows Host; no new player)

Existing Auto-Next
      ↓
Both-account next-episode resolution  (independent per participant)

Existing auth/return context
      ↓
Invite → Auth → same room  (return target preserved, like B02 context preservation)

Future room transport
      ↓
Room state + 0chat  (the ONLY new seam)
```

### Requirements (must NOT reimplement)

- NO parallel Auth system.
- NO parallel entitlement system.
- NO duplicate player.
- NO duplicate episode access resolver.
- NO separate Plus subscription product (0nya Plus remains the one and only tier).
- NO separate 0chat authentication architecture.
- NO second 100-coin welcome grant.

---

## 7. Future interface boundaries (conceptual)

These are architectural concepts only. **Do NOT add source stubs** during this
documentation-only step. Names are illustrative of the seam, not committed APIs.

```
createRoom()                  — Account with 0chat access creates a room for a content_id/episode_id + invite
joinRoom()                    — Invitee joins via invitation token; follows Host
leaveRoom()                   — Participant leaves; room ends if Host leaves
endRoom()                     — Host ends the room

resolve0chatAccess()          — Backend/config-controlled: Coin / Rewarded / Plus
subscribeToRoomState()        — Guest subscribes and applies Host playback state

send0chatMessage()            — Send a text (or system) message scoped to the room
subscribeTo0chat()            — Stream room-scoped chat messages
```

Integration notes:

- `createRoom` / `joinRoom` must resolve identity through `src/lib/api/auth.ts`
  (server-verified) and 0chat capability through the future `resolve0chatAccess()`
  backend boundary (fail-closed). The Host is the account that creates the
  room; the Guest joins via an invitation token. The Guest's access to the shared
  episode is resolved independently through `canUserWatchEpisode`.
- `publishPlaybackState` must not bypass `src/lib/playback.ts` playback
  authorization. The Host obtains a signed Mux playback URL through the existing
  `POST /api/v1/playback` boundary; the Guest independently resolves its own
  signed playback URL through the same boundary. The room transport only carries
  *state* (Play/Pause/Seek/position), never the media token.
- `subscribeToRoomState` drives the Guest's `expo-video` player
  (`apps/android/src/player/`) to mirror Host Play/Pause/Seek/position. The
  Guest's player must remain behind the same server-side playback
  authorization it uses for any other content.
- `resolveParticipantAccess` reuses `canUserWatchEpisode` and the parental/classification
  gates (`src/lib/classification.ts`, `src/lib/parental-controls.ts`) per
  participant. If the Guest lacks access, the room enters `waiting_for_access`
  and the existing access flow resolves it; on success the Guest returns to the
  SAME pending room (mirroring B02 context preservation).
- `send0chatMessage` / `subscribeTo0chat` are the only genuinely new seam and
  must remain room-scoped, two-participant, text-only, and ephemeral per the
  locked V1 rules.

---

## 8. Feature activation boundary

Future implementation requires an explicit server/config-controlled activation
boundary conceptually equivalent to:

```
play_together_enabled = false
```

This documentation step does **NOT** create or change any runtime flag. The
feature remains invisible to consumers until the Product Owner explicitly
activates PX01.

When activated, the activation should be server/config-controlled (not
client-authoritative) so that the feature can be toggled without a client release
and so that it never becomes client-authoritative for access (per AGENTS.md
rule 7).

---

## 9. Privacy / security preparation

Recorded as **POLICY / IMPLEMENTATION DECISION REQUIRED BEFORE PX01 RELEASE**.
Do NOT invent answers.

| Topic | Current status | Decision required before PX01 release |
| --- | --- | --- |
| Message retention | Unresolved | How long are 0chat messages retained server-side? |
| Room retention | Unresolved | How long are ended rooms retained? |
| Reporting / abuse | Unresolved | How does a participant report the other for 0chat content? |
| Blocking | Unresolved | Is blocking supported within a room? |
| Moderation | Unresolved | Is there server-side content moderation for 0chat text? |
| Room expiry | Conceptual (`expires_at`) | TTL for inactive/active rooms. |
| Invitation expiry | Unresolved | TTL for room invitation tokens. |
| Message size | Unresolved | Max characters per 0chat message. |
| Rate limits | Unresolved | Send rate limits per participant. |
| Reconnect window | Conceptual (`reconnecting`) | How long a room waits for a dropped participant to return. |
| Message transport security | Unresolved | Encryption in transit / at rest requirements for chat. |
| Age restrictions | Unresolved | Whether age-gated content interacts with Play Together. |

Security constraints that are already authoritative and must carry forward:

- Client is never authoritative for identity, wallet balance, coin credit,
  subscriptions, entitlements, pricing, or playback authorization
  (AGENTS.md rule 7; `src/lib/entitlements.ts`, `src/lib/playback.ts`).
- No service_role / signing keys / OTP secrets / provider secrets may be
  exposed to, stored in, or authored by the client.
- Room + 0chat transport must reuse server-verified identity from the existing
  Supabase Auth boundary rather than introducing a second identity path.
- Existing 100-coin welcome-coin grant is the only new-account coin grant;
  0chat must not create another.
- Rewarded 0chat access must reuse the existing AdMob SSV verification
  principles (`src/app/api/webhooks/admob/ssv/route.ts`); never a
  client-only completion flag.

---

## 10. Future implementation plan

Each slice is independently bounded and activation-gated.

```
PX01-A  Compatibility / read-only architecture audit
PX01-B  Room + realtime backend foundation
PX01-C  Android Play Together room shell
PX01-D  Playback synchronization
PX01-E  0chat
PX01-F  Auth / entitlement / Auto-Next / invite / return-context integration
PX01-G  Two-client emulator verification
PX01-H  Current screenshots
         → Product Owner + ChatGPT review
         → refinement loop (to tiniest detail)
PX01-I  Two-device physical verification (OnePlus 13R)
LOCK     only after full acceptance protocol
```

Lock ordering (from AGENTS.md):

- Consumer App: `SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT -> PHYSICAL ONEPLUS -> LOCK`.
- CMS: `CMS SOURCE/CONFIG -> DEPLOYED QA/API -> CMS WEBSITE -> SCREENSHOTS -> OWNER+CHATGPT REVIEW -> OWNER HANDS-ON CMS CHECK -> LOCK`.

No AI agent may self-approve final visual or operational deliverables.

---

## 11. Do-not-touch / preservation

This documentation-only milestone does not modify runtime. When PX01 is
eventually activated, it must not break these existing systems:

- `expo-video` player architecture and playback-source/controller stack.
- Playback authorization boundary (`src/lib/api.ts` authorizePlayback /
  `src/lib/playback.ts`).
- Guest history merge (sign-in data durability).
- Access / unlock UI (EpisodeAccessOptions, rewarded/coin) — client must not
  become authoritative.
- AdMob / UMP consent bootstrap (release compliance).
- Home rows / Spotlight / CMS Composer foundation.
- Account deletion cascade.
- Existing Supabase migration history.
- CMS admin auth / structure.
- Existing 100-coin welcome-grant RPC (`apply_welcome_coin_grant`).
- Existing rewarded SSV infrastructure.

## 12. Architecture principle

Future implementation should reuse existing infrastructure wherever safely
possible. Do not pre-select a third-party messaging SaaS. At PX01-B, first
determine whether the existing Supabase / realtime / backend architecture can
satisfy the realtime room-state and 0chat requirements. No recurring paid
dependency without explicit Product Owner approval.

## 13. Summary of this step

This step:

- Records the approved deferred product decision (Play Together / 0chat;
  "Wanna Chat" superseded by "0chat").
- Synchronizes PX01 roadmap placement (§20) and defers it behind major completion.
- Documents conceptual room / event / 0chat message models.
- Maps the integration seams onto the current architecture (Auth → 0chat
  resolver → episode access → playback authorization → expo-video → Auto-Next
  → auth/return context → future room transport).
- Records the feature-activation boundary (`play_together_enabled = false`).
- Records unresolved privacy / security / commercial decisions.
- Records the 0chat visual identity, link-first connection model, terminal →
  friendly transition, Guest discovery boundaries, and the welcome-coin boundary.

This step does NOT:

- Write or modify source code.
- Create, alter, or apply Supabase migrations.
- Create API routes.
- Introduce a runtime feature flag.
- Deploy.
- Select a paid realtime / chat service.
- Create an icon asset.
- Commit or push.
- Rename any existing source identifiers (e.g. `sendWannaChatMessage` in source
  must only be introduced during actual PX01 implementation, gated and named
  per 0chat conventions at that time).

---

## 14. Verification checklist (this documentation-only milestone)

- [ ] Only intended documentation files were changed (Product Bible §36,
      Roadmap §20, this new spec file).
- [ ] No runtime source was modified.
- [ ] No migrations were created or modified.
- [ ] No feature was activated (no `play_together_enabled` flag introduced at runtime).
- [ ] Current active roadmap batch (B02) is unchanged.
- [ ] Play Together / 0chat terminology is consistent across all docs.
- [ ] No active "Wanna Chat" terminology remains except deliberate supersession notes.
- [ ] Product Bible remains the product authority (this spec is subordinate).
- [ ] PX01 is clearly labeled DEFERRED and activation-gated.
- [ ] This spec states it is non-authoritative preparation.
- [ ] Project locations use repository-relative paths.
- [ ] `git diff --check` passes for all tracked target files.
- [ ] Two independent access gates (0chat ≠ episode) are documented.
- [ ] Existing 100-welcome-coin rule is preserved; no 0chat coin bonus.
- [ ] Host/Guest playback control and Plus-non-transfer rules preserved.
- [ ] V1 room capacity remains maximum 2 participants.
