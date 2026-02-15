// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Agent Service
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryMany, query, transaction } from '../db/connection.js';
import { redis } from '../db/redis.js';
import { config } from '../config/index.js';
import { createAuditLog } from './audit.service.js';
import type {
  Agent,
  AgentListItem,
  PaginationMeta,
  EnrollRequest,
  EnrollResponse,
  HeartbeatPayload,
  MetricsPayload,
  InventoryPayload,
  AgentCapabilityName,
  AgentPolicy,
} from '@massvision/shared';

// ═══════════════════════════════════════════════════════════════
// Enrollment
// ═══════════════════════════════════════════════════════════════

interface EnrollmentToken {
  id: string;
  organization_id: string;
  max_uses: number | null;
  current_uses: number;
  tags: string[];
  policy: AgentPolicy;
  expires_at: Date | null;
  is_active: boolean;
}

export async function enrollAgent(req: EnrollRequest): Promise<EnrollResponse | { error: string }> {
  // Hash the enrollment token to look it up
  const tokenHash = crypto.createHash('sha256').update(req.enrollment_token).digest('hex');

  const token = await queryOne<EnrollmentToken>(
    `SELECT * FROM enrollment_tokens WHERE token_hash = $1 AND is_active = TRUE`,
    [tokenHash],
  );

  if (!token) {
    return { error: 'Invalid enrollment token' };
  }

  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    return { error: 'Enrollment token has expired' };
  }

  if (token.max_uses !== null && token.current_uses >= token.max_uses) {
    return { error: 'Enrollment token usage limit reached' };
  }

  // Generate agent credentials
  // The agent's HMAC key is derived deterministically: HMAC-SHA256(AGENT_HMAC_SECRET, agent_id)
  // This same derivation is used in validateEnvelope() to verify incoming envelopes.
  const agentId = uuidv4();
  const agentDerivedKey = crypto.createHmac('sha256', config.AGENT_HMAC_SECRET).update(agentId).digest('hex');

  const defaultPolicy: AgentPolicy = {
    metrics_interval_sec: 30,
    inventory_interval_sec: 3600,
    allowed_job_types: [
      'run_script', 'remote_shell_start', 'remote_shell_stop',
      'remote_desktop_start', 'remote_desktop_stop',
      'reboot', 'shutdown',
      'service_restart', 'service_stop', 'service_start', 'process_kill',
    ],
    max_concurrent_jobs: 5,
    update_channel: 'stable',
  };

  const policy = token.policy ?? defaultPolicy;
  const capabilities: AgentCapabilityName[] = [
    'metrics', 'inventory', 'run_script', 'remote_shell',
    'remote_desktop', 'reboot', 'shutdown', 'service_management',
    'process_management', 'agent_update',
  ];

  await transaction(async (client) => {
    // Insert agent
    await client.query(
      `INSERT INTO agents (id, organization_id, hostname, os, os_version, arch, agent_version, status, mac_addresses, agent_secret_hash, tags, policy, last_seen, enrolled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'online', $8, $9, $10, $11, NOW(), NOW())`,
      [
        agentId,
        token.organization_id,
        req.hostname,
        req.os,
        req.os_version,
        req.arch,
        req.agent_version,
        req.mac_addresses,
        agentDerivedKey,
        token.tags,
        JSON.stringify(policy),
      ],
    );

    // Insert capabilities
    for (const cap of capabilities) {
      await client.query(
        `INSERT INTO agent_capabilities (agent_id, capability, enabled) VALUES ($1, $2, TRUE)`,
        [agentId, cap],
      );
    }

    // Increment token usage
    await client.query(
      `UPDATE enrollment_tokens SET current_uses = current_uses + 1 WHERE id = $1`,
      [token.id],
    );

    // Audit
    await client.query(
      `INSERT INTO audit_logs (organization_id, agent_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'agent.enrolled', 'agent', $2, $3)`,
      [
        token.organization_id,
        agentId,
        JSON.stringify({ hostname: req.hostname, os: req.os, version: req.agent_version }),
      ],
    );
  });

  return {
    agent_id: agentId,
    agent_secret: agentDerivedKey,
    policy,
    heartbeat_interval_sec: 30,
    capabilities,
  };
}

// ═══════════════════════════════════════════════════════════════
// Heartbeat
// ═══════════════════════════════════════════════════════════════

export async function processHeartbeat(
  agentId: string,
  payload: HeartbeatPayload,
): Promise<void> {
  const agent = await queryOne<{ status: string; organization_id: string }>(
    'SELECT status, organization_id FROM agents WHERE id = $1',
    [agentId],
  );

  if (!agent) return;

  const previousStatus = agent.status;
  const newStatus = payload.status;

  await queryOne(
    `UPDATE agents SET status = $1, last_seen = NOW(), agent_version = $2 WHERE id = $3`,
    [newStatus, payload.agent_version, agentId],
  );

  // Update capabilities
  if (payload.capabilities?.length) {
    for (const cap of payload.capabilities) {
      await queryOne(
        `INSERT INTO agent_capabilities (agent_id, capability, enabled, updated_at)
         VALUES ($1, $2, TRUE, NOW())
         ON CONFLICT (agent_id, capability)
         DO UPDATE SET enabled = TRUE, updated_at = NOW()`,
        [agentId, cap],
      );
    }
  }

  // Store status in Redis for real-time
  await redis.set(`agent:status:${agentId}`, newStatus, 'EX', 120);
  await redis.set(`agent:lastseen:${agentId}`, Date.now().toString(), 'EX', 120);

  // Check status change for audit/notification
  if (previousStatus !== newStatus) {
    await createAuditLog({
      organization_id: agent.organization_id,
      agent_id: agentId,
      action: newStatus === 'online' ? 'agent.came_online' : 'agent.went_offline',
      resource_type: 'agent',
      resource_id: agentId,
      details: { old_status: previousStatus, new_status: newStatus },
    });

    // Publish status change event
    await redis.publish('agent:status_changed', JSON.stringify({
      agent_id: agentId,
      organization_id: agent.organization_id,
      old_status: previousStatus,
      new_status: newStatus,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════
// Metrics
// ═══════════════════════════════════════════════════════════════

export async function processMetrics(agentId: string, payload: MetricsPayload): Promise<void> {
  await queryOne(
    `INSERT INTO metrics_timeseries (agent_id, timestamp, cpu_usage, memory_used_bytes, memory_total_bytes, 
     disk_used_bytes, disk_total_bytes, network_rx_bytes_sec, network_tx_bytes_sec, processes_count, raw_data)
     VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      agentId,
      payload.timestamp,
      payload.cpu.usage_percent,
      payload.memory.used_bytes,
      payload.memory.total_bytes,
      payload.disks.reduce((sum, d) => sum + d.used_bytes, 0),
      payload.disks.reduce((sum, d) => sum + d.total_bytes, 0),
      payload.network.reduce((sum, n) => sum + n.rx_bytes_sec, 0),
      payload.network.reduce((sum, n) => sum + n.tx_bytes_sec, 0),
      payload.processes_count,
      JSON.stringify(payload),
    ],
  );

  // Cache latest metrics in Redis for real-time dashboard
  await redis.set(`agent:metrics:${agentId}`, JSON.stringify(payload), 'EX', 120);

  // Publish for WebSocket
  await redis.publish('agent:metrics', JSON.stringify({ agent_id: agentId, metrics: payload }));
}

// ═══════════════════════════════════════════════════════════════
// Inventory
// ═══════════════════════════════════════════════════════════════

export async function processInventory(agentId: string, payload: InventoryPayload): Promise<void> {
  await queryOne(
    `INSERT INTO inventory_snapshots (agent_id, timestamp, os_info, hardware_info, software, services, users, network_config, raw_data)
     VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7, $8, $9)`,
    [
      agentId,
      payload.timestamp,
      JSON.stringify(payload.os),
      JSON.stringify(payload.hardware),
      JSON.stringify(payload.software),
      JSON.stringify(payload.services),
      JSON.stringify(payload.users),
      JSON.stringify(payload.network_config),
      JSON.stringify(payload),
    ],
  );

  // Update agent info
  if (payload.os) {
    await queryOne(
      `UPDATE agents SET os_version = $1, arch = $2 WHERE id = $3`,
      [payload.os.version, payload.os.arch, agentId],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Agent Queries
// ═══════════════════════════════════════════════════════════════

export interface AgentListParams {
  organization_id: string;
  page: number;
  per_page: number;
  search?: string;
  status?: string;
  os?: string;
  tags?: string[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function listAgents(params: AgentListParams): Promise<{ agents: AgentListItem[]; meta: PaginationMeta }> {
  const conditions: string[] = ['a.organization_id = $1'];
  const values: unknown[] = [params.organization_id];
  let paramIdx = 2;

  if (params.search) {
    conditions.push(`(a.hostname ILIKE $${paramIdx} OR a.ip_address::text ILIKE $${paramIdx})`);
    values.push(`%${params.search}%`);
    paramIdx++;
  }
  if (params.status) {
    conditions.push(`a.status = $${paramIdx++}`);
    values.push(params.status);
  }
  if (params.os) {
    conditions.push(`a.os = $${paramIdx++}`);
    values.push(params.os);
  }
  if (params.tags?.length) {
    conditions.push(`a.tags && $${paramIdx++}`);
    values.push(params.tags);
  }

  const where = conditions.join(' AND ');
  const sortColumn = ['hostname', 'status', 'os', 'last_seen', 'enrolled_at'].includes(params.sort_by ?? '')
    ? params.sort_by
    : 'last_seen';
  const sortOrder = params.sort_order === 'asc' ? 'ASC' : 'DESC';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM agents a WHERE ${where}`,
    values,
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const offset = (params.page - 1) * params.per_page;
  const agents = await queryMany<AgentListItem>(
    `SELECT a.id, a.hostname, a.os, a.os_version, a.status, a.last_seen, 
            a.ip_address, a.agent_version, a.tags, a.source,
            COALESCE(
              (SELECT array_agg(c.capability) FROM agent_capabilities c WHERE c.agent_id = a.id AND c.enabled = TRUE),
              '{}'
            ) as capabilities
     FROM agents a
     WHERE ${where}
     ORDER BY a.${sortColumn} ${sortOrder}
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...values, params.per_page, offset],
  );

  return {
    agents,
    meta: {
      page: params.page,
      per_page: params.per_page,
      total,
      total_pages: Math.ceil(total / params.per_page),
    },
  };
}

export async function getAgent(agentId: string, organizationId: string): Promise<Agent | null> {
  const agent = await queryOne<Agent>(
    `SELECT a.*,
            COALESCE(
              (SELECT array_agg(c.capability) FROM agent_capabilities c WHERE c.agent_id = a.id AND c.enabled = TRUE),
              '{}'
            ) as capabilities
     FROM agents a
     WHERE a.id = $1 AND a.organization_id = $2`,
    [agentId, organizationId],
  );
  return agent;
}

export async function getAgentMetrics(
  agentId: string,
  from: string,
  to: string,
  limit: number = 100,
) {
  return queryMany(
    `SELECT timestamp, cpu_usage, memory_used_bytes, memory_total_bytes,
            disk_used_bytes, disk_total_bytes, network_rx_bytes_sec, network_tx_bytes_sec, processes_count
     FROM metrics_timeseries
     WHERE agent_id = $1 AND timestamp >= $2 AND timestamp <= $3
     ORDER BY timestamp DESC
     LIMIT $4`,
    [agentId, from, to, limit],
  );
}

export async function getAgentLatestInventory(agentId: string) {
  return queryOne(
    `SELECT * FROM inventory_snapshots
     WHERE agent_id = $1
     ORDER BY timestamp DESC
     LIMIT 1`,
    [agentId],
  );
}

export async function deleteAgent(agentId: string, organizationId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, organizationId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════
// Offline Detection (called periodically)
// ═══════════════════════════════════════════════════════════════

export async function markStaleAgentsOffline(thresholdSec: number = 90): Promise<void> {
  const stale = await queryMany<{ id: string; organization_id: string; status: string }>(
    `UPDATE agents SET status = 'offline'
     WHERE status != 'offline' AND last_seen < NOW() - INTERVAL '1 second' * $1
     RETURNING id, organization_id, status`,
    [thresholdSec],
  );

  for (const agent of stale) {
    await createAuditLog({
      organization_id: agent.organization_id,
      agent_id: agent.id,
      action: 'agent.went_offline',
      resource_type: 'agent',
      resource_id: agent.id,
      details: { reason: 'heartbeat_timeout' },
    });

    await redis.publish('agent:status_changed', JSON.stringify({
      agent_id: agent.id,
      organization_id: agent.organization_id,
      old_status: agent.status,
      new_status: 'offline',
    }));
  }
}
