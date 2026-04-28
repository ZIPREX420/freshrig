// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// SMART Disk Monitoring — cross-platform.
//
// Wraps `smartctl` from the smartmontools project. Detects whether smartctl
// is installed, runs `smartctl --scan` to enumerate physical drives, then
// runs `smartctl -a -j /dev/<disk>` per drive and parses the JSON output.
// History is persisted into the shared SQLite db (see `crate::db`) so we
// can render trends.
//
// Background scheduling (Pro): writes a per-OS scheduled job that re-runs
// the check every 6 hours. The actual scheduled run requires the binary
// to support `--headless --task=smart-check`; that CLI flag lives in
// main.rs.

#[cfg(not(target_os = "windows"))]
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::db;

// ───────── Models ─────────

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SmartStatus {
    Ok,
    Caution,
    Critical,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartAttribute {
    pub id: u32,
    pub name: String,
    pub raw_value: u64,
    pub normalized_value: Option<u32>,
    pub threshold: Option<u32>,
    pub flagged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartReading {
    pub disk_id: String,
    pub captured_at: String,
    pub model: String,
    pub serial: String,
    pub disk_type: String, // "HDD" | "SSD" | "NVMe"
    pub temperature_c: Option<i32>,
    pub power_on_hours: Option<u64>,
    pub attributes: Vec<SmartAttribute>,
    pub overall_status: SmartStatus,
}

// ───────── Helpers ─────────

#[cfg(target_os = "windows")]
fn run_capture(program: &str, args: &[&str]) -> Result<String, String> {
    let output = crate::util::silent_cmd(program)
        .args(args)
        .output()
        .map_err(|e| format!("spawn {}: {}", program, e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(not(target_os = "windows"))]
fn run_capture(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("spawn {}: {}", program, e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn smartctl_available_sync() -> bool {
    run_capture("smartctl", &["--version"])
        .map(|out| out.to_lowercase().contains("smartmontools"))
        .unwrap_or(false)
}

fn install_command_for_os() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "winget install -e --id smartmontools.smartmontools"
    }
    #[cfg(target_os = "linux")]
    {
        if std::path::Path::new("/etc/debian_version").exists() {
            "sudo apt install smartmontools"
        } else if std::path::Path::new("/etc/fedora-release").exists()
            || std::path::Path::new("/etc/redhat-release").exists()
        {
            "sudo dnf install smartmontools"
        } else if std::path::Path::new("/etc/arch-release").exists() {
            "sudo pacman -S smartmontools"
        } else {
            "sudo apt install smartmontools"
        }
    }
    #[cfg(target_os = "macos")]
    {
        "brew install smartmontools"
    }
}

fn current_iso_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
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

// ───────── smartctl JSON parsing ─────────

const HDD_HIGH_SIGNAL_IDS: &[u32] = &[5, 187, 188, 197, 198];

fn parse_disk_smart(raw: &str) -> Option<SmartReading> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let model = v
        .get("model_name")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let serial = v
        .get("serial_number")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let device_name = v
        .get("device")
        .and_then(|d| d.get("name"))
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    if device_name.is_empty() {
        return None;
    }

    // NVMe vs HDD/SSD detection.
    let is_nvme = v
        .get("device")
        .and_then(|d| d.get("protocol"))
        .and_then(|x| x.as_str())
        .map(|p| p.to_uppercase().contains("NVME"))
        .unwrap_or(false);
    let rotation = v.get("rotation_rate").and_then(|x| x.as_u64()).unwrap_or(0);
    let disk_type = if is_nvme {
        "NVMe"
    } else if rotation == 0 {
        "SSD"
    } else {
        "HDD"
    }
    .to_string();

    let temperature_c = v
        .get("temperature")
        .and_then(|t| t.get("current"))
        .and_then(|x| x.as_i64())
        .map(|n| n as i32);
    let power_on_hours = v
        .get("power_on_time")
        .and_then(|p| p.get("hours"))
        .and_then(|x| x.as_u64());

    let mut attributes = Vec::new();
    let mut critical = false;
    let mut caution = false;

    if is_nvme {
        if let Some(log) = v.get("nvme_smart_health_information_log") {
            // Percentage Used
            if let Some(used) = log.get("percentage_used").and_then(|x| x.as_u64()) {
                let flagged = used >= 80;
                if used >= 95 {
                    critical = true;
                } else if used >= 80 {
                    caution = true;
                }
                attributes.push(SmartAttribute {
                    id: 1,
                    name: "Percentage Used".into(),
                    raw_value: used,
                    normalized_value: Some(used as u32),
                    threshold: Some(100),
                    flagged,
                });
            }
            // Available Spare
            if let Some(spare) = log.get("available_spare").and_then(|x| x.as_u64()) {
                let threshold = log
                    .get("available_spare_threshold")
                    .and_then(|x| x.as_u64())
                    .unwrap_or(10);
                let flagged = spare <= threshold;
                if flagged {
                    critical = true;
                }
                attributes.push(SmartAttribute {
                    id: 2,
                    name: "Available Spare".into(),
                    raw_value: spare,
                    normalized_value: Some(spare as u32),
                    threshold: Some(threshold as u32),
                    flagged,
                });
            }
            // Media Errors
            if let Some(errs) = log.get("media_errors").and_then(|x| x.as_u64()) {
                if errs > 0 {
                    caution = true;
                }
                attributes.push(SmartAttribute {
                    id: 3,
                    name: "Media Errors".into(),
                    raw_value: errs,
                    normalized_value: None,
                    threshold: None,
                    flagged: errs > 0,
                });
            }
        }
    } else if let Some(table) = v
        .get("ata_smart_attributes")
        .and_then(|a| a.get("table"))
        .and_then(|t| t.as_array())
    {
        for row in table {
            let id = row.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            if !HDD_HIGH_SIGNAL_IDS.contains(&id) {
                continue;
            }
            let name = row
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let raw_value = row
                .get("raw")
                .and_then(|r| r.get("value"))
                .and_then(|x| x.as_u64())
                .unwrap_or(0);
            let normalized = row.get("value").and_then(|x| x.as_u64()).map(|n| n as u32);
            let threshold = row.get("thresh").and_then(|x| x.as_u64()).map(|n| n as u32);
            let flagged = raw_value > 0;
            if flagged {
                caution = true;
                if id == 5 || id == 197 || id == 198 {
                    // reallocated / current pending / offline uncorrectable
                    if raw_value > 10 {
                        critical = true;
                    }
                }
            }
            attributes.push(SmartAttribute {
                id,
                name,
                raw_value,
                normalized_value: normalized,
                threshold,
                flagged,
            });
        }
    }

    let overall_status = if critical {
        SmartStatus::Critical
    } else if caution {
        SmartStatus::Caution
    } else {
        SmartStatus::Ok
    };

    Some(SmartReading {
        disk_id: device_name,
        captured_at: current_iso_timestamp(),
        model,
        serial,
        disk_type,
        temperature_c,
        power_on_hours,
        attributes,
        overall_status,
    })
}

// ───────── Commands ─────────

#[tauri::command]
pub async fn check_smartctl_available() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| Ok(smartctl_available_sync()))
        .await
        .map_err(|e| format!("task failed: {}", e))?
}

#[tauri::command]
pub async fn get_smart_install_command() -> Result<String, String> {
    Ok(install_command_for_os().to_string())
}

#[tauri::command]
pub async fn read_smart_data() -> Result<Vec<SmartReading>, String> {
    tokio::task::spawn_blocking(|| {
        if !smartctl_available_sync() {
            return Err("smartctl not installed".into());
        }
        let scan = run_capture("smartctl", &["--scan", "-j"]).unwrap_or_default();
        let parsed: serde_json::Value = serde_json::from_str(&scan).map_err(|e| {
            format!(
                "parse smartctl --scan output: {} (raw: {})",
                e,
                scan.chars().take(200).collect::<String>()
            )
        })?;
        let devices = parsed
            .get("devices")
            .and_then(|d| d.as_array())
            .cloned()
            .unwrap_or_default();

        let mut readings = Vec::new();
        for dev in devices {
            let name = dev
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }
            let raw = run_capture("smartctl", &["-a", "-j", &name]).unwrap_or_default();
            if let Some(reading) = parse_disk_smart(&raw) {
                readings.push(reading);
            }
        }
        Ok(readings)
    })
    .await
    .map_err(|e| format!("task failed: {}", e))?
}

#[tauri::command]
pub async fn save_smart_history(readings: Vec<SmartReading>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        let mut stmt = conn
            .prepare(
                "INSERT INTO smart_history (
                    captured_at, disk_id, model, serial, disk_type,
                    overall_status, temperature_c, power_on_hours, attributes_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            )
            .map_err(|e| format!("prepare insert: {}", e))?;
        for r in readings {
            let attrs_json = serde_json::to_string(&r.attributes)
                .map_err(|e| format!("serialize attributes: {}", e))?;
            let status = format!("{:?}", r.overall_status);
            stmt.execute(rusqlite::params![
                r.captured_at,
                r.disk_id,
                r.model,
                r.serial,
                r.disk_type,
                status,
                r.temperature_c,
                r.power_on_hours.map(|n| n as i64),
                attrs_json,
            ])
            .map_err(|e| format!("insert smart_history: {}", e))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("task failed: {}", e))?
}

#[tauri::command]
pub async fn get_smart_trend(disk_id: String, last_n: u32) -> Result<Vec<SmartReading>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        let mut stmt = conn
            .prepare(
                "SELECT captured_at, disk_id, model, serial, disk_type,
                        overall_status, temperature_c, power_on_hours, attributes_json
                 FROM smart_history
                 WHERE disk_id = ?1
                 ORDER BY captured_at DESC
                 LIMIT ?2",
            )
            .map_err(|e| format!("prepare select: {}", e))?;
        let rows = stmt
            .query_map(rusqlite::params![disk_id, last_n], |row| {
                let captured_at: String = row.get(0)?;
                let disk_id: String = row.get(1)?;
                let model: String = row.get(2)?;
                let serial: String = row.get(3)?;
                let disk_type: String = row.get(4)?;
                let status: String = row.get(5)?;
                let temperature_c: Option<i32> = row.get(6)?;
                let power_on_hours: Option<i64> = row.get(7)?;
                let attrs_json: String = row.get(8)?;
                Ok((
                    captured_at,
                    disk_id,
                    model,
                    serial,
                    disk_type,
                    status,
                    temperature_c,
                    power_on_hours,
                    attrs_json,
                ))
            })
            .map_err(|e| format!("query smart_history: {}", e))?;

        let mut readings = Vec::new();
        for row in rows {
            let (captured_at, disk_id, model, serial, disk_type, status, temp, hours, attrs) =
                row.map_err(|e| format!("row error: {}", e))?;
            let attributes: Vec<SmartAttribute> = serde_json::from_str(&attrs).unwrap_or_default();
            let overall_status = match status.as_str() {
                "Ok" => SmartStatus::Ok,
                "Caution" => SmartStatus::Caution,
                "Critical" => SmartStatus::Critical,
                _ => SmartStatus::Unknown,
            };
            readings.push(SmartReading {
                disk_id,
                captured_at,
                model,
                serial,
                disk_type,
                temperature_c: temp,
                power_on_hours: hours.map(|h| h as u64),
                attributes,
                overall_status,
            });
        }
        // Re-sort ASC for chart consumption.
        readings.reverse();
        Ok(readings)
    })
    .await
    .map_err(|e| format!("task failed: {}", e))?
}

// ───────── Background scheduling (Pro) ─────────

#[tauri::command]
pub async fn enable_smart_schedule(is_pro: bool) -> Result<String, String> {
    if !is_pro {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(write_scheduler_files)
        .await
        .map_err(|e| format!("task failed: {}", e))?
}

#[cfg(target_os = "windows")]
fn write_scheduler_files() -> Result<String, String> {
    // Drop a Task Scheduler XML and register it via schtasks /create /xml.
    let exe = std::env::current_exe()
        .map_err(|e| format!("current_exe: {}", e))?
        .to_string_lossy()
        .to_string();
    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <TimeTrigger>
      <Repetition>
        <Interval>PT6H</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2026-01-01T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{}</Command>
      <Arguments>--headless --task=smart-check</Arguments>
    </Exec>
  </Actions>
</Task>"#,
        xml_escape(&exe)
    );
    let xml_path = crate::portable::get_data_dir().join("smart-schedule.xml");
    std::fs::write(&xml_path, xml).map_err(|e| format!("write xml: {}", e))?;
    let xml_path_str = xml_path.to_string_lossy().to_string();

    let output = crate::util::silent_cmd("schtasks")
        .args([
            "/create",
            "/tn",
            "FreshRig SMART Check",
            "/xml",
            &xml_path_str,
            "/f",
        ])
        .output()
        .map_err(|e| format!("schtasks: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "schtasks failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok("Scheduled task installed (every 6h).".into())
}

#[cfg(target_os = "linux")]
fn write_scheduler_files() -> Result<String, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("current_exe: {}", e))?
        .to_string_lossy()
        .to_string();
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let dir = format!("{}/.config/systemd/user", home);
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {}", dir, e))?;
    let service = format!(
        "[Unit]
Description=FreshRig SMART check

[Service]
Type=oneshot
ExecStart={} --headless --task=smart-check
",
        exe
    );
    let timer = "[Unit]
Description=Run FreshRig SMART check every 6 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=6h
Persistent=true

[Install]
WantedBy=timers.target
";
    std::fs::write(format!("{}/freshrig-smart.service", dir), service)
        .map_err(|e| format!("write service: {}", e))?;
    std::fs::write(format!("{}/freshrig-smart.timer", dir), timer)
        .map_err(|e| format!("write timer: {}", e))?;
    Ok("Wrote ~/.config/systemd/user/freshrig-smart.{service,timer}. Run `systemctl --user enable --now freshrig-smart.timer` to activate.".into())
}

#[cfg(target_os = "macos")]
fn write_scheduler_files() -> Result<String, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("current_exe: {}", e))?
        .to_string_lossy()
        .to_string();
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let dir = format!("{}/Library/LaunchAgents", home);
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {}", dir, e))?;
    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.freshrig.smart</string>
  <key>ProgramArguments</key>
  <array>
    <string>{}</string>
    <string>--headless</string>
    <string>--task=smart-check</string>
  </array>
  <key>StartInterval</key><integer>21600</integer>
  <key>RunAtLoad</key><false/>
</dict>
</plist>"#,
        exe
    );
    let path = format!("{}/com.freshrig.smart.plist", dir);
    std::fs::write(&path, plist).map_err(|e| format!("write plist: {}", e))?;
    Ok(format!(
        "Wrote {}. Run `launchctl load {}` to activate.",
        path, path
    ))
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// Headless task entry point used by main.rs when invoked with
// `--headless --task=smart-check`. Reads SMART data and persists it.
pub fn run_headless_smart_check() -> i32 {
    let rt = match tokio::runtime::Runtime::new() {
        Ok(r) => r,
        Err(_) => return 1,
    };
    let result = rt.block_on(async {
        let readings = read_smart_data().await?;
        save_smart_history(readings).await
    });
    if result.is_err() {
        1
    } else {
        0
    }
}
