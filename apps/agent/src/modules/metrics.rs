// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r Agent - System Metrics Collector
// ─────────────────────────────────────────────────────────────

use anyhow::Result;
use chrono::Utc;
use sysinfo::{System, Disks, Networks};
use crate::comms::protocol::{MetricsPayload, CpuMetrics, MemoryMetrics, DiskMetrics, NetworkMetrics};

pub struct MetricsCollector {
    sys: System,
    disks: Disks,
    networks: Networks,
    prev_net: Vec<(String, u64, u64)>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        let disks = Disks::new_with_refreshed_list();
        let networks = Networks::new_with_refreshed_list();

        // Initialise previous network counters
        let prev_net: Vec<(String, u64, u64)> = networks
            .list()
            .iter()
            .map(|(name, data)| (name.to_string(), data.total_received(), data.total_transmitted()))
            .collect();

        Self {
            sys,
            disks,
            networks,
            prev_net,
        }
    }

    pub fn collect(&mut self) -> Result<MetricsPayload> {
        self.sys.refresh_all();
        self.disks.refresh();
        self.networks.refresh();

        // ── CPU ─────────────────────────────────────────────
        let cpu_usage = self.sys.global_cpu_info().cpu_usage() as f64;
        let cpus = self.sys.cpus();
        let cpu_cores = cpus.len() as u32;

        let cpu_model = cpus
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_default();

        let frequency_mhz = cpus
            .first()
            .map(|c| c.frequency())
            .unwrap_or(0);

        let per_core_usage: Vec<f64> = cpus.iter().map(|c| c.cpu_usage() as f64).collect();

        let cpu = CpuMetrics {
            usage_percent: cpu_usage,
            cores: cpu_cores,
            model: cpu_model,
            frequency_mhz,
            per_core_usage,
        };

        // ── Memory ──────────────────────────────────────────
        let memory = MemoryMetrics {
            total_bytes: self.sys.total_memory(),
            used_bytes: self.sys.used_memory(),
            available_bytes: self.sys.available_memory(),
            swap_total_bytes: self.sys.total_swap(),
            swap_used_bytes: self.sys.used_swap(),
        };

        // ── Disks ───────────────────────────────────────────
        let disks: Vec<DiskMetrics> = self
            .disks
            .list()
            .iter()
            .map(|d| {
                let total = d.total_space();
                let available = d.available_space();
                DiskMetrics {
                    mount_point: d.mount_point().to_string_lossy().to_string(),
                    device: d.name().to_string_lossy().to_string(),
                    fs_type: d.file_system().to_string_lossy().to_string(),
                    total_bytes: total,
                    used_bytes: total.saturating_sub(available),
                    available_bytes: available,
                    read_bytes_sec: 0,
                    write_bytes_sec: 0,
                }
            })
            .collect();

        // ── Network ─────────────────────────────────────────
        let mut new_prev: Vec<(String, u64, u64)> = Vec::new();
        let network: Vec<NetworkMetrics> = self
            .networks
            .list()
            .iter()
            .map(|(name, data)| {
                let total_rx = data.total_received();
                let total_tx = data.total_transmitted();

                // Delta from previous snapshot
                let (rx_sec, tx_sec) = self
                    .prev_net
                    .iter()
                    .find(|(n, _, _)| n == name)
                    .map(|(_, prev_rx, prev_tx)| {
                        (
                            total_rx.saturating_sub(*prev_rx),
                            total_tx.saturating_sub(*prev_tx),
                        )
                    })
                    .unwrap_or((0, 0));

                new_prev.push((name.to_string(), total_rx, total_tx));

                let mac = data.mac_address().to_string();

                NetworkMetrics {
                    interface_name: name.to_string(),
                    ip_address: String::new(),
                    mac_address: mac,
                    rx_bytes_sec: rx_sec,
                    tx_bytes_sec: tx_sec,
                    rx_packets_sec: 0,
                    tx_packets_sec: 0,
                }
            })
            .collect();
        self.prev_net = new_prev;

        // ── Aggregate ───────────────────────────────────────
        let processes_count = self.sys.processes().len() as u32;
        let uptime_sec = System::uptime();

        Ok(MetricsPayload {
            timestamp: Utc::now().timestamp_millis(),
            cpu,
            memory,
            disks,
            network,
            processes_count,
            uptime_sec,
        })
    }
}
