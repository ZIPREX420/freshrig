# FreshRig — Project Context for Claude Code

## What this project is
FreshRig is a cross-platform desktop app (Tauri v2 + React + TypeScript) at `C:\Users\Seppe\Desktop\PROJECTS\FreshRig` that combines hardware detection, driver recommendations, app batch installation, and system optimization into one tool. Runs natively on Windows (winget), Linux (apt/dnf/pacman/zypper/Flatpak), and macOS (Homebrew). Target audience: gamers, developers, PC enthusiasts.

## Tech stack
- Frontend: React 19, TypeScript, Tailwind CSS v4, Zustand, Lucide React
- Backend: Rust (Tauri v2) with platform abstraction at `src-tauri/src/platform/` — `wmi` crate on Windows, `/proc` + `lspci` + `procfs` on Linux, `system_profiler` + `sysctl` + `plist` on macOS
- Build: Vite, npm

## Project structure
- `src/` — React frontend
- `src-tauri/src/` — Rust backend (Tauri commands in `lib.rs`)
- `src/components/` — React components organized by feature
- `src/stores/` — Zustand stores
- `src/types/` — TypeScript type definitions
- `src/config/` — App constants (`app.ts`)

## Key patterns & Requirements
- **App Config:** Never hardcode "FreshRig" in UI code — always use `src/config/app.ts`. Current version: **2.4.2**. `PRO_PURCHASE_URL`, `PRO_PRICE_LABEL`, `TRIAL_DAYS` also live in `app.ts`.
- **Tauri IPC:** Frontend calls `invoke('command_name')`, backend uses `#[tauri::command]` in `src-tauri/src/lib.rs`.
- **Rust ↔ TS:** Rust uses snake_case, TypeScript uses camelCase — Tauri auto-converts field names.
- **Hardware data:** All hardware info comes from WMI queries via the `wmi` crate (v0.18+, `WMIConnection::new()` takes 0 args). WMI queries have 5-second timeouts to avoid hangs.
- **Winget:** ALL winget commands MUST wrap with: `cmd /C "chcp 65001 >nul && winget ..."` (encoding fix). Uses JSON output mode with automatic table-parsing fallback for older Windows versions.
- **Process spawning:** Never call `Command::new("cmd")` or `Command::new("powershell")` directly. Always use `crate::util::silent_cmd()`, which sets `CREATE_NO_WINDOW` (0x08000000) on Windows so background processes don't flash console windows. The helper lives at `src-tauri/src/util.rs` and is a no-op on non-Windows.
- **Design tokens:** Dark theme only — tokens defined in `src/styles.css` @theme block.
- **Serialization:** All Rust models use `#[serde(default)]` on fields for forward compatibility.
- **Storage:** Settings via `tauri-plugin-store` (`settings.json`). Profiles in `%APPDATA%/com.freshrig.app/profiles/` (or portable data dir).
- **Debloat Tiers:** Safe → Moderate → Expert (type: `TweakTier = "safe" | "moderate" | "expert"`).
- **Pre-flight checks:** Disk space (`get_free_disk_space_gb`) and network connectivity (`check_network_connectivity`) are checked before batch installs.
- **Always elevated:** App embeds a Windows manifest (`src-tauri/windows-app-manifest.xml`) with `requireAdministrator` via `tauri_build::WindowsAttributes::app_manifest()` in `build.rs`. The manifest is embedded ONLY for release builds (`PROFILE=release`), so `npm run tauri dev` does NOT trigger UAC — only `npm run tauri build` output does. The Common-Controls v6 dependency in the manifest is mandatory — without it Tauri's dialog APIs crash. Do NOT use `embed-resource` — it causes CVT1100 duplicate-resource linker errors with Tauri v2.
- **Driver installs:** `DriverInstallAction` is a tagged enum (`Winget(String) | DirectDownload(String)`). NVIDIA and AMD GPUs route to `DirectDownload` because the NVIDIA App has no winget package and GeForce Experience is deprecated; Intel GPU/network devices use the `Intel.DriverSupportAssistant` winget id. The frontend shows a "Open download page" fallback button when a winget install fails with a hash-mismatch error.
- **Theming:** 6 accent presets via `data-accent` attribute on `<html>`. CSS vars in `src/styles.css`. Store in `settingsStore`. FOUC prevented by inline script in `index.html` that reads `localStorage["freshrig-settings"]` and sets the attribute before React mounts.
- **Animations:** `MotionConfig` at app root with spring `{ stiffness: 380, damping: 30, mass: 0.8 }`. Page transitions use `AnimatePresence mode="wait"`. Import from `"framer-motion"` (package name, even though the library was renamed to `"motion"`).
- **Startup Manager:** `StartupApproved` binary format: `byte[0]` `0x02`=enabled (`0x06` also enabled), `0x03`=disabled; `bytes[4..12]`=FILETIME of the toggle. Protected items: `SecurityHealth`, `Windows Defender`, `explorer` (case-insensitive substring match in `is_protected`).
- **Pro License Testing:** Test keys must match format `FR-XXXXX-XXXXX` where X is uppercase A-Z or 0-9. Example test key: `FR-TEST1-KEY01`. The old lowercase "FR-xxxxx" format no longer validates.
- **Pro Features (v2.4):** Pro features gated by `ProFeatureGate` (`src/components/ui/ProFeatureGate.tsx`, modes: `overlay | blur | badge | hide`). Subscription pricing: Pro $5.99/mo or $49/yr, Business $14.99/mo or $149/yr per technician, plus a Founder's Lifetime offer at $149 one-time (first 500 customers / 30-day window) — see constants in `src/config/app.ts`. Non-Pro users see an upsell linking to `PRO_PURCHASE_URL` (currently aliased to `PRICING_PAGE_URL` while LemonSqueezy is being set up — pre-launch mode). The Pro commands registered in `lib.rs`:
  - **Disk Cleanup** — `commands::cleanup::scan_cleanup`, `commands::cleanup::run_cleanup`
  - **Privacy Dashboard** — `commands::privacy::get_privacy_settings`, `get_app_permissions`, `apply_privacy_setting`, `revoke_app_permission`
  - **Network Tools** — `commands::network::network_reset_dns`, `network_reset_full`, `set_dns_servers`, `get_network_interfaces`, `get_wifi_passwords`
  - **Services Manager** — `commands::services::get_services`, `set_service_start_type`, `get_service_presets`, `apply_service_preset`
  - **Context Menu Editor** — `commands::context_menu::get_classic_menu_status`, `toggle_classic_menu`, `get_shell_extensions`, `toggle_shell_extension`
  - **System Health Report** — `commands::report::generate_health_report`
- **LemonSqueezy Licensing:** `commands::license::get_machine_fingerprint` (SHA-256 of MachineGuid + CPU ID + SMBIOS UUID), `activate_license` → `POST https://api.lemonsqueezy.com/v1/licenses/activate` (form-urlencoded), `validate_license` → `POST /v1/licenses/validate`. Frontend runs 6-hour revalidation tick from `App.tsx` with 14-day grace on network failure. `EXPECTED_STORE_ID` / `EXPECTED_PRODUCT_ID` in `src-tauri/src/commands/license.rs` must be filled before first real sale — when `0`, store/product match is skipped (dev-friendly).
- **Trial mode:** `useLicenseStore.startTrial()` sets `trialStartedAt` and grants Pro access locally for `TRIAL_DAYS` (7 days as of v2.0+; was 14 in v1.x). `isPro()` returns true if tier is "pro" OR trial is still within the window. Trial can only be started once per install; after expiry, user must purchase. No credit card is required to start the trial.
- **SMART data:** Drive health comes from `Get-PhysicalDisk` + `Get-StorageReliabilityCounter` in `ROOT\Microsoft\Windows\Storage` WMI namespace via PowerShell wrapped with `silent_cmd`. Fields are `Option<T>` because older SATA and USB-attached drives may not populate the counter. Derivation: `Wear >= 90` or predict-failure → "Fail"; `Wear >= 70` or temp >= 60°C → "Warning"; else "OK".
- **Privacy ConsentStore path encoding:** Registry path `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\<capability>\NonPackaged\<path>` uses `#` to encode `\` in the Win32 path (e.g. `C:#Program Files#App#app.exe`). The `privacy::get_app_permissions` helper decodes `#` → `\` when parsing app paths.
- **FILETIME epoch delta:** Windows FILETIME is 100-ns intervals since 1601-01-01 UTC. Unix epoch delta = `11_644_473_600` seconds. Used in `startup.rs` when parsing `StartupApproved` `bytes[4..12]`.
- **Build fingerprint:** `BUILD_FINGERPRINT` in `src/config/app.ts` uses a `__BUILD_TIMESTAMP__` constant injected by Vite (`define` in `vite.config.ts`) — it's baked in at build time, so all users on the same build report the same fingerprint. Declared in `src/vite-env.d.ts`.
- **Crash logs:** Panic handler scrubs usernames, MAC addresses, and serial numbers via regex before writing to `crash.log`.
- **SBOM:** CI generates CycloneDX SBOMs for both Rust and npm dependencies.

## Known upstream issues
- **Suppressed cargo audit findings:** 18 transitive RustSec advisories grouped into three families, all upstream-Tauri issues we cannot patch at our layer:
  - **gtk-rs 0.18 family (11 IDs)** — `RUSTSEC-2024-0411` … `0420` (atk, atk-sys, gdk, gdk-sys, gdkwayland-sys, gdkx11, gdkx11-sys, gtk, gtk-sys, gtk3-macros — unmaintained warnings) plus `RUSTSEC-2024-0429` (glib 0.18.5 unsoundness). Linux-only via Tauri's `wry` → `webkit2gtk` → gtk-rs 0.18; clears when Tauri bumps to gtk-rs 0.20+ (GTK4).
  - **unic-* family (5 IDs)** — `RUSTSEC-2025-0075`, `0080`, `0081`, `0098`, `0100` (unic-char-range, unic-common, unic-char-property, unic-ucd-version, unic-ucd-ident — unmaintained, all flagged 2025-10-18). Pulled via `urlpattern` → `tauri-utils`. Clears when Tauri replaces `urlpattern`.
  - **proc-macro-error 1.x (1 ID)** — `RUSTSEC-2024-0370` unmaintained. Build-script transitive, never in shipped binary.
  - **rand 0.7.3 (1 ID, currently no-op)** — `RUSTSEC-2026-0097` was firing via the kuchikiki path, which Tauri 2.11+ dropped. Kept as a defence in case a future dep tree change re-pulls it.

  Single source of truth: `src-tauri/.cargo/audit.toml`. CI copies that file to `$CARGO_HOME/audit.toml` before running `cargo audit` (cargo-audit v0.22+ only auto-discovers there — there is no `--config` flag). Re-evaluate when Tauri bumps gtk-rs and/or replaces `urlpattern`; both would shrink this list dramatically.

## Linux support
- Platform abstraction: `src-tauri/src/platform/` with `mod.rs`, `types.rs`, `windows.rs`, `linux.rs`.
- Linux deps (gated via `[target.'cfg(target_os = "linux")']` in `Cargo.toml`): `procfs`. Cross-platform top-level: `sysinfo`, `os_info`, `cfg-if`, `jwalk`, `trash`. `nix` lives under `[target.'cfg(unix)']` (shared with macOS).
- Linux hardware: `/proc/cpuinfo`, `/proc/meminfo`, `/sys/class/dmi/id`, `/sys/class/net`, `/sys/class/power_supply`, `lspci`, `lsblk -JO`, `smartctl -j`.
- Linux package managers: `apt-get`, `dnf`, `pacman`, `zypper`, `flatpak` — detected via `/etc/os-release` `ID_LIKE` (wrapped in `platform::current::get_distro_family()`).
- Linux services: `systemctl list-units --output=json` + `is-enabled` probe; same `ServiceStartType` enum as Windows.
- Linux startup: XDG autostart (`~/.config/autostart/*.desktop` + `/etc/xdg/autostart/`) and `systemctl --user` user units.
- Linux privacy: Flatpak permission audit via `flatpak info --show-permissions`, plus apport/whoopsie/popcon/firewall/auto-update toggles.
- Linux cleanup: `~/.cache/`, `/var/log/`, distro package cache, browser cache, trash, thumbnails — via `jwalk` + `trash`.
- Linux elevation: `pkexec` (polkit), never `sudo`. Matches the GUI-session expectation of Tauri apps.
- CI: matrix build on `ubuntu-22.04` + `windows-latest` (`.github/workflows/ci.yml`); macOS is intentionally omitted (see "macOS support" section below). Release on tag push produces `.exe`, `.deb`, `.rpm`, `.AppImage` (`.github/workflows/release.yml`); `.dmg` is gated behind macOS CI re-enable.
- Linux command tree: `src-tauri/src/commands/linux/` — parallel subtree mirroring the Windows command modules. `tauri::generate_handler!` entries in `lib.rs` cfg-gate a Windows twin, Linux twin, and macOS twin under the same command name so the frontend's `invoke()` calls are OS-agnostic.

## macOS support

> **CI builds are currently disabled** for macOS — the code is implemented behind `#[cfg(target_os = "macos")]` but `.github/workflows/ci.yml` and `.github/workflows/release.yml` no longer include `macos-latest` in their matrices. To re-enable:
> 1. Add `macos-latest` back to both workflow `platform:` matrices.
> 2. Restore the `Add macOS targets` step (`rustup target add aarch64-apple-darwin x86_64-apple-darwin`) in both workflows.
> 3. In `release.yml`, restore the matrix-conditional `args:` (`${{ matrix.platform == 'macos-latest' && '--target universal-apple-darwin' || '' }}`).
> 4. Configure these GitHub secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_TEAM_ID`.
> 5. In `release.yml`, restore the corresponding env vars in the `tauri-action` env block (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY: ${{ secrets.APPLE_API_KEY_ID }}`, `APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER_ID }}`, `APPLE_TEAM_ID`).

- Platform abstraction: `src-tauri/src/platform/macos.rs` (3 functions: `get_system_info`, `get_distro_family` → `"darwin"`, `is_admin`).
- macOS deps (gated via `[target.'cfg(target_os = "macos")']` in `Cargo.toml`): `plist`, `core-foundation`. Shared with Linux via `cfg(unix)`: `nix`. Cross-platform: `sysinfo`, `os_info`, `jwalk`, `trash`.
- macOS hardware: `system_profiler -json` (SPDisplaysDataType, SPNVMeDataType, SPSerialATADataType, SPAudioDataType, SPHardwareDataType, SPMemoryDataType, SPPowerDataType, SPApplicationsDataType), `sysctl` (hw.memsize, hw.physicalcpu, hw.logicalcpu, hw.cpufrequency_max, machdep.cpu.brand_string, hw.model, kern.boottime), `sw_vers`, `scutil --get ComputerName`, `networksetup -listallhardwareports`, `ifconfig` for connection status.
- macOS package manager: **Homebrew only** — `/opt/homebrew/bin/brew` (Apple Silicon) or `/usr/local/bin/brew` (Intel), detected via `commands::macos::util::brew_path()`. Sets `NONINTERACTIVE=1` and `HOMEBREW_NO_AUTO_UPDATE=1`. App catalog has 25 cask + formula mappings (cask: GUI bundle, formula: CLI tool).
- macOS services: `launchctl list` for enumeration (PID, status, label tab-separated). `launchctl print-disabled system` for the disabled-set probe. `launchctl enable/disable` + `launchctl bootstrap/bootout system /Library/LaunchDaemons/<label>.plist` for toggles. NEVER_DISABLE list protects `com.apple.WindowServer`, `loginwindow`, `coreduetd`, `opendirectoryd`, `securityd`, `notifyd`, plus anything starting with `com.apple.system.` or `com.apple.kernel.`.
- macOS startup: LaunchAgents `.plist` parsing via the `plist` crate from `~/Library/LaunchAgents/` (CurrentUser scope) and `/Library/LaunchAgents/` (AllUsers scope). Login Items via `osascript -e 'tell application "System Events" to get the name/path of every login item'`. ID-prefix routing: `launchagent:<plist-path>` vs `loginitem:<name>` so toggle commands reach the right backing store. Toggle for LaunchAgents: `defaults write <plist-without-extension> Disabled -bool <value>`. Toggle for Login Items: osascript `make new login item` / `delete login item`.
- macOS cleanup: `~/Library/Caches`, `~/Library/Logs`, Xcode DerivedData, `~/.Trash`, iOS Simulator caches, old downloads (90+ days), `/private/var/log` — via `jwalk`. Homebrew cache cleanup shells out to `brew cleanup -s --prune=all`. Excludes `Homebrew` subdir from the user_caches walk so the dedicated category handles it.
- macOS privacy: `csrutil status` (SIP), `spctl --status` (Gatekeeper), `fdesetup status` (FileVault), `defaults read /Library/Preferences/com.apple.alf globalstate` (firewall), `defaults read com.apple.AdLib forceLimitAdTracking` (ad tracking). Firewall + ad_tracking are writeable; SIP/Gatekeeper/FileVault require System Settings or Recovery Mode. TCC database parsing is out of scope (requires Full Disk Access entitlement) — `get_app_permissions` returns empty list.
- macOS network: `dscacheutil -flushcache && killall -HUP mDNSResponder` for DNS flush. `networksetup -listallhardwareports` for interface enumeration (Device → Hardware Port mapping for DNS commands). `networksetup -setdnsservers` for DNS preset switching. `security find-generic-password -wa <ssid>` for WiFi passwords (triggers a Keychain GUI prompt per call — unavoidable). `route get default | grep interface:` for the primary interface.
- macOS elevation: `osascript -e 'do shell script "..." with administrator privileges'` (NOT `sudo`, NOT `SMAppService`). Centralized in `commands::macos::util::run_elevated(shell_cmd)` which escapes backslashes + double-quotes. The first elevated call per session triggers a Touch ID / password GUI prompt; subsequent calls in the same osascript invocation reuse credentials.
- macOS code signing: Apple Developer ID + notarization via `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_TEAM_ID` GitHub Actions secrets. Empty until configured — build still succeeds unsigned, Gatekeeper warns end-users on first launch ("App can't be opened because Apple cannot check it for malicious software"). Right-click → Open bypasses the warning once.
- CI: macos-latest runs `rustup target add aarch64-apple-darwin x86_64-apple-darwin` then `cargo clippy -D warnings` + `cargo test`. Release leg runs `tauri-action` with `--target universal-apple-darwin` (matrix-conditional `args:` value) so the `.dmg` works on both M-series and Intel Macs.
- macOS command tree: `src-tauri/src/commands/macos/` — 12 files mirroring `commands::linux::*` (`util.rs`, `app_catalog.rs`, `apps.rs`, `cleanup.rs`, `drivers.rs`, `hardware.rs`, `network.rs`, `privacy.rs`, `report.rs`, `services.rs`, `startup.rs`). Shared helpers in `util.rs`: `run_cmd`/`run_cmd_lossy`/`which`/`home_dir`/`is_root`/`run_elevated`/`brew_path`. `commands::macos::report::ReportData` is duplicated locally (mirrors Linux pattern) so the frontend consumes identical JSON on every OS.

## Commands & Workflow
- `npm run tauri dev` — start development
- `npm run tauri build` — creates production NSIS installer in `src-tauri/target/release/bundle/nsis/`
- `cargo clippy --manifest-path src-tauri/Cargo.toml` — lint Rust code
- `npx tsc --noEmit` — type-check frontend
- `npx @tauri-apps/cli icon <source>` — regenerate all icon sizes from a source image
- **Mandatory validation after EVERY phase:**
  `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings && npx tsc --noEmit`
- **Git:** Commit each completed phase separately after successful validation.

## Code conventions
- **Rust:** Use `Result<T, String>` for Tauri commands, always handle WMI errors gracefully.
- **React:** Functional components only, hooks for state, no class components.
- **TypeScript:** Strict mode, no `any` types.
- **CSS:** Tailwind v4 utility classes referencing `@theme` design tokens (e.g., `bg-bg-card`, `text-accent`).

## Design Guidelines (v2.4 — Cyber/Hex)
The UI is a control-panel for power users — Discord meets HWiNFO meets Tron. Dark, neon-lit, hex-laden. NOT generic light-mode corporate SaaS.

**Palette (in `src/styles.css`).** Deep near-black bg (`#05060a` base, `#07080f` sidebar, `#0c0e16` cards). Dual-accent system: cyan `#00e5ff` for primary / safe / "go", magenta `#ff2bd6` for creative / Pro / commit. The 6 accent presets in Settings rotate the cyan slot only; magenta is preset-independent so the dual-identity always reads.

**Typography.** Segoe UI Variable on Windows, then `-apple-system` / `BlinkMacSystemFont`, then `Inter` / `Ubuntu` / `Cantarell` / `Noto Sans`. Body 14px. Section labels uppercase + letter-spacing `0.14–0.18em`. Monospace `Cascadia Code` for technical data only.

**Component vocabulary (v2.4 primitives — `src/components/ui/`).** Reach for these instead of building parallel implementations:
- **`<HexIcon>`** — pointy-top hex frame with cyan / magenta / gradient stroke + ambient glow + optional Tron-perspective floor inside. Sizes `sm` (32px) → `hero` (200px). Use for any "feature stamp" — sidebar status peg, action-tile thumbnail, page centerpiece.
- **`<HeroCTA>`** — full-width outlined neon pill with arrow. Use as the page-level CTA (one per surface). Cyan = primary safe, magenta = creative / commit. NOT for inline buttons — use `<Button>` for those.
- **`<ActionTile>`** + **`<ActionGrid>`** — equal-height rim-glow cards in 2 / 3 / 4-col responsive grids. Each tile = HexIcon + uppercase title + 1-2 line description + arrow. The standard "pick one of these flows" affordance.
- **`<HexStepper>`** — horizontal hex-shaped step indicator with connecting lines that fill cyan as the user advances. Use at the top of any multi-step flow (Quick Setup, Custom Setup wizard, future onboarding).
- **`<ProgressRing>`** — animated circular gauge with optional indeterminate scan rotation, accent-aware glow, 12 tick marks at 30°. Use for system score (Dashboard) and live scan progress (Quick Setup running state). For static health rings, the older `<HealthRing>` is still appropriate inside detail widgets.
- **`<SidebarSystemCard>`** — bottom-of-sidebar status card. `compact` = small hex + status label + last scan; `expanded` = full hardware spec list + DETAILS button.
- **`<PageBreadcrumb>`** — back arrow + uppercase current-page label + optional right slot. Goes at the top of every subpage. Pair with `PageShell` `title` slot — use one or the other.
- **`<NotificationBell>`** — title-bar widget with magenta unread-count dot.
- **`<CircuitBackdrop>`** — full-bleed deterministic SVG circuit-rain backdrop. Use for splash / welcome screens; pointer-events disabled so it never interferes.
- **`<BrandMark>`** + **`<BrandWordmark>`** — hex "FR" monogram and "FRESH"+magenta "RIG" wordmark. Always render together at hero scale; can use BrandMark alone in chrome.

**Layout patterns.**
- Hub-and-spoke navigation: Home / Quick Setup / Custom Setup / Profiles / Tools / Settings (+ Fleet for Business). 5–7 sidebar items max.
- Page bodies max-w-7xl mx-auto with consistent `p-8` from AppLayout. Subpage hero stacks: PageBreadcrumb → big hex centerpiece → uppercase title (`text-gradient-neon` for the headliner) → tagline → body content → HeroCTA.
- Action-tile grids prefer 3-up at desktop (lg breakpoint), 4-up only when content is naturally categorical (Dashboard's Quick / Custom / Import / Tools).
- Dashboard hero: 2-col `grid-cols-[1fr_auto]` — heading + verdict text on the left, big ProgressRing on the right.

**Animations.** `MotionConfig` spring `{ stiffness: 380, damping: 30, mass: 0.8 }` at app root. Page transitions use `AnimatePresence mode="wait"` with `duration: 0.15` opacity+y. Hex pulse on hero icons via `.animate-hex-pulse-cyan` / `.animate-hex-pulse-magenta`. Scan rotation via `.animate-scan-rotate`. Respect `prefers-reduced-motion` (already wired in styles.css).

**Density.** Show real technical data (clock speeds, VRAM, driver dates) — this audience wants details, not simplifications. But the home view (Dashboard) is intentionally spacious — detail lives one click away in Tools / Health Report.

**Icons.** Lucide React only. Stroke width 2 for inline (`w-4 h-4`), 2.5 for hex thumbnails (`w-7 h-7` in xl HexIcon).

## i18n (v2.4)
- Strings live in `src/i18n/index.ts` as a typed `TRANSLATIONS` dict. EN + NL out of the box. Adding a language: extend `Locale`, add a column to each entry, surface in the sidebar locale toggle.
- Use `const t = useT(); t("key.subkey")` in components. TypeScript enforces known keys at compile time.
- Falls through to English when a key is missing the active-locale entry.
- Per-page rollout strategy: wrap new pages first, backfill existing pages incrementally — don't try to translate everything at once.

## Release process
1. Bump version in 4 files: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json`, `src/config/app.ts`.
2. Run `cargo generate-lockfile --manifest-path src-tauri/Cargo.toml`.
3. Commit: `git commit -m "chore: release vX.Y.Z"`.
4. Tag & push: `git tag vX.Y.Z && git push origin main --tags`.
5. Pushing the tag triggers `.github/workflows/release.yml` which builds the NSIS installer and creates a draft GitHub release.

## GitHub infrastructure
- `.github/workflows/ci.yml` — CI on PR/push to main (tsc, clippy, fmt, test)
- `.github/workflows/release.yml` — Builds installer on tag push via tauri-action
- `.github/workflows/pages.yml` — Auto-deploys landing page to GitHub Pages
- `.github/ISSUE_TEMPLATE/` — Bug report and feature request forms
- `.github/dependabot.yml` — Weekly npm, cargo, and actions dependency updates
- `.github/release.yml` — Auto-categorized release notes
- `.github/FUNDING.yml` — GitHub Sponsors

## Slash commands
- `/project:release [patch|minor|major]` — Bump version, commit, and prepare tag.
- `/project:fix <issue-number>` — Read a GitHub issue and implement a fix.
- `/project:feature <description>` — Create a feature branch and implement.
