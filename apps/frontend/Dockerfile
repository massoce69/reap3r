# ─────────────────────────────────────────────────────────────
# MASSVISION Reap3r - Frontend Dockerfile (Multi-stage)
# ─────────────────────────────────────────────────────────────

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_WS_URL=ws://localhost:4000

RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S massvision && \
    adduser -S massvision -u 1001

COPY --from=builder /app/public ./public

# Next.js standalone output
COPY --from=builder --chown=massvision:massvision /app/.next/standalone ./
COPY --from=builder --chown=massvision:massvision /app/.next/static ./.next/static

USER massvision

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]
