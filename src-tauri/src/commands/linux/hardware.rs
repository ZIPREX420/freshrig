//! Linux hardware detection via /proc, /sys, lspci, lsblk, and dmidecode.
//!
//! Mirrors `commands::hardware` on Windows: the same Tauri command names return
//! the same cross-platform `models::hardware::*` structs so the frontend is
//! OS-agnostic.

use std::fs;

use crate::commands::linux::util::{read_trim, run_cmd, run_cmd_lossy, which};
use crate::models::hardware::*;

#[tauri::command]
pub async fn get_hardware_summary() -> Result<HardwareSummary, String> {
    tokio::task::spawn_blocking(move || {
        Ok::<HardwareSummary, String>(HardwareSummary {
            system: read_system(),
            cpu: read_cpu(),
            gpus: read_gpus(),
            disks: read_disks(),
            network_adapters: read_network_adapters(),
            audio_devices: read_audio_devices(),
            motherboard: read_motherboard(),
        })
    })
    .await
    .map_err(|e| format!("hardware task failed: {}", e))?
}

#[tauri::command]
pub async fn get_driver_issues() -> Result<Vec<DriverIssue>, String> {
    // Linux does not track "driver issues" the way Windows' Device Manager does.
    // Anything noteworthy is surfaced via `drivers::get_driver_recommendations`.
    Ok(Vec::new())
}

#[tauri::command]
pub fn get_windows_build() -> u32 {
    // Sentinel: 0 means "not Windows / unknown build". The frontend already
    // handles 0 gracefully.
    0
}

// ---- System ----

fn read_system() -> SystemInfo {
    let hostname = read_trim("/etc/hostname").unwrap_or_else(|| "localhost".to_string());

    let os = os_info::get();
    let os_version = os.version().to_string();
    let os_build = os.edition().unwrap_or("").to_string();
    let architecture = std::env::consts::ARCH.to_string();

    let total_ram_gb = read_meminfo_kb("MemTotal")
        .map(|kb| (kb as f64) / 1024.0 / 1024.0)
        .map(|g| (g * 100.0).round() / 100.0)
        .unwrap_or(0.0);

    let uptime_seconds = fs::read_to_string("/proc/uptime")
        .ok()
        .and_then(|s| {
            s.split_whitespace()
                .next()
                .and_then(|v| v.parse::<f64>().ok())
        })
        .map(|v| v as u64)
        .unwrap_or(0);

    SystemInfo {
        hostname,
        os_version,
        os_build,
        architecture,
        total_ram_gb,
        uptime_seconds,
    }
}

fn read_meminfo_kb(key: &str) -> Option<u64> {
    let data = fs::read_to_string("/proc/meminfo").ok()?;
    let prefix = format!("{}:", key);
    for line in data.lines() {
        if let Some(rest) = line.strip_prefix(&prefix) {
            return rest
                .split_whitespace()
                .next()
                .and_then(|v| v.parse::<u64>().ok());
        }
    }
    None
}

// ---- CPU ----

fn read_cpu() -> CpuInfo {
    let data = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();

    let mut name = String::new();
    let mut manufacturer = String::new();
    let mut cores: u32 = 0;
    let mut threads: u32 = 0;
    let mut max_clock_mhz: u32 = 0;

    for line in data.lines() {
        let (key, value) = match line.split_once(':') {
            Some((k, v)) => (k.trim(), v.trim()),
            None => continue,
        };

        match key {
            "model name" if name.is_empty() => name = value.to_string(),
            "vendor_id" if manufacturer.is_empty() => manufacturer = value.to_string(),
            "cpu cores" if cores == 0 => {
                if let Ok(n) = value.parse::<u32>() {
                    cores = n;
                }
            }
            "processor" => threads += 1,
            "cpu MHz" if max_clock_mhz == 0 => {
                if let Ok(f) = value.parse::<f32>() {
                    max_clock_mhz = f.round() as u32;
                }
            }
            _ => {}
        }
    }

    // Try /sys for a more accurate max frequency if cpuinfo gave us the
    // current rather than the peak.
    if let Some(khz) = read_trim("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")
        .and_then(|s| s.parse::<u64>().ok())
    {
        let mhz = (khz / 1000) as u32;
        if mhz > max_clock_mhz {
            max_clock_mhz = mhz;
        }
    }

    // Manufacturer mapping: present user-friendly brand names.
    let manufacturer = match manufacturer.as_str() {
        "GenuineIntel" => "Intel".to_string(),
        "AuthenticAMD" => "AMD".to_string(),
        other if !other.is_empty() => other.to_string(),
        _ => String::new(),
    };

    CpuInfo {
        name,
        manufacturer,
        cores,
        threads,
        max_clock_mhz,
    }
}

// ---- GPUs ----

fn read_gpus() -> Vec<GpuInfo> {
    let Ok(output) = run_cmd("lspci", &["-mm", "-nn"]) else {
        return Vec::new();
    };

    let verbose = run_cmd("lspci", &["-vnn"]).unwrap_or_default();

    let mut gpus = Vec::new();
    for line in output.lines() {
        // Example: 01:00.0 "VGA compatible controller [0300]" "NVIDIA Corporation [10de]" "GA104 [GeForce RTX 3070] [2484]" -r... "rev"
        if !line.contains("VGA compatible controller") && !line.contains("3D controller") {
            continue;
        }

        let bus = line
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .to_string();
        let parts: Vec<&str> = line.split('"').collect();
        // parts[1]=class, parts[3]=vendor, parts[5]=device
        let vendor_raw = parts.get(3).copied().unwrap_or("");
        let device_raw = parts.get(5).copied().unwrap_or("");

        let manufacturer = if vendor_raw.contains("NVIDIA") {
            "NVIDIA"
        } else if vendor_raw.contains("AMD") || vendor_raw.contains("Advanced Micro Devices") {
            "AMD"
        } else if vendor_raw.contains("Intel") {
            "Intel"
        } else {
            vendor_raw
                .split_once(" [")
                .map(|(v, _)| v)
                .unwrap_or(vendor_raw)
        }
        .to_string();

        // Clean device name: strip trailing "[hhhh]" PCI id.
        let name = strip_pci_id(device_raw);

        let driver_version = extract_kernel_driver(&verbose, &bus)
            .and_then(|drv| modinfo_version(&drv))
            .unwrap_or_default();

        gpus.push(GpuInfo {
            name,
            manufacturer,
            driver_version,
            driver_date: String::new(),
            vram_mb: 0, // unknown without vendor-specific tools
            pnp_device_id: bus,
            status: 0,
        });
    }

    gpus
}

fn strip_pci_id(s: &str) -> String {
    // "GA104 [GeForce RTX 3070] [2484]" → "GA104 [GeForce RTX 3070]"
    match s.rsplit_once(" [") {
        Some((head, tail)) if tail.ends_with(']') => head.to_string(),
        _ => s.to_string(),
    }
}

fn extract_kernel_driver(verbose: &str, bus: &str) -> Option<String> {
    // Find the block whose header starts with this bus address, then look for
    // "Kernel driver in use:" until we hit a blank line.
    let mut in_block = false;
    for line in verbose.lines() {
        if line.starts_with(bus) {
            in_block = true;
            continue;
        }
        if in_block {
            if line.trim().is_empty() {
                in_block = false;
                continue;
            }
            if let Some(rest) = line.trim().strip_prefix("Kernel driver in use:") {
                return Some(rest.trim().to_string());
            }
        }
    }
    None
}

fn modinfo_version(module: &str) -> Option<String> {
    if !which("modinfo") {
        return None;
    }
    let out = run_cmd("modinfo", &["-F", "version", module]).ok()?;
    let v = out.trim();
    if v.is_empty() {
        None
    } else {
        Some(v.to_string())
    }
}

// ---- Disks ----

fn read_disks() -> Vec<DiskInfo> {
    // lsblk with JSON + extra columns, -d for devices only, -b for raw bytes.
    let Ok(out) = run_cmd(
        "lsblk",
        &[
            "-J",
            "-d",
            "-b",
            "-o",
            "NAME,MODEL,SIZE,TYPE,ROTA,TRAN,SERIAL",
        ],
    ) else {
        return Vec::new();
    };

    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&out) else {
        return Vec::new();
    };

    let Some(devices) = parsed.get("blockdevices").and_then(|v| v.as_array()) else {
        return Vec::new();
    };

    devices
        .iter()
        .filter(|d| d.get("type").and_then(|t| t.as_str()) == Some("disk"))
        .map(|d| {
            let model = d
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let size_bytes = d.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
            let size_gb = (size_bytes as f64) / 1_000_000_000.0;
            let rotational = d.get("rota").and_then(|v| v.as_u64()).unwrap_or(1);
            let media_type = if rotational == 0 { "SSD" } else { "HDD" }.to_string();
            let interface_type = d
                .get("tran")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let serial_number = d
                .get("serial")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            DiskInfo {
                model,
                size_gb: (size_gb * 100.0).round() / 100.0,
                media_type,
                interface_type,
                serial_number,
            }
        })
        .collect()
}

// ---- Network adapters ----

fn read_network_adapters() -> Vec<NetworkAdapter> {
    let Ok(entries) = fs::read_dir("/sys/class/net") else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == "lo" {
            continue;
        }

        // Skip virtual interfaces by name.
        if name.starts_with("veth")
            || name.starts_with("docker")
            || name.starts_with("br-")
            || name.starts_with("virbr")
        {
            continue;
        }

        let base = format!("/sys/class/net/{}", name);

        // Skip loopback by type (ARPHRD_LOOPBACK=772).
        if read_trim(&format!("{}/type", base)).as_deref() == Some("772") {
            continue;
        }

        let mac_address = read_trim(&format!("{}/address", base)).unwrap_or_default();
        let connection_status = read_trim(&format!("{}/operstate", base)).unwrap_or_default();
        let speed_mbps = read_trim(&format!("{}/speed", base))
            .and_then(|s| s.parse::<i64>().ok())
            .and_then(|n| if n >= 0 { Some(n as u64) } else { None })
            .unwrap_or(0);

        out.push(NetworkAdapter {
            name,
            manufacturer: String::new(),
            mac_address,
            connection_status,
            speed_mbps,
        });
    }

    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

// ---- Audio ----

fn read_audio_devices() -> Vec<AudioDevice> {
    let Ok(out) = run_cmd("lspci", &["-mm", "-nn"]) else {
        return Vec::new();
    };

    let mut devices = Vec::new();
    for line in out.lines() {
        if !line.contains("Audio device") && !line.contains("Multimedia audio controller") {
            continue;
        }
        let parts: Vec<&str> = line.split('"').collect();
        let vendor_raw = parts.get(3).copied().unwrap_or("");
        let device_raw = parts.get(5).copied().unwrap_or("");

        let manufacturer = vendor_raw
            .split_once(" [")
            .map(|(v, _)| v)
            .unwrap_or(vendor_raw)
            .to_string();
        let name = strip_pci_id(device_raw);

        devices.push(AudioDevice {
            name,
            manufacturer,
            status: "OK".to_string(),
        });
    }
    devices
}

// ---- Motherboard ----

fn read_motherboard() -> MotherboardInfo {
    let manufacturer = read_trim("/sys/class/dmi/id/board_vendor").unwrap_or_default();
    let product = read_trim("/sys/class/dmi/id/board_name").unwrap_or_default();
    let serial_number = read_trim("/sys/class/dmi/id/board_serial").unwrap_or_default();
    let bios_version = read_trim("/sys/class/dmi/id/bios_version").unwrap_or_default();

    MotherboardInfo {
        manufacturer,
        product,
        serial_number,
        bios_version,
    }
}

#[allow(dead_code)]
fn lspci_present() -> bool {
    // Probe used by other modules; keep lints happy if we wire it later.
    !run_cmd_lossy("lspci", &["-h"]).is_empty()
}
