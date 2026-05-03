//! macOS app catalog. Maps internal app IDs to Homebrew casks (GUI .app
//! bundles) and formulae (CLI tools). The catalog IDs match the Linux
//! catalog where the apps overlap (firefox, vlc, vscode, …) plus a few
//! macOS-specific entries (iterm2, rectangle, raycast, keka, appcleaner).
//!
//! Profile exports are keyed by the running OS's catalog, so cross-platform
//! profile import is unsupported — same constraint as Linux.

#![allow(dead_code)]

use crate::models::apps::{AppCategory, AppEntry, AppTier};

/// 14 essential apps stay free; everything else is gated to Pro.
/// macOS flavor — uses this catalog's short-form IDs (e.g. "firefox"
/// rather than the Windows "Mozilla.Firefox"). Mirrors the Windows
/// FREE_TIER_IDS in `data::app_catalog`.
const FREE_TIER_IDS: &[&str] = &[
    // Browsers
    "firefox",
    "brave",
    "chrome",
    // Gaming / Communication
    "steam",
    "discord",
    // Media
    "obs",
    "vlc",
    "spotify",
    // Utilities / Productivity
    "7zip",
    "libreoffice",
    // Development / Runtimes
    "git",
    "python",
    "nodejs",
];

fn tier_for(id: &str) -> AppTier {
    if FREE_TIER_IDS.contains(&id) {
        AppTier::Free
    } else {
        AppTier::Pro
    }
}

/// Homebrew bindings for a single app. Either `cask` (GUI app bundle) or
/// `formula` (CLI tool) is set; never both at once for the catalog rows
/// below, but the type allows both for forward compatibility.
#[derive(Debug, Clone, Copy)]
pub struct MacosPackage {
    pub cask: Option<&'static str>,
    pub formula: Option<&'static str>,
}

impl MacosPackage {
    const fn cask(name: &'static str) -> Self {
        Self {
            cask: Some(name),
            formula: None,
        }
    }
    const fn formula(name: &'static str) -> Self {
        Self {
            cask: None,
            formula: Some(name),
        }
    }
}

struct Entry {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    category: AppCategory,
    icon: &'static str,
    popular: bool,
    size_mb: Option<u32>,
    pkg: MacosPackage,
}

const CATALOG: &[Entry] = &[
    // ── Browsers ────────────────────────────────────────────────────────
    Entry {
        id: "firefox",
        name: "Firefox",
        description: "Fast, private, open-source web browser from Mozilla.",
        category: AppCategory::Browser,
        icon: "Globe",
        popular: true,
        size_mb: Some(220),
        pkg: MacosPackage::cask("firefox"),
    },
    Entry {
        id: "brave",
        name: "Brave",
        description: "Privacy-focused browser with built-in ad blocking.",
        category: AppCategory::Browser,
        icon: "Globe",
        popular: true,
        size_mb: Some(300),
        pkg: MacosPackage::cask("brave-browser"),
    },
    Entry {
        id: "chrome",
        name: "Google Chrome",
        description: "Google's proprietary web browser.",
        category: AppCategory::Browser,
        icon: "Globe",
        popular: false,
        size_mb: Some(300),
        pkg: MacosPackage::cask("google-chrome"),
    },
    // ── Media ───────────────────────────────────────────────────────────
    Entry {
        id: "vlc",
        name: "VLC",
        description: "Plays nearly any audio/video file or disc.",
        category: AppCategory::Media,
        icon: "Play",
        popular: true,
        size_mb: Some(120),
        pkg: MacosPackage::cask("vlc"),
    },
    Entry {
        id: "spotify",
        name: "Spotify",
        description: "Music streaming client.",
        category: AppCategory::Media,
        icon: "Music",
        popular: true,
        size_mb: Some(220),
        pkg: MacosPackage::cask("spotify"),
    },
    Entry {
        id: "obs",
        name: "OBS Studio",
        description: "Open-source screen recording and streaming software.",
        category: AppCategory::Media,
        icon: "Video",
        popular: true,
        size_mb: Some(300),
        pkg: MacosPackage::cask("obs"),
    },
    Entry {
        id: "gimp",
        name: "GIMP",
        description: "Raster image editor.",
        category: AppCategory::Media,
        icon: "Image",
        popular: true,
        size_mb: Some(280),
        pkg: MacosPackage::cask("gimp"),
    },
    // ── Development ─────────────────────────────────────────────────────
    Entry {
        id: "vscode",
        name: "Visual Studio Code",
        description: "Microsoft's free code editor.",
        category: AppCategory::Development,
        icon: "Code",
        popular: true,
        size_mb: Some(380),
        pkg: MacosPackage::cask("visual-studio-code"),
    },
    Entry {
        id: "git",
        name: "Git",
        description: "Distributed version control.",
        category: AppCategory::Development,
        icon: "GitBranch",
        popular: true,
        size_mb: Some(60),
        pkg: MacosPackage::formula("git"),
    },
    Entry {
        id: "nodejs",
        name: "Node.js",
        description: "JavaScript runtime.",
        category: AppCategory::Runtime,
        icon: "Terminal",
        popular: true,
        size_mb: Some(90),
        pkg: MacosPackage::formula("node"),
    },
    Entry {
        id: "python",
        name: "Python 3",
        description: "General-purpose programming language.",
        category: AppCategory::Runtime,
        icon: "Terminal",
        popular: true,
        size_mb: Some(100),
        pkg: MacosPackage::formula("python@3"),
    },
    Entry {
        id: "docker",
        name: "Docker Desktop",
        description: "Container runtime with GUI.",
        category: AppCategory::Development,
        icon: "Package",
        popular: false,
        size_mb: Some(700),
        pkg: MacosPackage::cask("docker"),
    },
    Entry {
        id: "iterm2",
        name: "iTerm2",
        description: "Terminal replacement with split panes and search.",
        category: AppCategory::Development,
        icon: "Terminal",
        popular: true,
        size_mb: Some(60),
        pkg: MacosPackage::cask("iterm2"),
    },
    // ── Communication ──────────────────────────────────────────────────
    Entry {
        id: "discord",
        name: "Discord",
        description: "Voice + text chat for communities.",
        category: AppCategory::Communication,
        icon: "MessageCircle",
        popular: true,
        size_mb: Some(150),
        pkg: MacosPackage::cask("discord"),
    },
    Entry {
        id: "telegram",
        name: "Telegram",
        description: "Encrypted cloud-based messaging.",
        category: AppCategory::Communication,
        icon: "Send",
        popular: true,
        size_mb: Some(100),
        pkg: MacosPackage::cask("telegram"),
    },
    Entry {
        id: "signal",
        name: "Signal",
        description: "End-to-end encrypted messenger.",
        category: AppCategory::Communication,
        icon: "Shield",
        popular: false,
        size_mb: Some(140),
        pkg: MacosPackage::cask("signal"),
    },
    Entry {
        id: "slack",
        name: "Slack",
        description: "Team communication platform.",
        category: AppCategory::Communication,
        icon: "Hash",
        popular: false,
        size_mb: Some(180),
        pkg: MacosPackage::cask("slack"),
    },
    Entry {
        id: "zoom",
        name: "Zoom",
        description: "Video conferencing client.",
        category: AppCategory::Communication,
        icon: "Video",
        popular: false,
        size_mb: Some(200),
        pkg: MacosPackage::cask("zoom"),
    },
    Entry {
        id: "thunderbird",
        name: "Thunderbird",
        description: "Email client from Mozilla.",
        category: AppCategory::Communication,
        icon: "Mail",
        popular: false,
        size_mb: Some(170),
        pkg: MacosPackage::cask("thunderbird"),
    },
    // ── Gaming ──────────────────────────────────────────────────────────
    Entry {
        id: "steam",
        name: "Steam",
        description: "Valve's gaming platform.",
        category: AppCategory::Gaming,
        icon: "Gamepad",
        popular: true,
        size_mb: Some(400),
        pkg: MacosPackage::cask("steam"),
    },
    // ── Productivity ────────────────────────────────────────────────────
    Entry {
        id: "libreoffice",
        name: "LibreOffice",
        description: "Full office suite (Writer, Calc, Impress, Draw).",
        category: AppCategory::Productivity,
        icon: "FileText",
        popular: true,
        size_mb: Some(500),
        pkg: MacosPackage::cask("libreoffice"),
    },
    Entry {
        id: "notion",
        name: "Notion",
        description: "All-in-one workspace for notes and docs.",
        category: AppCategory::Productivity,
        icon: "BookOpen",
        popular: false,
        size_mb: Some(220),
        pkg: MacosPackage::cask("notion"),
    },
    // ── Utilities ───────────────────────────────────────────────────────
    Entry {
        id: "7zip",
        name: "7-Zip (p7zip)",
        description: "High-ratio archiver (.7z, .zip, .tar.*).",
        category: AppCategory::Utilities,
        icon: "Archive",
        popular: false,
        size_mb: Some(8),
        pkg: MacosPackage::formula("p7zip"),
    },
    Entry {
        id: "rectangle",
        name: "Rectangle",
        description: "Window snapping with keyboard shortcuts.",
        category: AppCategory::Utilities,
        icon: "Maximize",
        popular: true,
        size_mb: Some(20),
        pkg: MacosPackage::cask("rectangle"),
    },
    Entry {
        id: "raycast",
        name: "Raycast",
        description: "Spotlight replacement with extensions.",
        category: AppCategory::Utilities,
        icon: "Zap",
        popular: true,
        size_mb: Some(80),
        pkg: MacosPackage::cask("raycast"),
    },
    Entry {
        id: "keka",
        name: "Keka",
        description: "Archive utility (RAR, 7z, tar, zip).",
        category: AppCategory::Utilities,
        icon: "Archive",
        popular: false,
        size_mb: Some(40),
        pkg: MacosPackage::cask("keka"),
    },
    Entry {
        id: "appcleaner",
        name: "AppCleaner",
        description: "Uninstaller that finds related preference and cache files.",
        category: AppCategory::Utilities,
        icon: "Trash2",
        popular: false,
        size_mb: Some(10),
        pkg: MacosPackage::cask("appcleaner"),
    },
    // ── Security ────────────────────────────────────────────────────────
    Entry {
        id: "keepassxc",
        name: "KeePassXC",
        description: "Offline password manager.",
        category: AppCategory::Security,
        icon: "Lock",
        popular: false,
        size_mb: Some(100),
        pkg: MacosPackage::cask("keepassxc"),
    },
];

/// Return the full macOS app catalog.
pub fn macos_app_catalog() -> Vec<AppEntry> {
    CATALOG
        .iter()
        .map(|e| AppEntry {
            id: e.id.into(),
            name: e.name.into(),
            description: e.description.into(),
            category: e.category.clone(),
            icon_name: e.icon.into(),
            is_popular: e.popular,
            tier: tier_for(e.id),
            estimated_size_mb: e.size_mb,
        })
        .collect()
}

/// Look up the Homebrew bindings for a given app id.
pub fn find_package(app_id: &str) -> Option<MacosPackage> {
    CATALOG.iter().find(|e| e.id == app_id).map(|e| e.pkg)
}

/// Look up the display name for a given app id.
pub fn find_name(app_id: &str) -> Option<&'static str> {
    CATALOG.iter().find(|e| e.id == app_id).map(|e| e.name)
}
