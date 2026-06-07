// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
use crate::commands::wmi_util::extract_u32;
use crate::util::silent_cmd;
use serde::Serialize;
use std::collections::HashMap;
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::RegKey;
use wmi::WMIConnection;

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

fn extract_string(map: &HashMap<String, wmi::Variant>, key: &str) -> String {
    match map.get(key) {
        Some(wmi::Variant::String(s)) => s.clone(),
        Some(wmi::Variant::Null) => String::new(),
        _ => String::new(),
    }
}

fn extract_u64(map: &HashMap<String, wmi::Variant>, key: &str) -> Option<u64> {
    match map.get(key) {
        Some(wmi::Variant::UI8(n)) => Some(*n),
        Some(wmi::Variant::UI4(n)) => Some(*n as u64),
        Some(wmi::Variant::I4(n)) => Some(*n as u64),
        Some(wmi::Variant::String(s)) => s.parse().ok(),
        _ => None,
    }
}

fn run_powershell(script: &str) -> Result<String, String> {
    let out = silent_cmd("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|e| format!("powershell: {}", e))?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn parse_wmi_datetime_to_unix(s: &str) -> Option<u64> {
    if s.len() < 14 {
        return None;
    }
    let year: i64 = s[0..4].parse().ok()?;
    let month: u32 = s[4..6].parse().ok()?;
    let day: u32 = s[6..8].parse().ok()?;
    let hour: u32 = s[8..10].parse().ok()?;
    let min: u32 = s[10..12].parse().ok()?;
    let sec: u32 = s[12..14].parse().ok()?;
    // Rough epoch seconds (accurate enough for uptime-in-hours display).
    let approx = ((year - 1970) * 365 * 24 * 3600)
        + (month as i64 * 30 * 24 * 3600)
        + (day as i64 * 24 * 3600)
        + (hour as i64 * 3600)
        + (min as i64 * 60)
        + (sec as i64);
    Some(approx.max(0) as u64)
}

fn read_system() -> SystemReport {
    let wmi = match WMIConnection::new() {
        Ok(c) => c,
        Err(_) => return default_system(),
    };

    let system: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT Name FROM Win32_ComputerSystem")
        .unwrap_or_default();
    let hostname = system
        .first()
        .map(|r| extract_string(r, "Name"))
        .unwrap_or_default();

    let os: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT Caption, BuildNumber, LastBootUpTime FROM Win32_OperatingSystem")
        .unwrap_or_default();
    let os_row = os.first();
    let os_name = os_row
        .map(|r| extract_string(r, "Caption"))
        .unwrap_or_default();
    let os_build = os_row
        .map(|r| extract_string(r, "BuildNumber"))
        .unwrap_or_default();
    let last_boot = os_row
        .map(|r| extract_string(r, "LastBootUpTime"))
        .unwrap_or_default();

    let uptime_hours = parse_wmi_datetime_to_unix(&last_boot)
        .and_then(|boot| {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?
                .as_secs();
            Some((now.saturating_sub(boot)) / 3600)
        })
        .unwrap_or(0);

    // Activation — WMI SoftwareLicensingProduct via PowerShell
    // (SoftwareLicensingProduct isn't a standard namespace for the wmi crate).
    let (activated, edition) = read_activation();

    SystemReport {
        hostname,
        os_name,
        os_build,
        uptime_hours,
        windows_activated: activated,
        windows_edition: edition,
    }
}

fn default_system() -> SystemReport {
    SystemReport {
        hostname: "Unknown".into(),
        os_name: "Unknown".into(),
        os_build: String::new(),
        uptime_hours: 0,
        windows_activated: false,
        windows_edition: String::new(),
    }
}

fn read_activation() -> (bool, String) {
    let script = r#"Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND Name LIKE 'Windows%'" -ErrorAction SilentlyContinue | Select-Object -First 1 Name, LicenseStatus | ConvertTo-Json -Compress"#;
    let Ok(out) = run_powershell(script) else {
        return (false, String::new());
    };
    let trimmed = out.trim();
    if trimmed.is_empty() {
        return (false, String::new());
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return (false, String::new());
    };
    let status = v.get("LicenseStatus").and_then(|x| x.as_u64()).unwrap_or(0);
    let name = v
        .get("Name")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    (status == 1, name)
}

fn read_hardware() -> HardwareReport {
    let wmi = match WMIConnection::new() {
        Ok(c) => c,
        Err(_) => return default_hardware(),
    };

    // CPU
    let cpu: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT Name, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor")
        .unwrap_or_default();
    let cpu_row = cpu.first();
    let cpu_name = cpu_row
        .map(|r| extract_string(r, "Name").trim().to_string())
        .unwrap_or_default();
    let cpu_cores = cpu_row
        .and_then(|r| extract_u32(r, "NumberOfCores"))
        .unwrap_or(0);
    let cpu_threads = cpu_row
        .and_then(|r| extract_u32(r, "NumberOfLogicalProcessors"))
        .unwrap_or(0);

    // RAM
    let ram_raw: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT Capacity, Speed, Manufacturer, PartNumber FROM Win32_PhysicalMemory")
        .unwrap_or_default();
    let ram_slots: Vec<RamSlotReport> = ram_raw
        .iter()
        .map(|r| RamSlotReport {
            capacity_gb: extract_u64(r, "Capacity").unwrap_or(0) as f32
                / (1024.0 * 1024.0 * 1024.0),
            speed_mhz: extract_u32(r, "Speed").unwrap_or(0),
            manufacturer: extract_string(r, "Manufacturer").trim().to_string(),
            part_number: extract_string(r, "PartNumber").trim().to_string(),
        })
        .collect();
    let ram_total_gb: f32 = ram_slots.iter().map(|s| s.capacity_gb).sum();

    // GPUs
    let gpu: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT Name FROM Win32_VideoController")
        .unwrap_or_default();
    let gpus: Vec<String> = gpu
        .iter()
        .map(|r| extract_string(r, "Name"))
        .filter(|s| !s.is_empty())
        .collect();

    // Motherboard
    let mobo: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT Manufacturer, Product FROM Win32_BaseBoard")
        .unwrap_or_default();
    let motherboard = mobo
        .first()
        .map(|r| {
            let m = extract_string(r, "Manufacturer");
            let p = extract_string(r, "Product");
            format!("{} {}", m, p).trim().to_string()
        })
        .unwrap_or_default();

    HardwareReport {
        cpu_name,
        cpu_cores,
        cpu_threads,
        ram_total_gb,
        ram_slots,
        gpus,
        motherboard,
    }
}

fn default_hardware() -> HardwareReport {
    HardwareReport {
        cpu_name: "Unknown".into(),
        cpu_cores: 0,
        cpu_threads: 0,
        ram_total_gb: 0.0,
        ram_slots: vec![],
        gpus: vec![],
        motherboard: String::new(),
    }
}

fn read_drives() -> Vec<DriveSmartReport> {
    // Join Get-PhysicalDisk with Get-StorageReliabilityCounter per disk.
    let script = r#"
$disks = Get-PhysicalDisk -ErrorAction SilentlyContinue
if (-not $disks) { '[]' | Out-Host; exit 0 }
$out = @()
foreach ($d in $disks) {
  $rc = $null
  try { $rc = $d | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue } catch {}
  $out += [PSCustomObject]@{
    Model = $d.Model
    Size = $d.Size
    Temperature = if ($rc) { $rc.Temperature } else { $null }
    PowerOnHours = if ($rc) { $rc.PowerOnHours } else { $null }
    Wear = if ($rc) { $rc.Wear } else { $null }
    ReadErrorsTotal = if ($rc) { $rc.ReadErrorsTotal } else { $null }
  }
}
$out | ConvertTo-Json -Compress -AsArray
"#;
    let Ok(stdout) = run_powershell(script) else {
        return vec![];
    };
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return vec![];
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return vec![];
    };
    let arr = match v {
        serde_json::Value::Array(a) => a,
        other => vec![other],
    };
    arr.into_iter()
        .map(|row| {
            let model = row
                .get("Model")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let size_bytes = row.get("Size").and_then(|x| x.as_u64()).unwrap_or(0);
            let size_gb = size_bytes / (1024 * 1024 * 1024);
            let temp = row
                .get("Temperature")
                .and_then(|x| x.as_u64())
                .map(|n| n as u32);
            let hours = row.get("PowerOnHours").and_then(|x| x.as_u64());
            let wear = row.get("Wear").and_then(|x| x.as_u64()).map(|n| n as u32);
            let read_errors = row.get("ReadErrorsTotal").and_then(|x| x.as_u64());

            let health = match (wear, temp) {
                (Some(w), _) if w >= 90 => "Fail",
                (Some(w), _) if w >= 70 => "Warning",
                (_, Some(t)) if t >= 60 => "Warning",
                _ if wear.is_some() || temp.is_some() => "OK",
                _ => "Unknown",
            };

            DriveSmartReport {
                model,
                size_gb,
                health_status: health.to_string(),
                temperature_c: temp,
                power_on_hours: hours,
                wear_percentage: wear,
                read_errors_total: read_errors,
            }
        })
        .collect()
}

fn read_battery() -> Option<BatteryReport> {
    // Laptop check: any Win32_Battery row?
    let wmi = WMIConnection::new().ok()?;
    let batteries: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT BatteryStatus FROM Win32_Battery")
        .ok()?;
    if batteries.is_empty() {
        return None;
    }

    // powercfg /batteryreport /xml /output <tempfile>
    let mut path = std::env::temp_dir();
    path.push(format!(
        "freshrig-battery-{}.xml",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    let path_str = path.to_string_lossy().to_string();

    let out = silent_cmd("powercfg")
        .args(["/batteryreport", "/xml", "/output", &path_str])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let xml = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);

    let design = extract_tag_u64(&xml, "DesignCapacity").unwrap_or(0) as u32;
    let full = extract_tag_u64(&xml, "FullChargeCapacity").unwrap_or(0) as u32;
    let cycles = extract_tag_u64(&xml, "CycleCount").unwrap_or(0) as u32;

    if design == 0 {
        return None;
    }
    let health = ((full as u64 * 100) / design as u64).min(100) as u32;

    Some(BatteryReport {
        design_capacity_mwh: design,
        full_charge_capacity_mwh: full,
        cycle_count: cycles,
        health_percent: health,
    })
}

fn extract_tag_u64(xml: &str, tag: &str) -> Option<u64> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    xml[start..end].trim().parse().ok()
}

fn read_security() -> SecurityReport {
    let (av_name, av_enabled, av_current) = read_antivirus();
    let firewall = read_firewall_state();
    let bitlocker = read_bitlocker_status();
    let (tpm_present, tpm_enabled) = read_tpm();

    SecurityReport {
        antivirus_name: av_name,
        antivirus_enabled: av_enabled,
        antivirus_up_to_date: av_current,
        firewall_enabled: firewall,
        bitlocker_status: bitlocker,
        tpm_present,
        tpm_enabled,
    }
}

fn read_antivirus() -> (Option<String>, bool, bool) {
    let script = r#"Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue | Select-Object displayName, productState | ConvertTo-Json -Compress"#;
    let Ok(stdout) = run_powershell(script) else {
        return (None, false, false);
    };
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return (None, false, false);
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return (None, false, false);
    };
    let row = if v.is_array() {
        v.as_array()
            .and_then(|a| a.first())
            .cloned()
            .unwrap_or(serde_json::Value::Null)
    } else {
        v
    };
    let name = row
        .get("displayName")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let state = row
        .get("productState")
        .and_then(|x| x.as_u64())
        .unwrap_or(0) as u32;
    // productState bitfield: byte[1] bits 0x10 enabled, byte[2] bits 0x00 up-to-date.
    // Common decoding: enabled if (state & 0x1000) != 0; up-to-date if (state & 0x10) == 0.
    let enabled = (state & 0x1000) != 0 || (state & 0x2000) != 0;
    let up_to_date = (state & 0x10) == 0;
    (name, enabled, up_to_date)
}

fn read_firewall_state() -> bool {
    // All three profiles (Domain, Private, Public) should report "State ON".
    let out = match silent_cmd("netsh")
        .args(["advfirewall", "show", "allprofiles", "state"])
        .output()
    {
        Ok(o) => o,
        Err(_) => return false,
    };
    let text = String::from_utf8_lossy(&out.stdout);
    // Count "State ON" (case-insensitive) occurrences — ≥3 means all on.
    let lower = text.to_lowercase();
    lower.matches("state").filter(|_| true).count();
    // Simpler: count lines containing both "state" and "on"
    lower
        .lines()
        .filter(|l| l.contains("state") && l.contains("on"))
        .count()
        >= 3
}

fn read_bitlocker_status() -> String {
    let out = match silent_cmd("manage-bde").args(["-status", "C:"]).output() {
        Ok(o) => o,
        Err(_) => return "Unknown".into(),
    };
    let text = String::from_utf8_lossy(&out.stdout).to_lowercase();
    if text.contains("protection on") || text.contains("fully encrypted") {
        "Enabled".into()
    } else if text.contains("protection off") || text.contains("fully decrypted") {
        "Disabled".into()
    } else {
        "Unknown".into()
    }
}

fn read_tpm() -> (bool, bool) {
    let script = r#"Get-CimInstance -Namespace root\cimv2\Security\MicrosoftTpm -ClassName Win32_Tpm -ErrorAction SilentlyContinue | Select-Object -First 1 IsEnabled_InitialValue, IsActivated_InitialValue | ConvertTo-Json -Compress"#;
    let Ok(stdout) = run_powershell(script) else {
        return (false, false);
    };
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return (false, false);
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return (false, false);
    };
    let enabled = v
        .get("IsEnabled_InitialValue")
        .and_then(|x| x.as_bool())
        .unwrap_or(false);
    let activated = v
        .get("IsActivated_InitialValue")
        .and_then(|x| x.as_bool())
        .unwrap_or(false);
    (true, enabled && activated)
}

fn read_drivers() -> DriverSummaryReport {
    let wmi = match WMIConnection::new() {
        Ok(c) => c,
        Err(_) => {
            return DriverSummaryReport {
                total: 0,
                with_errors: 0,
                error_devices: vec![],
            };
        }
    };
    let total_rows: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT DeviceName FROM Win32_PnPSignedDriver")
        .unwrap_or_default();
    let total = total_rows.len() as u32;

    let err_rows: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT Name, ConfigManagerErrorCode FROM Win32_PnPEntity WHERE ConfigManagerErrorCode <> 0")
        .unwrap_or_default();
    let error_devices: Vec<String> = err_rows
        .iter()
        .map(|r| extract_string(r, "Name"))
        .filter(|s| !s.is_empty())
        .collect();

    DriverSummaryReport {
        total,
        with_errors: error_devices.len() as u32,
        error_devices,
    }
}

fn read_software_count() -> u32 {
    let mut count = 0u32;
    let sources: &[(winreg::HKEY, &str)] = &[
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_CURRENT_USER,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ];
    for (hive, path) in sources {
        if let Ok(key) = RegKey::predef(*hive).open_subkey(path) {
            for sub in key.enum_keys().flatten() {
                if let Ok(subkey) = key.open_subkey(&sub) {
                    let name: Result<String, _> = subkey.get_value("DisplayName");
                    if name.map(|n| !n.is_empty()).unwrap_or(false) {
                        count += 1;
                    }
                }
            }
        }
    }
    count
}

fn read_startup_counts() -> (u32, u32) {
    // Count registry entries under Run keys.
    let mut total = 0u32;
    let mut enabled = 0u32;
    let run_keys: &[(winreg::HKEY, &str)] = &[
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
        ),
        (
            HKEY_CURRENT_USER,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        ),
    ];
    for (hive, path) in run_keys {
        if let Ok(key) = RegKey::predef(*hive).open_subkey(path) {
            let values: Vec<_> = key.enum_values().flatten().collect();
            total += values.len() as u32;
            enabled += values.len() as u32;
        }
    }

    // Approved registry (StartupApproved) — flip entries where byte[0] == 0x03 to disabled.
    let approved_keys: &[(winreg::HKEY, &str)] = &[
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
        ),
        (
            HKEY_CURRENT_USER,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
        ),
    ];
    for (hive, path) in approved_keys {
        if let Ok(key) = RegKey::predef(*hive).open_subkey(path) {
            for (_name, val) in key.enum_values().flatten() {
                if !val.bytes.is_empty() && val.bytes[0] == 0x03 {
                    enabled = enabled.saturating_sub(1);
                }
            }
        }
    }

    (total, enabled)
}

fn read_reliability_index() -> Option<f32> {
    let wmi = WMIConnection::new().ok()?;
    let rows: Vec<HashMap<String, wmi::Variant>> = wmi
        .raw_query("SELECT SystemStabilityIndex FROM Win32_ReliabilityStabilityMetrics")
        .ok()?;
    rows.iter()
        .filter_map(|r| match r.get("SystemStabilityIndex") {
            Some(wmi::Variant::R4(n)) => Some(*n),
            Some(wmi::Variant::R8(n)) => Some(*n as f32),
            Some(wmi::Variant::String(s)) => s.parse::<f32>().ok(),
            _ => None,
        })
        .next_back()
}

fn compute_grade(report: &ReportData) -> (String, u32) {
    let mut score: i32 = 100;

    // Drive health
    for d in &report.drives {
        match d.health_status.as_str() {
            "Fail" => score -= 30,
            "Warning" => score -= 20,
            _ => {}
        }
    }

    if !report.security.antivirus_enabled {
        score -= 15;
    }
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

    if let Some(r) = report.reliability_index {
        if r < 5.0 {
            score -= 10;
        }
    }

    if report.startup_enabled_count > 30 {
        score -= 5;
    }

    if !report.system.windows_activated {
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

#[tauri::command]
pub async fn generate_health_report(app_version: String) -> Result<ReportData, String> {
    tokio::task::spawn_blocking(move || {
        let system = read_system();
        let hardware = read_hardware();
        let drives = read_drives();
        let battery = read_battery();
        let security = read_security();
        let drivers = read_drivers();
        let software_count = read_software_count();
        let (startup_count, startup_enabled_count) = read_startup_counts();
        let reliability_index = read_reliability_index();

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
            reliability_index,
        };

        let (grade, score) = compute_grade(&report);
        report.overall_grade = grade;
        report.overall_score = score;

        Ok::<ReportData, String>(report)
    })
    .await
    .map_err(|e| format!("report task failed: {}", e))?
}

fn chrono_like_now() -> String {
    // ISO-8601 UTC without an external crate.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Gregorian calendar conversion (algorithm: Howard Hinnant's days-from-civil)
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
