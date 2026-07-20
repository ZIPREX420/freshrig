use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AppTier {
    Free,
    // Default to Pro so any new catalog entry that forgets to specify a tier
    // gets gated correctly — failing closed.
    #[default]
    Pro,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: AppCategory,
    pub icon_name: String,
    pub is_popular: bool,
    #[serde(default)]
    pub tier: AppTier,
    #[serde(default)]
    pub estimated_size_mb: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum AppCategory {
    Browser,
    Gaming,
    Communication,
    Development,
    Media,
    Productivity,
    Utilities,
    Security,
    Runtime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    pub app_id: String,
    pub app_name: String,
    pub status: InstallStatus,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum InstallStatus {
    Pending,
    Installing,
    Completed,
    Failed,
    Skipped,
}

/// REL-02: aggregate result of an `install_apps` batch. Per-app progress
/// still streams via `install-progress` events; this return value gives the
/// awaiting caller a synchronous pass/fail signal instead of the old
/// `Ok(())`-even-when-every-install-failed contract. Fields hold app ids.
//
// Constructed only by the Windows `install_apps` twin; the Linux/macOS twins
// still return `()`, so on those targets this is defined-but-unused. It must
// stay defined on every platform (Windows IPC return type + mirrored in
// src/lib/api.ts), so silence dead_code where it isn't built rather than
// gating the type itself.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct InstallSummary {
    pub installed: Vec<String>,
    pub failed: Vec<String>,
    pub skipped: Vec<String>,
}
