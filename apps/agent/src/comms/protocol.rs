// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r Agent - Protocol Types
// ─────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};

/// Signed envelope wrapping all agent → backend messages.
/// HMAC-SHA256(agent_secret, "{agent_id}|{ts}|{nonce}|{type}|{payload_json}")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEnvelope {
    pub agent_id: String,
    pub ts: i64,
    pub nonce: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: serde_json::Value,
    pub hmac: String,
}

// ═══════════════════════════════════════════════════════════════
// Enrollment
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrollmentRequest {
    pub enrollment_token: String,
    pub hostname: String,
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub agent_version: String,
    pub mac_addresses: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrollmentResponse {
    pub agent_id: String,
    pub agent_secret: String,
    #[serde(default)]
    pub policy: Option<serde_json::Value>,
    #[serde(default)]
    pub heartbeat_interval_sec: Option<u64>,
    #[serde(default)]
    pub capabilities: Option<Vec<String>>,
}

// ═══════════════════════════════════════════════════════════════
// Heartbeat
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatPayload {
    pub status: String,
    pub uptime_sec: u64,
    pub agent_version: String,
    pub active_jobs: Vec<String>,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatResponse {
    pub ack: bool,
    pub pending_job: Option<JobRequest>,
}

// ═══════════════════════════════════════════════════════════════
// Metrics (matches shared MetricsPayload structure)
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsPayload {
    pub timestamp: i64,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disks: Vec<DiskMetrics>,
    pub network: Vec<NetworkMetrics>,
    pub processes_count: u32,
    pub uptime_sec: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub usage_percent: f64,
    pub cores: u32,
    pub model: String,
    pub frequency_mhz: u64,
    pub per_core_usage: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub mount_point: String,
    pub device: String,
    pub fs_type: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    #[serde(default)]
    pub read_bytes_sec: u64,
    #[serde(default)]
    pub write_bytes_sec: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub interface_name: String,
    #[serde(default)]
    pub ip_address: String,
    #[serde(default)]
    pub mac_address: String,
    pub rx_bytes_sec: u64,
    pub tx_bytes_sec: u64,
    #[serde(default)]
    pub rx_packets_sec: u64,
    #[serde(default)]
    pub tx_packets_sec: u64,
}

// ═══════════════════════════════════════════════════════════════
// Inventory (matches shared InventoryPayload structure)
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryPayload {
    pub timestamp: i64,
    pub os: OsInfo,
    pub hardware: HardwareInfo,
    pub software: Vec<InstalledSoftware>,
    pub services: Vec<ServiceInfo>,
    pub users: Vec<LocalUser>,
    pub network_config: Vec<NetworkConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsInfo {
    #[serde(rename = "type")]
    pub os_type: String,
    pub name: String,
    pub version: String,
    pub build: String,
    pub arch: String,
    pub kernel: String,
    pub hostname: String,
    pub domain: String,
    pub last_boot: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub manufacturer: String,
    pub model: String,
    pub serial_number: String,
    pub bios_version: String,
    pub cpu_model: String,
    pub cpu_cores: u32,
    pub cpu_threads: u32,
    pub ram_total_bytes: u64,
    pub ram_slots: Vec<RamSlot>,
    pub gpu: Vec<GpuInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RamSlot {
    pub slot: String,
    pub size_bytes: u64,
    #[serde(rename = "type")]
    pub ram_type: String,
    pub speed_mhz: u64,
    pub manufacturer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub name: String,
    pub driver_version: String,
    pub vram_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledSoftware {
    pub name: String,
    pub version: String,
    pub publisher: String,
    pub install_date: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub name: String,
    pub display_name: String,
    pub status: String,
    pub start_type: String,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalUser {
    pub username: String,
    pub full_name: String,
    pub is_admin: bool,
    pub is_active: bool,
    pub last_login: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub interface_name: String,
    pub ip_addresses: Vec<String>,
    pub mac_address: String,
    pub gateway: String,
    pub dns_servers: Vec<String>,
    pub dhcp_enabled: bool,
}

// ═══════════════════════════════════════════════════════════════
// Jobs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobRequest {
    pub job_id: String,
    #[serde(rename = "type")]
    pub job_type: String,
    pub timeout_sec: u64,
    pub priority: String,
    pub payload: serde_json::Value,
    pub created_by: String,
    pub organization_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    pub job_id: String,
    pub status: String,
    pub started_at: i64,
    pub completed_at: i64,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub error_message: Option<String>,
    pub result_data: Option<serde_json::Value>,
}

// ═══════════════════════════════════════════════════════════════
// API Response Wrapper
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: T,
    pub error: Option<String>,
}
