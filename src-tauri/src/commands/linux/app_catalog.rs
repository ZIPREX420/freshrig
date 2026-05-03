//! Linux app catalog. Maps internal app IDs to package manager names for each
//! supported distro family, plus a Flatpak fallback ref.
//!
//! Catalog IDs are Linux-flavored short-form (e.g. "firefox") rather than the
//! Windows winget IDs (e.g. "Mozilla.Firefox"). Profile exports are already
//! keyed by the running OS's catalog, so cross-platform profile import is not
//! supported — users export on Windows, import on Windows; same for Linux.

use crate::models::apps::{AppCategory, AppEntry, AppTier};

/// 14 essential apps stay free; everything else is gated to Pro.
/// Linux flavor — uses this catalog's short-form IDs (e.g. "firefox"
/// rather than the Windows "Mozilla.Firefox"). Mirrors the Windows
/// FREE_TIER_IDS in `data::app_catalog`.
const FREE_TIER_IDS: &[&str] = &[
    // Browsers
    "firefox",
    "brave",
    "google-chrome",
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

/// Package-manager bindings for a single app.
#[derive(Debug, Clone, Copy)]
pub struct LinuxPackage {
    pub apt: Option<&'static str>,
    pub dnf: Option<&'static str>,
    pub pacman: Option<&'static str>,
    pub zypper: Option<&'static str>,
    pub flatpak: Option<&'static str>,
    pub snap: Option<&'static str>,
}

impl LinuxPackage {
    const fn none() -> Self {
        Self {
            apt: None,
            dnf: None,
            pacman: None,
            zypper: None,
            flatpak: None,
            snap: None,
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
    pkg: LinuxPackage,
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
        pkg: LinuxPackage {
            apt: Some("firefox"),
            dnf: Some("firefox"),
            pacman: Some("firefox"),
            zypper: Some("MozillaFirefox"),
            flatpak: Some("org.mozilla.firefox"),
            snap: Some("firefox"),
        },
    },
    Entry {
        id: "chromium",
        name: "Chromium",
        description: "Open-source base of Google Chrome.",
        category: AppCategory::Browser,
        icon: "Globe",
        popular: true,
        size_mb: Some(280),
        pkg: LinuxPackage {
            apt: Some("chromium"),
            dnf: Some("chromium"),
            pacman: Some("chromium"),
            zypper: Some("chromium"),
            flatpak: Some("org.chromium.Chromium"),
            snap: Some("chromium"),
        },
    },
    Entry {
        id: "brave",
        name: "Brave",
        description: "Privacy-focused browser with built-in ad blocking.",
        category: AppCategory::Browser,
        icon: "Globe",
        popular: true,
        size_mb: Some(300),
        pkg: LinuxPackage {
            flatpak: Some("com.brave.Browser"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "google-chrome",
        name: "Google Chrome",
        description: "Google's proprietary web browser.",
        category: AppCategory::Browser,
        icon: "Globe",
        popular: false,
        size_mb: Some(300),
        pkg: LinuxPackage {
            flatpak: Some("com.google.Chrome"),
            ..LinuxPackage::none()
        },
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
        pkg: LinuxPackage {
            apt: Some("vlc"),
            dnf: Some("vlc"),
            pacman: Some("vlc"),
            zypper: Some("vlc"),
            flatpak: Some("org.videolan.VLC"),
            snap: None,
        },
    },
    Entry {
        id: "spotify",
        name: "Spotify",
        description: "Music streaming client.",
        category: AppCategory::Media,
        icon: "Music",
        popular: true,
        size_mb: Some(220),
        pkg: LinuxPackage {
            flatpak: Some("com.spotify.Client"),
            snap: Some("spotify"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "obs",
        name: "OBS Studio",
        description: "Open-source screen recording and streaming software.",
        category: AppCategory::Media,
        icon: "Video",
        popular: true,
        size_mb: Some(300),
        pkg: LinuxPackage {
            apt: Some("obs-studio"),
            dnf: Some("obs-studio"),
            pacman: Some("obs-studio"),
            zypper: Some("obs-studio"),
            flatpak: Some("com.obsproject.Studio"),
            snap: None,
        },
    },
    Entry {
        id: "audacity",
        name: "Audacity",
        description: "Multi-track audio editor and recorder.",
        category: AppCategory::Media,
        icon: "Mic",
        popular: false,
        size_mb: Some(80),
        pkg: LinuxPackage {
            apt: Some("audacity"),
            dnf: Some("audacity"),
            pacman: Some("audacity"),
            zypper: Some("audacity"),
            flatpak: Some("org.audacityteam.Audacity"),
            snap: None,
        },
    },
    Entry {
        id: "handbrake",
        name: "HandBrake",
        description: "Video transcoder for MP4/MKV output.",
        category: AppCategory::Media,
        icon: "Film",
        popular: false,
        size_mb: Some(160),
        pkg: LinuxPackage {
            apt: Some("handbrake"),
            dnf: Some("HandBrake"),
            pacman: Some("handbrake"),
            zypper: Some("handbrake"),
            flatpak: Some("fr.handbrake.ghb"),
            snap: None,
        },
    },
    Entry {
        id: "gimp",
        name: "GIMP",
        description: "Raster image editor.",
        category: AppCategory::Media,
        icon: "Image",
        popular: true,
        size_mb: Some(280),
        pkg: LinuxPackage {
            apt: Some("gimp"),
            dnf: Some("gimp"),
            pacman: Some("gimp"),
            zypper: Some("gimp"),
            flatpak: Some("org.gimp.GIMP"),
            snap: None,
        },
    },
    Entry {
        id: "inkscape",
        name: "Inkscape",
        description: "Vector graphics editor (SVG).",
        category: AppCategory::Media,
        icon: "PenTool",
        popular: false,
        size_mb: Some(180),
        pkg: LinuxPackage {
            apt: Some("inkscape"),
            dnf: Some("inkscape"),
            pacman: Some("inkscape"),
            zypper: Some("inkscape"),
            flatpak: Some("org.inkscape.Inkscape"),
            snap: None,
        },
    },
    Entry {
        id: "blender",
        name: "Blender",
        description: "3D modelling, animation, and rendering suite.",
        category: AppCategory::Media,
        icon: "Box",
        popular: false,
        size_mb: Some(400),
        pkg: LinuxPackage {
            apt: Some("blender"),
            dnf: Some("blender"),
            pacman: Some("blender"),
            zypper: Some("blender"),
            flatpak: Some("org.blender.Blender"),
            snap: None,
        },
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
        pkg: LinuxPackage {
            apt: Some("code"),
            dnf: Some("code"),
            pacman: Some("visual-studio-code-bin"),
            zypper: Some("code"),
            flatpak: Some("com.visualstudio.code"),
            snap: Some("code"),
        },
    },
    Entry {
        id: "git",
        name: "Git",
        description: "Distributed version control.",
        category: AppCategory::Development,
        icon: "GitBranch",
        popular: true,
        size_mb: Some(60),
        pkg: LinuxPackage {
            apt: Some("git"),
            dnf: Some("git"),
            pacman: Some("git"),
            zypper: Some("git-core"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "nodejs",
        name: "Node.js",
        description: "JavaScript runtime.",
        category: AppCategory::Runtime,
        icon: "Terminal",
        popular: true,
        size_mb: Some(90),
        pkg: LinuxPackage {
            apt: Some("nodejs"),
            dnf: Some("nodejs"),
            pacman: Some("nodejs"),
            zypper: Some("nodejs"),
            flatpak: None,
            snap: Some("node"),
        },
    },
    Entry {
        id: "python",
        name: "Python 3",
        description: "General-purpose programming language.",
        category: AppCategory::Runtime,
        icon: "Terminal",
        popular: true,
        size_mb: Some(100),
        pkg: LinuxPackage {
            apt: Some("python3"),
            dnf: Some("python3"),
            pacman: Some("python"),
            zypper: Some("python3"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "docker",
        name: "Docker Engine",
        description: "Container runtime.",
        category: AppCategory::Development,
        icon: "Package",
        popular: false,
        size_mb: Some(500),
        pkg: LinuxPackage {
            apt: Some("docker.io"),
            dnf: Some("docker"),
            pacman: Some("docker"),
            zypper: Some("docker"),
            flatpak: None,
            snap: Some("docker"),
        },
    },
    Entry {
        id: "rust",
        name: "Rust (rustup)",
        description: "Systems programming language.",
        category: AppCategory::Runtime,
        icon: "Package",
        popular: false,
        size_mb: Some(400),
        pkg: LinuxPackage {
            apt: Some("rustup"),
            dnf: Some("rustup"),
            pacman: Some("rustup"),
            zypper: Some("rustup"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "go",
        name: "Go",
        description: "Google's systems programming language.",
        category: AppCategory::Runtime,
        icon: "Package",
        popular: false,
        size_mb: Some(350),
        pkg: LinuxPackage {
            apt: Some("golang"),
            dnf: Some("golang"),
            pacman: Some("go"),
            zypper: Some("go"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "github-desktop",
        name: "GitHub Desktop",
        description: "Git GUI from GitHub.",
        category: AppCategory::Development,
        icon: "GitBranch",
        popular: false,
        size_mb: Some(160),
        pkg: LinuxPackage {
            flatpak: Some("io.github.shiftey.Desktop"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "postman",
        name: "Postman",
        description: "API testing client.",
        category: AppCategory::Development,
        icon: "Send",
        popular: false,
        size_mb: Some(300),
        pkg: LinuxPackage {
            flatpak: Some("com.getpostman.Postman"),
            snap: Some("postman"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "jetbrains-toolbox",
        name: "JetBrains Toolbox",
        description: "Manager for IntelliJ/PyCharm/CLion/WebStorm.",
        category: AppCategory::Development,
        icon: "Wrench",
        popular: false,
        size_mb: Some(250),
        pkg: LinuxPackage {
            flatpak: Some("com.jetbrains.JetBrainsToolbox"),
            ..LinuxPackage::none()
        },
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
        pkg: LinuxPackage {
            flatpak: Some("com.discordapp.Discord"),
            snap: Some("discord"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "telegram",
        name: "Telegram",
        description: "Encrypted cloud-based messaging.",
        category: AppCategory::Communication,
        icon: "Send",
        popular: true,
        size_mb: Some(100),
        pkg: LinuxPackage {
            apt: Some("telegram-desktop"),
            dnf: Some("telegram-desktop"),
            pacman: Some("telegram-desktop"),
            zypper: Some("telegram-desktop"),
            flatpak: Some("org.telegram.desktop"),
            snap: Some("telegram-desktop"),
        },
    },
    Entry {
        id: "signal",
        name: "Signal",
        description: "End-to-end encrypted messenger.",
        category: AppCategory::Communication,
        icon: "Shield",
        popular: false,
        size_mb: Some(140),
        pkg: LinuxPackage {
            flatpak: Some("org.signal.Signal"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "slack",
        name: "Slack",
        description: "Team communication platform.",
        category: AppCategory::Communication,
        icon: "Hash",
        popular: false,
        size_mb: Some(180),
        pkg: LinuxPackage {
            flatpak: Some("com.slack.Slack"),
            snap: Some("slack"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "zoom",
        name: "Zoom",
        description: "Video conferencing client.",
        category: AppCategory::Communication,
        icon: "Video",
        popular: false,
        size_mb: Some(200),
        pkg: LinuxPackage {
            flatpak: Some("us.zoom.Zoom"),
            snap: Some("zoom-client"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "thunderbird",
        name: "Thunderbird",
        description: "Email client from Mozilla.",
        category: AppCategory::Communication,
        icon: "Mail",
        popular: false,
        size_mb: Some(170),
        pkg: LinuxPackage {
            apt: Some("thunderbird"),
            dnf: Some("thunderbird"),
            pacman: Some("thunderbird"),
            zypper: Some("MozillaThunderbird"),
            flatpak: Some("org.mozilla.Thunderbird"),
            snap: Some("thunderbird"),
        },
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
        pkg: LinuxPackage {
            apt: Some("steam"),
            dnf: Some("steam"),
            pacman: Some("steam"),
            zypper: Some("steam"),
            flatpak: Some("com.valvesoftware.Steam"),
            snap: Some("steam"),
        },
    },
    Entry {
        id: "lutris",
        name: "Lutris",
        description: "Open gaming platform for Linux (Wine/emulators).",
        category: AppCategory::Gaming,
        icon: "Gamepad",
        popular: false,
        size_mb: Some(80),
        pkg: LinuxPackage {
            apt: Some("lutris"),
            dnf: Some("lutris"),
            pacman: Some("lutris"),
            zypper: Some("lutris"),
            flatpak: Some("net.lutris.Lutris"),
            snap: None,
        },
    },
    Entry {
        id: "heroic",
        name: "Heroic Games Launcher",
        description: "Open-source Epic/GOG client for Linux.",
        category: AppCategory::Gaming,
        icon: "Gamepad",
        popular: false,
        size_mb: Some(200),
        pkg: LinuxPackage {
            flatpak: Some("com.heroicgameslauncher.hgl"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "mangohud",
        name: "MangoHud",
        description: "Vulkan/OpenGL overlay for FPS + GPU/CPU telemetry.",
        category: AppCategory::Gaming,
        icon: "Activity",
        popular: false,
        size_mb: Some(10),
        pkg: LinuxPackage {
            apt: Some("mangohud"),
            dnf: Some("mangohud"),
            pacman: Some("mangohud"),
            zypper: Some("mangohud"),
            flatpak: Some("org.freedesktop.Platform.VulkanLayer.MangoHud"),
            snap: None,
        },
    },
    Entry {
        id: "gamemode",
        name: "Feral GameMode",
        description: "CPU governor + process tuning for games.",
        category: AppCategory::Gaming,
        icon: "Zap",
        popular: false,
        size_mb: Some(5),
        pkg: LinuxPackage {
            apt: Some("gamemode"),
            dnf: Some("gamemode"),
            pacman: Some("gamemode"),
            zypper: Some("gamemode"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "protonup-qt",
        name: "ProtonUp-Qt",
        description: "Install/update Proton-GE for Steam.",
        category: AppCategory::Gaming,
        icon: "Download",
        popular: false,
        size_mb: Some(50),
        pkg: LinuxPackage {
            flatpak: Some("net.davidotek.pupgui2"),
            ..LinuxPackage::none()
        },
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
        pkg: LinuxPackage {
            apt: Some("libreoffice"),
            dnf: Some("libreoffice"),
            pacman: Some("libreoffice-fresh"),
            zypper: Some("libreoffice"),
            flatpak: Some("org.libreoffice.LibreOffice"),
            snap: Some("libreoffice"),
        },
    },
    Entry {
        id: "obsidian",
        name: "Obsidian",
        description: "Markdown knowledge-base app.",
        category: AppCategory::Productivity,
        icon: "BookOpen",
        popular: false,
        size_mb: Some(180),
        pkg: LinuxPackage {
            flatpak: Some("md.obsidian.Obsidian"),
            snap: Some("obsidian"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "notion",
        name: "Notion",
        description: "All-in-one workspace for notes and docs.",
        category: AppCategory::Productivity,
        icon: "BookOpen",
        popular: false,
        size_mb: Some(220),
        pkg: LinuxPackage {
            flatpak: Some("notion-app-enhanced"),
            snap: Some("notion-snap"),
            ..LinuxPackage::none()
        },
    },
    // ── Utilities ───────────────────────────────────────────────────────
    Entry {
        id: "htop",
        name: "htop",
        description: "Interactive process viewer for the terminal.",
        category: AppCategory::Utilities,
        icon: "Activity",
        popular: false,
        size_mb: Some(2),
        pkg: LinuxPackage {
            apt: Some("htop"),
            dnf: Some("htop"),
            pacman: Some("htop"),
            zypper: Some("htop"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "btop",
        name: "btop++",
        description: "Prettier resource monitor for the terminal.",
        category: AppCategory::Utilities,
        icon: "Activity",
        popular: false,
        size_mb: Some(3),
        pkg: LinuxPackage {
            apt: Some("btop"),
            dnf: Some("btop"),
            pacman: Some("btop"),
            zypper: Some("btop"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "neofetch",
        name: "neofetch",
        description: "System-info CLI with distro art.",
        category: AppCategory::Utilities,
        icon: "Terminal",
        popular: false,
        size_mb: Some(1),
        pkg: LinuxPackage {
            apt: Some("neofetch"),
            dnf: Some("neofetch"),
            pacman: Some("neofetch"),
            zypper: Some("neofetch"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "7zip",
        name: "7-Zip (p7zip)",
        description: "High-ratio archiver (.7z, .zip, .tar.*).",
        category: AppCategory::Utilities,
        icon: "Archive",
        popular: false,
        size_mb: Some(8),
        pkg: LinuxPackage {
            apt: Some("p7zip-full"),
            dnf: Some("p7zip"),
            pacman: Some("p7zip"),
            zypper: Some("p7zip-full"),
            flatpak: None,
            snap: None,
        },
    },
    Entry {
        id: "qbittorrent",
        name: "qBittorrent",
        description: "Open-source BitTorrent client.",
        category: AppCategory::Utilities,
        icon: "Download",
        popular: false,
        size_mb: Some(60),
        pkg: LinuxPackage {
            apt: Some("qbittorrent"),
            dnf: Some("qbittorrent"),
            pacman: Some("qbittorrent"),
            zypper: Some("qbittorrent"),
            flatpak: Some("org.qbittorrent.qBittorrent"),
            snap: None,
        },
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
        pkg: LinuxPackage {
            apt: Some("keepassxc"),
            dnf: Some("keepassxc"),
            pacman: Some("keepassxc"),
            zypper: Some("keepassxc"),
            flatpak: Some("org.keepassxc.KeePassXC"),
            snap: Some("keepassxc"),
        },
    },
    Entry {
        id: "bitwarden",
        name: "Bitwarden",
        description: "Cloud-sync password manager (open source).",
        category: AppCategory::Security,
        icon: "Lock",
        popular: false,
        size_mb: Some(120),
        pkg: LinuxPackage {
            flatpak: Some("com.bitwarden.desktop"),
            snap: Some("bitwarden"),
            ..LinuxPackage::none()
        },
    },
    Entry {
        id: "veracrypt",
        name: "VeraCrypt",
        description: "On-the-fly disk encryption.",
        category: AppCategory::Security,
        icon: "Lock",
        popular: false,
        size_mb: Some(30),
        pkg: LinuxPackage {
            flatpak: Some("com.veracrypt.VeraCrypt"),
            ..LinuxPackage::none()
        },
    },
];

/// Return the full Linux app catalog.
pub fn linux_app_catalog() -> Vec<AppEntry> {
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

/// Look up the package-manager bindings for a given app id.
pub fn find_package(app_id: &str) -> Option<LinuxPackage> {
    CATALOG.iter().find(|e| e.id == app_id).map(|e| e.pkg)
}

/// Look up the display name for a given app id.
pub fn find_name(app_id: &str) -> Option<&'static str> {
    CATALOG.iter().find(|e| e.id == app_id).map(|e| e.name)
}
