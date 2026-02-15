// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - DB Model Types (API responses)
// ─────────────────────────────────────────────────────────────

import type { AgentStatus, AgentCapabilityName, OsType } from './protocol.js';
import type { JobType, JobStatus, JobPriority } from './jobs.js';

// ═══════════════════════════════════════════════════════════════
// Organization
// ═══════════════════════════════════════════════════════════════

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  max_agents: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════
// Agent
// ═══════════════════════════════════════════════════════════════

export interface Agent {
  id: string;
  organization_id: string;
  hostname: string;
  os: OsType;
  os_version: string;
  arch: string;
  agent_version: string;
  status: AgentStatus;
  last_seen: string;
  enrolled_at: string;
  ip_address: string;
  mac_addresses: string[];
  tags: string[];
  source: 'massvision' | 'zabbix' | 'manual';
  capabilities: AgentCapabilityName[];
  policy: Record<string, unknown>;
  notes: string;
}

export interface AgentListItem {
  id: string;
  hostname: string;
  os: OsType;
  os_version: string;
  status: AgentStatus;
  last_seen: string;
  ip_address: string;
  agent_version: string;
  tags: string[];
  source: 'massvision' | 'zabbix' | 'manual';
  capabilities: AgentCapabilityName[];
}

// ═══════════════════════════════════════════════════════════════
// Job
// ═══════════════════════════════════════════════════════════════

export interface Job {
  id: string;
  organization_id: string;
  agent_id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: Record<string, unknown>;
  timeout_sec: number;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agent_hostname?: string;
  created_by_name?: string;
}

export interface JobWithResult extends Job {
  result: JobResultRecord | null;
}

export interface JobResultRecord {
  id: string;
  job_id: string;
  status: JobStatus;
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  error_message: string | null;
  artifacts: Record<string, unknown>[];
  result_data: Record<string, unknown> | null;
  started_at: string;
  completed_at: string;
}

// ═══════════════════════════════════════════════════════════════
// Audit Log
// ═══════════════════════════════════════════════════════════════

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'agent.enrolled'
  | 'agent.deleted'
  | 'agent.updated'
  | 'agent.went_offline'
  | 'agent.came_online'
  | 'job.created'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'job.timeout'
  | 'remote_shell.started'
  | 'remote_shell.stopped'
  | 'remote_desktop.started'
  | 'remote_desktop.stopped'
  | 'privacy_mode.enabled'
  | 'privacy_mode.disabled'
  | 'input_lock.enabled'
  | 'input_lock.disabled'
  | 'wol.sent'
  | 'agent.update_started'
  | 'agent.update_completed'
  | 'agent.update_failed'
  | 'org.created'
  | 'org.updated'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted';

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  agent_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user_name?: string;
  agent_hostname?: string;
}

// ═══════════════════════════════════════════════════════════════
// API Response Wrappers
// ═══════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginationQuery {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
}

// ═══════════════════════════════════════════════════════════════
// WebSocket Realtime Events
// ═══════════════════════════════════════════════════════════════

export type WsEventType =
  | 'agent.status_changed'
  | 'agent.metrics'
  | 'job.status_changed'
  | 'job.output'
  | 'remote_shell.data'
  | 'remote_desktop.frame'
  | 'notification';

export interface WsMessage<T = unknown> {
  event: WsEventType;
  data: T;
  timestamp: number;
}

export interface AgentStatusChangedEvent {
  agent_id: string;
  hostname: string;
  old_status: AgentStatus;
  new_status: AgentStatus;
}

export interface JobStatusChangedEvent {
  job_id: string;
  agent_id: string;
  type: JobType;
  old_status: JobStatus;
  new_status: JobStatus;
}

export interface JobOutputEvent {
  job_id: string;
  stream: 'stdout' | 'stderr';
  data: string;
}

export interface RemoteShellDataEvent {
  session_id: string;
  data: string;
}

export interface RemoteDesktopFrameEvent {
  session_id: string;
  frame: string; // base64 JPEG
  timestamp: number;
  width: number;
  height: number;
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Stats
// ═══════════════════════════════════════════════════════════════

export interface DashboardStats {
  total_agents: number;
  online_agents: number;
  offline_agents: number;
  degraded_agents: number;
  total_jobs_today: number;
  successful_jobs_today: number;
  failed_jobs_today: number;
  pending_jobs: number;
  active_remote_sessions: number;
  agents_by_os: Record<OsType, number>;
  recent_alerts: DashboardAlert[];
}

export interface DashboardAlert {
  id: string;
  type: 'agent_offline' | 'job_failed' | 'update_failed' | 'security' | 'info';
  message: string;
  agent_id?: string;
  agent_hostname?: string;
  created_at: string;
  acknowledged: boolean;
}
