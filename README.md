# MASSVISION Reap3r

**Enterprise Hypervision & Remote Operations Platform**

A complete, production-ready platform for centralized machine management, real-time monitoring, remote execution, and full audit traceability across your infrastructure.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 14)                   │
│  Dashboard │ Agents │ Jobs │ Audit │ Settings │ Remote Shell │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼───────────────────────────────────────┐
│                    Backend API (Fastify)                      │
│  Auth │ RBAC │ Jobs │ Agents │ Metrics │ WebSocket │ Audit   │
│                  ┌─────────┐  ┌─────────┐                    │
│                  │PostgreSQL│  │  Redis  │                    │
│                  └─────────┘  └─────────┘                    │
└──────────────────────┬───────────────────────────────────────┘
                       │ Protocol V2 (HMAC-SHA256 Signed)
┌──────────────────────▼───────────────────────────────────────┐
│                   Agent (Rust)                                │
│  Metrics │ Inventory │ Runner │ Remote Shell │ Power Control │
│            Windows Service / Linux systemd                    │
└──────────────────────────────────────────────────────────────┘
```

## Core Principles

- **Job Driven Architecture**: Every machine action flows `UI → Backend → Agent → Result → UI`. No direct machine access.
- **No action without agent**: If an agent is offline, the UI shows "unavailable" — no silent failures.
- **Full Audit Trail**: Every action produces an immutable audit log entry.
- **RBAC**: Role-based access control with fine-grained permissions.
- **Protocol V2**: All agent communications are signed with HMAC-SHA256, with anti-replay nonce protection.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, React Query, xterm.js |
| Backend | Fastify 4, TypeScript, PostgreSQL 16, Redis 7, JWT, HMAC-SHA256, Prometheus |
| Agent | Rust, tokio, sysinfo, reqwest, HMAC-SHA256 |
| Infra | Docker Compose, Prometheus, Grafana |

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Docker** & Docker Compose
- **Rust** 1.78+ (for agent development)

### Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/massvision/reap3r.git
cd reap3r

# 2. Copy environment file
cp .env.example .env

# 3. Start infrastructure
docker compose up -d postgres redis

# 4. Install dependencies
npm install

# 5. Run database migrations
cd apps/backend && npx ts-node --transpile-only src/db/migrate.ts && cd ../..

# 6. Start backend
npm run dev -w apps/backend

# 7. Start frontend (new terminal)
npm run dev -w apps/frontend
```

### Default Credentials

| Field | Value |
|-------|-------|
| Email | `admin@massvision.io` |
| Password | `Admin@123456` |

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

## Project Structure

```
massvision-reap3r/
├── packages/
│   └── shared/              # Shared TypeScript types
│       └── src/
│           ├── protocol.ts  # Agent protocol V2 types
│           ├── jobs.ts      # Job types & payloads
│           ├── auth.ts      # Auth & RBAC types
│           └── models.ts    # Domain model types
├── apps/
│   ├── backend/             # Fastify API server
│   │   └── src/
│   │       ├── config/      # Zod-validated env config
│   │       ├── db/          # PostgreSQL + Redis + migrations
│   │       ├── auth/        # JWT, HMAC, RBAC
│   │       ├── services/    # Business logic
│   │       ├── routes/      # HTTP routes (UI + Agent V2)
│   │       ├── websocket/   # Real-time WebSocket handler
│   │       └── jobs/        # Cron scheduler
│   ├── frontend/            # Next.js 14 app
│   │   └── src/
│   │       ├── app/         # Pages (App Router)
│   │       ├── components/  # React components
│   │       ├── hooks/       # React Query + WebSocket hooks
│   │       └── lib/         # API client, store, utils
│   └── agent/               # Rust system agent
│       └── src/
│           ├── comms/       # HTTP client + protocol
│           └── modules/     # Metrics, inventory, runner
├── infra/
│   ├── prometheus/          # Prometheus config
│   ├── grafana/             # Grafana dashboards
│   └── scripts/             # Setup scripts
├── docs/                    # Documentation
├── docker-compose.yml       # Dev environment
└── docker-compose.prod.yml  # Production environment
```

## Agent Enrollment

1. Generate an enrollment token in Settings → Enrollment
2. Install the agent on the target machine:

**Windows (PowerShell):**
```powershell
# Download and install
irm https://your-domain/install.ps1 | iex -Token "YOUR_TOKEN"
```

**Linux (Bash):**
```bash
curl -sSL https://your-domain/install.sh | bash -s -- --token "YOUR_TOKEN"
```

The agent will:
1. Register with the backend using the enrollment token
2. Receive a unique `agent_id` and `agent_secret`
3. Start sending heartbeats, metrics, and inventory data
4. Begin polling for jobs

## Job Types

| Job Type | Description | Capability Required |
|----------|-------------|-------------------|
| `run_script` | Execute PowerShell/Bash/Python/CMD | `run_script` |
| `remote_shell_start` | Start interactive shell | `remote_shell` |
| `remote_shell_stop` | Stop interactive shell | `remote_shell` |
| `remote_desktop_start` | Start desktop streaming | `remote_desktop` |
| `reboot` | Reboot machine | `reboot` |
| `shutdown` | Shutdown machine | `shutdown` |
| `wake_on_lan` | Wake machine via WoL | `wake_on_lan` |
| `service_restart` | Restart a system service | `service_management` |
| `service_stop` | Stop a system service | `service_management` |
| `service_start` | Start a system service | `service_management` |
| `process_kill` | Kill a process by PID | `process_management` |
| `agent_update` | Update agent binary | `agent_update` |
| `artifact_upload` | Upload file to agent | `artifact` |
| `artifact_download` | Download file from agent | `artifact` |

## RBAC Roles

| Role | Permissions |
|------|------------|
| `super_admin` | All permissions |
| `org_admin` | All except system-level |
| `operator` | View + execute jobs |
| `viewer` | Read-only access |

## API Documentation

See [docs/openapi.yaml](docs/openapi.yaml) for the full OpenAPI 3.0 specification.

## Protocol V2

See [docs/protocol-v2.md](docs/protocol-v2.md) for the complete agent communication protocol specification.

## Security

- **JWT Authentication**: Access + refresh token rotation
- **HMAC-SHA256 Envelopes**: All agent messages are cryptographically signed
- **Anti-Replay**: Nonce-based deduplication with time window validation (30s)
- **Account Lockout**: After 5 failed login attempts
- **RBAC**: Fine-grained permission system
- **Immutable Audit Logs**: Cannot be modified or deleted (enforced at DB level)
- **Rate Limiting**: API rate limiting to prevent abuse

## License

Proprietary — MASSVISION. All rights reserved.
