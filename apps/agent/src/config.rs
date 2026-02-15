// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r Agent - Configuration
// ─────────────────────────────────────────────────────────────

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub server_url: String,
    pub agent_id: Option<String>,
    pub agent_secret: Option<String>,
    pub enrollment_token: Option<String>,
    pub organization_id: Option<String>,

    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval_sec: u64,

    #[serde(default = "default_metrics_interval")]
    pub metrics_interval_sec: u64,

    #[serde(default = "default_inventory_interval")]
    pub inventory_interval_sec: u64,

    #[serde(default = "default_job_poll_interval")]
    pub job_poll_interval_sec: u64,

    #[serde(default)]
    pub capabilities: Vec<String>,

    #[serde(default = "default_log_level")]
    pub log_level: String,
}

fn default_heartbeat_interval() -> u64 { 10 }
fn default_metrics_interval() -> u64 { 15 }
fn default_inventory_interval() -> u64 { 300 }
fn default_job_poll_interval() -> u64 { 3 }
fn default_log_level() -> String { "info".to_string() }

impl AgentConfig {
    pub fn load() -> Result<Self> {
        let config_path = Self::config_path()?;

        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .context("Failed to read config file")?;
            let config: AgentConfig = toml::from_str(&content)
                .context("Failed to parse config file")?;
            Ok(config)
        } else {
            // Create default config
            let config = AgentConfig {
                server_url: "http://localhost:4000".to_string(),
                agent_id: None,
                agent_secret: None,
                enrollment_token: Some("ENROLL-DEFAULT-2024-MASSVISION".to_string()),
                organization_id: None,
                heartbeat_interval_sec: default_heartbeat_interval(),
                metrics_interval_sec: default_metrics_interval(),
                inventory_interval_sec: default_inventory_interval(),
                job_poll_interval_sec: default_job_poll_interval(),
                capabilities: vec![
                    "run_script".to_string(),
                    "remote_shell".to_string(),
                    "reboot".to_string(),
                    "shutdown".to_string(),
                    "service_management".to_string(),
                    "process_management".to_string(),
                    "inventory".to_string(),
                    "metrics".to_string(),
                ],
                log_level: default_log_level(),
            };

            // Save default config
            config.save()?;
            Ok(config)
        }
    }

    pub fn save(&self) -> Result<()> {
        let config_path = Self::config_path()?;

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)
                .context("Failed to create config directory")?;
        }

        let content = toml::to_string_pretty(self)
            .context("Failed to serialize config")?;
        std::fs::write(&config_path, content)
            .context("Failed to write config file")?;

        tracing::info!("Config saved to {:?}", config_path);
        Ok(())
    }

    pub fn is_enrolled(&self) -> bool {
        self.agent_id.is_some() && self.agent_secret.is_some()
    }

    fn config_path() -> Result<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            Ok(PathBuf::from(r"C:\ProgramData\MASSVISION\Reap3r\agent.toml"))
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(PathBuf::from("/etc/massvision/reap3r/agent.toml"))
        }
    }
}
