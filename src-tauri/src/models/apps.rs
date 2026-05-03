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
