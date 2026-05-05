//! Linux application install orchestration — distro-family dispatch over
//! apt / dnf / pacman / zypper, with Flatpak fallback.

use std::process::Command;

use tauri::Emitter;

use crate::commands::linux::app_catalog::{find_name, find_package, linux_app_catalog};
use crate::commands::linux::util::{
    apt_install_args, distro_family, ensure_flathub_remote, is_classic_snap, is_root,
    refresh_package_index, require_elevation, run_cmd, which,
};
use crate::models::apps::*;

#[tauri::command]
pub async fn get_app_catalog() -> Result<Vec<AppEntry>, String> {
    Ok(linux_app_catalog())
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
        let output = Command::new("ping")
            .args(["-c", "1", "-W", "3", "1.1.1.1"])
            .output();
        Ok(match output {
            Ok(o) => o.status.success(),
            Err(_) => false,
        })
    })
    .await
    .map_err(|e| format!("ping task failed: {}", e))?
}

#[tauri::command]
pub async fn check_winget_available() -> Result<bool, String> {
    // On Linux we treat the native package manager as the "winget equivalent"
    // and report availability if at least one is on PATH.
    Ok(which("apt-get") || which("dnf") || which("pacman") || which("zypper") || which("flatpak"))
}

#[tauri::command]
pub async fn install_apps(
    app_handle: tauri::AppHandle,
    app_ids: Vec<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        // Probe elevation upfront — clearer than letting each install try
        // and fail with "pkexec: not found" 12 times.
        if let Err(msg) = require_elevation() {
            for app_id in &app_ids {
                let app_name = find_name(app_id).unwrap_or(app_id.as_str()).to_string();
                emit(&app_handle, app_id, &app_name, InstallStatus::Failed, &msg);
            }
            return Ok::<(), String>(());
        }

        let family = distro_family();

        // One-time package-index refresh before the install loop. Doing
        // this per-app would multiply install time by 10x for a typical
        // batch; doing it never gives "Unable to locate package …" on
        // freshly booted systems.
        let _ = refresh_package_index(&family);

        // Lazy: only add the Flathub remote the first time we're about
        // to install a flatpak in this batch.
        let mut flathub_ready = false;

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
                        "No package mapping available on Linux.",
                    );
                    continue;
                }
            };

            let plan = match plan_install(&family, pkg) {
                Some(p) => p,
                None => {
                    emit(
                        &app_handle,
                        app_id,
                        &app_name,
                        InstallStatus::Skipped,
                        "No install target available — no package binding for this distro \
                         and no Flatpak/Snap fallback installed.",
                    );
                    continue;
                }
            };

            // Lazy Flathub setup, only on first flatpak we hit.
            if matches!(plan, InstallPlan::Flatpak(_)) && !flathub_ready {
                if let Err(err) = ensure_flathub_remote() {
                    emit(
                        &app_handle,
                        app_id,
                        &app_name,
                        InstallStatus::Failed,
                        &format!("Could not configure Flathub: {}", err),
                    );
                    continue;
                }
                flathub_ready = true;
            }

            let (program, args) = materialize_plan(plan);
            let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            match run_cmd(&program, &arg_refs) {
                Ok(_) => {
                    emit(
                        &app_handle,
                        app_id,
                        &app_name,
                        InstallStatus::Completed,
                        &format!("{} installed.", app_name),
                    );
                }
                Err(err) => {
                    emit(&app_handle, app_id, &app_name, InstallStatus::Failed, &err);
                }
            }
        }

        Ok::<(), String>(())
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

/// What the install will actually do. Keeps the loop body small and lets
/// the caller handle install-system-specific concerns (e.g. only
/// configure Flathub if there's a flatpak in the batch) without
/// re-stringifying argv.
enum InstallPlan {
    Apt(String),
    Dnf(String),
    Pacman(String),
    Zypper(String),
    Flatpak(String),
    Snap { name: String, classic: bool },
}

/// Choose an install strategy for `pkg` on the running distro. Falls
/// through to Flatpak or Snap if no native binding fits AND the
/// alternative is on PATH.
fn plan_install(
    family: &str,
    pkg: crate::commands::linux::app_catalog::LinuxPackage,
) -> Option<InstallPlan> {
    let native = match family {
        "debian" => pkg.apt.map(|p| InstallPlan::Apt(p.to_string())),
        "rhel" => pkg.dnf.map(|p| InstallPlan::Dnf(p.to_string())),
        "arch" => pkg.pacman.map(|p| InstallPlan::Pacman(p.to_string())),
        "suse" => pkg.zypper.map(|p| InstallPlan::Zypper(p.to_string())),
        _ => None,
    };
    if native.is_some() {
        return native;
    }
    if let Some(reference) = pkg.flatpak {
        if which("flatpak") {
            return Some(InstallPlan::Flatpak(reference.to_string()));
        }
    }
    if let Some(s) = pkg.snap {
        if which("snap") {
            return Some(InstallPlan::Snap {
                name: s.to_string(),
                classic: is_classic_snap(s),
            });
        }
    }
    None
}

/// Convert a plan into an executable (program, args) pair, applying the
/// right elevation strategy: pkexec + DEBIAN_FRONTEND for apt; pkexec for
/// dnf/pacman/zypper/snap; user-scope flatpak (no pkexec).
fn materialize_plan(plan: InstallPlan) -> (String, Vec<String>) {
    match plan {
        InstallPlan::Apt(pkg) => apt_install_args(&[&pkg]),
        InstallPlan::Dnf(pkg) => wrap_privilege("dnf", vec!["install".into(), "-y".into(), pkg]),
        InstallPlan::Pacman(pkg) => wrap_privilege(
            "pacman",
            vec!["-S".into(), "--noconfirm".into(), "--needed".into(), pkg],
        ),
        InstallPlan::Zypper(pkg) => wrap_privilege(
            "zypper",
            vec!["--non-interactive".into(), "install".into(), pkg],
        ),
        InstallPlan::Flatpak(reference) => (
            "flatpak".into(),
            vec![
                "install".into(),
                "-y".into(),
                "--noninteractive".into(),
                "flathub".into(),
                reference,
            ],
        ),
        InstallPlan::Snap { name, classic } => {
            let mut args = vec!["install".into()];
            if classic {
                args.push("--classic".into());
            }
            args.push(name);
            wrap_privilege("snap", args)
        }
    }
}

/// Prepend `pkexec` when not already root. No env preamble — apt-specific
/// `DEBIAN_FRONTEND` lives in `apt_install_args` instead, so callers that
/// don't need it (dnf/pacman/zypper/snap) get a cleaner argv.
fn wrap_privilege(program: &str, args: Vec<String>) -> (String, Vec<String>) {
    if is_root() {
        return (program.to_string(), args);
    }
    let mut all = Vec::with_capacity(args.len() + 1);
    all.push(program.to_string());
    all.extend(args);
    ("pkexec".to_string(), all)
}
