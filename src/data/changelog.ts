export const CHANGELOG: Record<string, string> = {
  "2.4.1": `### FreshRig v2.4.1 — Dependency maintenance 🔧

Routine dependency update batch. No user-facing changes; safe upgrade for all v2.4.0 users.

**npm updates.**
react + react-dom 19.2.5 → 19.2.6, react-hotkeys-hook 5.2.4 → 5.3.2, tailwindcss + @tailwindcss/vite 4.2.2 → 4.3.0, @tauri-apps/cli 2.11.0 → 2.11.1, vite 8.0.10 → 8.0.13, zustand 5.0.12 → 5.0.13.

**Cargo update.**
sysinfo 0.38 → 0.39.1.

**CI fix.**
The release-readiness LemonSqueezy gate carve-out now covers the full v2.4.x family via \`startsWith()\` instead of individual tag checks, so future patch releases in this pre-launch cycle don't require a manual carve-out edit.

Auto-updater will pull this for all v2.4.0 installs on their next check.
`,
  "2.4.0": `### FreshRig v2.4.0 — Layout overhaul 🔷🔶

A full UI rethink. Same FreshRig under the hood, completely rebuilt on top — the v2.3 cyber/neon palette finally has the layout it was always meant for.

**New hub-and-spoke navigation.**
The sidebar drops from 14 items to 6: Home / Quick Setup / Custom Setup / Profiles / Tools / Settings (+ Fleet for Business). Every existing feature is still one click away — driver / app / cleanup / privacy / network / services / context-menu / startup / report all live inside the new Tools hub. Keyboard shortcuts re-mapped to match (Ctrl+1–5 = primary, Ctrl+6–9 = inside-Tools quick jumps).

**New hub pages.**
Two centerpiece flows from the mockups now ship as real pages:
- **Quick Setup** — one giant cyan hex hero, a checklist of what's included, an outlined neon CTA. Click Start, watch a 5-step wizard run with a circular progress gauge and live scan-item list (Hardware → OS → Drivers → Software → Settings → Network).
- **Custom Setup** — magenta hex hero, category grid, then a 5-step wizard with a 3-column layout (Categories | Items | Selection summary). Search filter, live total / disk / time estimates.

**Brand-new visual primitives.**
- \`<HexIcon>\` — pointy-top hex frame with cyan / magenta / gradient stroke, optional Tron-perspective floor inside, ambient glow. Sizes from 32px (sidebar status peg) to 200px (page centerpiece).
- \`<HeroCTA>\` — full-width outlined neon pill button with arrow. Cyan = safe / primary, magenta = creative / commit.
- \`<ActionTile>\` + \`<ActionGrid>\` — equal-height rim-glow cards in 2 / 3 / 4 column responsive grids. Drives the new Dashboard, Tools hub, and Aangepaste category picker.
- \`<HexStepper>\` — horizontal hex-shaped step indicator with connector lines that fill cyan as you progress. Used in both wizards.
- \`<ProgressRing>\` — animated circular gauge with optional indeterminate scan rotation, accent-aware glow, tick marks at 30° intervals.
- \`<SidebarSystemCard>\` — bottom-of-sidebar status card with two variants: compact (status pill + last scan) and expanded (full hardware spec list).
- \`<PageBreadcrumb>\` — back arrow + current-page label header for every subpage.
- \`<NotificationBell>\` — title-bar widget with unread red-dot indicator.
- \`<CircuitBackdrop>\` — full-bleed deterministic SVG circuit-rain backdrop for splash screens and inside hex frames.

**Welcome / Splash screen.**
First-launch users now see a true full-bleed splash matching mockup-1: large hex monogram, FRESHRIG wordmark, "Setup any PC. In minutes." tagline, outlined cyan CTA. A second variant ("returning") shows the mockup-2 left-logo + right-greeting layout for repeat launches. Tracked via new \`hasSeenSplash\` setting; shown once per fresh install.

**Redesigned Dashboard.**
The home view now matches mockup-2: big hero heading + system-score ProgressRing on the right, 4-tile action grid (Quick / Custom / Import / Tools), Recent Setups row with View-all link. Detailed hardware widgets (GPU / disk / network / audio cards, Smart health, driver issues) preserved in the tree and reachable from the Tools hub or the Health Report.

**Lightweight i18n.**
New \`src/i18n/\` module — zero-dependency, type-safe \`useT()\` hook. English (default) and Dutch shipped together; cycle between them from the sidebar footer pill. The redesigned splash is fully translated; the rest of the new pages are scaffolded for translation in incremental follow-ups. Plan: extend coverage one feature at a time, fall through to English when keys are missing.

**Landing page caught up.**
\`site/index.html\` hero rebuilt to match the splash screen — hex monogram, gradient wordmark, outlined cyan CTA. New "Four ways to set up your PC" tile section directly under the hero showcases Quick / Custom / Import / Tools with the same hex thumbnails as the desktop app.

**Architecture preserved.**
- Every IPC command and Zustand store untouched. Profiles, license keys, hardware data, settings — all carry over exactly.
- All cross-platform code paths intact (Windows / Linux / macOS-stub).
- Hardening from v2.3 (CSP, capabilities tightening, headless ACL, panic-log scrubbing, license release-gate) inherited as-is.

**Migration notes.**
- The old Sidebar groups (Overview / Setup / Tune-up / Maintain / Protect / Business) are gone — bookmark Ctrl+5 (Tools) for the closest equivalent if you used the secondary nav heavily.
- The Dashboard's old detail widgets (DashboardHero, SystemMetricsBar, GpuCard, etc.) still live under \`src/components/dashboard/\` and remain importable; the home view just doesn't render them anymore. Future iteration may bring a "detailed view" toggle.
- \`Edit\` users may notice old keyboard shortcuts re-mapped — Ctrl+2 was Drivers, now Quick Setup. Drivers moved to Ctrl+6.
`,
  "2.3.0": `### FreshRig v2.3.0 — Cyber/Neon redesign 🟦🟪

A top-to-bottom visual refresh plus a serious security/perf hardening pass. Same FreshRig under the hood — every IPC command, route, store, and saved profile keeps working — but the surface looks like the control panel it always wanted to be.

**Cyber/neon visual identity.**
Dual-accent system in \`src/styles.css\`: cyan (\`#00e5ff\`) for primary/safe/"go", magenta (\`#ff2bd6\`) for creative/Pro/danger. The 6 accent presets in Settings rotate the cyan slot; magenta stays constant so the dual-accent identity is always present. Deeper near-black palette, ambient body glow + faint grid, neon edge shadows, tighter radii.

**New brand mark.**
Hexagonal "FR" monogram with a cyan→magenta gradient stroke + soft glow filter, paired with a "FRESH"/magenta-"RIG" wordmark. Both render in the Sidebar and TitleBar. The full Tauri icon family was regenerated from a new high-detail \`app-icon.svg\` — installer icons, taskbar, alt-tab, all platforms.

**Re-themed landing page.**
Every page on the public site (index, download, privacy, terms) was repainted with the new palette and outlined-neon CTAs. \`og-image.svg\` rewritten so social shares pick up the new identity.

**Hardening pass (carried over from the v2.2 audit).**
Content-Security-Policy is now properly set in \`tauri.conf.json\` (was \`null\`), with a separate \`devCsp\` for HMR. The \`tauri-plugin-shell\` capability has been fully removed — no part of the webview can spawn shells anymore. The headless apply-profile flow's marker file is now versioned (\`{ "v": 1, ... }\`) and chmod-0600 on Unix. Panic logs scrub usernames, MAC addresses, and serial numbers before writing — covered by 7 new unit tests. A release-readiness gate test refuses to compile a tagged release if \`EXPECTED_STORE_ID\` / \`EXPECTED_PRODUCT_ID\` in license.rs are still placeholder zeros.

**Bundle splitting + lazy routes.**
Route-level code splitting via a \`lazyNamed\` helper means the entry chunk only loads what the dashboard needs. Every other page hydrates on hover/focus via a preload map in the Sidebar — clicks feel instant, but the initial paint downloads ~40% less JS. Vendor chunks (recharts, framer-motion, etc.) split out separately so they cache independently across releases.

**Build chain caught up.**
Node pinned to 22.22.2 (Vite 8 needs ≥22.12). Three small clippy fixes shipped along the way (\`doc_lazy_continuation\`, \`iter_overeager_cloned\`). The \`cargo audit\` step now copies \`src-tauri/.cargo/audit.toml\` into \`$CARGO_HOME\` before running so the suppression list is honoured (cargo-audit v0.22+ no longer auto-discovers it). The 18-ID upstream-Tauri suppression list is now grouped + commented so it's easy to re-evaluate when Tauri bumps gtk-rs / replaces urlpattern.

No business-logic, route, IPC, store, or data-shape changes. Profiles, license keys, and settings carry over unchanged.
`,
  "2.2.1": `### FreshRig v2.2.1 — Agent definitions 🤖

Adds 6 GitHub Copilot agent definition files at the repo root (\`freshrig-docs-auditor.agent.md\`, \`freshrig-issue-fix.agent.md\`, \`freshrig-launch-audit.agent.md\`, \`freshrig-platform-parity.agent.md\`, \`freshrig-release-manager.agent.md\`, \`github-ci-monitor.agent.md\`). Each is a focused agent for one slice of the FreshRig contributor workflow (docs consistency, issue triage, launch audits, cross-platform parity, version-bump hygiene, CI triage).

No code, UI, or behaviour changes — pure contributor tooling. The auto-updater will skip past this release on the next check.
`,
  "2.2.0": `### FreshRig v2.2.0 — Cross-platform polish 🐧🍎

The first release where the Linux and macOS builds stop feeling like ports. Driver and app installs now work end-to-end on Ubuntu/Fedora/Arch/openSUSE, the type renders with native fonts on every OS, and there's finally a single source of truth for which features work where.

**Linux drivers — Ubuntu fix.**
Previously every NVIDIA driver install on Ubuntu failed because the catalog used the meta-package name \`nvidia-driver\`, which doesn't exist on Ubuntu (Ubuntu ships versioned packages like \`nvidia-driver-535\`). The Linux drivers module now special-cases Ubuntu derivatives via \`ubuntu-drivers install\`, which picks the right versioned package automatically. Plain Debian still uses \`nvidia-driver\` from non-free-firmware.

**Linux drivers + apps — pkexec pre-flight + index refresh.**
Both flows now probe \`pkexec\` once and surface a clear "install policykit" message if it isn't on PATH, instead of failing 12 times with "binary not found". They also run the package manager refresh (\`apt-get update\` / \`dnf check-update --refresh\` / \`pacman -Sy\` / \`zypper refresh\`) once per batch, so a freshly booted system doesn't get "Unable to locate package…" before the first install even tries.

**Linux apps — Flathub setup + classic snaps.**
The first flatpak in a batch now lazily configures the \`flathub\` remote at user scope (no extra polkit prompt). Snap installs of classic-confined apps (VS Code, Discord, Slack, Spotify, IntelliJ, etc.) now pass \`--classic\` automatically. Apt installs are wrapped with \`env DEBIAN_FRONTEND=noninteractive\` so they don't hang on dpkg conf-file prompts when pkexec scrubs the parent environment. The install loop got an \`InstallPlan\` enum refactor — separating "what we're going to do" from "how we argv it" — so the next person adding a package manager only edits two functions.

**macOS apps — \`brew update\` once.**
The install loop now runs \`brew update\` once before iterating, so renamed formulae don't fail with "No formula with name X". Per-app installs still set \`HOMEBREW_NO_AUTO_UPDATE=1\` so each step is fast.

**Cross-OS visual polish.**
The font stack now falls through Windows → macOS → Linux native UI fonts: Segoe UI Variable, then \`-apple-system\` / \`BlinkMacSystemFont\`, then Inter / Ubuntu / Cantarell / Noto Sans / DejaVu Sans, then \`system-ui\`. Type density and weight now feel native on every distro/DE. Custom thin scrollbars (\`::-webkit-scrollbar\` + Firefox \`scrollbar-color\`) replace the GTK-themed defaults that looked incongruous on the dark UI. Backdrop-blur falls back to a solid card fill via \`@supports\` on older webkit2gtk versions where the property is a no-op.

**New \`get_platform_info\` Tauri command.**
A small cross-platform command exposing OS, arch, distro id + family, detected package managers, and elevation availability. Single source of truth for finer-grained UI gating than \`usePlatform\`'s os-only check. Frontend wiring lands incrementally — the data is exposed; consumers come in v2.3.

**New \`docs/PLATFORM_PARITY.md\`.**
Living parity table documenting every Tauri command's status per OS (Full / Partial / Stub / Missing), with a frontend gating contract, a "how to add a platform-aware command" guide, and a manual smoke checklist per distro. Updating it is part of "done" for any backend command change.

**Cross-OS unit tests.**
Pure-logic parsers (\`parse_os_release\`, \`split_pci_blocks\`, \`detect_vendor\`) now have \`#[cfg(test)] mod tests\` with fixture data — these compile without GTK/WebKit and run on every CI matrix leg.

No breaking changes. Auto-updater pulls v2.2.0 for v2.1.x users on their next check.

Known gaps still tracked: license activation on Linux/macOS (commands::license is still Windows-gated), profiles CRUD on Linux/macOS, and the macOS Privacy app-permissions list (TCC.db needs Full Disk Access entitlement we don't have in unsigned builds).
`,
  "2.1.0": `### FreshRig v2.1.0 — UI polish line ✨

The app's first dedicated polish release. Every page got a tighter design system, the dashboard learned to feel like a real tool, and a fresh primitive library makes future features cheaper to build.

**New dashboard.**
The old "header + 5 cards" layout is gone. The new dashboard opens with a hero strip — your hostname, a one-line health verdict, three context-aware quick actions, an XL animated health ring, and a system nameplate (motherboard, OS, CPU, RAM, network status) — followed by a live-metrics strip with sparkline-equipped chips for CPU, RAM, storage, network, and primary disk. An action strip surfaces driver issues only when there's something to act on (otherwise it disappears entirely). The hardware grid stays familiar: GPU, Storage, Network, Motherboard, Audio.

**Token system v2.1.**
Pre-mixed status alphas (\`bg-success-soft\`, \`bg-warning-rim\`) so usage is one class instead of \`bg-warning/10\`. New typography scale, a \`shadow-glow\` token for hover states, a \`shimmer\` keyframe for premium loading skeletons, and a \`prefers-reduced-motion\` blanket override that respects users who disable animation.

**Seven new primitives.**
\`PageShell\`, \`StatusPill\`, \`DataRow\`, \`SectionHeader\`, \`HealthRing\` (4 sizes, animated stroke), \`MetricChip\` (with sparkline support), and \`Drawer\` (right-side slide panel for "click for details" affordance). Plus refined \`Card\` (\`default\` / \`elevated\` / \`glass\` / \`hero\` variants, glow on \`interactive\`) and \`Button\` (added \`danger\` variant + \`lg\` size).

**Drivers page polished as the first PageShell adoption.**
Cleaner header, \`StatusPill\` for the recommendation count, shimmer skeletons replacing flat pulse, success empty-state instead of grey "no recommendations".

**Repo hygiene.**
Added \`.gitattributes\` (\`* text=auto eol=lf\`) — ends the CRLF/LF noisy-diff problem we hit through the v2.0 cycle. \`AboutPage\`, \`site/index.html\` JSON-LD schema, and CLAUDE.md were carrying stale v1.0 pricing copy ("$39 one-time", "14-day trial"); refreshed all three to reflect the v2.0 subscription reality.

The remaining 13 pages still use their pre-v2.1 inline scaffolding. They'll be migrated to PageShell incrementally — no breaking changes, just gradual polish. The new DriversPage demonstrates the migration pattern.

No breaking changes. Auto-updater pulls v2.1.0 for v2.0.x users on their next check.
`,
  "2.0.2": `### FreshRig v2.0.2 — CI hygiene 🧹

This is a maintenance release. No user-facing changes — just CI plumbing cleanups so future contributors don't trip on the same lints we did.

- **CI clippy fixes** — 35 lint sites cleaned up across the Linux command modules and watchdog.rs (Rust 1.95 added stricter \`unnecessary_sort_by\`, \`useless_format\`, \`collapsible_if\`, and \`trim_split_whitespace\` rules). Linux build is now clippy-clean for the first time in 10+ commits.
- **Windows-only modules properly cfg-gated** — \`data::app_catalog\`, \`data::debloat_tweaks\`, \`models::{context_menu, custom_apps, debloat, profiles}\` are now \`#[cfg(target_os = "windows")]\` at module declaration, eliminating dead-code warnings on Linux builds.
- **SBOM step robust against cargo-cyclonedx flag churn** — cargo-cyclonedx removed \`--output-file\` and has renamed its replacement a few times. The SBOM step now relies on the tool's default output behavior (writes to the manifest directory) and glob-moves the result to the expected name.
- **Release workflow gained \`workflow_dispatch\`** — when GitHub Actions silently drops a tag-trigger event (which happened to v2.0.1), you can now re-run the release from the Actions UI by entering the tag name, no force-push tag dance required.

Auto-updater will pull this for everyone on v2.0.0 / v2.0.1 within their normal check window.
`,
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
