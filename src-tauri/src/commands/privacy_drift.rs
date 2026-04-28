// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Privacy Drift Detection — Windows-only.
//
// Captures a snapshot ("baseline") of every privacy-relevant registry value
// the user cares about, then compares the current state to that baseline to
// surface what Windows has changed under the user (e.g. a feature update
// re-enabling Tailored Experiences, Recall, advertising IDs).
//
// Storage: a single JSON file `privacy_baseline.json` in the app data dir
// (portable next-to-exe or `%APPDATA%\com.freshrig.app`).
//
// All command bodies tolerate "no baseline yet" by returning an empty
// `Vec` (not Err) so the App-startup drift toast doesn't fire on first
// launch before the user has captured one.

use std::collections::HashMap;
use std::fs;

use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::RegKey;

use crate::portable::get_data_dir;

const BASELINE_FILENAME: &str = "privacy_baseline.json";
const ABSENT_SENTINEL: &str = "<NOT_SET>";

// ───────── Models ─────────

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DriftSeverity {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivacyBaseline {
    pub created_at: String,
    pub windows_build: String,
    pub entries: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriftEntry {
    pub registry_path: String,
    pub setting_name: String,
    pub baseline_value: Option<String>,
    pub current_value: Option<String>,
    pub severity: DriftSeverity,
}

// ───────── Monitored registry paths ─────────

#[derive(Clone, Copy)]
struct MonitoredPath {
    hive: HiveKey,
    subkey: &'static str,
    value_name: &'static str,
    setting_name: &'static str,
    severity: DriftSeverity,
}

#[derive(Clone, Copy)]
enum HiveKey {
    Hklm,
    Hkcu,
}

impl HiveKey {
    fn predef(self) -> RegKey {
        match self {
            HiveKey::Hklm => RegKey::predef(HKEY_LOCAL_MACHINE),
            HiveKey::Hkcu => RegKey::predef(HKEY_CURRENT_USER),
        }
    }
    fn label(self) -> &'static str {
        match self {
            HiveKey::Hklm => "HKLM",
            HiveKey::Hkcu => "HKCU",
        }
    }
}

// All paths the drift detector watches. 16 entries covering Telemetry,
// Advertising, Activity, AI/Copilot, Search, and Input/Cortana surfaces.
// Severity classification per the v2.0 spec.
const MONITORED: &[MonitoredPath] = &[
    // Telemetry — HIGH
    MonitoredPath {
        hive: HiveKey::Hklm,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
        value_name: "AllowTelemetry",
        setting_name: "Telemetry level",
        severity: DriftSeverity::High,
    },
    MonitoredPath {
        hive: HiveKey::Hklm,
        subkey: r"SYSTEM\CurrentControlSet\Services\DiagTrack",
        value_name: "Start",
        setting_name: "DiagTrack service start",
        severity: DriftSeverity::High,
    },
    // Advertising — MEDIUM
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
        value_name: "Enabled",
        setting_name: "Advertising ID enabled",
        severity: DriftSeverity::Medium,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
        value_name: "SubscribedContent-338389Enabled",
        setting_name: "Tailored: suggested content",
        severity: DriftSeverity::Medium,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
        value_name: "SubscribedContent-338388Enabled",
        setting_name: "Tailored: Start suggestions",
        severity: DriftSeverity::Medium,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
        value_name: "SubscribedContent-338393Enabled",
        setting_name: "Tailored: tips & tricks",
        severity: DriftSeverity::Medium,
    },
    // Activity — MEDIUM, with one HIGH for upload
    MonitoredPath {
        hive: HiveKey::Hklm,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\System",
        value_name: "PublishUserActivities",
        setting_name: "Publish user activities",
        severity: DriftSeverity::Medium,
    },
    MonitoredPath {
        hive: HiveKey::Hklm,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\System",
        value_name: "UploadUserActivities",
        setting_name: "Upload activities to Microsoft",
        severity: DriftSeverity::High,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
        value_name: "Start_TrackProgs",
        setting_name: "Track app launches",
        severity: DriftSeverity::Medium,
    },
    MonitoredPath {
        hive: HiveKey::Hklm,
        subkey: r"SOFTWARE\Policies\Microsoft\Windows\System",
        value_name: "AllowClipboardHistory",
        setting_name: "Clipboard history",
        severity: DriftSeverity::Medium,
    },
    // AI / Copilot — Recall is HIGH, Copilot is MEDIUM
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Policies\Microsoft\Windows\WindowsAI",
        value_name: "AllowRecallEnablement",
        setting_name: "Windows Recall",
        severity: DriftSeverity::High,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Policies\Microsoft\Windows\WindowsCopilot",
        value_name: "TurnOffWindowsCopilot",
        setting_name: "Windows Copilot disabled",
        severity: DriftSeverity::Medium,
    },
    // Search — LOW
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Policies\Microsoft\Windows\Explorer",
        value_name: "DisableSearchBoxSuggestions",
        setting_name: "Search box suggestions",
        severity: DriftSeverity::Low,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\Windows\CurrentVersion\Search",
        value_name: "BingSearchEnabled",
        setting_name: "Bing in Start search",
        severity: DriftSeverity::Low,
    },
    // Input / Cortana — LOW (ink/text), Speech HasAccepted is privacy-relevant
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\InputPersonalization",
        value_name: "RestrictImplicitInkCollection",
        setting_name: "Restrict ink collection",
        severity: DriftSeverity::Low,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\InputPersonalization",
        value_name: "RestrictImplicitTextCollection",
        setting_name: "Restrict text collection",
        severity: DriftSeverity::Low,
    },
    MonitoredPath {
        hive: HiveKey::Hkcu,
        subkey: r"Software\Microsoft\Speech_OneCore\Settings\OnlineSpeechPrivacy",
        value_name: "HasAccepted",
        setting_name: "Online speech recognition",
        severity: DriftSeverity::Medium,
    },
];

// ───────── Helpers ─────────

fn full_path_key(p: &MonitoredPath) -> String {
    format!("{}\\{}\\{}", p.hive.label(), p.subkey, p.value_name)
}

/// Read the value as a string. DWORDs become decimal, strings are returned
/// as-is. Returns `None` if the key/value is absent or the type is exotic.
fn read_value_as_string(p: &MonitoredPath) -> Option<String> {
    let subkey = p.hive.predef().open_subkey(p.subkey).ok()?;
    if let Ok(v) = subkey.get_value::<u32, _>(p.value_name) {
        return Some(v.to_string());
    }
    if let Ok(v) = subkey.get_value::<String, _>(p.value_name) {
        return Some(v);
    }
    None
}

/// Write a DWORD value, creating the subkey path if necessary.
/// Used by `reapply_privacy_baseline` to restore baseline state.
fn write_dword(p: &MonitoredPath, value: u32) -> Result<(), String> {
    let (key, _) = p
        .hive
        .predef()
        .create_subkey(p.subkey)
        .map_err(|e| format!("create_subkey {}\\{}: {}", p.hive.label(), p.subkey, e))?;
    key.set_value(p.value_name, &value)
        .map_err(|e| format!("set {}: {}", p.value_name, e))
}

fn current_iso_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Reuse the simple civil-from-days routine that the report module uses.
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

fn read_windows_build() -> String {
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .ok()
        .and_then(|k| k.get_value::<String, _>("CurrentBuild").ok())
        .unwrap_or_else(|| "unknown".into())
}

fn baseline_path() -> std::path::PathBuf {
    get_data_dir().join(BASELINE_FILENAME)
}

fn load_baseline() -> Option<PrivacyBaseline> {
    let raw = fs::read_to_string(baseline_path()).ok()?;
    serde_json::from_str(&raw).ok()
}

fn save_baseline(baseline: &PrivacyBaseline) -> Result<(), String> {
    let json =
        serde_json::to_string_pretty(baseline).map_err(|e| format!("serialize baseline: {}", e))?;
    fs::write(baseline_path(), json).map_err(|e| format!("write baseline: {}", e))
}

fn capture_current() -> HashMap<String, String> {
    let mut out = HashMap::new();
    for p in MONITORED {
        let key = full_path_key(p);
        let value = read_value_as_string(p).unwrap_or_else(|| ABSENT_SENTINEL.into());
        out.insert(key, value);
    }
    out
}

// ───────── Tauri commands ─────────

#[tauri::command]
pub async fn create_privacy_baseline() -> Result<PrivacyBaseline, String> {
    tokio::task::spawn_blocking(|| {
        let baseline = PrivacyBaseline {
            created_at: current_iso_timestamp(),
            windows_build: read_windows_build(),
            entries: capture_current(),
        };
        save_baseline(&baseline)?;
        Ok::<PrivacyBaseline, String>(baseline)
    })
    .await
    .map_err(|e| format!("baseline task failed: {}", e))?
}

#[tauri::command]
pub async fn check_privacy_drift() -> Result<Vec<DriftEntry>, String> {
    tokio::task::spawn_blocking(|| {
        let Some(baseline) = load_baseline() else {
            // No baseline captured yet → no drift to report. Returning an
            // empty Vec (not Err) lets the startup-toast logic stay silent
            // until the user explicitly creates a baseline.
            return Ok(Vec::new());
        };

        let mut drifted = Vec::new();
        for p in MONITORED {
            let key = full_path_key(p);
            let baseline_raw = baseline.entries.get(&key).cloned();
            let current_raw = read_value_as_string(p).unwrap_or_else(|| ABSENT_SENTINEL.into());

            // Skip if baseline doesn't have this entry (older baseline,
            // captured before we monitored this path).
            let Some(baseline_raw) = baseline_raw else {
                continue;
            };

            if baseline_raw == current_raw {
                continue;
            }

            drifted.push(DriftEntry {
                registry_path: key,
                setting_name: p.setting_name.into(),
                baseline_value: sentinel_to_option(&baseline_raw),
                current_value: sentinel_to_option(&current_raw),
                severity: p.severity,
            });
        }

        // Sort: High → Medium → Low so the table reads worst-first.
        drifted.sort_by_key(|e| match e.severity {
            DriftSeverity::High => 0,
            DriftSeverity::Medium => 1,
            DriftSeverity::Low => 2,
        });

        Ok(drifted)
    })
    .await
    .map_err(|e| format!("drift task failed: {}", e))?
}

fn sentinel_to_option(s: &str) -> Option<String> {
    if s == ABSENT_SENTINEL {
        None
    } else {
        Some(s.to_string())
    }
}

#[tauri::command]
pub async fn reapply_privacy_baseline(is_pro: bool) -> Result<(), String> {
    if !is_pro {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(|| {
        let baseline =
            load_baseline().ok_or_else(|| "No baseline found. Create one first.".to_string())?;

        for p in MONITORED {
            let key = full_path_key(p);
            let Some(value) = baseline.entries.get(&key) else {
                continue;
            };
            // Skip absent values — restoring "absent" would mean deleting
            // the key, which is risky for system-protected paths and not
            // what most users want. They can clear the key manually.
            if value == ABSENT_SENTINEL {
                continue;
            }
            // Try to parse as DWORD. All our monitored paths are DWORDs;
            // string values aren't expected but if they appear we skip them
            // rather than corrupting the registry.
            if let Ok(n) = value.parse::<u32>() {
                let _ = write_dword(p, n);
            }
        }
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("reapply task failed: {}", e))?
}

#[tauri::command]
pub async fn export_baseline(target_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let baseline =
            load_baseline().ok_or_else(|| "No baseline found. Create one first.".to_string())?;
        let json = serde_json::to_string_pretty(&baseline)
            .map_err(|e| format!("serialize baseline: {}", e))?;
        fs::write(&target_path, json).map_err(|e| format!("write {}: {}", target_path, e))
    })
    .await
    .map_err(|e| format!("export task failed: {}", e))?
}

#[tauri::command]
pub async fn import_baseline(path: String) -> Result<PrivacyBaseline, String> {
    tokio::task::spawn_blocking(move || {
        let raw = fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path, e))?;
        let baseline: PrivacyBaseline =
            serde_json::from_str(&raw).map_err(|e| format!("parse JSON: {}", e))?;
        save_baseline(&baseline)?;
        Ok(baseline)
    })
    .await
    .map_err(|e| format!("import task failed: {}", e))?
}
