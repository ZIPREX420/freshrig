use crate::models::cleanup::{
    CleanupCategory, CleanupProgress, CleanupResult, CleanupRisk, CleanupScanProgress,
};
use crate::util::silent_cmd;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

const REPARSE_POINT: u32 = 0x400;
const ERROR_ACCESS_DENIED: i32 = 5;
const ERROR_SHARING_VIOLATION: i32 = 32;
const TEMP_MIN_AGE_SECS: u64 = 86_400;
const MAX_SAMPLE_PATHS: usize = 10;

fn env_path(var: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(PathBuf::from)
}

fn is_reparse_point(metadata: &std::fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        metadata.file_attributes() & REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        let _ = metadata;
        false
    }
}

fn tolerable_error(err: &std::io::Error) -> bool {
    matches!(
        err.raw_os_error(),
        Some(ERROR_ACCESS_DENIED) | Some(ERROR_SHARING_VIOLATION)
    )
}

struct CategorySpec {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    risk: CleanupRisk,
    enabled_by_default: bool,
    apply_age_filter: bool,
    recycle_bin: bool,
    filename_prefix: Option<&'static str>,
    roots: Vec<PathBuf>,
}

fn expand_chromium_profiles(user_data_root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(user_data_root) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        let is_profile = name == "Default"
            || name == "Guest Profile"
            || name == "System Profile"
            || name.starts_with("Profile ");
        if !is_profile {
            continue;
        }
        let profile = entry.path();
        if !profile.is_dir() {
            continue;
        }
        out.push(profile.join("Cache"));
        out.push(profile.join("Code Cache"));
        out.push(profile.join("GPUCache"));
        out.push(profile.join("Service Worker").join("CacheStorage"));
    }
    out
}

fn expand_firefox_cache(profiles_root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(profiles_root) else {
        return Vec::new();
    };
    entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let p = e.path();
            if p.is_dir() {
                Some(p.join("cache2"))
            } else {
                None
            }
        })
        .collect()
}

fn build_category_specs() -> Vec<CategorySpec> {
    let temp = env_path("TEMP");
    let local = env_path("LOCALAPPDATA");
    let appdata = env_path("APPDATA");
    let windir = env_path("SystemRoot").or_else(|| env_path("windir"));

    let mut specs = Vec::new();

    // user_temp (SAFE) — %TEMP% + %LOCALAPPDATA%\Temp
    {
        let mut roots = Vec::new();
        if let Some(t) = temp.as_ref() {
            roots.push(t.clone());
        }
        if let Some(l) = local.as_ref() {
            let local_temp = l.join("Temp");
            if !roots.contains(&local_temp) {
                roots.push(local_temp);
            }
        }
        if !roots.is_empty() {
            specs.push(CategorySpec {
                id: "user_temp",
                name: "Temporary Files (User)",
                description: "Files older than 24 hours in %TEMP% and %LOCALAPPDATA%\\Temp",
                risk: CleanupRisk::Safe,
                enabled_by_default: true,
                apply_age_filter: true,
                recycle_bin: false,
                filename_prefix: None,
                roots,
            });
        }
    }

    // windows_temp (SAFE) — C:\Windows\Temp
    if let Some(w) = windir.as_ref() {
        specs.push(CategorySpec {
            id: "windows_temp",
            name: "Temporary Files (Windows)",
            description: "Files older than 24 hours in C:\\Windows\\Temp",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            apply_age_filter: true,
            recycle_bin: false,
            filename_prefix: None,
            roots: vec![w.join("Temp")],
        });
    }

    // crash_dumps (SAFE) — %LOCALAPPDATA%\CrashDumps + C:\Windows\Minidump + C:\Windows\MEMORY.DMP
    {
        let mut roots = Vec::new();
        if let Some(l) = local.as_ref() {
            roots.push(l.join("CrashDumps"));
        }
        if let Some(w) = windir.as_ref() {
            roots.push(w.join("Minidump"));
            roots.push(w.join("MEMORY.DMP"));
        }
        if !roots.is_empty() {
            specs.push(CategorySpec {
                id: "crash_dumps",
                name: "Crash Dumps",
                description:
                    "Minidumps and kernel memory dumps from crashed applications and BSODs",
                risk: CleanupRisk::Safe,
                enabled_by_default: true,
                apply_age_filter: false,
                recycle_bin: false,
                filename_prefix: None,
                roots,
            });
        }
    }

    // error_reports (SAFE) — WER\ReportQueue + WER\ReportArchive
    if let Some(l) = local.as_ref() {
        let wer = l.join("Microsoft").join("Windows").join("WER");
        specs.push(CategorySpec {
            id: "error_reports",
            name: "Windows Error Reports",
            description: "Queued telemetry in WER\\ReportQueue and WER\\ReportArchive",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            apply_age_filter: false,
            recycle_bin: false,
            filename_prefix: None,
            roots: vec![wer.join("ReportQueue"), wer.join("ReportArchive")],
        });
    }

    // windows_logs (SAFE) — C:\Windows\Logs\CBS + C:\Windows\Logs\DISM
    if let Some(w) = windir.as_ref() {
        let logs = w.join("Logs");
        specs.push(CategorySpec {
            id: "windows_logs",
            name: "Windows Setup Logs",
            description: "CBS and DISM servicing logs in C:\\Windows\\Logs",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            apply_age_filter: false,
            recycle_bin: false,
            filename_prefix: None,
            roots: vec![logs.join("CBS"), logs.join("DISM")],
        });
    }

    // shader_cache (SAFE) — D3DSCache + NVIDIA\DXCache + AMD\DxcCache
    if let Some(l) = local.as_ref() {
        specs.push(CategorySpec {
            id: "shader_cache",
            name: "GPU Shader Cache",
            description: "DirectX and vendor-specific shader caches (regenerates on next use)",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            apply_age_filter: false,
            recycle_bin: false,
            filename_prefix: None,
            roots: vec![
                l.join("D3DSCache"),
                l.join("NVIDIA").join("DXCache"),
                l.join("AMD").join("DxcCache"),
            ],
        });
    }

    // delivery_optimization (SAFE) — C:\Windows\SoftwareDistribution\DeliveryOptimization
    if let Some(w) = windir.as_ref() {
        specs.push(CategorySpec {
            id: "delivery_optimization",
            name: "Delivery Optimization Cache",
            description: "Windows Update peer-to-peer cache",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            apply_age_filter: false,
            recycle_bin: false,
            filename_prefix: None,
            roots: vec![w.join("SoftwareDistribution").join("DeliveryOptimization")],
        });
    }

    // browser_cache (MODERATE) — Chromium profiles + Firefox cache2 + Opera
    {
        let mut roots = Vec::new();
        if let Some(l) = local.as_ref() {
            let chromium_user_data_dirs = [
                l.join("Google").join("Chrome").join("User Data"),
                l.join("Microsoft").join("Edge").join("User Data"),
                l.join("BraveSoftware")
                    .join("Brave-Browser")
                    .join("User Data"),
            ];
            for user_data in &chromium_user_data_dirs {
                roots.extend(expand_chromium_profiles(user_data));
            }
            roots.extend(expand_firefox_cache(
                &l.join("Mozilla").join("Firefox").join("Profiles"),
            ));
        }
        if let Some(a) = appdata.as_ref() {
            roots.extend(expand_firefox_cache(
                &a.join("Mozilla").join("Firefox").join("Profiles"),
            ));
            roots.push(a.join("Opera Software").join("Opera Stable").join("Cache"));
        }
        specs.push(CategorySpec {
            id: "browser_cache",
            name: "Browser Cache",
            description: "HTTP caches from Chrome, Edge, Brave, Firefox, Opera. Does not touch cookies, history, or saved passwords.",
            risk: CleanupRisk::Moderate,
            enabled_by_default: false,
            apply_age_filter: false,
            recycle_bin: false,
            filename_prefix: None,
            roots,
        });
    }

    // thumbnail_cache (MODERATE) — thumbcache_*.db
    if let Some(l) = local.as_ref() {
        specs.push(CategorySpec {
            id: "thumbnail_cache",
            name: "Thumbnail Cache",
            description: "Explorer thumbnail database files (thumbcache_*.db)",
            risk: CleanupRisk::Moderate,
            enabled_by_default: false,
            apply_age_filter: false,
            recycle_bin: false,
            filename_prefix: Some("thumbcache_"),
            roots: vec![l.join("Microsoft").join("Windows").join("Explorer")],
        });
    }

    // recycle_bin (MODERATE) — PowerShell Clear-RecycleBin
    specs.push(CategorySpec {
        id: "recycle_bin",
        name: "Recycle Bin",
        description: "Permanently delete all items in the Recycle Bin",
        risk: CleanupRisk::Moderate,
        enabled_by_default: false,
        apply_age_filter: false,
        recycle_bin: true,
        filename_prefix: None,
        roots: Vec::new(),
    });

    specs
}

fn make_walker(root: &Path) -> jwalk::WalkDir {
    jwalk::WalkDir::new(root)
        .skip_hidden(false)
        .follow_links(false)
        .process_read_dir(|_, _, _, children| {
            children.retain(|child_result| match child_result {
                Ok(entry) => match entry.metadata() {
                    Ok(meta) => !is_reparse_point(&meta),
                    Err(_) => true,
                },
                Err(_) => true,
            });
        })
}

fn iter_files<F: FnMut(PathBuf, std::fs::Metadata)>(root: &Path, mut visit: F) {
    if !root.exists() {
        return;
    }
    match std::fs::symlink_metadata(root) {
        Ok(meta) if meta.is_file() => {
            if !is_reparse_point(&meta) {
                visit(root.to_path_buf(), meta);
            }
        }
        Ok(_) => {
            for entry_result in make_walker(root) {
                let Ok(entry) = entry_result else {
                    continue;
                };
                if !entry.file_type.is_file() {
                    continue;
                }
                let Ok(metadata) = entry.metadata() else {
                    continue;
                };
                if is_reparse_point(&metadata) {
                    continue;
                }
                visit(entry.path(), metadata);
            }
        }
        Err(_) => {}
    }
}

fn passes_filters(
    spec: &CategorySpec,
    path: &Path,
    metadata: &std::fs::Metadata,
    threshold: Option<SystemTime>,
) -> bool {
    if let Some(prefix) = spec.filename_prefix {
        let Some(file_name) = path.file_name() else {
            return false;
        };
        let name = file_name.to_string_lossy().to_lowercase();
        if !name.starts_with(&prefix.to_lowercase()) {
            return false;
        }
    }
    if let Some(threshold) = threshold {
        if let Ok(modified) = metadata.modified() {
            if modified > threshold {
                return false;
            }
        }
    }
    true
}

fn scan_one_category(spec: &CategorySpec, app_handle: &AppHandle) -> (u64, u64, Vec<String>) {
    if spec.recycle_bin {
        return (0, 0, Vec::new());
    }

    let threshold = if spec.apply_age_filter {
        SystemTime::now().checked_sub(Duration::from_secs(TEMP_MIN_AGE_SECS))
    } else {
        None
    };

    let mut file_count: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut samples: Vec<String> = Vec::new();

    for root in &spec.roots {
        iter_files(root, |path, metadata| {
            if !passes_filters(spec, &path, &metadata, threshold) {
                return;
            }
            file_count += 1;
            total_bytes += metadata.len();
            if samples.len() < MAX_SAMPLE_PATHS {
                samples.push(path.to_string_lossy().into_owned());
            }
        });
    }

    let _ = app_handle.emit(
        "cleanup-scan-progress",
        CleanupScanProgress {
            category_id: spec.id.to_string(),
            file_count,
            total_bytes,
        },
    );

    (file_count, total_bytes, samples)
}

#[tauri::command]
pub async fn scan_cleanup(app_handle: AppHandle) -> Result<Vec<CleanupCategory>, String> {
    tokio::task::spawn_blocking(move || -> Result<Vec<CleanupCategory>, String> {
        let specs = build_category_specs();
        let mut results = Vec::with_capacity(specs.len());
        for spec in &specs {
            let (file_count, total_bytes, paths) = scan_one_category(spec, &app_handle);
            results.push(CleanupCategory {
                id: spec.id.to_string(),
                name: spec.name.to_string(),
                description: spec.description.to_string(),
                risk: spec.risk.clone(),
                file_count,
                total_bytes,
                paths,
                enabled_by_default: spec.enabled_by_default,
            });
        }
        Ok(results)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

fn delete_file_category(spec: &CategorySpec) -> (u64, u64, Vec<String>) {
    let threshold = if spec.apply_age_filter {
        SystemTime::now().checked_sub(Duration::from_secs(TEMP_MIN_AGE_SECS))
    } else {
        None
    };

    let mut files_deleted: u64 = 0;
    let mut bytes_freed: u64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for root in &spec.roots {
        iter_files(root, |path, metadata| {
            if !passes_filters(spec, &path, &metadata, threshold) {
                return;
            }
            let size = metadata.len();
            match std::fs::remove_file(&path) {
                Ok(()) => {
                    files_deleted += 1;
                    bytes_freed += size;
                }
                Err(e) if tolerable_error(&e) => {}
                Err(e) => {
                    errors.push(format!("{}: {}", path.display(), e));
                }
            }
        });
    }

    (files_deleted, bytes_freed, errors)
}

fn empty_recycle_bin() -> Result<(), String> {
    let output = silent_cmd("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Clear-RecycleBin -Force -ErrorAction SilentlyContinue",
        ])
        .output()
        .map_err(|e| format!("Failed to run powershell: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "Clear-RecycleBin exited with status {}",
            output.status
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn run_cleanup(
    app_handle: AppHandle,
    category_ids: Vec<String>,
) -> Result<Vec<CleanupResult>, String> {
    tokio::task::spawn_blocking(move || -> Result<Vec<CleanupResult>, String> {
        let specs = build_category_specs();
        let selected: Vec<&CategorySpec> = specs
            .iter()
            .filter(|s| category_ids.iter().any(|id| id == s.id))
            .collect();

        let mut results = Vec::with_capacity(selected.len());
        for spec in selected {
            let (files_deleted, bytes_freed, errors) = if spec.recycle_bin {
                match empty_recycle_bin() {
                    Ok(()) => (0, 0, Vec::new()),
                    Err(e) => (0, 0, vec![e]),
                }
            } else {
                delete_file_category(spec)
            };

            let _ = app_handle.emit(
                "cleanup-progress",
                CleanupProgress {
                    category_id: spec.id.to_string(),
                    files_deleted,
                    bytes_freed,
                },
            );

            results.push(CleanupResult {
                category_id: spec.id.to_string(),
                files_deleted,
                bytes_freed,
                errors,
            });
        }
        Ok(results)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}
