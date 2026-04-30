// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Bulk profile deployment (v2.0 Pro Business). Generates a self-contained
// folder per target machine: a copy of the running FreshRig executable,
// a `.portable` marker, the chosen profile JSON, a `deploy-target.json`
// describing the customer, and a `run-deploy.{bat,sh}` launcher that
// runs FreshRig in headless apply mode.
//
// Layout produced inside `<output_dir>/<machine_id>/`:
//   freshrig-portable.exe         (Windows; equivalent on other OSes)
//   .portable
//   profiles/<profile_id>.json
//   deploy-target.json
//   run-deploy.bat | run-deploy.sh

use serde::Serialize;
use std::fs;
use std::path::PathBuf;

use crate::commands::fleet::Machine;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeployResult {
    pub output_dir: String,
    pub machine_count: usize,
}

#[tauri::command]
pub async fn create_deployment_bundle(
    profile_id: String,
    profile_json: String,
    target_machines: Vec<Machine>,
    output_dir: String,
    is_business: bool,
) -> Result<BulkDeployResult, String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    if target_machines.is_empty() {
        return Err("Pick at least one target machine".into());
    }
    tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&output_dir);
        fs::create_dir_all(&root).map_err(|e| format!("create {}: {}", root.display(), e))?;
        let exe = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
        let exe_name = exe
            .file_name()
            .ok_or_else(|| "running exe has no filename".to_string())?
            .to_owned();

        for machine in &target_machines {
            let dst = root.join(&machine.id);
            fs::create_dir_all(&dst).map_err(|e| format!("create {}: {}", dst.display(), e))?;
            fs::write(dst.join(".portable"), b"").map_err(|e| format!("write .portable: {}", e))?;
            fs::copy(&exe, dst.join(&exe_name)).map_err(|e| format!("copy exe: {}", e))?;
            let profiles_dir = dst.join("profiles");
            fs::create_dir_all(&profiles_dir).map_err(|e| format!("mkdir profiles: {}", e))?;
            fs::write(
                profiles_dir.join(format!("{}.json", profile_id)),
                profile_json.as_bytes(),
            )
            .map_err(|e| format!("write profile: {}", e))?;
            let target_meta = serde_json::json!({
                "machineId": machine.id,
                "ownerName": machine.owner_name,
                "hostname": machine.hostname,
                "profileId": profile_id,
                "createdAt": crate::commands::fleet::chrono_now(),
            });
            fs::write(
                dst.join("deploy-target.json"),
                serde_json::to_string_pretty(&target_meta)
                    .map_err(|e| format!("serialize target: {}", e))?,
            )
            .map_err(|e| format!("write target.json: {}", e))?;

            let exe_str = exe_name.to_string_lossy().into_owned();
            // Windows launcher.
            let bat = format!(
                "@echo off\r\n\
                 setlocal\r\n\
                 set FRESHRIG_PORTABLE=1\r\n\
                 \"%~dp0{}\" --headless --task=apply-profile --profile-id={}\r\n\
                 endlocal\r\n",
                exe_str, profile_id
            );
            fs::write(dst.join("run-deploy.bat"), bat)
                .map_err(|e| format!("write run-deploy.bat: {}", e))?;
            // POSIX launcher.
            let sh = format!(
                "#!/usr/bin/env bash\n\
                 set -euo pipefail\n\
                 cd \"$(dirname \"$0\")\"\n\
                 export FRESHRIG_PORTABLE=1\n\
                 ./{} --headless --task=apply-profile --profile-id={}\n",
                exe_str, profile_id
            );
            fs::write(dst.join("run-deploy.sh"), sh)
                .map_err(|e| format!("write run-deploy.sh: {}", e))?;
        }

        Ok(BulkDeployResult {
            output_dir: root.to_string_lossy().to_string(),
            machine_count: target_machines.len(),
        })
    })
    .await
    .map_err(|e| format!("bulk deploy task: {}", e))?
}
