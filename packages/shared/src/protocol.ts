// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Protocol V2 Types (Source of Truth)
// ─────────────────────────────────────────────────────────────

import type { JobType } from './jobs.js';

// ═══════════════════════════════════════════════════════════════
// Agent Envelope - Every message agent <-> backend
// ═══════════════════════════════════════════════════════════════

export interface AgentEnvelope<T = unknown> {
  agent_id: string;
  ts: number; // Unix epoch seconds
  nonce: string; // Unique per-message, anti-replay
  type: AgentMessageType;
  payload: T;
  hmac: string; // HMAC-SHA256 hex
}

export type AgentMessageType =
  | 'heartbeat'
  | 'metrics_push'
  | 'inventory_push'
  | 'job_result'
  | 'capabilities'
  | 'enroll_request'
  | 'enroll_response';

// ═══════════════════════════════════════════════════════════════
// Enrollment
// ═══════════════════════════════════════════════════════════════

export interface EnrollRequest {
  enrollment_token: string;
  hostname: string;
  os: OsType;
  os_version: string;
  arch: string;
  agent_version: string;
  mac_addresses: string[];
}

export interface EnrollResponse {
  agent_id: string;
  agent_secret: string;
  policy: AgentPolicy;
  heartbeat_interval_sec: number;
  capabilities: AgentCapabilityName[];
}

export interface AgentPolicy {
  metrics_interval_sec: number;
  inventory_interval_sec: number;
  allowed_job_types: JobType[];
  max_concurrent_jobs: number;
  update_channel: 'stable' | 'beta' | 'canary';
}

// ═══════════════════════════════════════════════════════════════
// Heartbeat
// ═══════════════════════════════════════════════════════════════

export interface HeartbeatPayload {
  status: AgentStatus;
  uptime_sec: number;
  agent_version: string;
  active_jobs: string[];
  capabilities: AgentCapabilityName[];
}

export type AgentStatus = 'online' | 'offline' | 'degraded' | 'updating';

// ═══════════════════════════════════════════════════════════════
// Metrics
// ═══════════════════════════════════════════════════════════════

export interface MetricsPayload {
  timestamp: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskMetrics[];
  network: NetworkMetrics[];
  processes_count: number;
  uptime_sec: number;
}

export interface CpuMetrics {
  usage_percent: number;
  cores: number;
  model: string;
  frequency_mhz: number;
  per_core_usage: number[];
}

export interface MemoryMetrics {
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
}

export interface DiskMetrics {
  mount_point: string;
  device: string;
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  read_bytes_sec: number;
  write_bytes_sec: number;
}

export interface NetworkMetrics {
  interface_name: string;
  ip_address: string;
  mac_address: string;
  rx_bytes_sec: number;
  tx_bytes_sec: number;
  rx_packets_sec: number;
  tx_packets_sec: number;
}

// ═══════════════════════════════════════════════════════════════
// Inventory
// ═══════════════════════════════════════════════════════════════

export interface InventoryPayload {
  timestamp: number;
  os: OsInfo;
  hardware: HardwareInfo;
  software: InstalledSoftware[];
  services: ServiceInfo[];
  users: LocalUser[];
  network_config: NetworkConfig[];
}

export interface OsInfo {
  type: OsType;
  name: string;
  version: string;
  build: string;
  arch: string;
  kernel: string;
  hostname: string;
  domain: string;
  last_boot: number;
}

export interface HardwareInfo {
  manufacturer: string;
  model: string;
  serial_number: string;
  bios_version: string;
  cpu_model: string;
  cpu_cores: number;
  cpu_threads: number;
  ram_total_bytes: number;
  ram_slots: RamSlot[];
  gpu: GpuInfo[];
}

export interface RamSlot {
  slot: string;
  size_bytes: number;
  type: string;
  speed_mhz: number;
  manufacturer: string;
}

export interface GpuInfo {
  name: string;
  driver_version: string;
  vram_bytes: number;
}

export interface InstalledSoftware {
  name: string;
  version: string;
  publisher: string;
  install_date: string;
  size_bytes: number;
}

export interface ServiceInfo {
  name: string;
  display_name: string;
  status: 'running' | 'stopped' | 'paused' | 'unknown';
  start_type: 'automatic' | 'manual' | 'disabled' | 'unknown';
  pid: number | null;
}

export interface LocalUser {
  username: string;
  full_name: string;
  is_admin: boolean;
  is_active: boolean;
  last_login: number | null;
}

export interface NetworkConfig {
  interface_name: string;
  ip_addresses: string[];
  mac_address: string;
  gateway: string;
  dns_servers: string[];
  dhcp_enabled: boolean;
}

export type OsType = 'windows' | 'linux' | 'macos';

// ═══════════════════════════════════════════════════════════════
// Capabilities
// ═══════════════════════════════════════════════════════════════

export type AgentCapabilityName =
  | 'metrics'
  | 'inventory'
  | 'run_script'
  | 'remote_shell'
  | 'remote_desktop'
  | 'privacy_mode'
  | 'input_lock'
  | 'wake_on_lan'
  | 'agent_update'
  | 'artifact_transfer'
  | 'webcam_capture'
  | 'reboot'
  | 'shutdown'
  | 'service_management'
  | 'process_management';

export interface AgentCapability {
  name: AgentCapabilityName;
  version: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}
