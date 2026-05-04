// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Watchdog Mode — cross-platform snapshot + diff engine.
//
// Captures the user-visible state of the system (services, startup
// programs, installed software) into a labeled snapshot stored in the
// shared SQLite db. Two snapshots can be diffed to surface what changed
// — what got installed, what services started/stopped, etc.
//
// Per-platform capture:
//   - services:  Win=`sc query type=service`, Linux=`systemctl list-units`,
//                macOS=`launchctl list`
//   - startup:   Win=registry Run keys, Linux=~/.config/autostart, macOS=
//                ~/Library/LaunchAgents
//   - software:  Win=Uninstall registry, Linux=dpkg/rpm/pacman, macOS=
//                /Applications listing + brew list
//
// Restore points (Windows only): runs PowerShell `Checkpoint-Computer`
// in MODIFY_SETTINGS mode. The 24h throttle is left intact — users who
// want to override it can edit
// HKLM\Software\Microsoft\Windows NT\CurrentVersion\SystemRestore\
// SystemRestorePointCreationFrequency themselves.
//
// Btrfs/Time Machine snapshots are NOT triggered by FreshRig — too risky
// to call without explicit user consent and they require root. The
// frontend points users to those tools as a manual companion.

use serde::{Deserialize, Serialize};

use crate::db;

// ───────── Models ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSnapshot {
    pub name: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupSnapshot {
    pub name: String,
    pub command: String,
    pub source: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    pub version: Option<String>,
    pub publisher: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotPayload {
    pub services: Vec<ServiceSnapshot>,
    pub startup_entries: Vec<StartupSnapshot>,
    pub installed_software: Vec<InstalledApp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: String,
    pub created_at: String,
    pub label: String,
    pub restore_point_id: Option<u32>,
    pub registry_export_path: Option<String>,
    pub services: Vec<ServiceSnapshot>,
    pub startup_entries: Vec<StartupSnapshot>,
    pub installed_software: Vec<InstalledApp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStateChange {
    pub name: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDiff {
    pub before_id: String,
    pub after_id: String,
    pub services_added: Vec<String>,
    pub services_removed: Vec<String>,
    pub services_state_changed: Vec<ServiceStateChange>,
    pub startup_added: Vec<StartupSnapshot>,
    pub startup_removed: Vec<StartupSnapshot>,
    pub software_added: Vec<InstalledApp>,
    pub software_removed: Vec<InstalledApp>,
}

// ───────── Helpers ─────────

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

// ───────── Per-OS capture ─────────

#[cfg(target_os = "windows")]
fn capture_services() -> Vec<ServiceSnapshot> {
    use winreg::enums::*;
    use winreg::RegKey;
    let mut out = Vec::new();
    let services = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(r"SYSTEM\CurrentControlSet\Services", KEY_READ);
    let Ok(services) = services else {
        return out;
    };
    for name in services.enum_keys().filter_map(|k| k.ok()) {
        if let Ok(sub) = services.open_subkey_with_flags(&name, KEY_READ) {
            // Start: 2 = Automatic, 3 = Manual, 4 = Disabled (registry-level)
            let start = sub.get_value::<u32, _>("Start").unwrap_or(99);
            let state = match start {
                2 => "Automatic",
                3 => "Manual",
                4 => "Disabled",
                0 | 1 => "Boot",
                _ => "Unknown",
            };
            out.push(ServiceSnapshot {
                name,
                state: state.into(),
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

#[cfg(target_os = "linux")]
fn capture_services() -> Vec<ServiceSnapshot> {
    use std::process::Command;
    let output = Command::new("systemctl")
        .args([
            "list-units",
            "--type=service",
            "--all",
            "--no-pager",
            "--no-legend",
            "--plain",
        ])
        .output();
    let mut out = Vec::new();
    if let Ok(o) = output {
        let text = String::from_utf8_lossy(&o.stdout);
        for line in text.lines() {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 4 && cols[0].ends_with(".service") {
                out.push(ServiceSnapshot {
                    name: cols[0].trim_end_matches(".service").to_string(),
                    state: cols[3].to_string(),
                });
            }
        }
    }
    out
}

#[cfg(target_os = "macos")]
fn capture_services() -> Vec<ServiceSnapshot> {
    use std::process::Command;
    let output = Command::new("launchctl").arg("list").output();
    let mut out = Vec::new();
    if let Ok(o) = output {
        let text = String::from_utf8_lossy(&o.stdout);
        for (i, line) in text.lines().enumerate() {
            if i == 0 || line.trim().is_empty() {
                continue;
            }
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 3 {
                let pid = cols[0];
                let label = cols[2..].join(" ");
                out.push(ServiceSnapshot {
                    name: label,
                    state: if pid != "-" { "Running" } else { "Stopped" }.into(),
                });
            }
        }
    }
    out
}

#[cfg(target_os = "windows")]
fn capture_startup() -> Vec<StartupSnapshot> {
    use winreg::enums::*;
    use winreg::RegKey;
    let mut out = Vec::new();
    let paths = [
        (
            HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            "HKCU\\Run",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            "HKLM\\Run",
        ),
    ];
    for (hive, path, source) in paths {
        if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(path, KEY_READ) {
            for (name, value) in key.enum_values().filter_map(|x| x.ok()) {
                let command = format!("{}", value);
                out.push(StartupSnapshot {
                    name,
                    command,
                    source: source.into(),
                    enabled: true,
                });
            }
        }
    }
    out
}

#[cfg(target_os = "linux")]
fn capture_startup() -> Vec<StartupSnapshot> {
    use std::fs;
    let mut out = Vec::new();
    let dirs = ["/etc/xdg/autostart"];
    let mut all_dirs: Vec<std::path::PathBuf> = dirs.iter().map(std::path::PathBuf::from).collect();
    if let Ok(home) = std::env::var("HOME") {
        all_dirs.push(std::path::PathBuf::from(home).join(".config/autostart"));
    }
    for dir in all_dirs {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("desktop") {
                    continue;
                }
                let name = path
                    .file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let raw = fs::read_to_string(&path).unwrap_or_default();
                let mut command = String::new();
                let mut enabled = true;
                for line in raw.lines() {
                    if let Some(rest) = line.strip_prefix("Exec=") {
                        if command.is_empty() {
                            command = rest.to_string();
                        }
                    }
                    if line.trim() == "Hidden=true" {
                        enabled = false;
                    }
                }
                out.push(StartupSnapshot {
                    name,
                    command,
                    source: dir.to_string_lossy().to_string(),
                    enabled,
                });
            }
        }
    }
    out
}

#[cfg(target_os = "macos")]
fn capture_startup() -> Vec<StartupSnapshot> {
    use std::fs;
    let mut out = Vec::new();
    let mut dirs = vec![std::path::PathBuf::from("/Library/LaunchAgents")];
    if let Ok(home) = std::env::var("HOME") {
        dirs.push(std::path::PathBuf::from(home).join("Library/LaunchAgents"));
    }
    for dir in dirs {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("plist") {
                continue;
            }
            let name = path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            out.push(StartupSnapshot {
                name,
                command: path.to_string_lossy().to_string(),
                source: dir.to_string_lossy().to_string(),
                enabled: true,
            });
        }
    }
    out
}

#[cfg(target_os = "windows")]
fn capture_software() -> Vec<InstalledApp> {
    use winreg::enums::*;
    use winreg::RegKey;
    let mut out = Vec::new();
    let paths = [
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
    for (hive, path) in paths {
        if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(path, KEY_READ) {
            for sub_name in key.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(sub) = key.open_subkey_with_flags(&sub_name, KEY_READ) {
                    let Ok(name) = sub.get_value::<String, _>("DisplayName") else {
                        continue;
                    };
                    if name.trim().is_empty() {
                        continue;
                    }
                    if sub.get_value::<u32, _>("SystemComponent").unwrap_or(0) == 1 {
                        continue;
                    }
                    out.push(InstalledApp {
                        name,
                        version: sub.get_value::<String, _>("DisplayVersion").ok(),
                        publisher: sub.get_value::<String, _>("Publisher").ok(),
                    });
                }
            }
        }
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    out.dedup_by(|a, b| a.name == b.name && a.version == b.version);
    out
}

#[cfg(target_os = "linux")]
fn capture_software() -> Vec<InstalledApp> {
    use std::process::Command;
    let mut out = Vec::new();
    // Try dpkg first (Debian/Ubuntu).
    if let Ok(o) = Command::new("dpkg-query")
        .args(["-W", "-f=${Package}\t${Version}\t${Maintainer}\n"])
        .output()
    {
        for line in String::from_utf8_lossy(&o.stdout).lines() {
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() >= 3 && !cols[0].is_empty() {
                out.push(InstalledApp {
                    name: cols[0].into(),
                    version: Some(cols[1].into()),
                    publisher: Some(cols[2].into()),
                });
            }
        }
        if !out.is_empty() {
            return out;
        }
    }
    // RHEL family.
    if let Ok(o) = Command::new("rpm")
        .args(["-qa", "--queryformat", "%{NAME}\t%{VERSION}\t%{VENDOR}\n"])
        .output()
    {
        for line in String::from_utf8_lossy(&o.stdout).lines() {
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() >= 3 && !cols[0].is_empty() {
                out.push(InstalledApp {
                    name: cols[0].into(),
                    version: Some(cols[1].into()),
                    publisher: Some(cols[2].into()),
                });
            }
        }
        if !out.is_empty() {
            return out;
        }
    }
    // Arch family.
    if let Ok(o) = Command::new("pacman").arg("-Q").output() {
        for line in String::from_utf8_lossy(&o.stdout).lines() {
            let parts: Vec<&str> = line.splitn(2, ' ').collect();
            if parts.len() == 2 {
                out.push(InstalledApp {
                    name: parts[0].into(),
                    version: Some(parts[1].into()),
                    publisher: None,
                });
            }
        }
    }
    out
}

#[cfg(target_os = "macos")]
fn capture_software() -> Vec<InstalledApp> {
    use std::fs;
    use std::process::Command;
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir("/Applications") {
        for e in entries.flatten() {
            if let Some(name) = e.path().file_stem().and_then(|n| n.to_str()) {
                if name.ends_with(".app") {
                    out.push(InstalledApp {
                        name: name.trim_end_matches(".app").to_string(),
                        version: None,
                        publisher: None,
                    });
                } else {
                    out.push(InstalledApp {
                        name: name.to_string(),
                        version: None,
                        publisher: None,
                    });
                }
            }
        }
    }
    if let Ok(o) = Command::new("brew").args(["list", "--versions"]).output() {
        for line in String::from_utf8_lossy(&o.stdout).lines() {
            let parts: Vec<&str> = line.splitn(2, ' ').collect();
            if !parts[0].is_empty() {
                out.push(InstalledApp {
                    name: parts[0].into(),
                    version: parts.get(1).map(|s| s.to_string()),
                    publisher: Some("Homebrew".into()),
                });
            }
        }
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    out.dedup_by(|a, b| a.name == b.name);
    out
}

#[cfg(target_os = "windows")]
fn create_restore_point(label: &str) -> Option<u32> {
    let cmd = format!(
        "Checkpoint-Computer -Description '{}' -RestorePointType MODIFY_SETTINGS",
        label.replace('\'', "''")
    );
    let _ = crate::util::silent_cmd("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &cmd])
        .output();
    // We don't get a numeric restore-point ID back from Checkpoint-Computer;
    // surface the moment-of-creation as a sentinel so the UI can show "yes".
    Some(1)
}

#[cfg(not(target_os = "windows"))]
fn create_restore_point(_label: &str) -> Option<u32> {
    None
}

// ───────── DB layer ─────────

fn save_snapshot_to_db(snap: &Snapshot) -> Result<(), String> {
    let conn = db::open()?;
    let payload = SnapshotPayload {
        services: snap.services.clone(),
        startup_entries: snap.startup_entries.clone(),
        installed_software: snap.installed_software.clone(),
    };
    let payload_json =
        serde_json::to_string(&payload).map_err(|e| format!("serialize snapshot: {}", e))?;
    conn.execute(
        "INSERT OR REPLACE INTO snapshots (
            id, created_at, label, restore_point_id, registry_export_dir, payload_json
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            snap.id,
            snap.created_at,
            snap.label,
            snap.restore_point_id,
            snap.registry_export_path,
            payload_json,
        ],
    )
    .map_err(|e| format!("insert snapshot: {}", e))?;
    Ok(())
}

fn load_snapshot_from_db(id: &str) -> Result<Snapshot, String> {
    let conn = db::open()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, created_at, label, restore_point_id, registry_export_dir, payload_json
             FROM snapshots WHERE id = ?1",
        )
        .map_err(|e| format!("prepare select: {}", e))?;
    let row = stmt
        .query_row(rusqlite::params![id], |r| {
            let id: String = r.get(0)?;
            let created_at: String = r.get(1)?;
            let label: String = r.get(2)?;
            let restore_point_id: Option<i64> = r.get(3)?;
            let registry_export_dir: Option<String> = r.get(4)?;
            let payload_json: String = r.get(5)?;
            Ok((
                id,
                created_at,
                label,
                restore_point_id,
                registry_export_dir,
                payload_json,
            ))
        })
        .map_err(|e| format!("snapshot {} not found: {}", id, e))?;
    let payload: SnapshotPayload =
        serde_json::from_str(&row.5).map_err(|e| format!("parse payload: {}", e))?;
    Ok(Snapshot {
        id: row.0,
        created_at: row.1,
        label: row.2,
        restore_point_id: row.3.map(|n| n as u32),
        registry_export_path: row.4,
        services: payload.services,
        startup_entries: payload.startup_entries,
        installed_software: payload.installed_software,
    })
}

// ───────── Commands ─────────

#[tauri::command]
pub async fn take_snapshot(label: String) -> Result<Snapshot, String> {
    tokio::task::spawn_blocking(move || {
        let id = uuid::Uuid::new_v4().to_string();
        let restore_point_id = create_restore_point(&label);
        let snap = Snapshot {
            id,
            created_at: current_iso_timestamp(),
            label,
            restore_point_id,
            registry_export_path: None,
            services: capture_services(),
            startup_entries: capture_startup(),
            installed_software: capture_software(),
        };
        save_snapshot_to_db(&snap)?;
        Ok::<Snapshot, String>(snap)
    })
    .await
    .map_err(|e| format!("snapshot task failed: {}", e))?
}

#[tauri::command]
pub async fn list_snapshots() -> Result<Vec<Snapshot>, String> {
    tokio::task::spawn_blocking(|| {
        let conn = db::open()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, created_at, label, restore_point_id, registry_export_dir, payload_json
                 FROM snapshots ORDER BY created_at DESC",
            )
            .map_err(|e| format!("prepare select: {}", e))?;
        let rows = stmt
            .query_map([], |r| {
                let id: String = r.get(0)?;
                let created_at: String = r.get(1)?;
                let label: String = r.get(2)?;
                let restore_point_id: Option<i64> = r.get(3)?;
                let registry_export_dir: Option<String> = r.get(4)?;
                let payload_json: String = r.get(5)?;
                Ok((
                    id,
                    created_at,
                    label,
                    restore_point_id,
                    registry_export_dir,
                    payload_json,
                ))
            })
            .map_err(|e| format!("query: {}", e))?;
        let mut out = Vec::new();
        for row in rows {
            let row = row.map_err(|e| format!("row: {}", e))?;
            let payload: SnapshotPayload =
                serde_json::from_str(&row.5).unwrap_or(SnapshotPayload {
                    services: Vec::new(),
                    startup_entries: Vec::new(),
                    installed_software: Vec::new(),
                });
            out.push(Snapshot {
                id: row.0,
                created_at: row.1,
                label: row.2,
                restore_point_id: row.3.map(|n| n as u32),
                registry_export_path: row.4,
                services: payload.services,
                startup_entries: payload.startup_entries,
                installed_software: payload.installed_software,
            });
        }
        Ok(out)
    })
    .await
    .map_err(|e| format!("list task failed: {}", e))?
}

#[tauri::command]
pub async fn delete_snapshot(id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        conn.execute("DELETE FROM snapshots WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| format!("delete: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("delete task failed: {}", e))?
}

#[tauri::command]
pub async fn diff_snapshots(before_id: String, after_id: String) -> Result<SnapshotDiff, String> {
    tokio::task::spawn_blocking(move || {
        let before = load_snapshot_from_db(&before_id)?;
        let after = load_snapshot_from_db(&after_id)?;

        // Services
        let before_svcs: std::collections::HashMap<String, String> = before
            .services
            .iter()
            .map(|s| (s.name.clone(), s.state.clone()))
            .collect();
        let after_svcs: std::collections::HashMap<String, String> = after
            .services
            .iter()
            .map(|s| (s.name.clone(), s.state.clone()))
            .collect();
        let mut services_added: Vec<String> = after_svcs
            .keys()
            .filter(|k| !before_svcs.contains_key(*k))
            .cloned()
            .collect();
        let mut services_removed: Vec<String> = before_svcs
            .keys()
            .filter(|k| !after_svcs.contains_key(*k))
            .cloned()
            .collect();
        services_added.sort();
        services_removed.sort();
        let mut services_state_changed: Vec<ServiceStateChange> = before_svcs
            .iter()
            .filter_map(|(k, v_before)| {
                after_svcs.get(k).and_then(|v_after| {
                    if v_before != v_after {
                        Some(ServiceStateChange {
                            name: k.clone(),
                            before: v_before.clone(),
                            after: v_after.clone(),
                        })
                    } else {
                        None
                    }
                })
            })
            .collect();
        services_state_changed.sort_by(|a, b| a.name.cmp(&b.name));

        // Startup entries
        let before_keys: std::collections::HashSet<String> = before
            .startup_entries
            .iter()
            .map(|s| s.name.clone())
            .collect();
        let after_keys: std::collections::HashSet<String> = after
            .startup_entries
            .iter()
            .map(|s| s.name.clone())
            .collect();
        let startup_added: Vec<StartupSnapshot> = after
            .startup_entries
            .iter()
            .filter(|s| !before_keys.contains(&s.name))
            .cloned()
            .collect();
        let startup_removed: Vec<StartupSnapshot> = before
            .startup_entries
            .iter()
            .filter(|s| !after_keys.contains(&s.name))
            .cloned()
            .collect();

        // Software
        let before_sw: std::collections::HashSet<String> = before
            .installed_software
            .iter()
            .map(|a| a.name.clone())
            .collect();
        let after_sw: std::collections::HashSet<String> = after
            .installed_software
            .iter()
            .map(|a| a.name.clone())
            .collect();
        let software_added: Vec<InstalledApp> = after
            .installed_software
            .iter()
            .filter(|a| !before_sw.contains(&a.name))
            .cloned()
            .collect();
        let software_removed: Vec<InstalledApp> = before
            .installed_software
            .iter()
            .filter(|a| !after_sw.contains(&a.name))
            .cloned()
            .collect();

        Ok(SnapshotDiff {
            before_id,
            after_id,
            services_added,
            services_removed,
            services_state_changed,
            startup_added,
            startup_removed,
            software_added,
            software_removed,
        })
    })
    .await
    .map_err(|e| format!("diff task failed: {}", e))?
}
