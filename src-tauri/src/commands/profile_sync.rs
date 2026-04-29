// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Encrypted Profile Sync — cross-platform.
//
// Wraps the `age` crate's passphrase-based encryption (scrypt-derived
// key, internal to age's API surface — we don't compose argon2 on top
// because age's `with_user_passphrase` already runs scrypt with sane
// parameters and adding argon2 would mean fighting with `Recipient`s).
//
// Three commands:
//   * export_profile_encrypted(profile_json, passphrase, output_path)
//     → writes a `.frprofile` blob to disk.
//   * import_profile_encrypted(input_path, passphrase) → returns the
//     decrypted JSON string. Frontend persists via existing
//     `save_profile`.
//   * detect_cloud_synced_profiles() → scans known cloud-sync folders
//     per OS for `*.frprofile` files. Detect-only — never auto-imports.
//
// Frontend gates the cloud-import affordance on Pro tier; the encrypt /
// decrypt commands themselves are open (anyone can encrypt or decrypt
// a file they already have a passphrase for).

use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;

use age::secrecy::SecretString;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedProfile {
    pub name: String,
    pub path: String,
    pub modified_at: String,
}

// ───────── Encrypt / Decrypt ─────────

#[tauri::command]
pub async fn export_profile_encrypted(
    profile_json: String,
    passphrase: String,
    output_path: String,
) -> Result<(), String> {
    if passphrase.is_empty() {
        return Err("Passphrase cannot be empty".into());
    }
    tokio::task::spawn_blocking(move || {
        let encryptor = age::Encryptor::with_user_passphrase(SecretString::from(passphrase));
        let mut buf = Vec::new();
        let mut writer = encryptor
            .wrap_output(&mut buf)
            .map_err(|e| format!("age wrap_output: {}", e))?;
        writer
            .write_all(profile_json.as_bytes())
            .map_err(|e| format!("age write: {}", e))?;
        writer
            .finish()
            .map_err(|e| format!("age finish: {}", e))?;
        fs::write(&output_path, buf).map_err(|e| format!("write {}: {}", output_path, e))?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("export task failed: {}", e))?
}

#[tauri::command]
pub async fn import_profile_encrypted(
    input_path: String,
    passphrase: String,
) -> Result<String, String> {
    if passphrase.is_empty() {
        return Err("Passphrase cannot be empty".into());
    }
    tokio::task::spawn_blocking(move || {
        let raw = fs::read(&input_path).map_err(|e| format!("read {}: {}", input_path, e))?;
        let decryptor = match age::Decryptor::new(raw.as_slice())
            .map_err(|e| format!("age decrypt header: {}", e))?
        {
            age::Decryptor::Passphrase(d) => d,
            _ => return Err("not a passphrase-encrypted age file".into()),
        };
        let mut reader = decryptor
            .decrypt(&SecretString::from(passphrase), None)
            .map_err(|e| format!("age decrypt body: {} (wrong passphrase?)", e))?;
        let mut decrypted = String::new();
        reader
            .read_to_string(&mut decrypted)
            .map_err(|e| format!("age read: {}", e))?;
        Ok::<String, String>(decrypted)
    })
    .await
    .map_err(|e| format!("import task failed: {}", e))?
}

// ───────── Cloud-folder detection ─────────

fn cloud_search_paths() -> Vec<PathBuf> {
    let mut out = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if let Ok(home) = std::env::var("USERPROFILE") {
            let h = PathBuf::from(home);
            out.push(h.join("OneDrive"));
            out.push(h.join("Dropbox"));
            // iCloudDrive subdirs use `iCloud~*` prefix
            out.push(h.join("iCloudDrive"));
            out.push(h.join("Google Drive"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let h = PathBuf::from(home);
            out.push(h.join("Dropbox"));
            out.push(h.join("OneDrive"));
            out.push(h.join("Insync"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let h = PathBuf::from(home);
            out.push(h.join("Library/Mobile Documents/com~apple~CloudDocs"));
            out.push(h.join("Dropbox"));
            out.push(h.join("OneDrive"));
        }
    }
    out
}

fn modified_iso(meta: &fs::Metadata) -> String {
    let secs = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
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

/// Walk a directory up to ~3 levels deep looking for *.frprofile files.
/// Cloud sync roots can have nested subdirs (e.g. `OneDrive\Documents\…`).
/// Bounded depth keeps the scan cheap.
fn walk_for_frprofile(root: &std::path::Path, depth: u32, out: &mut Vec<DetectedProfile>) {
    if depth > 3 {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            walk_for_frprofile(&path, depth + 1, out);
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("frprofile") {
            continue;
        }
        let name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        out.push(DetectedProfile {
            name,
            path: path.to_string_lossy().to_string(),
            modified_at: modified_iso(&meta),
        });
    }
}

#[tauri::command]
pub async fn detect_cloud_synced_profiles() -> Result<Vec<DetectedProfile>, String> {
    tokio::task::spawn_blocking(|| {
        let mut found = Vec::new();
        for root in cloud_search_paths() {
            if !root.exists() {
                continue;
            }
            walk_for_frprofile(&root, 0, &mut found);
        }
        found.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
        Ok(found)
    })
    .await
    .map_err(|e| format!("detect task failed: {}", e))?
}
