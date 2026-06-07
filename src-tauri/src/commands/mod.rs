// Cross-platform modules — always compiled on every OS.
pub mod branding;
pub mod bulk_deploy;
pub mod fleet;
pub mod integrations;
// License — LemonSqueezy activation. Cross-platform as of v2.6: the machine
// fingerprint has Windows/Linux/macOS implementations in license.rs.
pub mod license;
pub mod platform_info;
pub mod presets;
pub mod profile_sync;
pub mod secrets;
pub mod smart_monitor;
pub mod watchdog;

// Linux-only subtree — mirrors the Windows-command surface so
// `tauri::generate_handler!` can register the same command names on either
// OS. Gated at the `pub mod` declaration, so Windows builds don't see a
// single file under `linux/`.
#[cfg(target_os = "linux")]
pub mod linux;

// macOS-only subtree — same pattern as `linux/`, but every command body is
// a stub returning `Err("macOS support coming soon".into())` until real
// implementations land. The frontend hides the same pages it hides on Linux
// (Optimize, Context Menu) via `usePlatform().isWindows`.
#[cfg(target_os = "macos")]
pub mod macos;

// Windows-only modules — bodies rely on WMI, registry, winget, shell
// extensions, or other Win32-specific APIs. Linux equivalents live under
// `commands::linux::*`; the frontend hides the corresponding pages behind
// `usePlatform().isWindows` on Linux when a feature has no equivalent.
#[cfg(target_os = "windows")]
pub mod apps;
#[cfg(target_os = "windows")]
pub mod cleanup;
#[cfg(target_os = "windows")]
pub mod context_menu;
#[cfg(target_os = "windows")]
pub mod custom_apps;
#[cfg(target_os = "windows")]
pub mod debloat;
#[cfg(target_os = "windows")]
pub mod drivers;
#[cfg(target_os = "windows")]
pub mod hardware;
#[cfg(target_os = "windows")]
pub mod installed_apps;
#[cfg(target_os = "windows")]
pub mod network;
#[cfg(target_os = "windows")]
pub mod privacy;
#[cfg(target_os = "windows")]
pub mod privacy_drift;
#[cfg(target_os = "windows")]
pub mod profiles;
#[cfg(target_os = "windows")]
pub mod report;
#[cfg(target_os = "windows")]
pub mod services;
#[cfg(target_os = "windows")]
pub mod startup;
#[cfg(target_os = "windows")]
pub mod winget_search;
#[cfg(target_os = "windows")]
pub mod wmi_util;
