use std::fs;
use std::path::{Path, PathBuf};

/// Check if FreshRig is running in portable mode.
///
/// Portable mode is detected by:
///
/// 1. A `.portable` marker file next to the executable
/// 2. The `FRESHRIG_PORTABLE` environment variable set to "1"
pub fn is_portable() -> bool {
    std::env::var("FRESHRIG_PORTABLE").unwrap_or_default() == "1"
        || std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(".portable").exists()))
            .unwrap_or(false)
}

/// Get the data directory — either portable (next to exe) or standard (%APPDATA%).
/// Falls back to the standard path if exe-path resolution fails so we never panic
/// during startup (panic in this codepath would crash the tray init in `lib.rs`).
pub fn get_data_dir() -> PathBuf {
    if is_portable() {
        if let Some(dir) = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("data")))
        {
            std::fs::create_dir_all(&dir).ok();
            return dir;
        }
        // Portable mode requested but we couldn't resolve the exe path —
        // fall through to the standard %APPDATA% path so the app still boots.
    }
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    let dir = PathBuf::from(appdata).join("com.freshrig.app");
    std::fs::create_dir_all(&dir).ok();
    dir
}

#[tauri::command]
pub fn check_portable_mode() -> bool {
    is_portable()
}

#[tauri::command]
pub fn get_portable_data_dir() -> Result<String, String> {
    Ok(get_data_dir().to_string_lossy().to_string())
}

/// Bootstrap a USB-portable FreshRig at `target` by copying the running
/// executable, writing the `.portable` marker, seeding `data/`, and copying
/// the local `branding.json` + `freshrig-license.json` if they exist.
///
/// Pro Business gated on the UI; the backend trusts the caller's `is_business`
/// flag the same way the rest of the Pro-gated commands do.
#[tauri::command]
pub async fn bootstrap_portable_dir(target_path: String, is_business: bool) -> Result<(), String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || {
        let target = PathBuf::from(&target_path);
        fs::create_dir_all(&target).map_err(|e| format!("create {}: {}", target.display(), e))?;

        // 1. Copy the running executable next to a `.portable` marker.
        let exe = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
        let exe_name = exe
            .file_name()
            .ok_or_else(|| "running exe has no filename".to_string())?;
        let dst_exe = target.join(exe_name);
        fs::copy(&exe, &dst_exe)
            .map_err(|e| format!("copy {} -> {}: {}", exe.display(), dst_exe.display(), e))?;
        fs::write(target.join(".portable"), b"")
            .map_err(|e| format!("write .portable marker: {}", e))?;

        // 2. Seed an empty data dir.
        let data_dir = target.join("data");
        fs::create_dir_all(&data_dir).map_err(|e| format!("create data dir: {}", e))?;

        // 3. Copy branding.json + license.json if present in the source data dir.
        let src_data = get_data_dir();
        copy_if_exists(
            &src_data.join("branding.json"),
            &data_dir.join("branding.json"),
        );
        copy_if_exists(
            &src_data.join("freshrig-license.json"),
            &data_dir.join("freshrig-license.json"),
        );

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("bootstrap task: {}", e))?
}

fn copy_if_exists(src: &Path, dst: &Path) {
    if src.exists() {
        let _ = fs::copy(src, dst);
    }
}
