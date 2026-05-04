//! Linux health report. Structs are duplicated from `commands::report` verbatim
//! (same derives + camelCase) so the frontend consumes identical JSON on either
//! OS without editing the Windows module.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;

use crate::commands::linux::hardware::get_driver_issues;
use crate::commands::linux::util::{distro_family, run_cmd_lossy, which};

// ---- Shared struct surface (kept byte-for-byte the same as Windows) ----

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportData {
    pub generated_at: String,
    pub app_version: String,
    pub overall_grade: String,
    pub overall_score: u32,
    pub system: SystemReport,
    pub hardware: HardwareReport,
    pub drives: Vec<DriveSmartReport>,
    pub battery: Option<BatteryReport>,
    pub security: SecurityReport,
    pub drivers: DriverSummaryReport,
    pub software_count: u32,
    pub startup_count: u32,
    pub startup_enabled_count: u32,
    pub reliability_index: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemReport {
    pub hostname: String,
    pub os_name: String,
    pub os_build: String,
    pub uptime_hours: u64,
    pub windows_activated: bool,
    pub windows_edition: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareReport {
    pub cpu_name: String,
    pub cpu_cores: u32,
    pub cpu_threads: u32,
    pub ram_total_gb: f32,
    pub ram_slots: Vec<RamSlotReport>,
    pub gpus: Vec<String>,
    pub motherboard: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RamSlotReport {
    pub capacity_gb: f32,
    pub speed_mhz: u32,
    pub manufacturer: String,
    pub part_number: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveSmartReport {
    pub model: String,
    pub size_gb: u64,
    pub health_status: String,
    pub temperature_c: Option<u32>,
    pub power_on_hours: Option<u64>,
    pub wear_percentage: Option<u32>,
    pub read_errors_total: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryReport {
    pub design_capacity_mwh: u32,
    pub full_charge_capacity_mwh: u32,
    pub cycle_count: u32,
    pub health_percent: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityReport {
    pub antivirus_name: Option<String>,
    pub antivirus_enabled: bool,
    pub antivirus_up_to_date: bool,
    pub firewall_enabled: bool,
    pub bitlocker_status: String,
    pub tpm_present: bool,
    pub tpm_enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverSummaryReport {
    pub total: u32,
    pub with_errors: u32,
    pub error_devices: Vec<String>,
}

// ---- Main command ----

#[tauri::command]
pub async fn generate_health_report(app_version: String) -> Result<ReportData, String> {
    let driver_issues = get_driver_issues().await.unwrap_or_default();

    tokio::task::spawn_blocking(move || {
        let hardware_summary = block_on_hardware();
        let system = read_system(&hardware_summary);
        let hardware = read_hardware(&hardware_summary);
        let drives = read_drives(&hardware_summary);
        let battery = read_battery();
        let security = read_security();
        let drivers = DriverSummaryReport {
            total: hardware_summary
                .as_ref()
                .map(|h| h.network_adapters.len() as u32 + h.audio_devices.len() as u32)
                .unwrap_or(0),
            with_errors: driver_issues.len() as u32,
            error_devices: driver_issues.into_iter().map(|d| d.device_name).collect(),
        };

        let software_count = read_software_count();
        let (startup_count, startup_enabled_count) = read_startup_counts();

        let generated_at = chrono_like_now();

        let mut report = ReportData {
            generated_at,
            app_version,
            overall_grade: String::new(),
            overall_score: 0,
            system,
            hardware,
            drives,
            battery,
            security,
            drivers,
            software_count,
            startup_count,
            startup_enabled_count,
            reliability_index: None,
        };

        let (grade, score) = compute_grade(&report);
        report.overall_grade = grade;
        report.overall_score = score;

        Ok::<ReportData, String>(report)
    })
    .await
    .map_err(|e| format!("report task failed: {}", e))?
}

// ---- Section builders ----

fn block_on_hardware() -> Option<crate::models::hardware::HardwareSummary> {
    // Reuse our own hardware collector synchronously by reading the same
    // sources directly — avoid spinning up another tokio runtime.
    use crate::models::hardware::*;
    Some(HardwareSummary {
        system: SystemInfo {
            hostname: fs::read_to_string("/etc/hostname")
                .unwrap_or_default()
                .trim()
                .to_string(),
            os_version: os_info::get().version().to_string(),
            os_build: os_info::get().edition().unwrap_or("").to_string(),
            architecture: std::env::consts::ARCH.to_string(),
            total_ram_gb: read_meminfo_kb("MemTotal")
                .map(|kb| (kb as f64) / 1024.0 / 1024.0)
                .map(|g| (g * 100.0).round() / 100.0)
                .unwrap_or(0.0),
            uptime_seconds: fs::read_to_string("/proc/uptime")
                .ok()
                .and_then(|s| {
                    s.split_whitespace()
                        .next()
                        .and_then(|v| v.parse::<f64>().ok())
                })
                .map(|v| v as u64)
                .unwrap_or(0),
        },
        cpu: CpuInfo {
            name: cpu_field("model name"),
            manufacturer: match cpu_field("vendor_id").as_str() {
                "GenuineIntel" => "Intel".into(),
                "AuthenticAMD" => "AMD".into(),
                o => o.to_string(),
            },
            cores: cpu_field("cpu cores").parse().unwrap_or(0),
            threads: cpu_processor_count(),
            max_clock_mhz: cpu_field("cpu MHz")
                .parse::<f32>()
                .ok()
                .map(|f| f.round() as u32)
                .unwrap_or(0),
        },
        gpus: Vec::new(),
        disks: Vec::new(),
        network_adapters: Vec::new(),
        audio_devices: Vec::new(),
        motherboard: MotherboardInfo {
            manufacturer: fs::read_to_string("/sys/class/dmi/id/board_vendor")
                .unwrap_or_default()
                .trim()
                .to_string(),
            product: fs::read_to_string("/sys/class/dmi/id/board_name")
                .unwrap_or_default()
                .trim()
                .to_string(),
            serial_number: String::new(),
            bios_version: fs::read_to_string("/sys/class/dmi/id/bios_version")
                .unwrap_or_default()
                .trim()
                .to_string(),
        },
    })
}

fn cpu_field(key: &str) -> String {
    let data = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let prefix = key.to_string();
    for line in data.lines() {
        if let Some((k, v)) = line.split_once(':') {
            if k.trim() == prefix {
                return v.trim().to_string();
            }
        }
    }
    String::new()
}

fn cpu_processor_count() -> u32 {
    let data = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    data.lines().filter(|l| l.starts_with("processor")).count() as u32
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

fn read_system(hw: &Option<crate::models::hardware::HardwareSummary>) -> SystemReport {
    let os = os_info::get();
    let os_name = format!("{}", os.os_type());
    let os_build = os.version().to_string();
    let hostname = hw
        .as_ref()
        .map(|h| h.system.hostname.clone())
        .unwrap_or_default();
    let uptime_seconds = hw.as_ref().map(|h| h.system.uptime_seconds).unwrap_or(0);

    SystemReport {
        hostname,
        os_name,
        os_build,
        uptime_hours: uptime_seconds / 3600,
        windows_activated: false, // N/A on Linux
        windows_edition: String::new(),
    }
}

fn read_hardware(hw: &Option<crate::models::hardware::HardwareSummary>) -> HardwareReport {
    let Some(hw) = hw else {
        return HardwareReport {
            cpu_name: String::new(),
            cpu_cores: 0,
            cpu_threads: 0,
            ram_total_gb: 0.0,
            ram_slots: vec![],
            gpus: vec![],
            motherboard: String::new(),
        };
    };

    // RAM slots from dmidecode (needs root). Fall back to a single aggregated row.
    let ram_slots = read_ram_slots_via_dmidecode().unwrap_or_else(|| {
        vec![RamSlotReport {
            capacity_gb: hw.system.total_ram_gb as f32,
            speed_mhz: 0,
            manufacturer: String::new(),
            part_number: String::new(),
        }]
    });

    let gpus = hw
        .gpus
        .iter()
        .map(|g| {
            if g.manufacturer.is_empty() {
                g.name.clone()
            } else {
                format!("{} {}", g.manufacturer, g.name)
            }
        })
        .collect();

    let motherboard = format!("{} {}", hw.motherboard.manufacturer, hw.motherboard.product)
        .trim()
        .to_string();

    HardwareReport {
        cpu_name: hw.cpu.name.clone(),
        cpu_cores: hw.cpu.cores,
        cpu_threads: hw.cpu.threads,
        ram_total_gb: hw.system.total_ram_gb as f32,
        ram_slots,
        gpus,
        motherboard,
    }
}

fn read_ram_slots_via_dmidecode() -> Option<Vec<RamSlotReport>> {
    if !which("dmidecode") {
        return None;
    }
    // Needs root — try unelevated first, pkexec is intentionally *not* used
    // here so the report doesn't prompt the user.
    let out = run_cmd_lossy("dmidecode", &["-t", "17"]);
    if out.trim().is_empty() {
        return None;
    }
    let mut slots = Vec::new();
    let mut cap: f32 = 0.0;
    let mut speed: u32 = 0;
    let mut manu = String::new();
    let mut part = String::new();
    let mut in_device = false;

    let flush = |cap: f32, speed: u32, manu: &str, part: &str, slots: &mut Vec<RamSlotReport>| {
        if cap > 0.0 {
            slots.push(RamSlotReport {
                capacity_gb: cap,
                speed_mhz: speed,
                manufacturer: manu.trim().to_string(),
                part_number: part.trim().to_string(),
            });
        }
    };

    for raw in out.lines() {
        let line = raw.trim();
        if line.starts_with("Memory Device") {
            flush(cap, speed, &manu, &part, &mut slots);
            cap = 0.0;
            speed = 0;
            manu.clear();
            part.clear();
            in_device = true;
            continue;
        }
        if !in_device {
            continue;
        }
        if let Some(rest) = line.strip_prefix("Size:") {
            let trimmed = rest.trim();
            if trimmed.to_lowercase().contains("no module") {
                cap = 0.0;
            } else {
                cap = parse_memory_size(trimmed);
            }
        } else if let Some(rest) = line.strip_prefix("Configured Memory Speed:") {
            speed = rest
                .split_whitespace()
                .next()
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0);
        } else if let Some(rest) = line.strip_prefix("Manufacturer:") {
            manu = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("Part Number:") {
            part = rest.trim().to_string();
        }
    }
    flush(cap, speed, &manu, &part, &mut slots);

    if slots.is_empty() {
        None
    } else {
        Some(slots)
    }
}

fn parse_memory_size(s: &str) -> f32 {
    let mut parts = s.split_whitespace();
    let num = parts
        .next()
        .and_then(|v| v.parse::<f32>().ok())
        .unwrap_or(0.0);
    let unit = parts.next().unwrap_or("").to_uppercase();
    match unit.as_str() {
        "MB" => num / 1024.0,
        "GB" => num,
        "TB" => num * 1024.0,
        _ => 0.0,
    }
}

fn read_drives(hw: &Option<crate::models::hardware::HardwareSummary>) -> Vec<DriveSmartReport> {
    let Some(hw) = hw else { return Vec::new() };

    hw.disks
        .iter()
        .map(|d| {
            let size_gb = d.size_gb as u64;
            let smart = smartctl_for(&d.model);
            let (health, temp, hours, wear, read_err) = match smart {
                Some(s) => (s.health, s.temp, s.hours, s.wear, s.read_errors),
                None => ("OK".to_string(), None, None, None, None),
            };
            DriveSmartReport {
                model: d.model.clone(),
                size_gb,
                health_status: health,
                temperature_c: temp,
                power_on_hours: hours,
                wear_percentage: wear,
                read_errors_total: read_err,
            }
        })
        .collect()
}

struct SmartSummary {
    health: String,
    temp: Option<u32>,
    hours: Option<u64>,
    wear: Option<u32>,
    read_errors: Option<u64>,
}

fn smartctl_for(_model: &str) -> Option<SmartSummary> {
    if !which("smartctl") {
        return None;
    }
    // Enumerate devices via `smartctl --scan` so we don't hardcode /dev names.
    let scan = run_cmd_lossy("smartctl", &["--scan"]);
    for line in scan.lines() {
        let Some(device) = line.split_whitespace().next() else {
            continue;
        };
        let json = run_cmd_lossy("smartctl", &["-j", "-a", device]);
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&json) else {
            continue;
        };

        let temp = v
            .get("temperature")
            .and_then(|t| t.get("current"))
            .and_then(|x| x.as_u64())
            .map(|n| n as u32);
        let hours = v
            .get("power_on_time")
            .and_then(|t| t.get("hours"))
            .and_then(|x| x.as_u64());
        let wear_raw = v
            .get("ata_smart_attributes")
            .and_then(|a| a.get("table"))
            .and_then(|t| t.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|r| r.get("id").and_then(|x| x.as_u64()) == Some(177))
                    .or_else(|| {
                        arr.iter()
                            .find(|r| r.get("id").and_then(|x| x.as_u64()) == Some(233))
                    })
            })
            .and_then(|r| r.get("value").and_then(|x| x.as_u64()))
            .map(|v| v as u32);
        let wear = wear_raw.map(|w| (100u32).saturating_sub(w));

        let read_errors = v
            .get("ata_smart_error_log")
            .and_then(|l| l.get("summary"))
            .and_then(|s| s.get("count"))
            .and_then(|x| x.as_u64());

        let health = match (wear, temp) {
            (Some(w), _) if w >= 90 => "Fail",
            (Some(w), _) if w >= 70 => "Warning",
            (_, Some(t)) if t >= 60 => "Warning",
            _ if wear.is_some() || temp.is_some() => "OK",
            _ => "Unknown",
        }
        .to_string();

        return Some(SmartSummary {
            health,
            temp,
            hours,
            wear,
            read_errors,
        });
    }
    None
}

fn read_battery() -> Option<BatteryReport> {
    let entries = fs::read_dir("/sys/class/power_supply").ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.to_uppercase().starts_with("BAT") {
            continue;
        }
        let design = read_u64(&path.join("energy_full_design")).unwrap_or(0);
        let full = read_u64(&path.join("energy_full")).unwrap_or(0);
        let cycles = read_u64(&path.join("cycle_count")).unwrap_or(0);
        if design == 0 {
            continue;
        }

        // /sys reports energy in microwatt-hours.
        let design_mwh = (design / 1000) as u32;
        let full_mwh = (full / 1000) as u32;
        let health = ((full as u128 * 100) / design as u128).min(100) as u32;

        return Some(BatteryReport {
            design_capacity_mwh: design_mwh,
            full_charge_capacity_mwh: full_mwh,
            cycle_count: cycles as u32,
            health_percent: health,
        });
    }
    None
}

fn read_u64(path: &PathBuf) -> Option<u64> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
}

fn read_security() -> SecurityReport {
    let firewall_enabled = detect_firewall();
    let (tpm_present, tpm_enabled) = detect_tpm();
    SecurityReport {
        antivirus_name: None,
        antivirus_enabled: false,
        antivirus_up_to_date: false,
        firewall_enabled,
        bitlocker_status: "N/A".to_string(),
        tpm_present,
        tpm_enabled,
    }
}

fn detect_firewall() -> bool {
    if which("ufw") {
        let out = run_cmd_lossy("ufw", &["status"]);
        if out.to_lowercase().contains("status: active") {
            return true;
        }
    }
    if which("firewall-cmd") {
        let out = run_cmd_lossy("firewall-cmd", &["--state"]);
        if out.trim() == "running" {
            return true;
        }
    }
    false
}

fn detect_tpm() -> (bool, bool) {
    let path = std::path::Path::new("/sys/class/tpm/tpm0");
    if !path.exists() {
        return (false, false);
    }
    let enabled = fs::read_to_string("/sys/class/tpm/tpm0/enabled")
        .map(|s| s.trim() == "1")
        .unwrap_or(true);
    (true, enabled)
}

fn read_software_count() -> u32 {
    let family = distro_family();
    match family.as_str() {
        "debian" => run_cmd_lossy("dpkg-query", &["-f", "${binary:Package}\\n", "-W"])
            .lines()
            .filter(|l| !l.is_empty())
            .count() as u32,
        "rhel" | "suse" => run_cmd_lossy("rpm", &["-qa"])
            .lines()
            .filter(|l| !l.is_empty())
            .count() as u32,
        "arch" => run_cmd_lossy("pacman", &["-Q"])
            .lines()
            .filter(|l| !l.is_empty())
            .count() as u32,
        _ => 0,
    }
}

fn read_startup_counts() -> (u32, u32) {
    let mut total = 0u32;
    let mut enabled = 0u32;

    for dir in ["/etc/xdg/autostart", "/usr/share/applications/autostart"] {
        if let Ok(rd) = fs::read_dir(dir) {
            for e in rd.flatten() {
                if e.path().extension().and_then(|x| x.to_str()) == Some("desktop") {
                    total += 1;
                    if !is_hidden_desktop(&e.path()) {
                        enabled += 1;
                    }
                }
            }
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        let user_dir = PathBuf::from(home).join(".config/autostart");
        if let Ok(rd) = fs::read_dir(&user_dir) {
            for e in rd.flatten() {
                if e.path().extension().and_then(|x| x.to_str()) == Some("desktop") {
                    total += 1;
                    if !is_hidden_desktop(&e.path()) {
                        enabled += 1;
                    }
                }
            }
        }
    }

    (total, enabled)
}

fn is_hidden_desktop(path: &std::path::Path) -> bool {
    let Ok(text) = fs::read_to_string(path) else {
        return false;
    };
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("Hidden=") {
            if rest.eq_ignore_ascii_case("true") {
                return true;
            }
        }
        if let Some(rest) = trimmed.strip_prefix("X-GNOME-Autostart-enabled=") {
            if rest.eq_ignore_ascii_case("false") {
                return true;
            }
        }
    }
    false
}

fn compute_grade(report: &ReportData) -> (String, u32) {
    let mut score: i32 = 100;

    for d in &report.drives {
        match d.health_status.as_str() {
            "Fail" => score -= 30,
            "Warning" => score -= 20,
            _ => {}
        }
    }

    // Linux users rarely run a third-party AV. Don't penalize the absence.
    if !report.security.firewall_enabled {
        score -= 10;
    }

    if let Some(b) = &report.battery {
        if b.health_percent < 50 {
            score -= 20;
        } else if b.health_percent < 70 {
            score -= 10;
        }
    }

    let driver_deduction = (report.drivers.with_errors as i32 * 5).min(20);
    score -= driver_deduction;

    if report.startup_enabled_count > 30 {
        score -= 5;
    }

    let clamped = score.max(0) as u32;
    let grade = match clamped {
        90..=100 => "A",
        80..=89 => "B",
        70..=79 => "C",
        60..=69 => "D",
        _ => "F",
    };
    (grade.to_string(), clamped)
}

fn chrono_like_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let days = (secs / 86400) as i64;
    let tod = (secs % 86400) as u32;
    let hour = tod / 3600;
    let min = (tod % 3600) / 60;
    let sec = tod % 60;

    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hour, min, sec
    )
}
