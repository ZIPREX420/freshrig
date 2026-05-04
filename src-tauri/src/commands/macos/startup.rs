//! macOS startup manager — reads `.plist` LaunchAgents from
//! `~/Library/LaunchAgents` and `/Library/LaunchAgents`, plus AppleScript
//! Login Items via `osascript -e 'tell application "System Events" …'`.
//!
//! Entry IDs are prefixed with `"launchagent:<path>"` or
//! `"loginitem:<name>"` so the toggle command can route back to the right
//! backing store. Mirrors Linux's `xdg:` / `systemd-user:` pattern.

use std::fs;
use std::path::{Path, PathBuf};

use plist::Value as PlistValue;

use crate::commands::macos::util::{home_dir, run_cmd_lossy, run_elevated};
use crate::models::startup::*;

#[tauri::command]
pub async fn get_startup_entries() -> Result<Vec<StartupEntry>, String> {
    tokio::task::spawn_blocking(|| {
        let mut entries = Vec::new();
        entries.extend(read_launch_agents());
        entries.extend(read_login_items());

        entries.sort_by_key(|a| a.name.to_lowercase());
        Ok(entries)
    })
    .await
    .map_err(|e| format!("startup task failed: {}", e))?
}

#[tauri::command]
pub async fn toggle_startup_entry(id: String, name: String, enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if let Some(path) = id.strip_prefix("launchagent:") {
            toggle_launch_agent(path, enabled)
        } else if let Some(label) = id.strip_prefix("loginitem:") {
            toggle_login_item(label, &name, enabled)
        } else {
            Err(format!("Unrecognized startup id: {}", id))
        }
    })
    .await
    .map_err(|e| format!("toggle task failed: {}", e))?
}

// ---- LaunchAgents ----

fn read_launch_agents() -> Vec<StartupEntry> {
    let mut out = Vec::new();

    if let Some(home) = home_dir() {
        let user_dir = home.join("Library/LaunchAgents");
        append_launch_agents(&user_dir, StartupScope::CurrentUser, &mut out);
    }
    append_launch_agents(
        Path::new("/Library/LaunchAgents"),
        StartupScope::AllUsers,
        &mut out,
    );

    out
}

fn append_launch_agents(dir: &Path, scope: StartupScope, out: &mut Vec<StartupEntry>) {
    let Ok(read) = fs::read_dir(dir) else {
        return;
    };
    for entry in read.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("plist") {
            continue;
        }
        let parsed = match parse_launch_agent(&path) {
            Some(p) => p,
            None => continue,
        };
        let publisher = derive_publisher(&parsed.label);
        out.push(StartupEntry {
            id: format!("launchagent:{}", path.to_string_lossy()),
            name: parsed.label.clone(),
            command: parsed.command,
            source: StartupSource::StartupFolder,
            scope: scope.clone(),
            enabled: !parsed.disabled,
            publisher,
            impact: StartupImpact::NotMeasured,
        });
    }
}

struct ParsedAgent {
    label: String,
    command: String,
    disabled: bool,
}

fn parse_launch_agent(path: &Path) -> Option<ParsedAgent> {
    let raw = fs::read(path).ok()?;
    let value = PlistValue::from_reader(std::io::Cursor::new(&raw)).ok()?;
    let dict = value.as_dictionary()?;

    let label = dict
        .get("Label")
        .and_then(|v| v.as_string())
        .unwrap_or_default()
        .to_string();
    if label.is_empty() {
        return None;
    }

    let disabled = dict
        .get("Disabled")
        .and_then(|v| v.as_boolean())
        .unwrap_or(false);

    let command = if let Some(args) = dict.get("ProgramArguments").and_then(|v| v.as_array()) {
        args.iter()
            .filter_map(|v| v.as_string().map(|s| s.to_string()))
            .collect::<Vec<_>>()
            .join(" ")
    } else if let Some(prog) = dict.get("Program").and_then(|v| v.as_string()) {
        prog.to_string()
    } else {
        String::new()
    };

    Some(ParsedAgent {
        label,
        command,
        disabled,
    })
}

fn derive_publisher(label: &str) -> Option<String> {
    if label.starts_with("com.apple.") {
        return Some("Apple".to_string());
    }
    let mut parts = label.split('.');
    let first = parts.next()?;
    let second = parts.next()?;
    Some(match first {
        "com" | "org" | "io" | "net" => capitalize(second),
        _ => capitalize(first),
    })
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

fn toggle_launch_agent(path_str: &str, enabled: bool) -> Result<(), String> {
    let path = PathBuf::from(path_str);
    if !path.exists() {
        return Err(format!("LaunchAgent plist not found: {}", path_str));
    }

    // `defaults write <plist-without-extension> Disabled -bool <value>`
    // expects the path stem (no `.plist`).
    let stem = path.with_extension("");
    let stem_str = stem.to_string_lossy().to_string();
    let value = if enabled { "false" } else { "true" };

    // System-scope plists need elevation. User-scope (~/Library) works
    // unprivileged.
    let is_system = path_str.starts_with("/Library/");

    if is_system {
        let cmd = format!(
            "defaults write {stem} Disabled -bool {value}",
            stem = quote_shell(&stem_str),
            value = value
        );
        run_elevated(&cmd).map(|_| ())
    } else {
        let out = std::process::Command::new("defaults")
            .args(["write", &stem_str, "Disabled", "-bool", value])
            .output()
            .map_err(|e| format!("Failed to spawn defaults: {}", e))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        Ok(())
    }
}

fn quote_shell(s: &str) -> String {
    // Wrap in single quotes and escape any internal single quotes.
    format!("'{}'", s.replace('\'', "'\\''"))
}

// ---- Login Items ----

fn read_login_items() -> Vec<StartupEntry> {
    let names = run_cmd_lossy(
        "osascript",
        &[
            "-e",
            "tell application \"System Events\" to get the name of every login item",
        ],
    );
    let paths = run_cmd_lossy(
        "osascript",
        &[
            "-e",
            "tell application \"System Events\" to get the path of every login item",
        ],
    );

    let name_list = parse_osascript_list(&names);
    let path_list = parse_osascript_list(&paths);

    name_list
        .into_iter()
        .enumerate()
        .map(|(i, name)| {
            let command = path_list.get(i).cloned().unwrap_or_default();
            StartupEntry {
                id: format!("loginitem:{}", name),
                name: name.clone(),
                command,
                source: StartupSource::TaskScheduler,
                scope: StartupScope::CurrentUser,
                enabled: true,
                publisher: None,
                impact: StartupImpact::NotMeasured,
            }
        })
        .collect()
}

/// osascript list output is comma-separated, e.g. `Slack, Spotify, iTerm2`.
/// Empty output → empty vec.
fn parse_osascript_list(raw: &str) -> Vec<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    trimmed
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn toggle_login_item(label: &str, name: &str, enabled: bool) -> Result<(), String> {
    let display_name = if name.is_empty() { label } else { name };
    if enabled {
        // Re-add. Without the original path we can only attempt to add by
        // name — System Events may resolve it from the disk if the bundle
        // is in /Applications. This is best-effort.
        let escaped = display_name.replace('"', "\\\"");
        let script = format!(
            "tell application \"System Events\" to make new login item with properties {{name:\"{n}\", path:\"/Applications/{n}.app\", hidden:false}}",
            n = escaped
        );
        let out = std::process::Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("Failed to spawn osascript: {}", e))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
    } else {
        let escaped = display_name.replace('"', "\\\"");
        let script = format!(
            "tell application \"System Events\" to delete login item \"{}\"",
            escaped
        );
        let out = std::process::Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("Failed to spawn osascript: {}", e))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
    }
    Ok(())
}
