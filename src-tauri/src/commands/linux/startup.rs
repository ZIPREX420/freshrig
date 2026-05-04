//! Linux startup manager — reads XDG autostart `.desktop` files and systemd
//! user units. Matches the Windows startup command surface.
//!
//! Entry IDs are prefixed with `"xdg:<filename>"` or `"systemd-user:<unit>"`
//! so the toggle command can route back to the right backing store.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use serde::Deserialize;

use crate::commands::linux::util::{home_dir, run_cmd, which};
use crate::models::startup::*;

#[tauri::command]
pub async fn get_startup_entries() -> Result<Vec<StartupEntry>, String> {
    tokio::task::spawn_blocking(|| {
        let mut entries = Vec::new();
        entries.extend(read_xdg_autostart());
        entries.extend(read_systemd_user_units());

        entries.sort_by_key(|a| a.name.to_lowercase());
        Ok(entries)
    })
    .await
    .map_err(|e| format!("startup task failed: {}", e))?
}

#[tauri::command]
pub async fn toggle_startup_entry(id: String, _name: String, enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if let Some(filename) = id.strip_prefix("xdg:") {
            toggle_xdg(filename, enabled)
        } else if let Some(unit) = id.strip_prefix("systemd-user:") {
            toggle_systemd_user(unit, enabled)
        } else {
            Err(format!("Unrecognized startup id: {}", id))
        }
    })
    .await
    .map_err(|e| format!("toggle task failed: {}", e))?
}

// ---- XDG autostart ----

fn xdg_user_dir() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".config/autostart"))
}

fn read_xdg_autostart() -> Vec<StartupEntry> {
    let mut map: BTreeMap<String, StartupEntry> = BTreeMap::new();

    // System-wide autostart first so per-user overrides win.
    for dir in ["/etc/xdg/autostart", "/usr/share/applications/autostart"] {
        append_desktop_files(&PathBuf::from(dir), &mut map);
    }
    if let Some(user_dir) = xdg_user_dir() {
        append_desktop_files(&user_dir, &mut map);
    }

    map.into_values().collect()
}

fn append_desktop_files(dir: &std::path::Path, out: &mut BTreeMap<String, StartupEntry>) {
    let Ok(read) = fs::read_dir(dir) else {
        return;
    };
    for entry in read.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("desktop") {
            continue;
        }
        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };

        let parsed = parse_desktop(&text);
        let enabled =
            parsed.hidden != Some(true) && parsed.x_gnome_autostart_enabled != Some(false);

        let command = parsed.exec.unwrap_or_default();
        let name = parsed.name.unwrap_or_else(|| file_name.clone());

        out.insert(
            file_name.clone(),
            StartupEntry {
                id: format!("xdg:{}", file_name),
                name,
                command,
                source: StartupSource::StartupFolder,
                scope: StartupScope::CurrentUser,
                enabled,
                publisher: None,
                impact: StartupImpact::NotMeasured,
            },
        );
    }
}

#[derive(Default)]
struct DesktopFile {
    name: Option<String>,
    exec: Option<String>,
    hidden: Option<bool>,
    x_gnome_autostart_enabled: Option<bool>,
}

fn parse_desktop(text: &str) -> DesktopFile {
    let mut out = DesktopFile::default();
    let mut in_entry = false;
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if line.starts_with('[') {
            in_entry = line.eq_ignore_ascii_case("[Desktop Entry]");
            continue;
        }
        if !in_entry {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();
            match key {
                "Name" if out.name.is_none() => out.name = Some(value.to_string()),
                "Exec" if out.exec.is_none() => out.exec = Some(value.to_string()),
                "Hidden" => out.hidden = Some(value.eq_ignore_ascii_case("true")),
                "X-GNOME-Autostart-enabled" => {
                    out.x_gnome_autostart_enabled = Some(value.eq_ignore_ascii_case("true"));
                }
                _ => {}
            }
        }
    }
    out
}

fn toggle_xdg(filename: &str, enable: bool) -> Result<(), String> {
    let user_dir = xdg_user_dir().ok_or_else(|| "HOME not set".to_string())?;
    fs::create_dir_all(&user_dir).map_err(|e| format!("mkdir autostart: {}", e))?;

    let user_path = user_dir.join(filename);

    // If disabling: ensure a user override exists and write `Hidden=true`.
    // If enabling: clear `Hidden=true` if present. If no user override yet,
    // copy the system one so the write has something to flip.
    let source_path = if user_path.exists() {
        user_path.clone()
    } else {
        let system = [
            PathBuf::from("/etc/xdg/autostart").join(filename),
            PathBuf::from("/usr/share/applications/autostart").join(filename),
        ];
        system
            .into_iter()
            .find(|p| p.exists())
            .unwrap_or(user_path.clone())
    };

    let content = if source_path.exists() {
        fs::read_to_string(&source_path).map_err(|e| format!("read desktop: {}", e))?
    } else {
        format!(
            "[Desktop Entry]\nType=Application\nName={}\nExec=true\n",
            filename.trim_end_matches(".desktop")
        )
    };

    let rewritten = rewrite_hidden(&content, !enable);
    fs::write(&user_path, rewritten).map_err(|e| format!("write desktop: {}", e))?;
    Ok(())
}

fn rewrite_hidden(text: &str, hidden: bool) -> String {
    let mut lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
    let mut entry_start: Option<usize> = None;
    let mut entry_end: usize = lines.len();

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            if trimmed.eq_ignore_ascii_case("[Desktop Entry]") {
                entry_start = Some(i);
            } else if entry_start.is_some() {
                entry_end = i;
                break;
            }
        }
    }

    let start = match entry_start {
        Some(s) => s,
        None => {
            lines.insert(0, "[Desktop Entry]".to_string());
            0
        }
    };
    let mut wrote_hidden = false;
    let mut wrote_gnome = false;

    let mut i = start + 1;
    while i < entry_end.min(lines.len()) {
        let trimmed = lines[i].trim_start();
        if let Some(rest) = trimmed.strip_prefix("Hidden=") {
            let _ = rest;
            lines[i] = format!("Hidden={}", if hidden { "true" } else { "false" });
            wrote_hidden = true;
        } else if let Some(rest) = trimmed.strip_prefix("X-GNOME-Autostart-enabled=") {
            let _ = rest;
            lines[i] = format!(
                "X-GNOME-Autostart-enabled={}",
                if hidden { "false" } else { "true" }
            );
            wrote_gnome = true;
        }
        i += 1;
    }

    let insert_at = entry_end.min(lines.len());
    if !wrote_hidden {
        lines.insert(
            insert_at,
            format!("Hidden={}", if hidden { "true" } else { "false" }),
        );
    }
    if !wrote_gnome {
        let insert_at = insert_at + if !wrote_hidden { 1 } else { 0 };
        lines.insert(
            insert_at,
            format!(
                "X-GNOME-Autostart-enabled={}",
                if hidden { "false" } else { "true" }
            ),
        );
    }

    let mut s = lines.join("\n");
    s.push('\n');
    s
}

// ---- systemd --user ----

#[derive(Debug, Deserialize)]
struct UserUnitFile {
    #[serde(default)]
    unit_file: String,
    #[serde(default)]
    state: String,
}

fn read_systemd_user_units() -> Vec<StartupEntry> {
    if !which("systemctl") {
        return Vec::new();
    }
    let Ok(json) = run_cmd(
        "systemctl",
        &[
            "--user",
            "list-unit-files",
            "--type=service",
            "--no-pager",
            "--output=json",
        ],
    ) else {
        return Vec::new();
    };

    let rows: Vec<UserUnitFile> = match serde_json::from_str(&json) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    rows.into_iter()
        .filter(|r| !r.unit_file.is_empty())
        .map(|r| {
            let enabled = matches!(
                r.state.as_str(),
                "enabled" | "enabled-runtime" | "static" | "alias"
            );
            let name = r
                .unit_file
                .strip_suffix(".service")
                .unwrap_or(&r.unit_file)
                .to_string();
            StartupEntry {
                id: format!("systemd-user:{}", r.unit_file),
                name: name.clone(),
                command: format!("systemctl --user start {}", r.unit_file),
                source: StartupSource::TaskScheduler,
                scope: StartupScope::CurrentUser,
                enabled,
                publisher: None,
                impact: StartupImpact::NotMeasured,
            }
        })
        .collect()
}

fn toggle_systemd_user(unit: &str, enable: bool) -> Result<(), String> {
    let action = if enable { "enable" } else { "disable" };
    run_cmd("systemctl", &["--user", action, unit]).map(|_| ())
}
