# ─────────────────────────────────────────────────────────────
# MASSVISION Reap3r - Backend Dockerfile (Multi-stage)
# ─────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY ../../package.json ../../package-lock.json* ./
COPY ../../tsconfig.base.json ./

# Copy shared package
COPY ../../packages/shared ./packages/shared

# Copy backend
COPY . ./apps/backend

# Install dependencies
RUN npm install --workspace=apps/backend --include-workspace-root

# Build shared package first
RUN npm run build -w packages/shared 2>/dev/null || true

# Build backend
WORKDIR /app/apps/backend
RUN npx tsc --outDir dist

# Stage 2: Production
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Copy built files
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/src/db/migrations ./dist/db/migrations

# Install production dependencies only
RUN npm install --production --ignore-scripts

# Security: non-root user
RUN addgroup -g 1001 -S massvision && \
    adduser -S massvision -u 1001
USER massvision

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
