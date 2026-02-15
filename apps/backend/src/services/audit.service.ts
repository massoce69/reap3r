// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Audit Log Service (Immutable)
// ─────────────────────────────────────────────────────────────

import { queryOne, queryMany } from '../db/connection.js';
import type { AuditAction, AuditLog, PaginationMeta } from '@massvision/shared';

export interface CreateAuditEntry {
  organization_id: string;
  user_id?: string | null;
  agent_id?: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export async function createAuditLog(entry: CreateAuditEntry): Promise<void> {
  await queryOne(
    `INSERT INTO audit_logs (organization_id, user_id, agent_id, action, resource_type, resource_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.organization_id,
      entry.user_id ?? null,
      entry.agent_id ?? null,
      entry.action,
      entry.resource_type,
      entry.resource_id,
      JSON.stringify(entry.details ?? {}),
      entry.ip_address ?? null,
      entry.user_agent ?? null,
    ],
  );
}

export interface AuditListParams {
  organization_id: string;
  page: number;
  per_page: number;
  action?: string;
  user_id?: string;
  agent_id?: string;
  resource_type?: string;
  from_date?: string;
  to_date?: string;
}

export async function listAuditLogs(params: AuditListParams): Promise<{ logs: AuditLog[]; meta: PaginationMeta }> {
  const conditions: string[] = ['a.organization_id = $1'];
  const values: unknown[] = [params.organization_id];
  let paramIdx = 2;

  if (params.action) {
    conditions.push(`a.action = $${paramIdx++}`);
    values.push(params.action);
  }
  if (params.user_id) {
    conditions.push(`a.user_id = $${paramIdx++}`);
    values.push(params.user_id);
  }
  if (params.agent_id) {
    conditions.push(`a.agent_id = $${paramIdx++}`);
    values.push(params.agent_id);
  }
  if (params.resource_type) {
    conditions.push(`a.resource_type = $${paramIdx++}`);
    values.push(params.resource_type);
  }
  if (params.from_date) {
    conditions.push(`a.created_at >= $${paramIdx++}`);
    values.push(params.from_date);
  }
  if (params.to_date) {
    conditions.push(`a.created_at <= $${paramIdx++}`);
    values.push(params.to_date);
  }

  const where = conditions.join(' AND ');

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs a WHERE ${where}`,
    values,
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const offset = (params.page - 1) * params.per_page;
  const logs = await queryMany<AuditLog>(
    `SELECT a.*, u.full_name as user_name, ag.hostname as agent_hostname
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN agents ag ON ag.id = a.agent_id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...values, params.per_page, offset],
  );

  return {
    logs,
    meta: {
      page: params.page,
      per_page: params.per_page,
      total,
      total_pages: Math.ceil(total / params.per_page),
    },
  };
}
