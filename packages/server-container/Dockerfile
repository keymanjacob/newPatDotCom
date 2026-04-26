# ─────────────────────────────────────────────────────────────────────────────
# Baby Tracker — Container API
#
# Build context MUST be the monorepo root (newPatDotCom/):
#   docker build -f packages/server-container/Dockerfile -t baby-tracker-api .
#
# Or via the package script (which sets the context automatically):
#   pnpm --filter @baby-tracker/server-container docker:build
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first — maximises layer cache reuse.
# Only re-runs pnpm install when these files change.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json           ./packages/shared/
COPY packages/server-container/package.json ./packages/server-container/

RUN pnpm install --frozen-lockfile

# Copy source after install so code changes don't bust the dep cache.
COPY packages/shared/src           ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

COPY packages/server-container/src           ./packages/server-container/src
COPY packages/server-container/tsconfig.json ./packages/server-container/

# Build shared first (server-container imports from its dist)
RUN pnpm --filter @baby-tracker/shared build
RUN pnpm --filter @baby-tracker/server-container build

# Create a self-contained production deployment directory.
# pnpm deploy inlines workspace deps (shared/dist) into node_modules —
# the runner stage needs no workspace layout at all.
RUN pnpm --filter @baby-tracker/server-container deploy --prod /app/deploy

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Self-contained: dist/ + flattened node_modules/ with shared inlined
COPY --from=builder /app/deploy .

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
