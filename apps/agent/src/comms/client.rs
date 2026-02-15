// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r Agent - HTTP Client & Envelope Signer
// ─────────────────────────────────────────────────────────────

use anyhow::{Context, Result, bail};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

use super::protocol::*;

type HmacSha256 = Hmac<Sha256>;

pub struct AgentClient {
    http: reqwest::Client,
    base_url: String,
    agent_id: Option<String>,
    agent_secret: Option<String>,
}

impl AgentClient {
    pub fn new(base_url: &str) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .user_agent(format!("MASSVISION-Agent/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            agent_id: None,
            agent_secret: None,
        }
    }

    pub fn set_credentials(&mut self, agent_id: String, agent_secret: String) {
        self.agent_id = Some(agent_id);
        self.agent_secret = Some(agent_secret);
    }

    // ═══════════════════════════════════════════════════════════
    // HMAC Envelope Construction
    // ═══════════════════════════════════════════════════════════

    fn build_envelope(&self, msg_type: &str, payload: serde_json::Value) -> Result<AgentEnvelope> {
        let agent_id = self.agent_id.as_ref()
            .context("Agent not enrolled: no agent_id")?;
        let secret = self.agent_secret.as_ref()
            .context("Agent not enrolled: no agent_secret")?;

        let ts = chrono::Utc::now().timestamp();
        let nonce = Uuid::new_v4().to_string();
        let payload_json = serde_json::to_string(&payload)?;

        // HMAC-SHA256("{agent_id}|{ts}|{nonce}|{type}|{payload_json}")
        let sign_payload = format!("{}|{}|{}|{}|{}", agent_id, ts, nonce, msg_type, payload_json);
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .context("Invalid HMAC key")?;
        mac.update(sign_payload.as_bytes());
        let hmac_hex = hex::encode(mac.finalize().into_bytes());

        Ok(AgentEnvelope {
            agent_id: agent_id.clone(),
            ts,
            nonce,
            msg_type: msg_type.to_string(),
            payload,
            hmac: hmac_hex,
        })
    }

    // ═══════════════════════════════════════════════════════════
    // Enrollment
    // ═══════════════════════════════════════════════════════════

    pub async fn enroll(&self, req: &EnrollmentRequest) -> Result<EnrollmentResponse> {
        let url = format!("{}/agent-v2/enroll", self.base_url);
        tracing::info!("Enrolling agent at {}", url);

        let response = self.http
            .post(&url)
            .json(req)
            .send()
            .await
            .context("Failed to connect to server for enrollment")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            bail!("Enrollment failed (HTTP {}): {}", status, body);
        }

        let api_resp: ApiResponse<EnrollmentResponse> = response.json().await
            .context("Failed to parse enrollment response")?;

        if !api_resp.success {
            bail!("Enrollment rejected: {}", api_resp.error.unwrap_or_default());
        }

        tracing::info!("Enrollment successful! Agent ID: {}", api_resp.data.agent_id);
        Ok(api_resp.data)
    }

    // ═══════════════════════════════════════════════════════════
    // Heartbeat
    // ═══════════════════════════════════════════════════════════

    pub async fn heartbeat(&self, payload: HeartbeatPayload) -> Result<HeartbeatResponse> {
        let envelope = self.build_envelope("heartbeat", serde_json::to_value(&payload)?)?;
        let url = format!("{}/agent-v2/heartbeat", self.base_url);

        let response = self.http
            .post(&url)
            .json(&envelope)
            .send()
            .await
            .context("Heartbeat request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            bail!("Heartbeat rejected (HTTP {}): {}", status, body);
        }

        let api_resp: ApiResponse<HeartbeatResponse> = response.json().await
            .context("Failed to parse heartbeat response")?;

        Ok(api_resp.data)
    }

    // ═══════════════════════════════════════════════════════════
    // Metrics
    // ═══════════════════════════════════════════════════════════

    pub async fn report_metrics(&self, payload: MetricsPayload) -> Result<()> {
        let envelope = self.build_envelope("metrics", serde_json::to_value(&payload)?)?;
        let url = format!("{}/agent-v2/metrics", self.base_url);

        let response = self.http
            .post(&url)
            .json(&envelope)
            .send()
            .await
            .context("Metrics report failed")?;

        if !response.status().is_success() {
            let status = response.status();
            tracing::warn!("Metrics rejected (HTTP {})", status);
        }

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════
    // Inventory
    // ═══════════════════════════════════════════════════════════

    pub async fn report_inventory(&self, payload: InventoryPayload) -> Result<()> {
        let envelope = self.build_envelope("inventory", serde_json::to_value(&payload)?)?;
        let url = format!("{}/agent-v2/inventory", self.base_url);

        let response = self.http
            .post(&url)
            .json(&envelope)
            .send()
            .await
            .context("Inventory report failed")?;

        if !response.status().is_success() {
            let status = response.status();
            tracing::warn!("Inventory rejected (HTTP {})", status);
        }

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════
    // Job Polling
    // ═══════════════════════════════════════════════════════════

    pub async fn poll_jobs(&self) -> Result<Option<JobRequest>> {
        let envelope = self.build_envelope("job_poll", serde_json::json!({}))?;
        let url = format!("{}/agent-v2/jobs/next", self.base_url);

        let response = self.http
            .post(&url)
            .json(&envelope)
            .send()
            .await
            .context("Job poll failed")?;

        if response.status().as_u16() == 204 {
            return Ok(None); // No pending jobs
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            bail!("Job poll failed (HTTP {}): {}", status, body);
        }

        let api_resp: ApiResponse<Option<JobRequest>> = response.json().await
            .context("Failed to parse job poll response")?;

        Ok(api_resp.data)
    }

    // ═══════════════════════════════════════════════════════════
    // Job Result
    // ═══════════════════════════════════════════════════════════

    pub async fn report_job_result(&self, result: JobResult) -> Result<()> {
        let envelope = self.build_envelope("job_result", serde_json::to_value(&result)?)?;
        let url = format!("{}/agent-v2/job-result", self.base_url);

        let response = self.http
            .post(&url)
            .json(&envelope)
            .send()
            .await
            .context("Job result report failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            bail!("Job result rejected (HTTP {}): {}", status, body);
        }

        tracing::info!("Job result reported: {}", result.job_id);
        Ok(())
    }
}
