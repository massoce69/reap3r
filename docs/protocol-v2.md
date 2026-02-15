# MASSVISION Reap3r — Protocol V2 Specification

## Overview

Protocol V2 governs all communication between the Rust agent and the backend API. Every message is wrapped in a **signed envelope** using HMAC-SHA256 to ensure:

1. **Authenticity** — Only enrolled agents with a valid `agent_secret` can send messages
2. **Integrity** — The payload cannot be tampered with in transit
3. **Anti-Replay** — Each message has a unique nonce; duplicates are rejected
4. **Time-Bounded** — Messages older than 30 seconds are rejected

## Envelope Structure

```json
{
  "agent_id": "uuid",
  "ts": 1710000000,
  "nonce": "uuid-v4",
  "type": "heartbeat|metrics|inventory|job_result|job_poll",
  "payload": { ... },
  "hmac": "hex-encoded-hmac-sha256"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | UUID | The enrolled agent's unique identifier |
| `ts` | Integer | Unix timestamp (seconds) when the message was created |
| `nonce` | UUID v4 | Unique per-message identifier for anti-replay |
| `type` | String | Message type enum |
| `payload` | Object | Type-specific payload data |
| `hmac` | String | Hex-encoded HMAC-SHA256 signature |

## HMAC Computation

```
sign_string = "{agent_id}:{ts}:{nonce}:{type}:{json(payload)}"
hmac = HMAC-SHA256(agent_secret, sign_string)
```

### Example

```
agent_id = "a1b2c3d4-..."
ts = 1710000000
nonce = "e5f6g7h8-..."
type = "heartbeat"
payload_json = '{"status":"online","uptime_sec":3600,...}'

sign_string = "a1b2c3d4-...:1710000000:e5f6g7h8-...:heartbeat:{\"status\":\"online\",...}"
hmac = HMAC-SHA256("agent_secret_here", sign_string) → "a3f8b2..."
```

## Server Validation Steps

1. **Parse envelope** — Extract `agent_id`, `ts`, `nonce`, `type`, `payload`, `hmac`
2. **Lookup agent** — Find agent by `agent_id`, retrieve `agent_secret`
3. **Time window check** — Reject if `|server_time - ts| > 30 seconds`
4. **Nonce check** — Reject if nonce was seen before (stored in `agent_nonces` table)
5. **HMAC verification** — Recompute HMAC with server-side secret, compare with received `hmac`
6. **Store nonce** — Insert nonce into `agent_nonces` table to prevent replay
7. **Process payload** — Route to appropriate handler based on `type`

## Message Types

### `heartbeat`

Sent every 10 seconds by the agent.

```json
{
  "status": "online",
  "uptime_sec": 3600,
  "agent_version": "1.0.0",
  "cpu_usage_percent": 23.5,
  "ram_usage_percent": 45.2,
  "active_jobs": ["job-uuid-1"],
  "capabilities": ["run_script", "remote_shell", "reboot"]
}
```

**Response:**
```json
{
  "ack": true,
  "server_time": 1710000010,
  "pending_actions": []
}
```

### `metrics`

Sent every 15 seconds.

```json
{
  "cpu_usage_percent": 23.5,
  "cpu_cores": 8,
  "ram_total_bytes": 17179869184,
  "ram_used_bytes": 8589934592,
  "ram_available_bytes": 8589934592,
  "disk_total_bytes": 512110190592,
  "disk_used_bytes": 256055095296,
  "disk_available_bytes": 256055095296,
  "net_rx_bytes": 1024000,
  "net_tx_bytes": 512000,
  "net_rx_packets": 1000,
  "net_tx_packets": 500,
  "process_count": 142,
  "uptime_sec": 3600,
  "load_average": [1.5, 1.2, 0.9]
}
```

### `inventory`

Sent every 5 minutes.

```json
{
  "os": {
    "name": "Windows",
    "version": "10.0.22631",
    "arch": "x86_64",
    "kernel_version": "10.0.22631",
    "hostname": "WORKSTATION-01"
  },
  "hardware": {
    "cpu_model": "Intel Core i7-13700K",
    "cpu_cores": 16,
    "cpu_threads": 24,
    "total_ram_bytes": 34359738368,
    "manufacturer": "Dell",
    "model": "OptiPlex 7090"
  },
  "network_interfaces": [...],
  "software": [...],
  "services": [...],
  "users": [...]
}
```

### `job_result`

Sent after a job finishes execution.

```json
{
  "job_id": "uuid",
  "status": "success|failed|timeout",
  "started_at": 1710000000,
  "completed_at": 1710000005,
  "stdout": "...",
  "stderr": "...",
  "exit_code": 0,
  "error_message": null,
  "result_data": null
}
```

### `job_poll`

Agent polls for pending jobs.

```json
{}
```

**Response (job available):**
```json
{
  "job_id": "uuid",
  "type": "run_script",
  "timeout_sec": 300,
  "priority": "normal",
  "payload": {
    "language": "powershell",
    "script": "Get-Process",
    "capture_output": true
  },
  "created_by": "user-uuid",
  "organization_id": "org-uuid"
}
```

**Response (no jobs):** HTTP 204 No Content

## Enrollment Flow

Enrollment is the **only unauthenticated** agent endpoint.

```
Agent                          Backend
  │                               │
  │  POST /agent/v2/enroll        │
  │  {enrollment_token, hostname, │
  │   os, capabilities, ...}      │
  │──────────────────────────────►│
  │                               │  Validate token
  │                               │  Create agent record
  │                               │  Generate agent_secret
  │  {agent_id, agent_secret,     │
  │   organization_id}            │
  │◄──────────────────────────────│
  │                               │
  │  [Save credentials to disk]   │
  │                               │
  │  POST /agent/v2/heartbeat     │
  │  [Signed Envelope]            │
  │──────────────────────────────►│  Normal operation begins
```

## Error Handling

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 204 | No content (e.g., no pending jobs) |
| 400 | Invalid envelope format |
| 401 | Invalid HMAC or unknown agent |
| 403 | Agent disabled or organization mismatch |
| 409 | Nonce replay detected |
| 410 | Time window exceeded |
| 429 | Rate limit exceeded |
| 500 | Server error |
