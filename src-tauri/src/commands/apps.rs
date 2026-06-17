use tauri::Emitter;

use crate::data::app_catalog;
use crate::models::apps::*;
use crate::util::{is_valid_winget_id, run_winget, silent_cmd};

#[tauri::command]
pub async fn get_app_catalog() -> Result<Vec<AppEntry>, String> {
    Ok(app_catalog::get_default_catalog())
}

#[tauri::command]
pub async fn get_free_disk_space_gb() -> Result<f64, String> {
    // PERF-03: query the already-present `sysinfo` crate instead of spawning a
    // PowerShell process. Preserves the original behavior — free bytes on the
    // C: system drive, returned in GiB — without a subprocess.
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let free_bytes = disks
        .list()
        .iter()
        .find(|d| d.mount_point().to_string_lossy().starts_with("C:"))
        .map(|d| d.available_space())
        .ok_or_else(|| "C: drive not found".to_string())?;
    Ok(free_bytes as f64 / 1_073_741_824.0)
}

#[tauri::command]
pub async fn check_network_connectivity() -> Result<bool, String> {
    let output = silent_cmd("cmd")
        .args(["/C", "ping -n 1 -w 3000 1.1.1.1"])
        .output();
    match output {
        Ok(result) => Ok(result.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn check_winget_available() -> Result<bool, String> {
    let result = run_winget(&["--version"]);

    match result {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn install_apps(
    app_handle: tauri::AppHandle,
    app_ids: Vec<String>,
) -> Result<InstallSummary, String> {
    let catalog = app_catalog::get_default_catalog();
    let mut installed: Vec<String> = Vec::new();
    let mut failed: Vec<String> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();

    for app_id in &app_ids {
        let app_name = catalog
            .iter()
            .find(|a| &a.id == app_id)
            .map(|a| a.name.clone())
            .unwrap_or_else(|| app_id.clone());

        // Emit: Installing
        let _ = app_handle.emit(
            "install-progress",
            InstallProgress {
                app_id: app_id.clone(),
                app_name: app_name.clone(),
                status: InstallStatus::Installing,
                message: format!("Installing {}...", app_name),
            },
        );

        // SEC-02: reject ids outside the winget-id allowlist before they can
        // reach the shell, then run through the `run_winget` choke point — no
        // raw interpolation of caller data into a `cmd /C` string.
        if !is_valid_winget_id(app_id) {
            let _ = app_handle.emit(
                "install-progress",
                InstallProgress {
                    app_id: app_id.clone(),
                    app_name: app_name.clone(),
                    status: InstallStatus::Failed,
                    message: format!("Refused: '{}' is not a valid package id", app_id),
                },
            );
            skipped.push(app_id.clone());
            continue;
        }

        let output = run_winget(&[
            "install",
            "--id",
            app_id.as_str(),
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ]);

        match output {
            Ok(result) => {
                if result.status.success() {
                    let _ = app_handle.emit(
                        "install-progress",
                        InstallProgress {
                            app_id: app_id.clone(),
                            app_name: app_name.clone(),
                            status: InstallStatus::Completed,
                            message: format!("{} installed successfully", app_name),
                        },
                    );
                    installed.push(app_id.clone());
                } else {
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    let stdout = String::from_utf8_lossy(&result.stdout);
                    // winget often writes errors to stdout
                    let error_msg = if !stderr.is_empty() {
                        stderr.to_string()
                    } else if !stdout.is_empty() {
                        // Extract last meaningful line
                        stdout
                            .lines()
                            .rev()
                            .find(|l| !l.trim().is_empty())
                            .unwrap_or("Unknown error")
                            .to_string()
                    } else {
                        "Installation failed with no output".to_string()
                    };

                    let _ = app_handle.emit(
                        "install-progress",
                        InstallProgress {
                            app_id: app_id.clone(),
                            app_name: app_name.clone(),
                            status: InstallStatus::Failed,
                            message: error_msg,
                        },
                    );
                    failed.push(app_id.clone());
                }
            }
            Err(e) => {
                let _ = app_handle.emit(
                    "install-progress",
                    InstallProgress {
                        app_id: app_id.clone(),
                        app_name: app_name.clone(),
                        status: InstallStatus::Failed,
                        message: format!("Failed to execute winget: {}", e),
                    },
                );
                failed.push(app_id.clone());
            }
        }
    }

    Ok(InstallSummary {
        installed,
        failed,
        skipped,
    })
}
