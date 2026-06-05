FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Root workspace files
COPY package*.json ./
COPY packages/hh-core/package*.json    ./packages/hh-core/
COPY packages/hh-fhir/package*.json    ./packages/hh-fhir/
COPY packages/hh-billing/package*.json ./packages/hh-billing/
COPY packages/hh-whatsapp/package*.json ./packages/hh-whatsapp/
COPY apps/web/package*.json            ./apps/web/

RUN npm ci --workspace=@hh/web --include-workspace-root

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY packages/hh-core     ./packages/hh-core
COPY packages/hh-fhir     ./packages/hh-fhir
COPY packages/hh-billing  ./packages/hh-billing
COPY packages/hh-whatsapp ./packages/hh-whatsapp
COPY apps/web             ./apps/web

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static      ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public            ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
