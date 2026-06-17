use std::path::PathBuf;

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

use crate::models::custom_apps::*;
use crate::portable;
use crate::util::{silent_cmd, split_args};

fn custom_apps_path() -> PathBuf {
    portable::get_data_dir().join("custom-apps.json")
}

#[tauri::command]
pub async fn get_custom_apps() -> Result<Vec<CustomAppEntry>, String> {
    let path = custom_apps_path();
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_custom_app(app: CustomAppEntry) -> Result<(), String> {
    if !app.download_url.starts_with("https://") {
        return Err("Only HTTPS download URLs are allowed for security".to_string());
    }

    let path = custom_apps_path();
    let mut apps = get_custom_apps().await.unwrap_or_default();

    if let Some(existing) = apps.iter_mut().find(|a| a.id == app.id) {
        *existing = app;
    } else {
        apps.push(app);
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&apps).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_custom_app(app_id: String) -> Result<(), String> {
    let path = custom_apps_path();
    let mut apps = get_custom_apps().await.unwrap_or_default();
    apps.retain(|a| a.id != app_id);
    let json = serde_json::to_string_pretty(&apps).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn download_and_install_custom_app(
    app_handle: tauri::AppHandle,
    app: CustomAppEntry,
) -> Result<(), String> {
    if !app.download_url.starts_with("https://") {
        return Err("Only HTTPS URLs are allowed".to_string());
    }

    // Create temp directory for download
    let temp_dir = std::env::temp_dir().join("freshrig_custom");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // Extract filename from URL
    let filename = app
        .download_url
        .split('/')
        .next_back()
        .unwrap_or("installer.exe")
        .to_string();
    let dest_path = temp_dir.join(&filename);

    // Download with progress
    let client = reqwest::Client::builder()
        .https_only(true)
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&app.download_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut hasher = Sha256::new();
    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        downloaded += chunk.len() as u64;

        let _ = app_handle.emit(
            "custom-download-progress",
            DownloadProgress {
                downloaded,
                total,
                filename: filename.clone(),
            },
        );
    }

    drop(file);

    // Verify hash if provided
    if let Some(expected_hash) = &app.expected_hash {
        if !expected_hash.is_empty() {
            let hash = hasher
                .finalize()
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>();
            if hash != expected_hash.to_lowercase() {
                let _ = tokio::fs::remove_file(&dest_path).await;
                return Err(format!(
                    "Hash verification failed!\nExpected: {}\nGot: {}\nThe downloaded file has been deleted for safety.",
                    expected_hash, hash
                ));
            }
        }
    }

    // SEC-02: build an argument vector instead of a `cmd /C` shell string, so
    // neither the download path nor the user-configured silent args are
    // re-parsed by the shell. `silent_args` is tokenized with `split_args`
    // (honoring quoted segments) rather than handed to cmd.exe.
    let mut command = if filename.to_lowercase().ends_with(".msi") {
        let mut c = silent_cmd("msiexec");
        c.arg("/i").arg(&dest_path);
        c
    } else {
        silent_cmd(&dest_path.to_string_lossy())
    };
    command.args(split_args(&app.silent_args));

    let output = command
        .output()
        .map_err(|e| format!("Install failed: {}", e))?;

    // Clean up
    let _ = tokio::fs::remove_file(&dest_path).await;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "Installation failed (exit code {}): {}",
            output.status.code().unwrap_or(-1),
            stderr
        ))
    }
}
