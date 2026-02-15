// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Prometheus Metrics
// ─────────────────────────────────────────────────────────────

import client from 'prom-client';

// Create registry
export const metricsRegistry = new client.Registry();

// Default metrics
client.collectDefaultMetrics({ register: metricsRegistry });

// ═══════════════════════════════════════════════════════════════
// Custom Metrics
// ═══════════════════════════════════════════════════════════════

export const httpRequestDuration = new client.Histogram({
  name: 'massvision_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestsTotal = new client.Counter({
  name: 'massvision_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

export const agentsOnlineGauge = new client.Gauge({
  name: 'massvision_agents_online',
  help: 'Number of agents currently online',
  labelNames: ['organization_id'],
  registers: [metricsRegistry],
});

export const agentsTotalGauge = new client.Gauge({
  name: 'massvision_agents_total',
  help: 'Total number of agents',
  labelNames: ['organization_id', 'status'],
  registers: [metricsRegistry],
});

export const jobsCreatedCounter = new client.Counter({
  name: 'massvision_jobs_created_total',
  help: 'Total jobs created',
  labelNames: ['type', 'organization_id'],
  registers: [metricsRegistry],
});

export const jobsCompletedCounter = new client.Counter({
  name: 'massvision_jobs_completed_total',
  help: 'Total jobs completed',
  labelNames: ['type', 'status', 'organization_id'],
  registers: [metricsRegistry],
});

export const jobDurationHistogram = new client.Histogram({
  name: 'massvision_job_duration_seconds',
  help: 'Duration of jobs in seconds',
  labelNames: ['type'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [metricsRegistry],
});

export const agentHeartbeatCounter = new client.Counter({
  name: 'massvision_agent_heartbeats_total',
  help: 'Total agent heartbeats received',
  registers: [metricsRegistry],
});

export const enrollmentCounter = new client.Counter({
  name: 'massvision_enrollments_total',
  help: 'Total agent enrollments',
  labelNames: ['status'],
  registers: [metricsRegistry],
});

export const wsConnectionsGauge = new client.Gauge({
  name: 'massvision_ws_connections',
  help: 'Active WebSocket connections',
  registers: [metricsRegistry],
});

export const remoteSessions = new client.Gauge({
  name: 'massvision_remote_sessions_active',
  help: 'Active remote sessions (shell + desktop)',
  labelNames: ['type'],
  registers: [metricsRegistry],
});
