// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Dashboard Service
// ─────────────────────────────────────────────────────────────

import { queryOne, queryMany } from '../db/connection.js';
import type { DashboardStats, DashboardAlert } from '@massvision/shared';

export async function getDashboardStats(organizationId: string): Promise<DashboardStats> {
  // Agent counts
  const agentCounts = await queryOne<{
    total: string;
    online: string;
    offline: string;
    degraded: string;
  }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'online') as online,
       COUNT(*) FILTER (WHERE status = 'offline') as offline,
       COUNT(*) FILTER (WHERE status = 'degraded') as degraded
     FROM agents WHERE organization_id = $1`,
    [organizationId],
  );

  // Job counts today
  const jobCounts = await queryOne<{
    total: string;
    successful: string;
    failed: string;
    pending: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as total,
       COUNT(*) FILTER (WHERE status = 'success' AND created_at >= CURRENT_DATE) as successful,
       COUNT(*) FILTER (WHERE status IN ('failed', 'timeout') AND created_at >= CURRENT_DATE) as failed,
       COUNT(*) FILTER (WHERE status IN ('pending', 'queued')) as pending
     FROM jobs WHERE organization_id = $1`,
    [organizationId],
  );

  // Active remote sessions
  const sessions = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM remote_sessions WHERE organization_id = $1 AND status = 'active'`,
    [organizationId],
  );

  // Agents by OS
  const osCounts = await queryMany<{ os: string; count: string }>(
    `SELECT os, COUNT(*) as count FROM agents WHERE organization_id = $1 GROUP BY os`,
    [organizationId],
  );
  const agentsByOs: Record<string, number> = {};
  for (const row of osCounts) {
    agentsByOs[row.os] = parseInt(row.count, 10);
  }

  // Recent alerts (agent went offline + failed jobs)
  const alerts = await queryMany<DashboardAlert>(
    `SELECT id, 
            CASE 
              WHEN action = 'agent.went_offline' THEN 'agent_offline'
              WHEN action IN ('job.failed', 'job.timeout') THEN 'job_failed'
              WHEN action = 'agent.update_failed' THEN 'update_failed'
              ELSE 'info'
            END as type,
            CASE
              WHEN action = 'agent.went_offline' THEN 'Agent went offline: ' || COALESCE(details->>'hostname', resource_id)
              WHEN action = 'job.failed' THEN 'Job failed: ' || COALESCE(details->>'type', 'unknown')
              WHEN action = 'job.timeout' THEN 'Job timed out: ' || COALESCE(details->>'type', 'unknown')
              ELSE action
            END as message,
            agent_id,
            created_at,
            FALSE as acknowledged
     FROM audit_logs
     WHERE organization_id = $1
       AND action IN ('agent.went_offline', 'job.failed', 'job.timeout', 'agent.update_failed')
       AND created_at >= NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC
     LIMIT 20`,
    [organizationId],
  );

  return {
    total_agents: parseInt(agentCounts?.total ?? '0', 10),
    online_agents: parseInt(agentCounts?.online ?? '0', 10),
    offline_agents: parseInt(agentCounts?.offline ?? '0', 10),
    degraded_agents: parseInt(agentCounts?.degraded ?? '0', 10),
    total_jobs_today: parseInt(jobCounts?.total ?? '0', 10),
    successful_jobs_today: parseInt(jobCounts?.successful ?? '0', 10),
    failed_jobs_today: parseInt(jobCounts?.failed ?? '0', 10),
    pending_jobs: parseInt(jobCounts?.pending ?? '0', 10),
    active_remote_sessions: parseInt(sessions?.count ?? '0', 10),
    agents_by_os: agentsByOs as Record<'windows' | 'linux' | 'macos', number>,
    recent_alerts: alerts,
  };
}
