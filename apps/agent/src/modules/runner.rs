// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r Agent - Job Runner
// ─────────────────────────────────────────────────────────────

use anyhow::{Result, Context};
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use crate::comms::protocol::{JobRequest, JobResult};

pub struct JobRunner;

impl JobRunner {
    /// Execute a job based on its type and payload.
    pub async fn execute(job: &JobRequest) -> JobResult {
        let started_at = chrono::Utc::now().timestamp();

        let result = match job.job_type.as_str() {
            "run_script" => Self::run_script(job).await,
            "reboot" => Self::reboot(job).await,
            "shutdown" => Self::shutdown(job).await,
            "service_restart" => Self::service_action(job, "restart").await,
            "service_stop" => Self::service_action(job, "stop").await,
            "service_start" => Self::service_action(job, "start").await,
            "process_kill" => Self::process_kill(job).await,
            _ => Err(anyhow::anyhow!("Unsupported job type: {}", job.job_type)),
        };

        let completed_at = chrono::Utc::now().timestamp();

        match result {
            Ok(mut jr) => {
                jr.started_at = started_at;
                jr.completed_at = completed_at;
                jr
            }
            Err(e) => JobResult {
                job_id: job.job_id.clone(),
                status: "failed".to_string(),
                started_at,
                completed_at,
                stdout: None,
                stderr: None,
                exit_code: None,
                error_message: Some(e.to_string()),
                result_data: None,
            },
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Run Script
    // ═══════════════════════════════════════════════════════════

    async fn run_script(job: &JobRequest) -> Result<JobResult> {
        let language = job.payload.get("language")
            .and_then(|v| v.as_str())
            .unwrap_or("powershell");

        let script = job.payload.get("script")
            .and_then(|v| v.as_str())
            .context("Missing script in payload")?;

        let working_dir = job.payload.get("working_dir")
            .and_then(|v| v.as_str());

        let timeout_duration = Duration::from_secs(job.timeout_sec);

        let mut cmd = match language {
            "powershell" => {
                let mut c = Command::new("powershell");
                c.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script]);
                c
            }
            "bash" => {
                let mut c = Command::new("bash");
                c.args(["-c", script]);
                c
            }
            "python" => {
                let mut c = Command::new("python3");
                c.args(["-c", script]);
                c
            }
            "cmd" => {
                let mut c = Command::new("cmd");
                c.args(["/C", script]);
                c
            }
            _ => {
                return Ok(JobResult {
                    job_id: job.job_id.clone(),
                    status: "failed".to_string(),
                    started_at: 0,
                    completed_at: 0,
                    stdout: None,
                    stderr: None,
                    exit_code: None,
                    error_message: Some(format!("Unsupported language: {}", language)),
                    result_data: None,
                });
            }
        };

        if let Some(dir) = working_dir {
            cmd.current_dir(dir);
        }

        // Set environment variables
        if let Some(env_vars) = job.payload.get("env_vars").and_then(|v| v.as_object()) {
            for (key, value) in env_vars {
                if let Some(val) = value.as_str() {
                    cmd.env(key, val);
                }
            }
        }

        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let output = timeout(timeout_duration, cmd.output()).await;

        match output {
            Ok(Ok(out)) => {
                let exit_code = out.status.code().unwrap_or(-1);
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();

                // Truncate output to 1MB
                let stdout = if stdout.len() > 1_048_576 {
                    format!("{}... [truncated]", &stdout[..1_048_576])
                } else {
                    stdout
                };
                let stderr = if stderr.len() > 1_048_576 {
                    format!("{}... [truncated]", &stderr[..1_048_576])
                } else {
                    stderr
                };

                Ok(JobResult {
                    job_id: job.job_id.clone(),
                    status: if exit_code == 0 { "success" } else { "failed" }.to_string(),
                    started_at: 0,
                    completed_at: 0,
                    stdout: if stdout.is_empty() { None } else { Some(stdout) },
                    stderr: if stderr.is_empty() { None } else { Some(stderr) },
                    exit_code: Some(exit_code),
                    error_message: None,
                    result_data: None,
                })
            }
            Ok(Err(e)) => Ok(JobResult {
                job_id: job.job_id.clone(),
                status: "failed".to_string(),
                started_at: 0,
                completed_at: 0,
                stdout: None,
                stderr: None,
                exit_code: None,
                error_message: Some(format!("Process execution error: {}", e)),
                result_data: None,
            }),
            Err(_) => Ok(JobResult {
                job_id: job.job_id.clone(),
                status: "timeout".to_string(),
                started_at: 0,
                completed_at: 0,
                stdout: None,
                stderr: None,
                exit_code: None,
                error_message: Some(format!("Job timed out after {} seconds", job.timeout_sec)),
                result_data: None,
            }),
        }
    }

    // ═══════════════════════════════════════════════════════════
    // System Power Actions
    // ═══════════════════════════════════════════════════════════

    async fn reboot(job: &JobRequest) -> Result<JobResult> {
        let force = job.payload.get("force").and_then(|v| v.as_bool()).unwrap_or(false);

        tracing::warn!("Executing REBOOT (force={})", force);

        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("shutdown");
            c.args(["/r", "/t", "5"]);
            if force { c.arg("/f"); }
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let mut c = Command::new("shutdown");
            c.args(["-r", "+0"]);
            c
        };

        let output = cmd.output().await?;

        Ok(JobResult {
            job_id: job.job_id.clone(),
            status: "success".to_string(),
            started_at: 0,
            completed_at: 0,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: if output.stderr.is_empty() { None } else { Some(String::from_utf8_lossy(&output.stderr).to_string()) },
            exit_code: output.status.code(),
            error_message: None,
            result_data: None,
        })
    }

    async fn shutdown(job: &JobRequest) -> Result<JobResult> {
        let force = job.payload.get("force").and_then(|v| v.as_bool()).unwrap_or(false);
        let delay = job.payload.get("delay_sec").and_then(|v| v.as_u64()).unwrap_or(0);

        tracing::warn!("Executing SHUTDOWN (force={}, delay={}s)", force, delay);

        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("shutdown");
            c.args(["/s", "/t", &delay.to_string()]);
            if force { c.arg("/f"); }
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let mut c = Command::new("shutdown");
            if delay == 0 {
                c.args(["-h", "now"]);
            } else {
                c.args(["-h", &format!("+{}", delay / 60)]);
            }
            c
        };

        let output = cmd.output().await?;

        Ok(JobResult {
            job_id: job.job_id.clone(),
            status: "success".to_string(),
            started_at: 0,
            completed_at: 0,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: if output.stderr.is_empty() { None } else { Some(String::from_utf8_lossy(&output.stderr).to_string()) },
            exit_code: output.status.code(),
            error_message: None,
            result_data: None,
        })
    }

    // ═══════════════════════════════════════════════════════════
    // Service Management
    // ═══════════════════════════════════════════════════════════

    async fn service_action(job: &JobRequest, action: &str) -> Result<JobResult> {
        let service_name = job.payload.get("service_name")
            .and_then(|v| v.as_str())
            .context("Missing service_name in payload")?;

        tracing::info!("Service {}: {}", action, service_name);

        #[cfg(target_os = "windows")]
        let cmd_args = match action {
            "restart" => vec!["Restart-Service", "-Name", service_name, "-Force"],
            "stop" => vec!["Stop-Service", "-Name", service_name, "-Force"],
            "start" => vec!["Start-Service", "-Name", service_name],
            _ => return Err(anyhow::anyhow!("Unknown service action: {}", action)),
        };

        #[cfg(not(target_os = "windows"))]
        let cmd_args = vec!["systemctl", action, service_name];

        #[cfg(target_os = "windows")]
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command"])
            .args(&cmd_args)
            .output()
            .await?;

        #[cfg(not(target_os = "windows"))]
        let output = Command::new(cmd_args[0])
            .args(&cmd_args[1..])
            .output()
            .await?;

        let exit_code = output.status.code().unwrap_or(-1);

        Ok(JobResult {
            job_id: job.job_id.clone(),
            status: if exit_code == 0 { "success" } else { "failed" }.to_string(),
            started_at: 0,
            completed_at: 0,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: if output.stderr.is_empty() { None } else { Some(String::from_utf8_lossy(&output.stderr).to_string()) },
            exit_code: Some(exit_code),
            error_message: None,
            result_data: None,
        })
    }

    // ═══════════════════════════════════════════════════════════
    // Process Kill
    // ═══════════════════════════════════════════════════════════

    async fn process_kill(job: &JobRequest) -> Result<JobResult> {
        let pid = job.payload.get("pid")
            .and_then(|v| v.as_u64())
            .context("Missing pid in payload")? as u32;

        tracing::info!("Killing process PID: {}", pid);

        #[cfg(target_os = "windows")]
        let output = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .await?;

        #[cfg(not(target_os = "windows"))]
        let output = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .await?;

        let exit_code = output.status.code().unwrap_or(-1);

        Ok(JobResult {
            job_id: job.job_id.clone(),
            status: if exit_code == 0 { "success" } else { "failed" }.to_string(),
            started_at: 0,
            completed_at: 0,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: if output.stderr.is_empty() { None } else { Some(String::from_utf8_lossy(&output.stderr).to_string()) },
            exit_code: Some(exit_code),
            error_message: None,
            result_data: None,
        })
    }
}
