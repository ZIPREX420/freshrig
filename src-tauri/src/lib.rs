// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
mod commands;
mod data;
mod db;
mod models;
mod platform;
pub mod portable;
mod util;

// Re-exports for headless CLI entry points called from main.rs.
pub use commands::smart_monitor::run_headless_smart_check;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Scrub sensitive data from crash log messages before writing to disk.
fn scrub_sensitive_data(input: &str) -> String {
    use regex::Regex;
    let mut result = input.to_string();
    // Scrub Windows user paths: C:\Users\<username>\ → C:\Users\<USER>\
    if let Ok(re) = Regex::new(r"(?i)C:\\Users\\[^\\]+\\") {
        result = re.replace_all(&result, r"C:\Users\<USER>\").to_string();
    }
    // Scrub MAC addresses (XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX)
    if let Ok(re) = Regex::new(r"([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}") {
        result = re.replace_all(&result, "<MAC_REDACTED>").to_string();
    }
    // Scrub serial-like hex strings (20+ hex chars to avoid matching backtrace addresses)
    if let Ok(re) = Regex::new(r"\b[0-9A-Fa-f]{20,}\b") {
        result = re.replace_all(&result, "<SERIAL_REDACTED>").to_string();
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Panic hook — write crash log (scrubbed of sensitive data)
    std::panic::set_hook(Box::new(|info| {
        let msg = scrub_sensitive_data(&format!("PANIC: {}", info));
        eprintln!("{}", msg);
        let log_path = portable::get_data_dir().join("crash.log");
        let _ = std::fs::write(&log_path, &msg);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // System tray
            let show_item = MenuItem::with_id(app, "show", "Show FreshRig", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let scan_item = MenuItem::with_id(app, "scan", "Quick Scan", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &sep1, &scan_item, &sep2, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app_handle: &AppHandle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_handle = tray.app_handle();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Cross-platform commands (always registered):
            commands::presets::get_presets,
            portable::check_portable_mode,
            // SMART Disk Monitoring (cross-platform via smartctl). v2.0 Feature 4.
            commands::smart_monitor::check_smartctl_available,
            commands::smart_monitor::get_smart_install_command,
            commands::smart_monitor::read_smart_data,
            commands::smart_monitor::save_smart_history,
            commands::smart_monitor::get_smart_trend,
            commands::smart_monitor::enable_smart_schedule,
            // Windows-only commands (Linux + macOS twins below each entry):
            #[cfg(target_os = "windows")]
            commands::hardware::get_hardware_summary,
            #[cfg(target_os = "linux")]
            commands::linux::hardware::get_hardware_summary,
            #[cfg(target_os = "macos")]
            commands::macos::hardware::get_hardware_summary,
            #[cfg(target_os = "windows")]
            commands::hardware::get_driver_issues,
            #[cfg(target_os = "linux")]
            commands::linux::hardware::get_driver_issues,
            #[cfg(target_os = "macos")]
            commands::macos::hardware::get_driver_issues,
            #[cfg(target_os = "windows")]
            commands::hardware::get_windows_build,
            #[cfg(target_os = "linux")]
            commands::linux::hardware::get_windows_build,
            #[cfg(target_os = "macos")]
            commands::macos::hardware::get_windows_build,
            #[cfg(target_os = "windows")]
            commands::license::get_machine_fingerprint,
            #[cfg(target_os = "windows")]
            commands::license::activate_license,
            #[cfg(target_os = "windows")]
            commands::license::validate_license,
            #[cfg(target_os = "windows")]
            commands::drivers::get_driver_recommendations,
            #[cfg(target_os = "linux")]
            commands::linux::drivers::get_driver_recommendations,
            #[cfg(target_os = "macos")]
            commands::macos::drivers::get_driver_recommendations,
            #[cfg(target_os = "windows")]
            commands::drivers::install_driver,
            #[cfg(target_os = "linux")]
            commands::linux::drivers::install_driver,
            #[cfg(target_os = "macos")]
            commands::macos::drivers::install_driver,
            #[cfg(target_os = "windows")]
            commands::apps::get_app_catalog,
            #[cfg(target_os = "linux")]
            commands::linux::apps::get_app_catalog,
            #[cfg(target_os = "macos")]
            commands::macos::apps::get_app_catalog,
            #[cfg(target_os = "windows")]
            commands::apps::get_free_disk_space_gb,
            #[cfg(target_os = "linux")]
            commands::linux::apps::get_free_disk_space_gb,
            #[cfg(target_os = "macos")]
            commands::macos::apps::get_free_disk_space_gb,
            #[cfg(target_os = "windows")]
            commands::apps::check_network_connectivity,
            #[cfg(target_os = "linux")]
            commands::linux::apps::check_network_connectivity,
            #[cfg(target_os = "macos")]
            commands::macos::apps::check_network_connectivity,
            #[cfg(target_os = "windows")]
            commands::apps::check_winget_available,
            #[cfg(target_os = "linux")]
            commands::linux::apps::check_winget_available,
            #[cfg(target_os = "macos")]
            commands::macos::apps::check_winget_available,
            #[cfg(target_os = "windows")]
            commands::apps::install_apps,
            #[cfg(target_os = "linux")]
            commands::linux::apps::install_apps,
            #[cfg(target_os = "macos")]
            commands::macos::apps::install_apps,
            #[cfg(target_os = "windows")]
            commands::profiles::save_profile,
            #[cfg(target_os = "windows")]
            commands::profiles::load_profile,
            #[cfg(target_os = "windows")]
            commands::profiles::list_profiles,
            #[cfg(target_os = "windows")]
            commands::profiles::delete_profile,
            #[cfg(target_os = "windows")]
            commands::profiles::export_profile_to_file,
            #[cfg(target_os = "windows")]
            commands::profiles::import_profile_from_file,
            #[cfg(target_os = "windows")]
            commands::profiles::export_profile_as_text,
            #[cfg(target_os = "windows")]
            commands::profiles::compress_profile,
            #[cfg(target_os = "windows")]
            commands::profiles::decompress_profile,
            #[cfg(target_os = "windows")]
            commands::profiles::get_current_hardware_snapshot,
            #[cfg(target_os = "windows")]
            commands::winget_search::search_winget_packages,
            #[cfg(target_os = "windows")]
            commands::winget_search::get_winget_package_info,
            #[cfg(target_os = "windows")]
            commands::installed_apps::get_installed_apps,
            #[cfg(target_os = "windows")]
            commands::installed_apps::check_apps_installed,
            #[cfg(target_os = "windows")]
            commands::debloat::get_debloat_tweaks,
            #[cfg(target_os = "windows")]
            commands::debloat::create_restore_point,
            #[cfg(target_os = "windows")]
            commands::debloat::apply_debloat_tweaks,
            #[cfg(target_os = "windows")]
            commands::debloat::check_admin_elevation,
            #[cfg(target_os = "windows")]
            commands::debloat::get_installed_appx_packages,
            #[cfg(target_os = "windows")]
            commands::custom_apps::get_custom_apps,
            #[cfg(target_os = "windows")]
            commands::custom_apps::save_custom_app,
            #[cfg(target_os = "windows")]
            commands::custom_apps::delete_custom_app,
            #[cfg(target_os = "windows")]
            commands::custom_apps::download_and_install_custom_app,
            #[cfg(target_os = "windows")]
            commands::startup::get_startup_entries,
            #[cfg(target_os = "linux")]
            commands::linux::startup::get_startup_entries,
            #[cfg(target_os = "macos")]
            commands::macos::startup::get_startup_entries,
            #[cfg(target_os = "windows")]
            commands::startup::toggle_startup_entry,
            #[cfg(target_os = "linux")]
            commands::linux::startup::toggle_startup_entry,
            #[cfg(target_os = "macos")]
            commands::macos::startup::toggle_startup_entry,
            #[cfg(target_os = "windows")]
            commands::cleanup::scan_cleanup,
            #[cfg(target_os = "linux")]
            commands::linux::cleanup::scan_cleanup,
            #[cfg(target_os = "macos")]
            commands::macos::cleanup::scan_cleanup,
            #[cfg(target_os = "windows")]
            commands::cleanup::run_cleanup,
            #[cfg(target_os = "linux")]
            commands::linux::cleanup::run_cleanup,
            #[cfg(target_os = "macos")]
            commands::macos::cleanup::run_cleanup,
            #[cfg(target_os = "windows")]
            commands::privacy::get_privacy_settings,
            #[cfg(target_os = "linux")]
            commands::linux::privacy::get_privacy_settings,
            #[cfg(target_os = "macos")]
            commands::macos::privacy::get_privacy_settings,
            #[cfg(target_os = "windows")]
            commands::privacy::get_app_permissions,
            #[cfg(target_os = "linux")]
            commands::linux::privacy::get_app_permissions,
            #[cfg(target_os = "macos")]
            commands::macos::privacy::get_app_permissions,
            #[cfg(target_os = "windows")]
            commands::privacy::apply_privacy_setting,
            #[cfg(target_os = "linux")]
            commands::linux::privacy::apply_privacy_setting,
            #[cfg(target_os = "macos")]
            commands::macos::privacy::apply_privacy_setting,
            #[cfg(target_os = "windows")]
            commands::privacy::revoke_app_permission,
            #[cfg(target_os = "linux")]
            commands::linux::privacy::revoke_app_permission,
            #[cfg(target_os = "macos")]
            commands::macos::privacy::revoke_app_permission,
            // Privacy Drift Detection (Windows-only — registry baseline +
            // per-feature-update drift check). v2.0 Feature 1.
            #[cfg(target_os = "windows")]
            commands::privacy_drift::create_privacy_baseline,
            #[cfg(target_os = "windows")]
            commands::privacy_drift::check_privacy_drift,
            #[cfg(target_os = "windows")]
            commands::privacy_drift::reapply_privacy_baseline,
            #[cfg(target_os = "windows")]
            commands::privacy_drift::export_baseline,
            #[cfg(target_os = "windows")]
            commands::privacy_drift::import_baseline,
            #[cfg(target_os = "windows")]
            commands::report::generate_health_report,
            #[cfg(target_os = "linux")]
            commands::linux::report::generate_health_report,
            #[cfg(target_os = "macos")]
            commands::macos::report::generate_health_report,
            #[cfg(target_os = "windows")]
            commands::network::network_reset_dns,
            #[cfg(target_os = "linux")]
            commands::linux::network::network_reset_dns,
            #[cfg(target_os = "macos")]
            commands::macos::network::network_reset_dns,
            #[cfg(target_os = "windows")]
            commands::network::network_reset_full,
            #[cfg(target_os = "linux")]
            commands::linux::network::network_reset_full,
            #[cfg(target_os = "macos")]
            commands::macos::network::network_reset_full,
            #[cfg(target_os = "windows")]
            commands::network::set_dns_servers,
            #[cfg(target_os = "linux")]
            commands::linux::network::set_dns_servers,
            #[cfg(target_os = "macos")]
            commands::macos::network::set_dns_servers,
            #[cfg(target_os = "windows")]
            commands::network::get_network_interfaces,
            #[cfg(target_os = "linux")]
            commands::linux::network::get_network_interfaces,
            #[cfg(target_os = "macos")]
            commands::macos::network::get_network_interfaces,
            #[cfg(target_os = "windows")]
            commands::network::get_wifi_passwords,
            #[cfg(target_os = "linux")]
            commands::linux::network::get_wifi_passwords,
            #[cfg(target_os = "macos")]
            commands::macos::network::get_wifi_passwords,
            #[cfg(target_os = "windows")]
            commands::context_menu::get_classic_menu_status,
            #[cfg(target_os = "windows")]
            commands::context_menu::toggle_classic_menu,
            #[cfg(target_os = "windows")]
            commands::context_menu::get_shell_extensions,
            #[cfg(target_os = "windows")]
            commands::context_menu::toggle_shell_extension,
            #[cfg(target_os = "windows")]
            commands::services::get_services,
            #[cfg(target_os = "linux")]
            commands::linux::services::get_services,
            #[cfg(target_os = "macos")]
            commands::macos::services::get_services,
            #[cfg(target_os = "windows")]
            commands::services::set_service_start_type,
            #[cfg(target_os = "linux")]
            commands::linux::services::set_service_start_type,
            #[cfg(target_os = "macos")]
            commands::macos::services::set_service_start_type,
            #[cfg(target_os = "windows")]
            commands::services::get_service_presets,
            #[cfg(target_os = "linux")]
            commands::linux::services::get_service_presets,
            #[cfg(target_os = "macos")]
            commands::macos::services::get_service_presets,
            #[cfg(target_os = "windows")]
            commands::services::apply_service_preset,
            #[cfg(target_os = "linux")]
            commands::linux::services::apply_service_preset,
            #[cfg(target_os = "macos")]
            commands::macos::services::apply_service_preset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
