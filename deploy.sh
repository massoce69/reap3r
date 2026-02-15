#!/bin/bash
# Quick deployment script for MASSVISION Reap3r

set -e

echo "🚀 Deploying MASSVISION Reap3r..."

# Navigate to project directory
cd /opt/massvision-reap3r

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.simple.yml down || true
docker compose -f docker-compose.prod.yml down || true

# Remove old images to force rebuild
echo "🗑️  Cleaning old images..."
docker compose -f docker-compose.simple.yml rm -f || true

# Start services with simple compose
echo "🔨 Building and starting services..."
docker compose -f docker-compose.simple.yml up -d --build

# Show status
echo "✅ Deployment complete!"
echo ""
echo "📊 Services status:"
docker compose -f docker-compose.simple.yml ps

echo ""
echo "📝 View logs with:"
echo "  docker compose -f docker-compose.simple.yml logs -f [service]"
echo ""
echo "🌐 Access URLs:"
echo "  Frontend: http://$(hostname -I | awk '{print $1}'):3000"
echo "  Backend:  http://$(hostname -I | awk '{print $1}'):4000"
echo "  Grafana:  http://$(hostname -I | awk '{print $1}'):3001"
