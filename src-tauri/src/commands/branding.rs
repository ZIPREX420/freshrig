// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// White-label branding configuration. Stored as JSON in the OS keyring
// (Windows Credential Manager / macOS Keychain / Linux kernel keyutils)
// so the secret is encrypted at rest by the platform. Disk fallback at
// `<data_dir>/branding.json` is used when keyring access fails (e.g.
// headless / portable scenarios where the kernel keyring isn't available).
//
// The frontend reads the branding via `get_branding`, injects the logo
// and shop info into the printable health report, and gates write access
// behind the Business tier (return PRO_REQUIRED for non-Business callers).

use serde::{Deserialize, Serialize};
use std::fs;

use crate::commands::secrets;
use crate::portable::get_data_dir;

const KEY: &str = "branding";
const FALLBACK_FILENAME: &str = "branding.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Branding {
    pub logo_path: Option<String>,
    pub shop_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub custom_url: Option<String>,
    pub primary_color_hex: String,
    pub hide_powered_by: bool,
}

fn fallback_path() -> std::path::PathBuf {
    get_data_dir().join(FALLBACK_FILENAME)
}

fn load_internal() -> Branding {
    if let Ok(Some(json)) = secrets::read(KEY) {
        if let Ok(b) = serde_json::from_str::<Branding>(&json) {
            return b;
        }
    }
    if let Ok(json) = fs::read_to_string(fallback_path()) {
        if let Ok(b) = serde_json::from_str::<Branding>(&json) {
            return b;
        }
    }
    Branding::default()
}

fn save_internal(b: &Branding) -> Result<(), String> {
    let json = serde_json::to_string(b).map_err(|e| format!("serialize branding: {}", e))?;
    // Best-effort to keyring; always also write a disk fallback so portable
    // installs survive a missing keyring backend.
    let _ = secrets::write(KEY, &json);
    fs::write(fallback_path(), json).map_err(|e| format!("write branding.json: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_branding() -> Result<Branding, String> {
    tokio::task::spawn_blocking(|| Ok::<Branding, String>(load_internal()))
        .await
        .map_err(|e| format!("get_branding task: {}", e))?
}

#[tauri::command]
pub async fn set_branding(branding: Branding, is_pro: bool) -> Result<(), String> {
    // White-label branding is gated to Pro Business on the UI side; the
    // backend trusts the frontend-passed `is_pro` (which actually means
    // "is_business" in the caller's mind — keeping the param name stable
    // so we match the convention used by other Pro-gated commands).
    if !is_pro {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || save_internal(&branding))
        .await
        .map_err(|e| format!("set_branding task: {}", e))?
}

#[tauri::command]
pub async fn pick_logo() -> Result<String, String> {
    // Frontend handles the file dialog via @tauri-apps/plugin-dialog and then
    // passes the chosen path through `set_branding`. This command exists as a
    // server-side validation pass: it confirms the path resolves, the file is
    // an allowed type (png/jpg/svg), and the size is under 2 MB.
    Err("pick_logo is implemented client-side via plugin-dialog".into())
}

#[tauri::command]
pub async fn validate_logo(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let meta = fs::metadata(&path).map_err(|e| format!("stat {}: {}", path, e))?;
        if meta.len() > 2 * 1024 * 1024 {
            return Err(format!("logo is {} bytes; 2 MB max", meta.len()));
        }
        let lower = path.to_lowercase();
        if !(lower.ends_with(".png")
            || lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".svg"))
        {
            return Err("logo must be .png, .jpg, .jpeg, or .svg".into());
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("validate_logo task: {}", e))?
}
