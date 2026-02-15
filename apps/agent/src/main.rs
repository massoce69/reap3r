// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r Agent - Main Entry Point
// ─────────────────────────────────────────────────────────────
//
// Architecture:
//   Config → Enroll (if needed) → Spawn background tasks → Loop
//   - Heartbeat task (every 10s)
//   - Metrics task (every 15s)
//   - Inventory task (every 5min)
//   - Job poll task (every 3s)
//
// All communication uses Protocol V2 signed envelopes
// (HMAC-SHA256 + nonce + timestamp anti-replay)
// ─────────────────────────────────────────────────────────────

mod config;
mod comms;
mod modules;

use anyhow::{Context, Result};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};

use config::AgentConfig;
use comms::client::AgentClient;
use comms::protocol::*;
use modules::metrics::MetricsCollector;
use modules::inventory::InventoryCollector;
use modules::runner::JobRunner;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    tracing::info!("╔══════════════════════════════════════════╗");
    tracing::info!("║  MASSVISION Reap3r Agent v{}          ║", VERSION);
    tracing::info!("╚══════════════════════════════════════════╝");

    // Load configuration
    let mut config = AgentConfig::load()
        .context("Failed to load configuration")?;

    tracing::info!("Server: {}", config.server_url);

    // Create HTTP client
    let client = Arc::new(RwLock::new(AgentClient::new(&config.server_url)));

    // Enroll if needed
    if !config.is_enrolled() {
        tracing::info!("Agent not enrolled. Starting enrollment...");
        enroll(&mut config, &client).await?;
    } else {
        tracing::info!("Agent already enrolled: {}", config.agent_id.as_ref().unwrap());
        let mut c = client.write().await;
        c.set_credentials(
            config.agent_id.clone().unwrap(),
            config.agent_secret.clone().unwrap(),
        );
    }

    let config = Arc::new(config);

    // Spawn background tasks
    let heartbeat_handle = tokio::spawn(heartbeat_loop(
        Arc::clone(&client),
        Arc::clone(&config),
    ));

    let metrics_handle = tokio::spawn(metrics_loop(
        Arc::clone(&client),
        Arc::clone(&config),
    ));

    let inventory_handle = tokio::spawn(inventory_loop(
        Arc::clone(&client),
        Arc::clone(&config),
    ));

    let job_handle = tokio::spawn(job_poll_loop(
        Arc::clone(&client),
        Arc::clone(&config),
    ));

    tracing::info!("All background tasks started. Agent is operational.");

    // Wait for Ctrl+C or task failure
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("Shutdown signal received");
        }
        r = heartbeat_handle => {
            tracing::error!("Heartbeat task exited: {:?}", r);
        }
        r = metrics_handle => {
            tracing::error!("Metrics task exited: {:?}", r);
        }
        r = inventory_handle => {
            tracing::error!("Inventory task exited: {:?}", r);
        }
        r = job_handle => {
            tracing::error!("Job poll task exited: {:?}", r);
        }
    }

    tracing::info!("Agent shutting down gracefully");
    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// Enrollment
// ═══════════════════════════════════════════════════════════════

async fn enroll(config: &mut AgentConfig, client: &Arc<RwLock<AgentClient>>) -> Result<()> {
    let enrollment_token = config.enrollment_token.as_ref()
        .context("No enrollment token configured")?
        .clone();

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let os_version = sysinfo::System::os_version()
        .unwrap_or_else(|| "unknown".to_string());

    let mac_addresses = get_mac_addresses();

    let req = EnrollmentRequest {
        enrollment_token,
        hostname,
        os,
        os_version,
        arch,
        agent_version: VERSION.to_string(),
        mac_addresses,
    };

    let c = client.read().await;
    let resp = c.enroll(&req).await?;
    drop(c);

    // Save enrollment data
    config.agent_id = Some(resp.agent_id.clone());
    config.agent_secret = Some(resp.agent_secret.clone());

    // Apply server-provided settings
    if let Some(interval) = resp.heartbeat_interval_sec {
        config.heartbeat_interval_sec = interval;
    }
    if let Some(caps) = &resp.capabilities {
        config.capabilities = caps.clone();
    }
    config.save()?;

    // Set credentials on client
    let mut c = client.write().await;
    c.set_credentials(resp.agent_id, resp.agent_secret);

    tracing::info!("Enrollment complete!");
    Ok(())
}

fn get_mac_addresses() -> Vec<String> {
    let networks = sysinfo::Networks::new_with_refreshed_list();
    networks
        .list()
        .iter()
        .map(|(_name, data)| data.mac_address().to_string())
        .filter(|mac| mac != "00:00:00:00:00:00")
        .collect()
}

// ═══════════════════════════════════════════════════════════════
// Heartbeat Loop
// ═══════════════════════════════════════════════════════════════

async fn heartbeat_loop(client: Arc<RwLock<AgentClient>>, config: Arc<AgentConfig>) {
    let mut consecutive_failures = 0u32;

    loop {
        let payload = HeartbeatPayload {
            status: "online".to_string(),
            uptime_sec: sysinfo::System::uptime(),
            agent_version: VERSION.to_string(),
            active_jobs: vec![],
            capabilities: config.capabilities.clone(),
        };

        let c = client.read().await;
        match c.heartbeat(payload).await {
            Ok(resp) => {
                consecutive_failures = 0;
                tracing::debug!("Heartbeat OK (ack={})", resp.ack);

                // If the server pushes a pending job, execute it
                if let Some(job) = resp.pending_job {
                    tracing::info!("Server pushed job via heartbeat: {} (type={})", job.job_id, job.job_type);
                    let job_client = Arc::clone(&client);
                    tokio::spawn(async move {
                        let result = JobRunner::execute(&job).await;
                        let c = job_client.read().await;
                        if let Err(e) = c.report_job_result(result).await {
                            tracing::error!("Failed to report pushed job result: {}", e);
                        }
                    });
                }
            }
            Err(e) => {
                consecutive_failures += 1;
                tracing::warn!("Heartbeat failed (attempt {}): {}", consecutive_failures, e);
            }
        }

        sleep(Duration::from_secs(config.heartbeat_interval_sec)).await;
    }
}

// ═══════════════════════════════════════════════════════════════
// Metrics Loop
// ═══════════════════════════════════════════════════════════════

async fn metrics_loop(client: Arc<RwLock<AgentClient>>, config: Arc<AgentConfig>) {
    let mut collector = MetricsCollector::new();

    // Wait a bit before first collection
    sleep(Duration::from_secs(5)).await;

    loop {
        match collector.collect() {
            Ok(payload) => {
                let c = client.read().await;
                if let Err(e) = c.report_metrics(payload).await {
                    tracing::warn!("Metrics report failed: {}", e);
                } else {
                    tracing::debug!("Metrics reported");
                }
            }
            Err(e) => {
                tracing::warn!("Metrics collection failed: {}", e);
            }
        }

        sleep(Duration::from_secs(config.metrics_interval_sec)).await;
    }
}

// ═══════════════════════════════════════════════════════════════
// Inventory Loop
// ═══════════════════════════════════════════════════════════════

async fn inventory_loop(client: Arc<RwLock<AgentClient>>, config: Arc<AgentConfig>) {
    // Report inventory immediately on startup
    sleep(Duration::from_secs(10)).await;

    loop {
        match InventoryCollector::collect() {
            Ok(payload) => {
                let c = client.read().await;
                if let Err(e) = c.report_inventory(payload).await {
                    tracing::warn!("Inventory report failed: {}", e);
                } else {
                    tracing::info!("Inventory snapshot reported");
                }
            }
            Err(e) => {
                tracing::warn!("Inventory collection failed: {}", e);
            }
        }

        sleep(Duration::from_secs(config.inventory_interval_sec)).await;
    }
}

// ═══════════════════════════════════════════════════════════════
// Job Poll Loop
// ═══════════════════════════════════════════════════════════════

async fn job_poll_loop(client: Arc<RwLock<AgentClient>>, config: Arc<AgentConfig>) {
    sleep(Duration::from_secs(3)).await;

    loop {
        let c = client.read().await;
        match c.poll_jobs().await {
            Ok(Some(job)) => {
                tracing::info!("Received job: {} (type={})", job.job_id, job.job_type);
                drop(c); // Release read lock

                // Execute job
                let result = JobRunner::execute(&job).await;

                // Report result
                let c = client.read().await;
                if let Err(e) = c.report_job_result(result).await {
                    tracing::error!("Failed to report job result: {}", e);
                }
            }
            Ok(None) => {
                tracing::trace!("No pending jobs");
            }
            Err(e) => {
                tracing::warn!("Job poll failed: {}", e);
            }
        }

        sleep(Duration::from_secs(config.job_poll_interval_sec)).await;
    }
}
