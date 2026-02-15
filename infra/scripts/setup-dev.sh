#!/bin/bash
# ─────────────────────────────────────────────────────────────
# MASSVISION Reap3r - Development Setup Script
# ─────────────────────────────────────────────────────────────

set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║  MASSVISION Reap3r - Development Setup       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📄 Created .env from .env.example"
else
  echo "📄 .env already exists"
fi

# Start infrastructure (PostgreSQL + Redis)
echo ""
echo "🐳 Starting PostgreSQL and Redis..."
docker compose up -d postgres redis
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check health
docker compose ps

# Install npm dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Run database migrations
echo ""
echo "🗃️  Running database migrations..."
cd apps/backend
npx ts-node --transpile-only src/db/migrate.ts
cd ../..

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Setup Complete!                          ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Start backend:   npm run dev -w apps/backend║"
echo "║  Start frontend:  npm run dev -w apps/frontend║"
echo "║                                              ║"
echo "║  Frontend: http://localhost:3000              ║"
echo "║  Backend:  http://localhost:4000              ║"
echo "║                                              ║"
echo "║  Login: admin@massvision.io / Admin@123456   ║"
echo "╚══════════════════════════════════════════════╝"
