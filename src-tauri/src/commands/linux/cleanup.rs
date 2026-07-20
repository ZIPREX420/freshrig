//! Linux cleanup — scan and delete user-level caches, system logs,
//! package-manager caches, browser caches, trash, and thumbnail caches.

use std::fs;
use std::path::{Path, PathBuf};

use jwalk::WalkDir;
use tauri::{AppHandle, Emitter};

use crate::commands::linux::util::{
    distro_family, home_dir, is_root, run_cmd_lossy, run_elevated, which,
};
use crate::models::cleanup::*;

struct CategorySpec {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    risk: CleanupRisk,
    enabled_by_default: bool,
    kind: CleanupKind,
}

enum CleanupKind {
    /// Delete every file under the given paths (recursive).
    UserFiles {
        paths: Vec<PathBuf>,
        /// Skip subdirs whose names appear here (case-sensitive match on
        /// the *top-level* subdir name of each provided path).
        exclude_top_level: &'static [&'static str],
    },
    /// System logs — /var/log gz + journalctl vacuum.
    SystemLogs,
    /// Package manager cache — dispatches on distro family.
    PackageCache,
    /// Browser caches under ~/.cache/* for known browsers.
    BrowserCache { paths: Vec<PathBuf> },
    /// Freedesktop Trash spec.
    Trash,
    /// Thumbnail cache.
    Thumbnails,
}

fn specs() -> Vec<CategorySpec> {
    let home = home_dir().unwrap_or_else(|| PathBuf::from("/root"));

    let user_cache = home.join(".cache");

    vec![
        CategorySpec {
            id: "user_cache",
            name: "User cache",
            description: "Temporary files under ~/.cache (excluding browsers).",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            kind: CleanupKind::UserFiles {
                paths: vec![user_cache.clone()],
                exclude_top_level: &[
                    "google-chrome",
                    "mozilla",
                    "chromium",
                    "BraveSoftware",
                    "vivaldi",
                    "thumbnails",
                ],
            },
        },
        CategorySpec {
            id: "system_logs",
            name: "System logs",
            description: "Rotated /var/log archives and journalctl disk usage.",
            risk: CleanupRisk::Moderate,
            enabled_by_default: false,
            kind: CleanupKind::SystemLogs,
        },
        CategorySpec {
            id: "package_cache",
            name: "Package cache",
            description: "Cached .deb / .rpm / .pkg.tar files from your package manager.",
            risk: CleanupRisk::Moderate,
            enabled_by_default: true,
            kind: CleanupKind::PackageCache,
        },
        CategorySpec {
            id: "browser_cache",
            name: "Browser cache",
            description: "Chrome, Firefox, Chromium, Brave, and Vivaldi cache directories.",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            kind: CleanupKind::BrowserCache {
                paths: vec![
                    user_cache.join("google-chrome"),
                    user_cache.join("mozilla"),
                    user_cache.join("chromium"),
                    user_cache.join("BraveSoftware"),
                    user_cache.join("vivaldi"),
                ],
            },
        },
        CategorySpec {
            id: "trash",
            name: "Trash",
            description: "Files in the XDG Trash (~/.local/share/Trash).",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            kind: CleanupKind::Trash,
        },
        CategorySpec {
            id: "thumbnail_cache",
            name: "Thumbnail cache",
            description: "~/.cache/thumbnails — regenerated on demand.",
            risk: CleanupRisk::Safe,
            enabled_by_default: true,
            kind: CleanupKind::Thumbnails,
        },
    ]
}

#[tauri::command]
pub async fn scan_cleanup(app_handle: AppHandle) -> Result<Vec<CleanupCategory>, String> {
    tokio::task::spawn_blocking(move || {
        let mut out = Vec::new();
        for spec in specs() {
            let (file_count, total_bytes, paths_reported) = scan_spec(&spec);

            let category = CleanupCategory {
                id: spec.id.to_string(),
                name: spec.name.to_string(),
                description: spec.description.to_string(),
                risk: spec.risk.clone(),
                file_count,
                total_bytes,
                paths: paths_reported,
                enabled_by_default: spec.enabled_by_default,
            };

            let _ = app_handle.emit(
                "cleanup-scan-progress",
                CleanupScanProgress {
                    category_id: category.id.clone(),
                    file_count,
                    total_bytes,
                },
            );

            out.push(category);
        }
        Ok(out)
    })
    .await
    .map_err(|e| format!("scan task failed: {}", e))?
}

#[tauri::command]
pub async fn run_cleanup(
    app_handle: AppHandle,
    category_ids: Vec<String>,
) -> Result<Vec<CleanupResult>, String> {
    tokio::task::spawn_blocking(move || {
        let mut results = Vec::new();
        for spec in specs() {
            if !category_ids.iter().any(|id| id == spec.id) {
                continue;
            }
            let (files_deleted, bytes_freed, errors) = run_spec(&spec);

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
    .map_err(|e| format!("cleanup task failed: {}", e))?
}

// ---- Scan ----

fn scan_spec(spec: &CategorySpec) -> (u64, u64, Vec<String>) {
    match &spec.kind {
        CleanupKind::UserFiles {
            paths,
            exclude_top_level,
        } => {
            let mut count = 0u64;
            let mut bytes = 0u64;
            let mut reported = Vec::new();
            for base in paths {
                if !base.exists() {
                    continue;
                }
                reported.push(base.to_string_lossy().to_string());
                let (c, b) = walk_bytes(base, exclude_top_level);
                count += c;
                bytes += b;
            }
            (count, bytes, reported)
        }
        CleanupKind::SystemLogs => {
            let mut count = 0u64;
            let mut bytes = 0u64;
            // Old rotated logs.
            let rotated = fs::read_dir("/var/log").ok().into_iter().flatten();
            for entry in rotated.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.ends_with(".gz") || name.ends_with(".old") || name.ends_with(".1") {
                        if let Ok(meta) = entry.metadata() {
                            count += 1;
                            bytes += meta.len();
                        }
                    }
                }
            }
            // journalctl disk usage (advisory only).
            let usage = run_cmd_lossy("journalctl", &["--disk-usage"]);
            bytes += parse_journalctl_bytes(&usage);
            (
                count,
                bytes,
                vec!["/var/log/*.gz".into(), "journalctl".into()],
            )
        }
        CleanupKind::PackageCache => {
            let (bytes, paths) = package_cache_scan();
            (0, bytes, paths)
        }
        CleanupKind::BrowserCache { paths } => {
            let mut count = 0u64;
            let mut bytes = 0u64;
            let mut reported = Vec::new();
            for p in paths {
                if !p.exists() {
                    continue;
                }
                reported.push(p.to_string_lossy().to_string());
                let (c, b) = walk_bytes(p, &[]);
                count += c;
                bytes += b;
            }
            (count, bytes, reported)
        }
        CleanupKind::Trash => {
            let home = home_dir().unwrap_or_default();
            let dir = home.join(".local/share/Trash");
            if !dir.exists() {
                return (0, 0, Vec::new());
            }
            let (c, b) = walk_bytes(&dir, &[]);
            (c, b, vec![dir.to_string_lossy().to_string()])
        }
        CleanupKind::Thumbnails => {
            let home = home_dir().unwrap_or_default();
            let dir = home.join(".cache/thumbnails");
            if !dir.exists() {
                return (0, 0, Vec::new());
            }
            let (c, b) = walk_bytes(&dir, &[]);
            (c, b, vec![dir.to_string_lossy().to_string()])
        }
    }
}

fn walk_bytes(root: &Path, exclude_top_level: &[&str]) -> (u64, u64) {
    let excluded: std::collections::HashSet<&str> = exclude_top_level.iter().copied().collect();
    let root_components = root.components().count();

    let mut count = 0u64;
    let mut bytes = 0u64;
    for entry in WalkDir::new(root).follow_links(false).into_iter().flatten() {
        // Skip excluded top-level subdir trees.
        let path = entry.path();
        if !excluded.is_empty() {
            if let Some(top) = path
                .components()
                .nth(root_components)
                .and_then(|c| c.as_os_str().to_str())
            {
                if excluded.contains(top) {
                    continue;
                }
            }
        }
        if entry.file_type().is_file() {
            if let Ok(meta) = entry.metadata() {
                count += 1;
                bytes += meta.len();
            }
        }
    }
    (count, bytes)
}

fn package_cache_scan() -> (u64, Vec<String>) {
    let paths: Vec<&str> = match distro_family().as_str() {
        "debian" => vec!["/var/cache/apt/archives"],
        "rhel" => vec!["/var/cache/dnf"],
        "arch" => vec!["/var/cache/pacman/pkg"],
        "suse" => vec!["/var/cache/zypp/packages"],
        _ => vec![],
    };
    let mut bytes = 0u64;
    let mut reported = Vec::new();
    for p in paths {
        let path = Path::new(p);
        if !path.exists() {
            continue;
        }
        reported.push(p.to_string());
        let (_, b) = walk_bytes(path, &[]);
        bytes += b;
    }
    (bytes, reported)
}

fn parse_journalctl_bytes(text: &str) -> u64 {
    // "Archived and active journals take up 512.0M on disk."
    for word in text.split_whitespace() {
        if let Some(n) = parse_size_suffix(word) {
            return n;
        }
    }
    0
}

fn parse_size_suffix(s: &str) -> Option<u64> {
    let trimmed = s.trim_end_matches(',').trim_end_matches('.');
    let (num_str, mul) = if let Some(rest) = trimmed.strip_suffix('K') {
        (rest, 1024u64)
    } else if let Some(rest) = trimmed.strip_suffix('M') {
        (rest, 1024 * 1024)
    } else if let Some(rest) = trimmed.strip_suffix('G') {
        (rest, 1024 * 1024 * 1024)
    } else {
        let rest = trimmed.strip_suffix('T')?;
        (rest, 1024u64.pow(4))
    };
    num_str.parse::<f64>().ok().map(|n| (n * mul as f64) as u64)
}

// ---- Run ----

fn run_spec(spec: &CategorySpec) -> (u64, u64, Vec<String>) {
    match &spec.kind {
        CleanupKind::UserFiles {
            paths,
            exclude_top_level,
        } => delete_trees(paths, exclude_top_level),
        CleanupKind::BrowserCache { paths } => delete_trees(paths, &[]),
        CleanupKind::Trash => delete_trees(
            &[
                home_dir()
                    .unwrap_or_default()
                    .join(".local/share/Trash/files"),
                home_dir()
                    .unwrap_or_default()
                    .join(".local/share/Trash/info"),
            ],
            &[],
        ),
        CleanupKind::Thumbnails => delete_trees(
            &[home_dir().unwrap_or_default().join(".cache/thumbnails")],
            &[],
        ),
        CleanupKind::SystemLogs => run_system_logs(),
        CleanupKind::PackageCache => run_package_cache(),
    }
}

fn delete_trees(paths: &[PathBuf], exclude_top_level: &[&str]) -> (u64, u64, Vec<String>) {
    let mut files_deleted = 0u64;
    let mut bytes_freed = 0u64;
    let mut errors = Vec::new();

    let excluded: std::collections::HashSet<&str> = exclude_top_level.iter().copied().collect();

    for base in paths {
        if !base.exists() {
            continue;
        }
        let root_components = base.components().count();

        for entry in WalkDir::new(base).follow_links(false).into_iter().flatten() {
            let path = entry.path();
            // Exclude protected subtrees.
            if !excluded.is_empty() {
                if let Some(top) = path
                    .components()
                    .nth(root_components)
                    .and_then(|c| c.as_os_str().to_str())
                {
                    if excluded.contains(top) {
                        continue;
                    }
                }
            }
            if !entry.file_type().is_file() {
                continue;
            }
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            match fs::remove_file(&path) {
                Ok(_) => {
                    files_deleted += 1;
                    bytes_freed += size;
                }
                Err(e) => {
                    errors.push(format!("{}: {}", path.display(), e));
                }
            }
        }
    }
    (files_deleted, bytes_freed, errors)
}

fn run_system_logs() -> (u64, u64, Vec<String>) {
    let mut files_deleted = 0u64;
    let mut bytes_freed = 0u64;
    let mut errors = Vec::new();

    // Vacuum journalctl to 100M max. Needs root.
    if which("journalctl") {
        let res = if is_root() {
            run_cmd_lossy("journalctl", &["--vacuum-size=100M"])
        } else {
            run_elevated("journalctl", &["--vacuum-size=100M"]).unwrap_or_default()
        };
        // journalctl prints "Vacuuming done, freed ..."; best effort to sum.
        bytes_freed += parse_journalctl_bytes(&res);
    }

    // Delete rotated logs.
    if let Ok(entries) = fs::read_dir("/var/log") {
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !(name.ends_with(".gz") || name.ends_with(".old") || name.ends_with(".1")) {
                continue;
            }
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            match fs::remove_file(&path) {
                Ok(_) => {
                    files_deleted += 1;
                    bytes_freed += size;
                }
                Err(e) => errors.push(format!("{}: {}", path.display(), e)),
            }
        }
    }
    (files_deleted, bytes_freed, errors)
}

fn run_package_cache() -> (u64, u64, Vec<String>) {
    let family = distro_family();
    let (program, args): (&str, Vec<&str>) = match family.as_str() {
        "debian" => ("apt-get", vec!["clean"]),
        "rhel" => ("dnf", vec!["clean", "all"]),
        "arch" => ("pacman", vec!["-Scc", "--noconfirm"]),
        "suse" => ("zypper", vec!["clean", "--all"]),
        _ => return (0, 0, vec![format!("Unsupported distro family: {family}")]),
    };

    match run_elevated(program, &args) {
        Ok(_) => (0, 0, Vec::new()),
        Err(e) => (0, 0, vec![e]),
    }
}
