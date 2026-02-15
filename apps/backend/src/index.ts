// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Backend Server Entry Point
// ─────────────────────────────────────────────────────────────

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';

import { config } from './config/index.js';
import { healthCheck } from './db/connection.js';
import { redis, redisHealthCheck } from './db/redis.js';
import { metricsRegistry, httpRequestDuration, httpRequestsTotal } from './services/metrics.service.js';

// Routes
import { authRoutes } from './routes/ui/auth.routes.js';
import { agentRoutes } from './routes/ui/agents.routes.js';
import { jobRoutes } from './routes/ui/jobs.routes.js';
import { dashboardRoutes } from './routes/ui/dashboard.routes.js';
import { agentV2Routes } from './routes/agent-v2/agent.routes.js';

// WebSocket
import { setupWebSocket } from './websocket/handler.js';

// Background jobs
import { startBackgroundJobs } from './jobs/scheduler.js';

// ═══════════════════════════════════════════════════════════════
// Server Setup
// ═══════════════════════════════════════════════════════════════

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024, // 10MB
});

// ═══════════════════════════════════════════════════════════════
// Plugins
// ═══════════════════════════════════════════════════════════════

await app.register(cors, {
  origin: config.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
});

await app.register(helmet, {
  contentSecurityPolicy: config.NODE_ENV === 'production',
});

await app.register(jwt, {
  secret: config.JWT_SECRET,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    return request.ip;
  },
});

await app.register(websocket);
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

// ═══════════════════════════════════════════════════════════════
// Request timing middleware
// ═══════════════════════════════════════════════════════════════

app.addHook('onRequest', async (request) => {
  (request as unknown as Record<string, unknown>).startTime = process.hrtime.bigint();
});

app.addHook('onResponse', async (request, reply) => {
  const startTime = (request as unknown as Record<string, bigint>).startTime;
  if (startTime) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
    const route = request.routeOptions?.url ?? request.url;

    httpRequestDuration.observe(
      { method: request.method, route, status_code: reply.statusCode },
      duration,
    );
    httpRequestsTotal.inc(
      { method: request.method, route, status_code: reply.statusCode },
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// Error handling
// ═══════════════════════════════════════════════════════════════

app.setErrorHandler(async (error, request, reply) => {
  // Zod validation errors
  if (error.name === 'ZodError') {
    return reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: JSON.parse(error.message),
      },
    });
  }

  // Rate limit
  if (error.statusCode === 429) {
    return reply.code(429).send({
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Too many requests' },
    });
  }

  // Log unexpected errors
  request.log.error(error, 'Unhandled error');

  return reply.code(error.statusCode ?? 500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// Health & Metrics endpoints
// ═══════════════════════════════════════════════════════════════

app.get('/health', async (_request, reply) => {
  const dbOk = await healthCheck();
  const redisOk = await redisHealthCheck();

  const status = dbOk && redisOk ? 200 : 503;

  return reply.code(status).send({
    status: status === 200 ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
    version: '1.0.0',
  });
});

app.get('/metrics', async (_request, reply) => {
  const metrics = await metricsRegistry.metrics();
  return reply.type('text/plain').send(metrics);
});

// ═══════════════════════════════════════════════════════════════
// Register Routes
// ═══════════════════════════════════════════════════════════════

await app.register(authRoutes);
await app.register(agentRoutes, { prefix: '/api' });
await app.register(jobRoutes, { prefix: '/api' });
await app.register(dashboardRoutes, { prefix: '/api' });
await app.register(agentV2Routes);
await setupWebSocket(app);

// ═══════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════

async function start(): Promise<void> {
  try {
    // Connect Redis
    await redis.connect();

    // Start background jobs
    startBackgroundJobs();

    // Listen
    await app.listen({ port: config.PORT, host: config.HOST });

    console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ███╗   ███╗ █████╗ ███████╗███████╗                ║
║   ████╗ ████║██╔══██╗██╔════╝██╔════╝                ║
║   ██╔████╔██║███████║███████╗███████╗                ║
║   ██║╚██╔╝██║██╔══██║╚════██║╚════██║                ║
║   ██║ ╚═╝ ██║██║  ██║███████║███████║                ║
║   ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝                ║
║                                                      ║
║   VISION Reap3r Backend v1.0.0                       ║
║   Port: ${String(config.PORT).padEnd(45)}║
║   Env: ${String(config.NODE_ENV).padEnd(46)}║
║                                                      ║
╚══════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    await app.close();
    await redis.quit();
    process.exit(0);
  });
}
