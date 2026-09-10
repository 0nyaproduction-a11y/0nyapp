# Session Restore — 0nya B04 Home Visual Audit

Copy the prompt block below into a new session to restore this exact context.

---

## Session-restore prompt (paste into a new session)

```
CONTEXT RESTORE — 0nya B04 Home visual audit

REPOSITORY: C:\Users\Akash\Documents\0nyapp

TASK (READ ONLY — no code, no CMS, no DB, no git changes):
VERIFY whether the CURRENT Home screen uses the approved B04 Quiet Faceted
Cinema visual/semantic system consistently with the rest of the app.

B01 Home is VERIFIED COMPLETE / LOCKED BASELINE — do NOT redesign or alter it.
Audit only whether the current rendered Home correctly uses B04.

Finish a read-only B04 source + runtime visual audit of the Home screen and
produce the standard report:
STATUS / EVIDENCE (screenshots + PASS items + exact mismatches + shared-token vs
local override + affected file/token per mismatch) / ROOT CAUSE / NEXT.
STOP after screenshots + report. Do NOT implement fixes.

AUTHENTICATED BROWSER PROFILE: 0@0nya.com (Free account, Wallet 100 coins),
logged in on https://members-vary-cluster-dome.trycloudflare.com/
Historical evidence only: this Cloudflare tunnel was temporary and
non-authoritative. Do not reuse it; the current QA backend authority is Cloud
Run (`https://onya-qa-api-gwkke6nq5a-el.a.run.app`).
Current B04 status was: READY FOR OWNER/CHATGPT REVIEW — screenshots already
captured at ui-audit/b04-home/ (1-header-spotlight-top, 2-spotlight-next-peek,
3-continue-watching, 4-start-here-new-releases, 5-short-films-micro-dramas,
6-bottom-navigation). All screenshots verified distinct. If they still exist,
you may re-verify them rather than re-capture.

B04-VIS verified PASS items already established (re-verify against current
source before trusting): Cinema Canvas #030504; S0/S1/S2/S3 surfaces; muted teal
#2B7E7D interaction only; #47746F secondary; #B91825 red only for Plus (0 red on
Home); #FEFDFD Soft White text; no neon #0DD1BC/#4DE5D2; no glow/blur/noise;
poster radius ~8dp (radii.poster); strict 9:16 artwork everywhere; H3 18/600
section titles; restrained wallet affordance (authenticated only); Spotlight
width formula Math.round(min(260,max(220,usableWidth*0.67))) gap 12 with real
next-card peek; Continue Watching 3px teal progress on subtle track; Watch CTA
teal 9dp 48px; bottom nav teal active on matte surfaces.s0 with subtle top
border; safe areas via SafeAreaView; all Home visuals consume shared
theme/tokens.ts — no Home local B04 color/typography override.

AUTHORITY (read before editing; obey Locked Final Acceptance Protocol):
- AGENTS.md
- docs/agent-state/APP_COMPLETION_ROADMAP.md
- docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md (esp. 2026-09-03 B04-VIS supersession)
- docs/0nya_DESIGN_SYSTEM_v1.0.md (§3–§24, §21 Home, §22 Multi-Spotlight, §23 CW)
- docs/agent-state/ANDROID_CURRENT_STATE.md
- .claude/skills/0nya-execution, 0nya-current-state, 0nya-android,
  0nya-ui-compliance

KEY SOURCE FILES:
- apps/android/src/screens/HomeScreen.tsx (Home render)
- apps/android/src/theme/tokens.ts (shared B04 tokens, colors/surfaces/radii)
- apps/android/src/components/Screen.tsx (S0 canvas + safe area + margins)
- apps/android/src/components/ui.tsx (shared Button/BrandWordmark)
- apps/android/src/navigation/MainTabs.tsx (bottom nav active teal on matte)

KNOWN NOTE: This agent model cannot view images, so visual verification was done
at SOURCE + RUNTIME level via computed styles/geometry (JS DOM probes), with
screenshots still captured for the Product Owner + ChatGPT visual-review gate.

WORKING TREE: branch qa/netlify-api-e34ab5e, many uncommitted B04 changes across
Android + docs — do not clobber (obey 0nya-git-safety).
```

---

## Notes

- If the prior session's chat transcript is available to you, tell the assistant
  it may reference it.
- Confirm the browser profile is still authenticated before trusting runtime
  evidence.
- Status on last session close: `READY FOR OWNER/CHATGPT REVIEW` (source +
  runtime verified; screenshots captured; no code/CMS/DB/git changes made).
