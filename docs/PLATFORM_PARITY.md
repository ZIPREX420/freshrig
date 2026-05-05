# Platform parity

This is the living source of truth for which Tauri commands work on which
OS. Updating it is part of "done" for any change that adds or modifies a
backend command. Frontend components consult `usePlatform()` and the new
`get_platform_info` command to gate UI affordances; the table below tells
contributors what to gate.

## Status legend

- **Full** — the command works the same way as on Windows for the same
  user-facing outcome.
- **Partial** — the command exists and does something useful, but
  capabilities differ from Windows (documented in the notes).
- **Stub** — the command exists for ABI symmetry but returns empty/error.
  Frontend should hide or disable the affordance.
- **Missing** — the command isn't registered for this OS. Calling
  `invoke()` will throw "command not found".

## Table

| Command (group)                                    | Windows | Linux       | macOS       | Notes |
| -------------------------------------------------- | ------- | ----------- | ----------- | ----- |
| `get_platform_info`                                | Full    | Full        | Full        | Cross-platform OS facts. New in v2.2 — exposes distro family + package managers + elevation availability. |
| `get_hardware_summary`                             | Full    | Full        | Full        | WMI / `/proc` + lspci / `system_profiler`. |
| `get_driver_issues`                                | Full    | Full        | Full        | Win=`Get-PnpDevice`; Linux=`lspci -k`; macOS reports kernel-extension issues. |
| `get_windows_build`                                | Full    | Full (stub) | Full (stub) | Linux/macOS return distro string. |
| **License** |
| `get_machine_fingerprint`                          | Full    | **Missing** | **Missing** | Module is `#[cfg(target_os = "windows")]`. **Pro activation does not work outside Windows.** Tracking issue: see PLATFORM_PARITY follow-ups. |
| `activate_license` / `validate_license`            | Full    | **Missing** | **Missing** | Same. |
| **Drivers** |
| `get_driver_recommendations`                       | Full    | Full        | Partial     | macOS surfaces a single "Software Update" entry when `softwareupdate --list` shows Driver/Firmware updates. |
| `install_driver`                                   | Full    | Full        | Stub        | macOS returns an error pointing the user at System Settings; frontend should route via `installAction.value` (DirectDownload URL) instead. **Linux:** prefers `ubuntu-drivers install` on Ubuntu derivatives; refreshes the package index before install. |
| **Apps** |
| `get_app_catalog`                                  | Full    | Full        | Full        | Catalogs are *separate per OS* — IDs differ (winget format vs short-name vs cask name). Don't try to share IDs across OSes. |
| `install_apps`                                     | Full    | Full        | Full        | Linux: pkexec + apt/dnf/pacman/zypper, with Flatpak + Snap fallback (`--classic` for known classic snaps). macOS: brew formulae + casks. |
| `get_free_disk_space_gb`, `check_network_connectivity`, `check_winget_available` | Full | Full | Full | "winget available" on Linux means any package manager is on PATH; on macOS it means brew is installed. |
| **Profiles** |
| `save_profile` / `load_profile` / `list_profiles` etc. | Full | **Missing** | **Missing** | Module is Windows-gated. Cross-platform `profile_sync` (encrypted import/export) does work. |
| `export_profile_encrypted` / `import_profile_encrypted` / `detect_cloud_synced_profiles` | Full | Full | Full | age 0.11 + scrypt passphrase. |
| **Startup** |
| `get_startup_entries` / `toggle_startup_entry`     | Full    | Full        | Full        | Win=`StartupApproved` registry; Linux=XDG autostart + systemd user units; macOS=LaunchAgents + Login Items. |
| **Cleanup** |
| `scan_cleanup` / `run_cleanup`                     | Full    | Full        | Full        | Different category sets per OS (e.g. macOS adds "Xcode DerivedData" + "iOS Simulator caches"; Linux adds "package manager cache"). |
| **Privacy** |
| `get_privacy_settings` / `apply_privacy_setting`   | Full    | Partial     | Partial     | Linux subset: apport, whoopsie, popularity-contest, firewall, auto-update. macOS: SIP/Gatekeeper/FileVault are read-only (Recovery Mode required), firewall + ad tracking writeable. |
| `get_app_permissions` / `revoke_app_permission`    | Full    | Partial     | **Stub**    | Linux: Flatpak permission audit. macOS: TCC database needs Full Disk Access entitlement we don't have in unsigned builds — returns empty. Frontend shows an empty state. |
| `create_privacy_baseline` / `check_privacy_drift` etc. | Full | **Missing** | **Missing** | Privacy drift snapshots Windows registry keys; no Linux/macOS analog wired yet. |
| **Network** |
| `network_reset_dns` / `network_reset_full`         | Full    | Full        | Full        | Linux: resolvectl/systemd-resolved/nscd; macOS: `dscacheutil` + `mDNSResponder`. |
| `set_dns_servers` / `get_network_interfaces`       | Full    | Full        | Full        | macOS uses `networksetup`; Linux uses systemd-resolved drop-in or `nmcli`. |
| `get_wifi_passwords`                               | Full    | Partial     | Partial     | macOS triggers a Keychain GUI prompt per call (unavoidable). Linux reads `/etc/NetworkManager/system-connections/` (root only). |
| **Services** |
| `get_services` / `set_service_start_type`          | Full    | Full        | Full        | Linux=`systemctl`; macOS=`launchctl`. Both restrict a `NEVER_DISABLE` set (windowserver, dbus, polkit, etc.). |
| `get_service_presets` / `apply_service_preset`     | Full    | Full        | Full        | Same preset names per OS but unit lists differ. |
| **Smart Disk Monitoring** (cross-platform module) |
| `read_smart_data` / `save_smart_history` / `get_smart_trend` / `enable_smart_schedule` | Full | Full | Full | Wraps `smartctl -a -j`; same JSON shape across OSes. Frontend `check_smartctl_available` returns `false` on systems without the tool. |
| **Watchdog** (cross-platform module) |
| `take_snapshot` / `list_snapshots` / `delete_snapshot` / `diff_snapshots` | Full | Full | Full | Snapshots system state (apps, services, drivers, hosts file, etc.) into a SQLite DB. |
| **Branding / Bulk-deploy / Fleet / Integrations** | Full | Full | Full | Pure cross-platform Rust — no OS-specific syscalls. |
| **Windows-only** |
| `search_winget_packages` / `get_winget_package_info` | Full  | **Missing** | **Missing** | winget is Windows-specific. |
| `get_installed_apps` / `check_apps_installed`      | Full    | **Missing** | **Missing** | Reads `Uninstall` registry keys. Linux equivalent would need `dpkg-query` / `rpm -qa` — out of scope for v2.x. |
| `get_debloat_tweaks` / `apply_debloat_tweaks` etc. | Full    | **Missing** | **Missing** | Win11 telemetry/Cortana tweaks — no analog. |
| `get_classic_menu_status` / `toggle_classic_menu`  | Full    | **Missing** | **Missing** | Explorer-specific. |
| `get_shell_extensions` / `toggle_shell_extension`  | Full    | **Missing** | **Missing** | Explorer-specific. |
| `get_custom_apps` / `save_custom_app` / etc.       | Full    | **Missing** | **Missing** | Could become cross-platform if we add a Linux/macOS portable executable picker. |

## Frontend gating contract

The Sidebar already filters items via the `windowsOnly` flag in
`navGroups[]`. As of v2.2 the frontend additionally consumes
`get_platform_info` to drive finer gating:

- Hide the "Install" button on the Drivers page when
  `platformInfo.elevation_available === false` and show "Elevation not
  available — install `pkexec`" instead.
- Hide "Pro" CTAs on Linux/macOS until license activation is wired up
  cross-platform (tracking).
- Show distro-specific copy: e.g. "Apt is rebuilding its cache…" instead
  of "Updating package index…" on Debian-family.

## How to add a new platform-aware command

1. Define the model in `src-tauri/src/models/<feature>.rs` — must derive
   `Serialize + Deserialize` and use `#[serde(rename_all = "camelCase")]`.
2. Implement Windows in `src-tauri/src/commands/<feature>.rs`.
3. Implement Linux in `src-tauri/src/commands/linux/<feature>.rs`.
4. Implement macOS in `src-tauri/src/commands/macos/<feature>.rs`.
5. Register all three in `src-tauri/src/lib.rs`'s `generate_handler!`
   block, each behind a `#[cfg(target_os = "...")]` attribute. They
   share the same command name — the frontend's `invoke('command_name')`
   resolves to whichever twin compiled in.
6. Add the row to this doc with the right status per OS.
7. Add unit tests for parsing helpers — Linux modules that interpret
   text output (lspci, lsblk, systemctl, /proc, …) should have a
   `#[cfg(test)] mod tests` with fixture strings, since these compile
   without GTK and run on every CI matrix leg.

## How to gate UI on capability

In TS:

```ts
import { invoke } from "@tauri-apps/api/core";

// At app init — cache for the session.
const platform = await invoke<PlatformInfo>("get_platform_info");

// Use it.
if (!platform.elevationAvailable) {
  // Disable Install buttons; show "elevation unreachable" hint.
}
if (platform.os === "linux" && !platform.packageManagers.includes("flatpak")) {
  // Disable apps that only have a flatpak binding.
}
```

Don't call `get_platform_info` on every render — fetch once and keep in a
zustand store or React context.

## Testing strategy

- **Unit tests** at the parser level (text → struct). These compile
  without GTK/WebKit and run on every CI leg. See
  `commands/linux/drivers.rs::tests` for the pattern.
- **Integration tests** are not run in CI today because they need a
  display + actual system services. Manual smoke-test checklist below.

## Manual smoke-test checklist (per OS)

### Linux (Ubuntu 24.04)

- [ ] `apt list --installed | grep policykit` — confirm pkexec present.
- [ ] Drivers page lists at least one GPU.
- [ ] Click "Install" on NVIDIA / AMD / Intel — polkit dialog appears.
- [ ] Apps page: install Firefox (apt), Brave (flatpak fallback), Discord (snap classic).
- [ ] Cleanup: scan, run, observe disk space change.
- [ ] Settings → check accent picker, verify scrollbars are thin.

### Linux (Fedora 41)

- [ ] Drivers page: Install AMD → `dnf install -y mesa-vulkan-drivers` runs.
- [ ] Apps page: install GIMP (dnf), Spotify (flatpak).
- [ ] Verify `dnf check-update` exit-100 is treated as success.

### Linux (Arch)

- [ ] Drivers page: NVIDIA install runs `pacman -S --noconfirm --needed nvidia`.
- [ ] Apps page: install Firefox (pacman), Discord (flatpak fallback if no pacman binding).

### macOS (Apple Silicon)

- [ ] Brew detected at `/opt/homebrew/bin/brew`.
- [ ] Drivers page: shows "Software Update" entry when `softwareupdate --list` reports updates.
- [ ] Apps page: install VLC (cask), htop (formula). `brew update` runs once at start.
- [ ] Privacy page: SIP/Gatekeeper/FileVault rows are read-only.

### macOS (Intel)

- [ ] Brew detected at `/usr/local/bin/brew`.
- [ ] Hardware page: CPU/GPU/RAM populates from `system_profiler`.
- [ ] Cleanup: Xcode DerivedData category present.
