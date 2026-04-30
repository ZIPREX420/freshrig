// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // Headless task mode: invoked by the OS scheduler (Task Scheduler on
    // Windows, systemd timer on Linux, launchd on macOS) every 6 hours
    // to refresh the SMART history without opening the GUI window.
    // Format: `freshrig --headless --task=smart-check`.
    if args.iter().any(|a| a == "--headless") {
        let task = args
            .iter()
            .find_map(|a| a.strip_prefix("--task="))
            .unwrap_or("");
        let exit_code = match task {
            "smart-check" => freshrig_lib::run_headless_smart_check(),
            "run-contracts" => freshrig_lib::run_headless_contracts(),
            "apply-profile" => {
                let profile_id = args
                    .iter()
                    .find_map(|a| a.strip_prefix("--profile-id="))
                    .unwrap_or("");
                freshrig_lib::run_headless_apply_profile(profile_id)
            }
            _ => 2,
        };
        std::process::exit(exit_code);
    }

    freshrig_lib::run();
}
