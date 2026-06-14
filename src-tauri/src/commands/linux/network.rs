//! Linux network tools — DNS flush, NetworkManager restart, static DNS
//! configuration via resolved.conf.d/ or nmcli, and Wi-Fi password read.

use std::fs;

use crate::commands::linux::util::{is_root, run_cmd, run_cmd_lossy, run_elevated, which};
use crate::models::network::{NetworkInterface, WifiProfile};

/// Accepts only valid IPv4/IPv6 literals. DNS values flow into an nmcli
/// argument and a systemd-resolved drop-in written via `pkexec tee`, so reject
/// anything that is not a bare IP (also blocks newline-injected directives).
fn is_ip_literal(s: &str) -> bool {
    s.trim().parse::<std::net::IpAddr>().is_ok()
}

#[tauri::command]
pub async fn network_reset_dns() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        // Prefer resolvectl on systemd-resolved systems.
        if which("resolvectl") && run_cmd("resolvectl", &["flush-caches"]).is_ok() {
            return Ok(());
        }
        if which("systemd-resolve") && run_cmd("systemd-resolve", &["--flush-caches"]).is_ok() {
            return Ok(());
        }
        if which("systemctl") {
            if run_elevated("systemctl", &["restart", "systemd-resolved.service"]).is_ok() {
                return Ok(());
            }
            if run_elevated("systemctl", &["restart", "nscd.service"]).is_ok() {
                return Ok(());
            }
        }
        Err("Could not flush DNS cache — no systemd-resolved or nscd found.".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn network_reset_full() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        if which("systemctl") {
            // Try NetworkManager first; fall back to ifupdown's networking.service.
            if run_elevated("systemctl", &["restart", "NetworkManager.service"]).is_ok() {
                return Ok(());
            }
            if run_elevated("systemctl", &["restart", "networking.service"]).is_ok() {
                return Ok(());
            }
            if run_elevated("systemctl", &["restart", "systemd-networkd.service"]).is_ok() {
                return Ok(());
            }
        }
        Err("No supported network service could be restarted.".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn set_dns_servers(
    interface_name: String,
    primary: String,
    secondary: Option<String>,
) -> Result<(), String> {
    // SEC (injection): primary/secondary flow into an nmcli argument and into a
    // systemd-resolved drop-in written via `pkexec tee`. Validate as IP
    // literals so a newline or shell metacharacter cannot inject extra resolved
    // directives or arguments. DNS servers are always IPs.
    if !is_ip_literal(&primary) {
        return Err(format!("Invalid primary DNS address: {}", primary));
    }
    if let Some(s) = secondary.as_deref() {
        if !s.trim().is_empty() && !is_ip_literal(s) {
            return Err(format!("Invalid secondary DNS address: {}", s));
        }
    }
    tokio::task::spawn_blocking(move || {
        // If NetworkManager is around and the interface maps to a connection,
        // use nmcli — that's what the system treats as source of truth.
        if which("nmcli") {
            if let Some(conn) = nm_connection_for(&interface_name) {
                let dns = match &secondary {
                    Some(s) if !s.is_empty() => format!("{} {}", primary, s),
                    _ => primary.clone(),
                };
                run_cmd(
                    "nmcli",
                    &[
                        "con",
                        "mod",
                        &conn,
                        "ipv4.dns",
                        &dns,
                        "ipv4.ignore-auto-dns",
                        "yes",
                    ],
                )?;
                let _ = run_cmd("nmcli", &["con", "down", &conn]);
                run_cmd("nmcli", &["con", "up", &conn])?;
                return Ok(());
            }
        }

        // Fall back to a systemd-resolved drop-in. This is global rather than
        // per-interface, but it's the best we can do without NM.
        let mut dns_line = primary.clone();
        if let Some(s) = secondary.as_deref() {
            if !s.is_empty() {
                dns_line.push(' ');
                dns_line.push_str(s);
            }
        }
        let body = format!(
            "# Written by FreshRig\n[Resolve]\nDNS={}\nDNSOverTLS=opportunistic\n",
            dns_line
        );
        let path = "/etc/systemd/resolved.conf.d/freshrig.conf";
        write_elevated_file(path, &body)?;
        let _ = run_elevated("systemctl", &["restart", "systemd-resolved.service"]);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_network_interfaces() -> Result<Vec<NetworkInterface>, String> {
    tokio::task::spawn_blocking(|| {
        let entries =
            fs::read_dir("/sys/class/net").map_err(|e| format!("read /sys/class/net: {}", e))?;
        let mut out = Vec::new();
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == "lo" {
                continue;
            }
            let index = fs::read_to_string(format!("/sys/class/net/{}/ifindex", name))
                .ok()
                .and_then(|s| s.trim().parse::<u32>().ok())
                .unwrap_or(0);
            out.push(NetworkInterface { name, index });
        }
        out.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(out)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_wifi_passwords() -> Result<Vec<WifiProfile>, String> {
    tokio::task::spawn_blocking(|| {
        if !is_root() {
            return Err("Root privileges required to read stored Wi-Fi passwords.".to_string());
        }
        let dir = "/etc/NetworkManager/system-connections";
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return Ok(Vec::new()),
        };
        let mut profiles = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("nmconnection") {
                continue;
            }
            let Ok(text) = fs::read_to_string(&path) else {
                continue;
            };
            if let Some(profile) = parse_nmconnection(&text) {
                profiles.push(profile);
            }
        }
        profiles.sort_by_key(|a| a.ssid.to_lowercase());
        Ok(profiles)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

// ---- Helpers ----

fn nm_connection_for(interface: &str) -> Option<String> {
    let out = run_cmd_lossy(
        "nmcli",
        &["-t", "-f", "NAME,DEVICE", "connection", "show", "--active"],
    );
    for line in out.lines() {
        let mut parts = line.splitn(2, ':');
        let name = parts.next()?.to_string();
        let device = parts.next().unwrap_or("");
        if device == interface {
            return Some(name);
        }
    }
    None
}

fn parse_nmconnection(text: &str) -> Option<WifiProfile> {
    let mut section = "";
    let mut ssid = String::new();
    let mut psk: Option<String> = None;
    let mut key_mgmt = String::new();
    let mut is_wifi = false;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            section = line.trim_matches(|c| c == '[' || c == ']');
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        match (section, key) {
            ("connection", "type") if value == "wifi" || value == "802-11-wireless" => {
                is_wifi = true;
            }
            ("wifi", "ssid") | ("802-11-wireless", "ssid") => {
                ssid = value.to_string();
            }
            ("wifi-security", "psk") | ("802-11-wireless-security", "psk") => {
                psk = Some(value.to_string());
            }
            ("wifi-security", "key-mgmt") | ("802-11-wireless-security", "key-mgmt") => {
                key_mgmt = value.to_string();
            }
            _ => {}
        }
    }

    if !is_wifi || ssid.is_empty() {
        return None;
    }

    let auth_type = match key_mgmt.as_str() {
        "wpa-psk" => "WPA2-Personal".to_string(),
        "wpa-eap" => "WPA2-Enterprise".to_string(),
        "sae" => "WPA3-Personal".to_string(),
        "none" => "Open".to_string(),
        "" => "Open".to_string(),
        other => other.to_string(),
    };

    Some(WifiProfile {
        ssid,
        password: psk,
        auth_type,
    })
}

fn write_elevated_file(path: &str, content: &str) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    // Ensure parent dir exists (the drop-in dir may not).
    if let Some(parent) = std::path::Path::new(path).parent() {
        let _ = run_elevated("mkdir", &["-p", parent.to_string_lossy().as_ref()]);
    }

    let mut child = Command::new("pkexec")
        .args(["tee", path])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|e| format!("pkexec tee: {}", e))?;
    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(content.as_bytes())
            .map_err(|e| format!("write stdin: {}", e))?;
    }
    let status = child.wait().map_err(|e| format!("wait tee: {}", e))?;
    if !status.success() {
        return Err(format!("tee exited with {}", status));
    }
    Ok(())
}
