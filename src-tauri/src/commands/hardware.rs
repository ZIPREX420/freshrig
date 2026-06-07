use std::collections::HashMap;
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;
use wmi::WMIConnection;

use crate::commands::wmi_util::extract_u32;
use crate::models::hardware::*;

/// Read the real VRAM from the registry (64-bit QWORD), which avoids the
/// 4 GB overflow of Win32_VideoController.AdapterRAM (32-bit uint).
/// Checks subkeys 0000, 0001, … under the display class GUID and matches
/// by GPU name. Returns bytes.
fn read_registry_vram(gpu_name: &str) -> Option<u64> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let base = hklm
        .open_subkey(r"SYSTEM\ControlSet001\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}")
        .ok()?;

    for i in 0u32..16 {
        let subkey_name = format!("{:04}", i);
        if let Ok(subkey) = base.open_subkey(&subkey_name) {
            // Check if this subkey matches our GPU by DriverDesc
            let desc: String = subkey.get_value("DriverDesc").unwrap_or_default();
            if !desc.is_empty() && gpu_name.contains(&desc) || desc.contains(gpu_name) {
                if let Ok(bytes) = subkey.get_raw_value("HardwareInformation.qwMemorySize") {
                    if bytes.bytes.len() >= 8 {
                        let vram = u64::from_le_bytes(bytes.bytes[..8].try_into().ok()?);
                        return Some(vram);
                    }
                }
            }
        }
    }
    None
}

fn format_wmi_date(raw: &str) -> String {
    // WMI dates look like "20240115000000.000000-000" or similar
    if raw.len() >= 8 {
        let year = &raw[0..4];
        let month = &raw[4..6];
        let day = &raw[6..8];
        format!("{}-{}-{}", year, month, day)
    } else {
        raw.to_string()
    }
}

fn map_net_connection_status(status: Option<u16>) -> String {
    match status {
        Some(0) => "Disconnected".to_string(),
        Some(1) => "Connecting".to_string(),
        Some(2) => "Connected".to_string(),
        Some(3) => "Disconnecting".to_string(),
        Some(4) => "Hardware not present".to_string(),
        Some(5) => "Hardware disabled".to_string(),
        Some(6) => "Hardware malfunction".to_string(),
        Some(7) => "Media disconnected".to_string(),
        Some(8) => "Authenticating".to_string(),
        Some(9) => "Authentication succeeded".to_string(),
        Some(10) => "Authentication failed".to_string(),
        Some(11) => "Invalid address".to_string(),
        Some(12) => "Credentials required".to_string(),
        _ => "Unknown".to_string(),
    }
}

fn map_error_code(code: u16) -> String {
    match code {
        1 => "Device not configured correctly".to_string(),
        3 => "Driver may be corrupted".to_string(),
        10 => "Device cannot start".to_string(),
        22 => "Device is disabled".to_string(),
        28 => "Drivers not installed".to_string(),
        31 => "Device not working properly".to_string(),
        n => format!("Unknown issue (code {})", n),
    }
}

fn detect_media_type(model: &str, interface: &str) -> String {
    let model_lower = model.to_lowercase();
    let interface_lower = interface.to_lowercase();
    if model_lower.contains("nvme") || interface_lower.contains("nvme") {
        "NVMe".to_string()
    } else if model_lower.contains("ssd") || model_lower.contains("solid state") {
        "SSD".to_string()
    } else {
        "HDD".to_string()
    }
}

fn default_hardware_summary() -> HardwareSummary {
    HardwareSummary {
        system: SystemInfo {
            hostname: "Unknown".to_string(),
            os_version: "Detection timed out".to_string(),
            os_build: "Unknown".to_string(),
            architecture: "Unknown".to_string(),
            total_ram_gb: 0.0,
            uptime_seconds: 0,
        },
        cpu: CpuInfo {
            name: "Detection timed out".to_string(),
            manufacturer: "Unknown".to_string(),
            cores: 0,
            threads: 0,
            max_clock_mhz: 0,
        },
        gpus: vec![],
        disks: vec![],
        network_adapters: vec![],
        audio_devices: vec![],
        motherboard: MotherboardInfo {
            manufacturer: "Unknown".to_string(),
            product: "Unknown".to_string(),
            serial_number: "Unknown".to_string(),
            bios_version: "Unknown".to_string(),
        },
    }
}

#[tauri::command]
pub async fn get_hardware_summary() -> Result<HardwareSummary, String> {
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        tokio::task::spawn_blocking(|| {
            let wmi = WMIConnection::new()
                .map_err(|e| format!("Failed to connect to WMI: {}", e))?;

        // --- System Info ---
        let system_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Name, TotalPhysicalMemory FROM Win32_ComputerSystem")
            .map_err(|e| format!("Failed to query Win32_ComputerSystem: {}", e))?;

        let os_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Caption, BuildNumber, OSArchitecture, LastBootUpTime FROM Win32_OperatingSystem")
            .map_err(|e| format!("Failed to query Win32_OperatingSystem: {}", e))?;

        let hostname = system_results
            .first()
            .and_then(|r| match r.get("Name") {
                Some(wmi::Variant::String(s)) => Some(s.clone()),
                _ => None,
            })
            .unwrap_or_else(|| "Unknown".to_string());

        let total_ram_bytes: u64 = system_results
            .first()
            .and_then(|r| match r.get("TotalPhysicalMemory") {
                Some(wmi::Variant::String(s)) => s.parse().ok(),
                Some(wmi::Variant::UI8(n)) => Some(*n),
                _ => None,
            })
            .unwrap_or(0);

        let total_ram_gb = total_ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0);

        let os = os_results.first();
        let os_version = os
            .and_then(|r| match r.get("Caption") {
                Some(wmi::Variant::String(s)) => Some(s.clone()),
                _ => None,
            })
            .unwrap_or_else(|| "Unknown".to_string());

        let os_build = os
            .and_then(|r| match r.get("BuildNumber") {
                Some(wmi::Variant::String(s)) => Some(s.clone()),
                _ => None,
            })
            .unwrap_or_else(|| "Unknown".to_string());

        let architecture = os
            .and_then(|r| match r.get("OSArchitecture") {
                Some(wmi::Variant::String(s)) => Some(s.clone()),
                _ => None,
            })
            .unwrap_or_else(|| "Unknown".to_string());

        let last_boot = os
            .and_then(|r| match r.get("LastBootUpTime") {
                Some(wmi::Variant::String(s)) => Some(s.clone()),
                _ => None,
            })
            .unwrap_or_default();

        // Parse WMI datetime to compute uptime
        let uptime_seconds = parse_wmi_uptime(&last_boot);

        let system = SystemInfo {
            hostname,
            os_version,
            os_build,
            architecture,
            total_ram_gb,
            uptime_seconds,
        };

        // --- CPU Info ---
        let cpu_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor")
            .map_err(|e| format!("Failed to query Win32_Processor: {}", e))?;

        let cpu_row = cpu_results.first();
        let cpu = CpuInfo {
            name: cpu_row
                .and_then(|r| match r.get("Name") {
                    Some(wmi::Variant::String(s)) => Some(s.trim().to_string()),
                    _ => None,
                })
                .unwrap_or_else(|| "Unknown".to_string()),
            manufacturer: cpu_row
                .and_then(|r| match r.get("Manufacturer") {
                    Some(wmi::Variant::String(s)) => Some(s.clone()),
                    _ => None,
                })
                .unwrap_or_else(|| "Unknown".to_string()),
            cores: cpu_row
                .and_then(|r| extract_u32(r, "NumberOfCores"))
                .unwrap_or(0),
            threads: cpu_row
                .and_then(|r| extract_u32(r, "NumberOfLogicalProcessors"))
                .unwrap_or(0),
            max_clock_mhz: cpu_row
                .and_then(|r| extract_u32(r, "MaxClockSpeed"))
                .unwrap_or(0),
        };

        // --- GPU Info ---
        let gpu_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Name, AdapterCompatibility, DriverVersion, DriverDate, AdapterRAM, PNPDeviceID, ConfigManagerErrorCode FROM Win32_VideoController")
            .map_err(|e| format!("Failed to query Win32_VideoController: {}", e))?;

        let gpus: Vec<GpuInfo> = gpu_results
            .iter()
            .map(|r| {
                let name = extract_string(r, "Name");

                // Try registry first for accurate 64-bit VRAM, fall back to WMI's 32-bit AdapterRAM
                let vram_bytes: u64 = read_registry_vram(&name).unwrap_or_else(|| {
                    match r.get("AdapterRAM") {
                        Some(wmi::Variant::UI4(n)) => *n as u64,
                        Some(wmi::Variant::I4(n)) => (*n as u32) as u64,
                        Some(wmi::Variant::UI8(n)) => *n,
                        Some(wmi::Variant::String(s)) => s.parse().unwrap_or(0),
                        _ => 0,
                    }
                });

                GpuInfo {
                    name,
                    manufacturer: extract_string(r, "AdapterCompatibility"),
                    driver_version: extract_string(r, "DriverVersion"),
                    driver_date: r
                        .get("DriverDate")
                        .and_then(|v| match v {
                            wmi::Variant::String(s) => Some(format_wmi_date(s)),
                            _ => None,
                        })
                        .unwrap_or_else(|| "Unknown".to_string()),
                    vram_mb: vram_bytes / (1024 * 1024),
                    pnp_device_id: extract_string(r, "PNPDeviceID"),
                    status: match r.get("ConfigManagerErrorCode") {
                        Some(wmi::Variant::UI4(n)) => *n as u16,
                        Some(wmi::Variant::I4(n)) => *n as u16,
                        _ => 0,
                    },
                }
            })
            .collect();

        // --- Disk Info ---
        let disk_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Model, Size, InterfaceType, SerialNumber FROM Win32_DiskDrive")
            .map_err(|e| format!("Failed to query Win32_DiskDrive: {}", e))?;

        let disks: Vec<DiskInfo> = disk_results
            .iter()
            .map(|r| {
                let size_bytes: u64 = match r.get("Size") {
                    Some(wmi::Variant::UI8(n)) => *n,
                    Some(wmi::Variant::String(s)) => s.parse().unwrap_or(0),
                    _ => 0,
                };
                let model = extract_string(r, "Model");
                let interface_type = extract_string(r, "InterfaceType");
                let media_type = detect_media_type(&model, &interface_type);

                DiskInfo {
                    model,
                    size_gb: size_bytes as f64 / (1024.0 * 1024.0 * 1024.0),
                    media_type,
                    interface_type,
                    serial_number: extract_string(r, "SerialNumber"),
                }
            })
            .collect();

        // --- Network Adapters ---
        let net_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Name, Manufacturer, MACAddress, NetConnectionStatus, Speed FROM Win32_NetworkAdapter WHERE PhysicalAdapter=TRUE")
            .map_err(|e| format!("Failed to query Win32_NetworkAdapter: {}", e))?;

        let network_adapters: Vec<NetworkAdapter> = net_results
            .iter()
            .map(|r| {
                let connection_status_code: Option<u16> = match r.get("NetConnectionStatus") {
                    Some(wmi::Variant::UI4(n)) => Some(*n as u16),
                    Some(wmi::Variant::I4(n)) => Some(*n as u16),
                    _ => None,
                };
                let speed_raw: u64 = match r.get("Speed") {
                    Some(wmi::Variant::UI8(n)) => *n,
                    Some(wmi::Variant::String(s)) => s.parse().unwrap_or(0),
                    _ => 0,
                };
                // WMI returns speed in bps; values above 100 Gbps are bogus (often i64 max)
                let speed_mbps = speed_raw / 1_000_000;
                let speed_mbps = if speed_mbps > 100_000 { 0 } else { speed_mbps };

                NetworkAdapter {
                    name: extract_string(r, "Name"),
                    manufacturer: extract_string(r, "Manufacturer"),
                    mac_address: extract_string(r, "MACAddress"),
                    connection_status: map_net_connection_status(connection_status_code),
                    speed_mbps,
                }
            })
            .collect();

        // --- Audio Devices ---
        let audio_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Name, Manufacturer, Status FROM Win32_SoundDevice")
            .map_err(|e| format!("Failed to query Win32_SoundDevice: {}", e))?;

        let audio_devices: Vec<AudioDevice> = audio_results
            .iter()
            .map(|r| AudioDevice {
                name: extract_string(r, "Name"),
                manufacturer: extract_string(r, "Manufacturer"),
                status: extract_string(r, "Status"),
            })
            .collect();

        // --- Motherboard ---
        let board_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT Manufacturer, Product, SerialNumber FROM Win32_BaseBoard")
            .map_err(|e| format!("Failed to query Win32_BaseBoard: {}", e))?;

        let bios_results: Vec<HashMap<String, wmi::Variant>> = wmi
            .raw_query("SELECT SMBIOSBIOSVersion FROM Win32_BIOS")
            .map_err(|e| format!("Failed to query Win32_BIOS: {}", e))?;

        let board = board_results.first();
        let bios = bios_results.first();

        let motherboard = MotherboardInfo {
            manufacturer: board
                .and_then(|r| match r.get("Manufacturer") {
                    Some(wmi::Variant::String(s)) => Some(s.clone()),
                    _ => None,
                })
                .unwrap_or_else(|| "Unknown".to_string()),
            product: board
                .and_then(|r| match r.get("Product") {
                    Some(wmi::Variant::String(s)) => Some(s.clone()),
                    _ => None,
                })
                .unwrap_or_else(|| "Unknown".to_string()),
            serial_number: board
                .and_then(|r| match r.get("SerialNumber") {
                    Some(wmi::Variant::String(s)) => Some(s.clone()),
                    _ => None,
                })
                .unwrap_or_else(|| "Unknown".to_string()),
            bios_version: bios
                .and_then(|r| match r.get("SMBIOSBIOSVersion") {
                    Some(wmi::Variant::String(s)) => Some(s.clone()),
                    _ => None,
                })
                .unwrap_or_else(|| "Unknown".to_string()),
        };

            Ok::<HardwareSummary, String>(HardwareSummary {
                system,
                cpu,
                gpus,
                disks,
                network_adapters,
                audio_devices,
                motherboard,
            })
        }),
    )
    .await;

    match result {
        Ok(Ok(Ok(summary))) => Ok(summary),
        Ok(Ok(Err(e))) => {
            eprintln!("WMI hardware query failed: {}", e);
            Ok(default_hardware_summary())
        }
        Ok(Err(e)) => {
            eprintln!("WMI hardware task join error: {}", e);
            Ok(default_hardware_summary())
        }
        Err(_) => {
            eprintln!("WMI hardware detection timed out after 15s");
            Ok(default_hardware_summary())
        }
    }
}

#[tauri::command]
pub async fn get_driver_issues() -> Result<Vec<DriverIssue>, String> {
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        tokio::task::spawn_blocking(|| {
            let wmi = WMIConnection::new()
                .map_err(|e| format!("Failed to connect to WMI: {}", e))?;

            let results: Vec<HashMap<String, wmi::Variant>> = wmi
                .raw_query("SELECT Name, DeviceID, HardwareID, ConfigManagerErrorCode FROM Win32_PnPEntity WHERE ConfigManagerErrorCode <> 0")
                .map_err(|e| format!("Failed to query Win32_PnPEntity: {}", e))?;

            let issues: Vec<DriverIssue> = results
                .iter()
                .map(|r| {
                    let error_code: u16 = match r.get("ConfigManagerErrorCode") {
                        Some(wmi::Variant::UI4(n)) => *n as u16,
                        Some(wmi::Variant::I4(n)) => *n as u16,
                        _ => 0,
                    };

                    let hardware_id: Vec<String> = match r.get("HardwareID") {
                        Some(wmi::Variant::Array(arr)) => arr
                            .iter()
                            .filter_map(|v| match v {
                                wmi::Variant::String(s) => Some(s.clone()),
                                _ => None,
                            })
                            .collect(),
                        _ => vec![],
                    };

                    DriverIssue {
                        device_name: extract_string(r, "Name"),
                        device_id: extract_string(r, "DeviceID"),
                        hardware_id,
                        error_code,
                        error_description: map_error_code(error_code),
                    }
                })
                .collect();

            Ok::<Vec<DriverIssue>, String>(issues)
        }),
    )
    .await;

    match result {
        Ok(Ok(Ok(issues))) => Ok(issues),
        Ok(Ok(Err(e))) => {
            eprintln!("WMI driver issues query failed: {}", e);
            Ok(vec![])
        }
        Ok(Err(e)) => {
            eprintln!("WMI driver issues task join error: {}", e);
            Ok(vec![])
        }
        Err(_) => {
            eprintln!("WMI driver issues detection timed out after 15s");
            Ok(vec![])
        }
    }
}

// --- Helper functions ---

fn extract_string(map: &HashMap<String, wmi::Variant>, key: &str) -> String {
    match map.get(key) {
        Some(wmi::Variant::String(s)) => s.clone(),
        Some(wmi::Variant::Null) => "Unknown".to_string(),
        Some(other) => format!("{:?}", other),
        None => "Unknown".to_string(),
    }
}

#[tauri::command]
pub fn get_windows_build() -> u32 {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    hklm.open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .ok()
        .and_then(|key| {
            let val: Result<String, _> = key.get_value("CurrentBuildNumber");
            val.ok()
        })
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0)
}

fn parse_wmi_uptime(last_boot: &str) -> u64 {
    // WMI datetime: "20240115134523.456789-060"
    if last_boot.len() < 14 {
        return 0;
    }

    let year: i64 = last_boot[0..4].parse().unwrap_or(0);
    let month: u32 = last_boot[4..6].parse().unwrap_or(1);
    let day: u32 = last_boot[6..8].parse().unwrap_or(1);
    let hour: u32 = last_boot[8..10].parse().unwrap_or(0);
    let min: u32 = last_boot[10..12].parse().unwrap_or(0);
    let sec: u32 = last_boot[12..14].parse().unwrap_or(0);

    // Simple epoch-ish calculation (approximate but good enough for uptime display)
    let boot_approx = ((year - 1970) * 365 * 24 * 3600)
        + (month as i64 * 30 * 24 * 3600)
        + (day as i64 * 24 * 3600)
        + (hour as i64 * 3600)
        + (min as i64 * 60)
        + sec as i64;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    if now > boot_approx {
        (now - boot_approx) as u64
    } else {
        0
    }
}
