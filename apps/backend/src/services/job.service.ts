// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Job Service (Job Driven Architecture)
// ─────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryMany, query, transaction } from '../db/connection.js';
import { redis } from '../db/redis.js';
import { createAuditLog } from './audit.service.js';
import { JOB_TYPE_CAPABILITY } from '@massvision/shared';
import type {
  Job,
  JobWithResult,
  JobResultRecord,
  PaginationMeta,
  JobType,
  JobStatus,
  JobPriority,
  JobResult,
} from '@massvision/shared';

// ═══════════════════════════════════════════════════════════════
// Create Job
// ═══════════════════════════════════════════════════════════════

export interface CreateJobParams {
  organization_id: string;
  agent_id: string;
  type: JobType;
  payload: Record<string, unknown>;
  timeout_sec?: number;
  priority?: JobPriority;
  created_by: string;
}

export async function createJob(params: CreateJobParams): Promise<Job> {
  const jobId = uuidv4();

  // Verify agent belongs to org and is online
  const agent = await queryOne<{ id: string; status: string; hostname: string }>(
    'SELECT id, status, hostname FROM agents WHERE id = $1 AND organization_id = $2',
    [params.agent_id, params.organization_id],
  );

  if (!agent) {
    throw new Error('Agent not found');
  }

  // Check agent capability
  const requiredCapability = JOB_TYPE_CAPABILITY[params.type];

  if (requiredCapability) {
    const cap = await queryOne<{ enabled: boolean }>(
      'SELECT enabled FROM agent_capabilities WHERE agent_id = $1 AND capability = $2',
      [params.agent_id, requiredCapability],
    );

    if (!cap?.enabled) {
      throw new Error(`Agent does not support capability: ${requiredCapability}`);
    }
  }

  // Determine initial status
  let status: JobStatus = 'pending';
  if (agent.status === 'offline') {
    // For WoL, we still queue it (will be sent to relay agent)
    if (params.type !== 'wake_on_lan') {
      status = 'agent_offline';
    }
  }

  const job = await queryOne<Job>(
    `INSERT INTO jobs (id, organization_id, agent_id, type, status, priority, payload, timeout_sec, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      jobId,
      params.organization_id,
      params.agent_id,
      params.type,
      status,
      params.priority ?? 'normal',
      JSON.stringify(params.payload),
      params.timeout_sec ?? 300,
      params.created_by,
    ],
  );

  if (!job) throw new Error('Failed to create job');

  // Audit
  await createAuditLog({
    organization_id: params.organization_id,
    user_id: params.created_by,
    agent_id: params.agent_id,
    action: 'job.created',
    resource_type: 'job',
    resource_id: jobId,
    details: {
      type: params.type,
      agent_hostname: agent.hostname,
    },
  });

  // Notify via Redis for agent polling and WebSocket
  if (status === 'pending') {
    await redis.lpush(`agent:jobs:${params.agent_id}`, JSON.stringify({
      job_id: jobId,
      type: params.type,
      timeout_sec: params.timeout_sec ?? 300,
      priority: params.priority ?? 'normal',
      payload: params.payload,
      created_by: params.created_by,
      organization_id: params.organization_id,
    }));

    await redis.publish('job:created', JSON.stringify({
      job_id: jobId,
      agent_id: params.agent_id,
      type: params.type,
    }));
  }

  return job;
}

// ═══════════════════════════════════════════════════════════════
// Get Next Job for Agent (polling)
// ═══════════════════════════════════════════════════════════════

export async function getNextJobForAgent(agentId: string): Promise<Record<string, unknown> | null> {
  const jobJson = await redis.rpop(`agent:jobs:${agentId}`);
  if (!jobJson) return null;

  const jobRequest = JSON.parse(jobJson) as Record<string, unknown>;

  // Update job status to queued
  await queryOne(
    `UPDATE jobs SET status = 'queued' WHERE id = $1 AND status = 'pending'`,
    [jobRequest.job_id],
  );

  return jobRequest;
}

// ═══════════════════════════════════════════════════════════════
// Process Job Result (Agent → Backend)
// ═══════════════════════════════════════════════════════════════

export async function processJobResult(agentId: string, result: JobResult): Promise<void> {
  await transaction(async (client) => {
    // Verify job exists and belongs to agent (within transaction)
    const jobResult = await client.query<{ id: string; organization_id: string; type: string; created_by: string }>(
      'SELECT id, organization_id, type, created_by FROM jobs WHERE id = $1 AND agent_id = $2',
      [result.job_id, agentId],
    );
    const job = jobResult.rows[0];

    if (!job) {
      throw new Error(`Job ${result.job_id} not found for agent ${agentId}`);
    }

    // Insert result
    await client.query(
      `INSERT INTO job_results (job_id, status, stdout, stderr, exit_code, error_message, artifacts, result_data, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9), to_timestamp($10))
       ON CONFLICT (job_id) DO UPDATE SET
         status = EXCLUDED.status,
         stdout = EXCLUDED.stdout,
         stderr = EXCLUDED.stderr,
         exit_code = EXCLUDED.exit_code,
         error_message = EXCLUDED.error_message,
         artifacts = EXCLUDED.artifacts,
         result_data = EXCLUDED.result_data,
         completed_at = EXCLUDED.completed_at`,
      [
        result.job_id,
        result.status,
        result.stdout ?? null,
        result.stderr ?? null,
        result.exit_code ?? null,
        result.error_message ?? null,
        JSON.stringify(result.artifacts ?? []),
        result.result_data ? JSON.stringify(result.result_data) : null,
        result.started_at,
        result.completed_at,
      ],
    );

    // Update job status
    await client.query(
      `UPDATE jobs SET status = $1, started_at = to_timestamp($2), completed_at = to_timestamp($3) WHERE id = $4`,
      [result.status, result.started_at, result.completed_at, result.job_id],
    );

    // Audit
    const auditAction = result.status === 'success' ? 'job.completed' : 'job.failed';
    await client.query(
      `INSERT INTO audit_logs (organization_id, user_id, agent_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, 'job', $5, $6)`,
      [
        job.organization_id,
        job.created_by,
        agentId,
        auditAction,
        result.job_id,
        JSON.stringify({
          type: job.type,
          status: result.status,
          exit_code: result.exit_code,
          error: result.error_message,
        }),
      ],
    );
  });

  // Publish for WebSocket  
  await redis.publish('job:status_changed', JSON.stringify({
    job_id: result.job_id,
    agent_id: agentId,
    status: result.status,
    exit_code: result.exit_code,
  }));
}

// ═══════════════════════════════════════════════════════════════
// Job Queries
// ═══════════════════════════════════════════════════════════════

export interface JobListParams {
  organization_id: string;
  page: number;
  per_page: number;
  agent_id?: string;
  type?: string;
  status?: string;
  created_by?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function listJobs(params: JobListParams): Promise<{ jobs: Job[]; meta: PaginationMeta }> {
  const conditions: string[] = ['j.organization_id = $1'];
  const values: unknown[] = [params.organization_id];
  let paramIdx = 2;

  if (params.agent_id) {
    conditions.push(`j.agent_id = $${paramIdx++}`);
    values.push(params.agent_id);
  }
  if (params.type) {
    conditions.push(`j.type = $${paramIdx++}`);
    values.push(params.type);
  }
  if (params.status) {
    conditions.push(`j.status = $${paramIdx++}`);
    values.push(params.status);
  }
  if (params.created_by) {
    conditions.push(`j.created_by = $${paramIdx++}`);
    values.push(params.created_by);
  }

  const where = conditions.join(' AND ');

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM jobs j WHERE ${where}`,
    values,
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const sortColumn = ['created_at', 'type', 'status', 'priority'].includes(params.sort_by ?? '')
    ? params.sort_by
    : 'created_at';
  const sortOrder = params.sort_order === 'asc' ? 'ASC' : 'DESC';
  const offset = (params.page - 1) * params.per_page;

  const jobs = await queryMany<Job>(
    `SELECT j.*, a.hostname as agent_hostname, u.full_name as created_by_name
     FROM jobs j
     LEFT JOIN agents a ON a.id = j.agent_id
     LEFT JOIN users u ON u.id = j.created_by
     WHERE ${where}
     ORDER BY j.${sortColumn} ${sortOrder}
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...values, params.per_page, offset],
  );

  return {
    jobs,
    meta: {
      page: params.page,
      per_page: params.per_page,
      total,
      total_pages: Math.ceil(total / params.per_page),
    },
  };
}

export async function getJob(jobId: string, organizationId: string): Promise<JobWithResult | null> {
  const job = await queryOne<Job>(
    `SELECT j.*, a.hostname as agent_hostname, u.full_name as created_by_name
     FROM jobs j
     LEFT JOIN agents a ON a.id = j.agent_id
     LEFT JOIN users u ON u.id = j.created_by
     WHERE j.id = $1 AND j.organization_id = $2`,
    [jobId, organizationId],
  );

  if (!job) return null;

  const result = await queryOne<JobResultRecord>(
    'SELECT * FROM job_results WHERE job_id = $1',
    [jobId],
  );

  return { ...job, result: result ?? null };
}

export async function cancelJob(jobId: string, organizationId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE jobs SET status = 'cancelled', completed_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND status IN ('pending', 'queued')`,
    [jobId, organizationId],
  );

  if ((result.rowCount ?? 0) > 0) {
    await createAuditLog({
      organization_id: organizationId,
      user_id: userId,
      action: 'job.cancelled',
      resource_type: 'job',
      resource_id: jobId,
    });
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// Job Timeout Checker (called periodically)
// ═══════════════════════════════════════════════════════════════

export async function checkJobTimeouts(): Promise<void> {
  const timedOut = await queryMany<{ id: string; organization_id: string; agent_id: string }>(
    `UPDATE jobs SET status = 'timeout', completed_at = NOW()
     WHERE status = 'running'
       AND started_at IS NOT NULL
       AND started_at + (timeout_sec * INTERVAL '1 second') < NOW()
     RETURNING id, organization_id, agent_id`,
  );

  for (const job of timedOut) {
    await createAuditLog({
      organization_id: job.organization_id,
      agent_id: job.agent_id,
      action: 'job.timeout',
      resource_type: 'job',
      resource_id: job.id,
    });

    await redis.publish('job:status_changed', JSON.stringify({
      job_id: job.id,
      agent_id: job.agent_id,
      status: 'timeout',
    }));
  }
}
