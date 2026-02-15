// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r Agent - Inventory Collector
// ─────────────────────────────────────────────────────────────

use anyhow::Result;
use chrono::Utc;
use sysinfo::{System, Networks};
use crate::comms::protocol::*;

pub struct InventoryCollector;

impl InventoryCollector {
    pub fn collect() -> Result<InventoryPayload> {
        let mut sys = System::new_all();
        sys.refresh_all();

        let os_info = Self::collect_os();
        let hardware = Self::collect_hardware(&sys);
        let network_config = Self::collect_network();
        let services = Self::collect_services();
        let users = Self::collect_users();
        let software = Self::collect_software();

        Ok(InventoryPayload {
            timestamp: Utc::now().timestamp_millis(),
            os: os_info,
            hardware,
            software,
            services,
            users,
            network_config,
        })
    }

    fn collect_os() -> OsInfo {
        let os_type = match std::env::consts::OS {
            "windows" => "windows",
            "linux" => "linux",
            "macos" => "macos",
            _ => "linux",
        };

        OsInfo {
            os_type: os_type.to_string(),
            name: System::name().unwrap_or_else(|| "Unknown".to_string()),
            version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
            build: System::os_version().unwrap_or_default(),
            arch: std::env::consts::ARCH.to_string(),
            kernel: System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
            hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
            domain: String::new(),
            last_boot: {
                let uptime = System::uptime();
                Utc::now().timestamp() - uptime as i64
            },
        }
    }

    fn collect_hardware(sys: &System) -> HardwareInfo {
        let cpus = sys.cpus();
        let cpu_model = cpus
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        HardwareInfo {
            manufacturer: String::new(),
            model: String::new(),
            serial_number: String::new(),
            bios_version: String::new(),
            cpu_model,
            cpu_cores: sys.physical_core_count().unwrap_or(0) as u32,
            cpu_threads: cpus.len() as u32,
            ram_total_bytes: sys.total_memory(),
            ram_slots: Vec::new(),
            gpu: Vec::new(),
        }
    }

    fn collect_network() -> Vec<NetworkConfig> {
        let networks = Networks::new_with_refreshed_list();
        networks
            .list()
            .iter()
            .map(|(name, data)| {
                NetworkConfig {
                    interface_name: name.to_string(),
                    ip_addresses: Vec::new(),
                    mac_address: data.mac_address().to_string(),
                    gateway: String::new(),
                    dns_servers: Vec::new(),
                    dhcp_enabled: false,
                }
            })
            .collect()
    }

    fn collect_services() -> Vec<ServiceInfo> {
        #[cfg(target_os = "linux")]
        {
            linux_inventory::collect_services()
        }
        #[cfg(not(target_os = "linux"))]
        {
            Vec::new()
        }
    }

    fn collect_users() -> Vec<LocalUser> {
        #[cfg(target_os = "linux")]
        {
            linux_inventory::collect_users()
        }
        #[cfg(not(target_os = "linux"))]
        {
            Vec::new()
        }
    }

    fn collect_software() -> Vec<InstalledSoftware> {
        #[cfg(target_os = "windows")]
        {
            windows_inventory::collect_software()
        }
        #[cfg(target_os = "linux")]
        {
            linux_inventory::collect_software()
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        {
            Vec::new()
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Platform-specific implementations
// ═══════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
pub mod windows_inventory {
    use super::*;

    pub fn collect_software() -> Vec<InstalledSoftware> {
        let mut software = Vec::new();

        if let Ok(hklm) = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall")
        {
            for key_name in hklm.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(subkey) = hklm.open_subkey(&key_name) {
                    let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                    if !name.is_empty() {
                        software.push(InstalledSoftware {
                            name,
                            version: subkey.get_value("DisplayVersion").unwrap_or_default(),
                            publisher: subkey.get_value("Publisher").unwrap_or_default(),
                            install_date: subkey.get_value("InstallDate").unwrap_or_default(),
                            size_bytes: subkey.get_value::<u32, _>("EstimatedSize")
                                .map(|s| s as u64 * 1024)
                                .unwrap_or(0),
                        });
                    }
                }
            }
        }

        software
    }
}

#[cfg(target_os = "linux")]
pub mod linux_inventory {
    use super::*;
    use std::process::Command;

    pub fn collect_services() -> Vec<ServiceInfo> {
        let output = Command::new("systemctl")
            .args(["list-units", "--type=service", "--all", "--no-pager", "--plain", "--no-legend"])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                stdout
                    .lines()
                    .filter_map(|line| {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 4 {
                            let status = match parts[3] {
                                "running" => "running",
                                "exited" | "dead" => "stopped",
                                _ => "unknown",
                            };
                            Some(ServiceInfo {
                                name: parts[0].trim_end_matches(".service").to_string(),
                                display_name: parts[0].trim_end_matches(".service").to_string(),
                                status: status.to_string(),
                                start_type: "unknown".to_string(),
                                pid: None,
                            })
                        } else {
                            None
                        }
                    })
                    .collect()
            }
            Err(_) => Vec::new(),
        }
    }

    pub fn collect_software() -> Vec<InstalledSoftware> {
        let output = Command::new("dpkg-query")
            .args(["-W", "-f=${Package}\t${Version}\t${Maintainer}\n"])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                stdout
                    .lines()
                    .filter_map(|line| {
                        let parts: Vec<&str> = line.split('\t').collect();
                        if parts.len() >= 2 {
                            Some(InstalledSoftware {
                                name: parts[0].to_string(),
                                version: parts[1].to_string(),
                                publisher: parts.get(2).map(|s| s.to_string()).unwrap_or_default(),
                                install_date: String::new(),
                                size_bytes: 0,
                            })
                        } else {
                            None
                        }
                    })
                    .collect()
            }
            _ => Vec::new(),
        }
    }

    pub fn collect_users() -> Vec<LocalUser> {
        let output = Command::new("getent")
            .args(["passwd"])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                stdout
                    .lines()
                    .filter_map(|line| {
                        let parts: Vec<&str> = line.split(':').collect();
                        if parts.len() >= 7 {
                            let uid: u32 = parts[2].parse().unwrap_or(65534);
                            if uid >= 1000 || uid == 0 {
                                let full_name = if parts.len() > 4 && !parts[4].is_empty() {
                                    parts[4].split(',').next().unwrap_or("").to_string()
                                } else {
                                    String::new()
                                };
                                Some(LocalUser {
                                    username: parts[0].to_string(),
                                    full_name,
                                    is_admin: uid == 0,
                                    is_active: !parts[6].contains("nologin")
                                        && !parts[6].contains("false"),
                                    last_login: None,
                                })
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    })
                    .collect()
            }
            Err(_) => Vec::new(),
        }
    }
}
