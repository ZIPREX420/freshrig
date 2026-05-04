export const CHANGELOG: Record<string, string> = {
  "2.0.2": `### FreshRig v2.0.2 — CI hygiene 🧹

This is a maintenance release. No user-facing changes — just CI plumbing cleanups so future contributors don't trip on the same lints we did.

- **CI clippy fixes** — 35 lint sites cleaned up across the Linux command modules and watchdog.rs (Rust 1.95 added stricter \`unnecessary_sort_by\`, \`useless_format\`, \`collapsible_if\`, and \`trim_split_whitespace\` rules). Linux build is now clippy-clean for the first time in 10+ commits.
- **Windows-only modules properly cfg-gated** — \`data::app_catalog\`, \`data::debloat_tweaks\`, \`models::{context_menu, custom_apps, debloat, profiles}\` are now \`#[cfg(target_os = "windows")]\` at module declaration, eliminating dead-code warnings on Linux builds.
- **SBOM step robust against cargo-cyclonedx flag churn** — cargo-cyclonedx removed \`--output-file\` and has renamed its replacement a few times. The SBOM step now relies on the tool's default output behavior (writes to the manifest directory) and glob-moves the result to the expected name.
- **Release workflow gained \`workflow_dispatch\`** — when GitHub Actions silently drops a tag-trigger event (which happened to v2.0.1), you can now re-run the release from the Actions UI by entering the tag name, no force-push tag dance required.

Auto-updater will pull this for everyone on v2.0.0 / v2.0.1 within their normal check window.
\`,
  "2.0.1": `### FreshRig v2.0.1 — UI overhaul + Pro flow hotfix 🛠️

**Sidebar reorganized.**
The 13-item flat list became 6 functional groups — Overview, Setup, Tune-up, Maintain, Protect, and (for Business licenses) Fleet. Pro and Business features show inline tier badges so you know what's gated before you click. The badge dims to "you have this" once a license is active.

**Health Report has a sidebar entry now.**
Previously only reachable via a Dashboard button. Lives under Maintain.

**Pro upgrade buttons no longer 404.**
Every "Upgrade to Pro" button in v2.0.0 routed to a literal placeholder string. v2.0.1 routes them all to the public pricing page at ZIPREX420.github.io/freshrig#pricing while the LemonSqueezy store is being set up. The pricing page CTAs now mailto sales@freshrig.app for the waitlist.

**Release page categorizes downloads by OS.**
The new release notes group binaries under Windows / Linux / macOS sections instead of an alphabetical asset list, with install commands and size estimates next to each download.

No breaking changes. v2.0.0 users on the auto-updater get this automatically. v2.0.0 has been marked as pre-release on GitHub — please use v2.0.1 or later.
`,
  "2.0.0": `### FreshRig v2.0 — The Maintenance Tool That Reads Like a Tech 🛠️

**Four flagship Pro features:**
- **Privacy Drift Detection** — Snapshots privacy settings, notifies when Windows Updates re-enable tracking. One-click reapply.
- **Watchdog Mode** — System snapshots before any change. Compare before/after. Roll back when needed.
- **Encrypted Profile Sync** — Export profiles encrypted with your passphrase. Auto-detect them in OneDrive/Dropbox/iCloud.
- **SMART Disk Monitoring** — Trend-based alerts using Backblaze's high-signal attributes. Tells you when to back up.

**New: Pro Business tier ($14.99/mo or $149/yr per technician)**
- White-label PDF reports
- Multi-Machine Dashboard (up to 25 endpoints)
- Bulk Profile Deployment
- USB Portable Mode
- Customer Database with machine history
- Recurring Maintenance Contracts
- RepairShopr/Syncro/NinjaOne webhook integration

**Pricing changes:**
- Pro is now subscription: $5.99/mo or $49/yr (32% annual discount)
- 7-day free trial, no credit card required
- Pause-anytime subscription option
- Founder's Lifetime: first 500 customers get $149 one-time (no subscription, ever) — 30 days only

**Free tier evolved:**
- Apps catalog now has 15 essentials free, 60+ with Pro
- All other Free features stay free forever

**Open registry-path documentation. No telemetry. No bundled software. No auto-renewal traps.**
`,
  "1.2.1": `### FreshRig v1.2.1 — Polish + Dependency Updates 🧹

- **Launch-readiness audit** — top-to-bottom review caught 11 issues including a real cross-platform bug where the Profiles page was visible on Linux/macOS but errored on click (now hidden on non-Windows), and two startup-panic risks in portable mode (now fall back safely to %APPDATA%)
- **Cross-platform copy** — README, CLAUDE.md, AboutPage, package.json, and the in-app tagline all now describe FreshRig as the cross-platform tool it became in v1.1.0/v1.2.0 (was still saying "Windows desktop app" in places)
- **Landing page favicons** — index, download, privacy, and terms pages now show a proper browser-tab icon
- **Privacy policy updated** — the "What FreshRig Does" section now correctly mentions WMI on Windows + /proc + lspci on Linux + system_profiler + sysctl on macOS instead of WMI alone
- **About page accuracy** — replaced stale "Pro features coming soon" copy with the actual MIT-free + $39 one-time + 14-day trial reality
- **Dependency updates** — sysinfo, procfs, rand, plist, reqwest, lucide-react, and vite all bumped to current versions; \`npm audit\` shows 0 vulnerabilities; \`cargo audit\` clean (no new advisories)
- **LAUNCH_AUDIT.md** — added a 372-line repeatable playbook so future audits don't need to re-derive the methodology

No new features, no breaking changes — purely polish + housekeeping. Safe upgrade for everyone.
`,
  "1.2.0": `### FreshRig v1.2.0 — macOS Support 🍎

- **macOS is here** — FreshRig now runs natively on macOS 11+ (Big Sur through Tahoe), Apple Silicon and Intel
- **Universal binary** — Single .dmg download works on both M-series and Intel Macs
- **Homebrew integration** — Install apps via brew (40+ cask and formula mappings)
- **macOS hardware dashboard** — CPU, GPU, memory, disk health, and battery wear via system_profiler and sysctl
- **launchd service manager** — View and control LaunchAgents and LaunchDaemons with safety guardrails (Pro)
- **macOS startup manager** — Manage LaunchAgents and Login Items (Pro)
- **macOS disk cleanup** — Clear user caches, logs, Xcode DerivedData, Homebrew cache, and browser caches (Pro)
- **macOS security audit** — SIP, Gatekeeper, FileVault, Firewall, and XProtect status checks (Pro)
- **macOS network tools** — DNS flush, DNS preset switching, saved WiFi password viewer (Pro)
- **Downloads available as universal .dmg** — Signed and notarized (when Apple Developer certificate is configured)

**FreshRig now runs on Windows, Linux, AND macOS — the only open-source system tool that spans all three.**
`,
  "1.1.0": `### FreshRig v1.1.0 — Linux Support 🐧

- **Linux is here** — FreshRig now runs natively on Ubuntu, Fedora, Arch, Linux Mint, Pop!_OS, openSUSE, and more
- **Cross-distro package management** — Install apps via apt, dnf, pacman, zypper, or Flatpak depending on your distro
- **Linux hardware detection** — CPU, GPU, memory, disks, battery, and network via /proc, /sys, and lspci
- **systemd services manager** — View and control system services with safe presets (Pro)
- **XDG startup manager** — Manage autostart .desktop entries and systemd user services
- **Flatpak permission audit** — See which Flatpak apps have risky permissions like filesystem access (Pro)
- **Linux disk cleanup** — Clear package caches, old logs, browser caches, thumbnails, and trash (Pro)
- **Linux network tools** — DNS presets via systemd-resolved, NetworkManager restart, WiFi passwords from saved connections (Pro)
- **NVIDIA/AMD/Intel driver guidance** — Distro-specific driver recommendations with one-click package install
- **Downloads available as .deb, .rpm, and .AppImage** — plus AUR package for Arch users
`,
  "1.0.0": `### FreshRig v1.0.0 — Pro Launch 🎉

**New Pro Features** (free 14-day trial, then $39 one-time):
- **Disk Cleanup** — Scan and clean temp files, browser caches, crash dumps, shader caches, and more. Preview before cleaning with per-category risk ratings.
- **Privacy Dashboard** — Audit which apps access your camera, microphone, and location. 20+ privacy toggles with one-click hardening. Drift detection warns when Windows re-enables tracking.
- **Network Tools** — One-click DNS flush, full network reset, DNS preset switching (Cloudflare, Google, Quad9, etc.), saved WiFi password viewer.
- **Services Manager** — Gaming, Privacy, and Performance presets to safely disable unnecessary Windows services. Never-disable guardrails protect critical system services.
- **Context Menu Editor** — Restore Windows 11 classic right-click menu with one toggle. View and block shell extensions.
- **System Health Report** — Comprehensive PC diagnostic with hardware audit, SMART disk health, battery wear, security status, and an overall A-F grade. Export as PDF for selling a PC, documenting a build, or billing a repair job.
- **LemonSqueezy licensing** — Real license activation and validation replaces placeholder keys.

**Free features remain free forever.** Dashboard, Drivers, Apps, Profiles, Optimize, Startup Manager, and theme switching are all still free and open source.
`,
  "0.7.0": `### What's New in v0.7.0

- **Theme system** — 6 accent color presets (Teal, Blue, Purple, Orange, Rose, Green) with instant switching in Settings
- **Premium dark UI** — Redesigned cards, sidebar, buttons, and page transitions with spring-physics animations
- **Startup Manager** — New page to view and control Windows startup programs with one-click enable/disable
- **Smoother animations** — Page transitions, hover effects, and number animations throughout the app
- **Better toasts** — Custom-styled notifications matching the dark theme
`,
  "0.6.0": `### What's New in v0.6.0

- **No more CMD flashing** — All background commands now run invisibly, no more black terminal windows popping up
- **Fixed driver installs** — NVIDIA now links directly to the NVIDIA App (GeForce Experience is deprecated); Intel DSA installs via winget with hash-mismatch fallback
- **Better error messages** — Driver and app install failures now show specific, actionable error text instead of raw winget output
`,
  "0.5.1": `### What's New in v0.5.1

- **Build fingerprint fix** — Fingerprint now baked at compile time for accurate build tracing
- **Dev experience** — UAC elevation only triggers on release builds, not during development
- **Repo consistency** — Standardized GitHub URL casing across all documentation
`,
  "0.5.0": `### What's New in v0.5.0

- **Always elevated** — FreshRig now runs as administrator automatically, no more restart prompts
- **Silent driver install** — Install GPU and hardware driver tools directly from the Drivers page via winget
- **Build traceability** — Each build carries a unique fingerprint for support
- **Stronger license validation** — Improved Pro key format validation
- **Copyright headers** — Source files now carry proper attribution
`,
  "0.4.0": `### What's New in v0.4.0

- **Stability** — WMI hardware detection now has timeouts and graceful fallbacks; never hangs on broken systems
- **Smarter winget** — JSON output mode with automatic fallback to table parsing for older Windows versions
- **Retry failed installs** — One-click retry for apps that failed during batch install
- **Expert tier** — "Risky" debloat tier renamed to "Expert" for clarity
- **Windows version awareness** — Debloat tweaks now show compatibility badges (Win11-only tweaks disabled on Win10)
- **Download estimates** — See total estimated download size before starting batch install
- **Debloat summary** — In-app results banner after applying optimizations
- **Disk space check** — Warning before installing if drive space is low
- **Network check** — Offline indicator with retry on the Apps page
- **Accessibility** — Focus trap in command palette, aria-live install progress, health score screen reader support
- **Landing page** — Comparison table vs competitors, social proof badges, trust signals
- **Security** — SBOM generation in CI, crash log scrubbing, updated security policy
- **UX polish** — Category select/deselect all, better onboarding skip, UAC warning, confetti timing, tier tooltips
`,
  "0.3.0": `### What's New in v0.3.0

- **Custom app entries** — Add your own installers with download URL, silent install switches, and SHA256 hash verification
- **Portable mode** — Run FreshRig from a USB drive with a .portable marker file — all data stays next to the executable
- **Pro tier foundation** — Pro badges and license key activation (cosmetic for now, all features remain free)
- **Windows debloating** — 23 tweaks across Safe, Moderate, and Expert tiers with mandatory restore points
- **Onboarding wizard** — First-run setup with hardware detection and preset selection
- **Command palette** — Ctrl+K spotlight search for quick navigation and actions
- **Keyboard shortcuts** — Ctrl+1-5 page navigation, Ctrl+, for settings, Ctrl+Shift+/ for shortcut reference
- **Skeleton loading** — Smooth loading states across all pages
`,
  "0.2.0": `### What's New in v0.2.0

- **Search any app** — Search the entire winget repository, not just our curated catalog
- **Installed app detection** — See which apps are already on your system
- **Preset profiles** — One-click setup for Gamers, Developers, Privacy enthusiasts, and more
- **Auto-updates** — FreshRig now checks for and installs updates automatically
- **60+ apps** — Expanded catalog with developer tools, privacy apps, and creative software
`,
  "0.1.0": `### FreshRig v0.1.0 — First Release

- Hardware detection dashboard
- Driver recommendations
- App batch install via winget
- Shareable profiles
- Settings and system tray
`,
};
