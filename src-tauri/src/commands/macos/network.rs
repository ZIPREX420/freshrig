//! macOS network tools — DNS flush via `dscacheutil` + `mDNSResponder`,
//! interface enumeration via `networksetup`, and Wi-Fi password retrieval
//! via the macOS Keychain (`security find-generic-password`).

use crate::commands::macos::util::{run_cmd_lossy, run_elevated};
use crate::models::network::{NetworkInterface, WifiProfile};

#[tauri::command]
pub async fn network_reset_dns() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        run_elevated("dscacheutil -flushcache && killall -HUP mDNSResponder").map(|_| ())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn network_reset_full() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        // Flush DNS, flush routing table, bounce the primary interface.
        let primary = primary_interface().unwrap_or_else(|| "en0".to_string());
        let cmd = format!(
            "dscacheutil -flushcache; killall -HUP mDNSResponder; route -n flush; ifconfig {iface} down; ifconfig {iface} up",
            iface = primary
        );
        run_elevated(&cmd).map(|_| ())
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
    tokio::task::spawn_blocking(move || {
        let port = match hardware_port_for_device(&interface_name) {
            Some(p) => p,
            None => {
                return Err(format!(
                    "Could not map interface '{}' to a hardware port",
                    interface_name
                ));
            }
        };
        let dns = match secondary.as_deref() {
            Some(s) if !s.is_empty() => format!("{} {}", primary, s),
            _ => primary.clone(),
        };
        let cmd = format!(
            "networksetup -setdnsservers {port} {dns}",
            port = quote_shell(&port),
            dns = dns
        );
        run_elevated(&cmd).map(|_| ())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_network_interfaces() -> Result<Vec<NetworkInterface>, String> {
    tokio::task::spawn_blocking(|| {
        let raw = run_cmd_lossy("networksetup", &["-listallhardwareports"]);
        let mut out = Vec::new();
        for block in raw.split("\n\n") {
            for line in block.lines() {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("Device:") {
                    let device = rest.trim().to_string();
                    if !device.is_empty() && device != "lo0" {
                        out.push(NetworkInterface {
                            name: device,
                            index: 0,
                        });
                    }
                }
            }
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
        let device = wifi_device().unwrap_or_else(|| "en0".to_string());
        let raw = run_cmd_lossy("networksetup", &["-listpreferredwirelessnetworks", &device]);

        let mut profiles = Vec::new();
        for line in raw.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty()
                || trimmed.starts_with("Preferred networks on")
                || trimmed.starts_with("Error")
            {
                continue;
            }
            let ssid = trimmed.to_string();

            // `security find-generic-password -wa <ssid>` triggers a
            // keychain GUI prompt per call. Best we can do is pass the
            // request through and capture stdout — failure leaves
            // password as None.
            let pwd = run_cmd_lossy("security", &["find-generic-password", "-wa", &ssid]);
            let pwd = pwd.trim();
            let password = if pwd.is_empty() {
                None
            } else {
                Some(pwd.to_string())
            };

            profiles.push(WifiProfile {
                ssid,
                password,
                auth_type: "WPA2".to_string(),
            });
        }
        profiles.sort_by_key(|a| a.ssid.to_lowercase());
        Ok(profiles)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

// ---- Helpers ----

/// Parse `route get default` for the `interface:` field.
fn primary_interface() -> Option<String> {
    let raw = run_cmd_lossy("route", &["get", "default"]);
    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("interface:") {
            return Some(rest.trim().to_string());
        }
    }
    None
}

/// Translate a Device (e.g. `en0`) → Hardware Port (e.g. `Wi-Fi`) by
/// parsing `networksetup -listallhardwareports`.
fn hardware_port_for_device(device: &str) -> Option<String> {
    let raw = run_cmd_lossy("networksetup", &["-listallhardwareports"]);
    let mut current_port: Option<String> = None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("Hardware Port:") {
            current_port = Some(rest.trim().to_string());
        } else if let Some(rest) = trimmed.strip_prefix("Device:") {
            if rest.trim() == device {
                return current_port;
            }
        }
    }
    None
}

/// Find the first hardware port whose name contains "Wi-Fi" and return its
/// device name. Falls back to `None` so caller defaults to `en0`.
fn wifi_device() -> Option<String> {
    let raw = run_cmd_lossy("networksetup", &["-listallhardwareports"]);
    let mut is_wifi = false;
    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("Hardware Port:") {
            is_wifi = rest.contains("Wi-Fi") || rest.contains("AirPort");
        } else if let Some(rest) = trimmed.strip_prefix("Device:") {
            if is_wifi {
                return Some(rest.trim().to_string());
            }
        }
    }
    None
}

fn quote_shell(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}
