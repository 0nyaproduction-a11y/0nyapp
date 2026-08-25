<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 0nya project authority

1. Product/UI/user-flow authority order: explicitly approved current product decision; docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md; docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md; repository AI instructions; existing implementation conventions; AI preference.
2. The Product + UI/UX Bible wins over the Master User Flow on conflict.
3. Before consumer UI, UX, navigation, player, paywall, wallet, monetisation, short-film, profile, deep-link, account, or error/recovery work, read both docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md and docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md.
4. Do not silently reinterpret LOCKED rules.
5. Treat CONFIG values as backend/CMS/store-controlled and do not hardcode them into clients.
6. Preserve existing working architecture unless required by the authority documents or security/correctness.
7. Never make the mobile/web client authoritative for user identity, wallet balance, coin credit, entitlements, subscriptions, pricing, payment verification, rewarded-ad rewards, or playback authorization.
8. Never expose service_role or secrets.
9. Do not add paid dependencies/services without explicit approval.
10. Do not perform broad refactors merely because generated code prefers a different architecture.
