# syntax=docker/dockerfile:1
# 0nya backend/CMS container image (Next.js App Router, Node runtime).
#
# Uses the repository's existing `npm ci` / `npm run build` / `npm run start`
# architecture. Next.js `output` mode is intentionally left at its default;
# the standard Next production server is used.
#
# Cloud Run compatibility:
#   - `next start` reads the PORT environment variable (Commander `.env('PORT')`)
#   - `next start` binds 0.0.0.0 (passed explicitly below)
#
# Secrets are never baked in: no .env* file is copied (see .dockerignore), only
# intentionally-public NEXT_PUBLIC_* values are accepted as build args, and the
# build-time Supabase server key is passed as a BuildKit secret mount.

# ---------------------------------------------------------------------------
# Stage 1 - full dependency install (build + runtime deps) from package-lock
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2 - production build (next build)
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Public, client-inlined values only. Never pass server secrets as build args.
ARG NEXT_PUBLIC_SUPABASE_URL=https://grxflnpofubqddtltkoe.supabase.co
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_4_5PsKWA78d_J56Dx0jtDg_qXtn9HHN
ARG NEXT_PUBLIC_ONYA_CANONICAL_URL=https://onya-qa-api-gwkke6nq5a-el.a.run.app
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_ONYA_CANONICAL_URL=${NEXT_PUBLIC_ONYA_CANONICAL_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `generateStaticParams` in /series/[slug] and /watch/[seriesSlug]/[episodeNumber]
# reads the catalog through the Supabase admin client, so a Supabase server key
# is required at build time. Both keys are supplied as BuildKit secrets (never
# build args), so they are not persisted in any image layer or in
# `docker history`. Precedence mirrors src/lib/supabase/admin.ts: provide
# whichever server credential the target environment actually uses.
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3 - runtime dependencies only (no devDependencies)
# ---------------------------------------------------------------------------
FROM node:24-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 4 - production runtime
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next ./.next

USER node

EXPOSE 8080

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
