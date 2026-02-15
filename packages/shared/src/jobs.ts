// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Job Types (Complete Enum + Payloads)
// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// Job Type Enum
// ═══════════════════════════════════════════════════════════════

export type JobType =
  | 'run_script'
  | 'remote_shell_start'
  | 'remote_shell_stop'
  | 'remote_desktop_start'
  | 'remote_desktop_stop'
  | 'remote_desktop_stream'
  | 'remote_desktop_input'
  | 'remote_desktop_privacy_mode_set'
  | 'remote_desktop_input_lock_set'
  | 'wake_on_lan'
  | 'agent_update'
  | 'reboot'
  | 'shutdown'
  | 'service_restart'
  | 'service_stop'
  | 'service_start'
  | 'process_kill'
  | 'artifact_upload'
  | 'artifact_download'
  | 'webcam_capture';

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'agent_offline';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

// ═══════════════════════════════════════════════════════════════
// Job Request (Backend → Agent)
// ═══════════════════════════════════════════════════════════════

export interface JobRequest<T = unknown> {
  job_id: string;
  type: JobType;
  timeout_sec: number;
  priority: JobPriority;
  payload: T;
  created_by: string;
  organization_id: string;
}

// ═══════════════════════════════════════════════════════════════
// Job Result (Agent → Backend)
// ═══════════════════════════════════════════════════════════════

export interface JobResult<T = unknown> {
  job_id: string;
  status: JobStatus;
  started_at: number;
  completed_at: number;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  error_message?: string;
  artifacts?: JobArtifact[];
  result_data?: T;
}

export interface JobArtifact {
  artifact_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  url?: string;
}

// ═══════════════════════════════════════════════════════════════
// Job Payloads by Type
// ═══════════════════════════════════════════════════════════════

export interface RunScriptPayload {
  language: 'powershell' | 'bash' | 'python' | 'cmd';
  script: string;
  working_dir?: string;
  env_vars?: Record<string, string>;
  run_as?: string;
  capture_output: boolean;
}

export interface RemoteShellStartPayload {
  shell: 'powershell' | 'bash' | 'cmd' | 'sh';
  cols: number;
  rows: number;
}

export interface RemoteShellStopPayload {
  session_id: string;
}

export interface RemoteDesktopStartPayload {
  mode: 'view' | 'control';
  fps: number;
  quality: number; // 1-100 JPEG quality
  scale: number; // 0.25 - 1.0
  monitor_index?: number;
}

export interface RemoteDesktopStopPayload {
  session_id: string;
}

export interface RemoteDesktopStreamPayload {
  session_id: string;
  action: 'pause' | 'resume' | 'change_quality';
  quality?: number;
  fps?: number;
}

export interface RemoteDesktopInputPayload {
  session_id: string;
  events: InputEvent[];
}

export type InputEvent =
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'mouse_down'; button: 'left' | 'right' | 'middle'; x: number; y: number }
  | { type: 'mouse_up'; button: 'left' | 'right' | 'middle'; x: number; y: number }
  | { type: 'mouse_scroll'; delta_x: number; delta_y: number; x: number; y: number }
  | { type: 'key_down'; key: string; modifiers: string[] }
  | { type: 'key_up'; key: string; modifiers: string[] }
  | { type: 'key_char'; char: string };

export interface PrivacyModePayload {
  enabled: boolean;
  auto_restore_on_end: boolean;
}

export interface InputLockPayload {
  enabled: boolean;
  lock: ('keyboard' | 'mouse')[];
  auto_restore_on_end: boolean;
  ttl_sec: number;
}

export interface WakeOnLanPayload {
  target_mac: string;
  target_agent_id?: string;
  broadcast_address?: string;
  port?: number;
}

export interface AgentUpdatePayload {
  version: string;
  url: string;
  sha256: string;
  signature: string;
  force: boolean;
  rollback_on_failure: boolean;
}

export interface RebootPayload {
  delay_sec: number;
  force: boolean;
  reason: string;
}

export interface ShutdownPayload {
  delay_sec: number;
  force: boolean;
  reason: string;
}

export interface ServiceActionPayload {
  service_name: string;
}

export interface ProcessKillPayload {
  pid: number;
  signal?: string; // SIGTERM, SIGKILL, etc.
}

export interface ArtifactUploadPayload {
  source_path: string;
  filename: string;
  compress: boolean;
}

export interface ArtifactDownloadPayload {
  url: string;
  destination_path: string;
  sha256: string;
  overwrite: boolean;
}

export interface WebcamCapturePayload {
  device_index: number;
  duration_sec?: number; // null = single capture
  resolution?: { width: number; height: number };
}

// ═══════════════════════════════════════════════════════════════
// Job Type → Payload mapping (type-safe dispatch)
// ═══════════════════════════════════════════════════════════════

export interface JobPayloadMap {
  run_script: RunScriptPayload;
  remote_shell_start: RemoteShellStartPayload;
  remote_shell_stop: RemoteShellStopPayload;
  remote_desktop_start: RemoteDesktopStartPayload;
  remote_desktop_stop: RemoteDesktopStopPayload;
  remote_desktop_stream: RemoteDesktopStreamPayload;
  remote_desktop_input: RemoteDesktopInputPayload;
  remote_desktop_privacy_mode_set: PrivacyModePayload;
  remote_desktop_input_lock_set: InputLockPayload;
  wake_on_lan: WakeOnLanPayload;
  agent_update: AgentUpdatePayload;
  reboot: RebootPayload;
  shutdown: ShutdownPayload;
  service_restart: ServiceActionPayload;
  service_stop: ServiceActionPayload;
  service_start: ServiceActionPayload;
  process_kill: ProcessKillPayload;
  artifact_upload: ArtifactUploadPayload;
  artifact_download: ArtifactDownloadPayload;
  webcam_capture: WebcamCapturePayload;
}

// ═══════════════════════════════════════════════════════════════
// Required Permission per Job Type
// ═══════════════════════════════════════════════════════════════

export const JOB_TYPE_PERMISSION: Record<JobType, string> = {
  run_script: 'scripts.run',
  remote_shell_start: 'remote.shell',
  remote_shell_stop: 'remote.shell',
  remote_desktop_start: 'remote.desktop',
  remote_desktop_stop: 'remote.desktop',
  remote_desktop_stream: 'remote.desktop',
  remote_desktop_input: 'remote.desktop',
  remote_desktop_privacy_mode_set: 'remote.desktop',
  remote_desktop_input_lock_set: 'remote.desktop',
  wake_on_lan: 'power.wol',
  agent_update: 'agent.update',
  reboot: 'power.reboot',
  shutdown: 'power.shutdown',
  service_restart: 'services.manage',
  service_stop: 'services.manage',
  service_start: 'services.manage',
  process_kill: 'processes.kill',
  artifact_upload: 'artifacts.upload',
  artifact_download: 'artifacts.download',
  webcam_capture: 'webcam.capture',
};

// ═══════════════════════════════════════════════════════════════
// Required Capability per Job Type
// ═══════════════════════════════════════════════════════════════

export const JOB_TYPE_CAPABILITY: Record<JobType, string> = {
  run_script: 'run_script',
  remote_shell_start: 'remote_shell',
  remote_shell_stop: 'remote_shell',
  remote_desktop_start: 'remote_desktop',
  remote_desktop_stop: 'remote_desktop',
  remote_desktop_stream: 'remote_desktop',
  remote_desktop_input: 'remote_desktop',
  remote_desktop_privacy_mode_set: 'privacy_mode',
  remote_desktop_input_lock_set: 'input_lock',
  wake_on_lan: 'wake_on_lan',
  agent_update: 'agent_update',
  reboot: 'reboot',
  shutdown: 'shutdown',
  service_restart: 'service_management',
  service_stop: 'service_management',
  service_start: 'service_management',
  process_kill: 'process_management',
  artifact_upload: 'artifact_transfer',
  artifact_download: 'artifact_transfer',
  webcam_capture: 'webcam_capture',
};
