//! macOS application install orchestration — Homebrew dispatch (casks for
//! GUI apps, formulae for CLI tools). Mirrors the Windows winget /
//! Linux apt-dnf-pacman command surface.

use std::process::{Command, Stdio};

use tauri::Emitter;

use crate::commands::macos::app_catalog::{find_name, find_package, macos_app_catalog};
use crate::commands::macos::util::brew_path;
use crate::models::apps::*;

#[tauri::command]
pub async fn get_app_catalog() -> Result<Vec<AppEntry>, String> {
    Ok(macos_app_catalog())
}

#[tauri::command]
pub async fn get_free_disk_space_gb() -> Result<f64, String> {
    tokio::task::spawn_blocking(|| {
        let stat = nix::sys::statvfs::statvfs("/").map_err(|e| format!("statvfs failed: {}", e))?;
        let frsize = stat.fragment_size() as u64;
        let bavail = stat.blocks_available() as u64;
        let bytes = frsize.saturating_mul(bavail);
        Ok((bytes as f64) / 1_000_000_000.0)
    })
    .await
    .map_err(|e| format!("disk task failed: {}", e))?
}

#[tauri::command]
pub async fn check_network_connectivity() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        // macOS `ping -W` takes milliseconds, not seconds (unlike Linux/BSD's
        // `-w`). Use 2000ms.
        let output = Command::new("ping")
            .args(["-c", "1", "-W", "2000", "1.1.1.1"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        Ok(match output {
            Ok(s) => s.success(),
            Err(_) => false,
        })
    })
    .await
    .map_err(|e| format!("ping task failed: {}", e))?
}

#[tauri::command]
pub async fn check_winget_available() -> Result<bool, String> {
    // The frontend calls this "winget" but treats it as a generic package-
    // manager probe. On macOS, Homebrew is the answer.
    Ok(brew_path().is_some())
}

#[tauri::command]
pub async fn install_apps(
    app_handle: tauri::AppHandle,
    app_ids: Vec<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let brew = match brew_path() {
            Some(p) => p,
            None => {
                for app_id in &app_ids {
                    let app_name = find_name(app_id).unwrap_or(app_id.as_str()).to_string();
                    emit(
                        &app_handle,
                        app_id,
                        &app_name,
                        InstallStatus::Failed,
                        "Homebrew is not installed. Install it from https://brew.sh first.",
                    );
                }
                return Ok::<(), String>(());
            }
        };

        // Refresh formula metadata once before the install loop. Without
        // this, batches that include any formula renamed since the user's
        // last `brew update` fail with "No formula with name X". We
        // explicitly *don't* set HOMEBREW_NO_AUTO_UPDATE for this call
        // since updating is the whole point.
        let _ = std::process::Command::new(brew)
            .arg("update")
            .env("NONINTERACTIVE", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        for app_id in &app_ids {
            let app_name = find_name(app_id).unwrap_or(app_id.as_str()).to_string();

            emit(
                &app_handle,
                app_id,
                &app_name,
                InstallStatus::Installing,
                &format!("Installing {}…", app_name),
            );

            let pkg = match find_package(app_id) {
                Some(p) => p,
                None => {
                    emit(
                        &app_handle,
                        app_id,
                        &app_name,
                        InstallStatus::Skipped,
                        "Not in macOS catalog.",
                    );
                    continue;
                }
            };

            let (program, args): (&str, Vec<&str>) = if let Some(cask) = pkg.cask {
                (brew, vec!["install", "--cask", cask])
            } else if let Some(formula) = pkg.formula {
                (brew, vec!["install", formula])
            } else {
                emit(
                    &app_handle,
                    app_id,
                    &app_name,
                    InstallStatus::Skipped,
                    "No Homebrew binding for this app.",
                );
                continue;
            };

            let result = Command::new(program)
                .args(&args)
                .env("NONINTERACTIVE", "1")
                .env("HOMEBREW_NO_AUTO_UPDATE", "1")
                .stdin(Stdio::null())
                .output();

            match result {
                Ok(output) if output.status.success() => {
                    emit(
                        &app_handle,
                        app_id,
                        &app_name,
                        InstallStatus::Completed,
                        &format!("{} installed.", app_name),
                    );
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    let msg = if stderr.is_empty() {
                        format!("brew exited with status {}", output.status)
                    } else {
                        stderr
                    };
                    emit(&app_handle, app_id, &app_name, InstallStatus::Failed, &msg);
                }
                Err(e) => {
                    emit(
                        &app_handle,
                        app_id,
                        &app_name,
                        InstallStatus::Failed,
                        &format!("Failed to spawn brew: {}", e),
                    );
                }
            }
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("install task failed: {}", e))?
}

fn emit(
    app_handle: &tauri::AppHandle,
    app_id: &str,
    app_name: &str,
    status: InstallStatus,
    message: &str,
) {
    let _ = app_handle.emit(
        "install-progress",
        InstallProgress {
            app_id: app_id.to_string(),
            app_name: app_name.to_string(),
            status,
            message: message.to_string(),
        },
    );
}
