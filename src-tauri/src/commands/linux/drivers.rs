//! Linux driver recommendations — scans `lspci -vnn` for GPUs and offers
//! distro-specific package names. Also surfaces pending firmware updates from
//! `fwupdmgr`.

use crate::commands::linux::util::{distro_family, run_cmd_lossy, run_elevated, which};
use crate::models::drivers::*;

#[tauri::command]
pub async fn get_driver_recommendations() -> Result<Vec<DriverRecommendation>, String> {
    tokio::task::spawn_blocking(|| {
        let mut out = Vec::new();
        let lspci = run_cmd_lossy("lspci", &["-vnn"]);
        let family = distro_family();

        let mut seen_vendors = std::collections::HashSet::new();
        for block in split_pci_blocks(&lspci) {
            let header = block.lines().next().unwrap_or_default();
            if !header.contains("VGA compatible controller") && !header.contains("3D controller") {
                continue;
            }
            let vendor = detect_vendor(header);
            if vendor == GpuVendor::Unknown {
                continue;
            }
            if !seen_vendors.insert(vendor) {
                continue; // one recommendation per vendor
            }

            let kernel_driver = block
                .lines()
                .find_map(|l| l.trim().strip_prefix("Kernel driver in use:"))
                .map(|s| s.trim().to_string());

            out.push(build_gpu_reco(vendor, &family, kernel_driver));
        }

        // Firmware via fwupd.
        if which("fwupdmgr") {
            let updates = run_cmd_lossy("fwupdmgr", &["get-updates"]);
            if !updates.to_lowercase().contains("no updates available")
                && !updates.trim().is_empty()
            {
                out.push(DriverRecommendation {
                    device_name: "System firmware (fwupd)".to_string(),
                    category: DriverCategory::Chipset,
                    vendor: "fwupd".to_string(),
                    current_version: None,
                    current_date: None,
                    download_url: "https://fwupd.org".to_string(),
                    download_page: "https://fwupd.org".to_string(),
                    status: DriverStatus::UpdateAvailable,
                    install_action: DriverInstallAction::Winget("fwupdmgr".to_string()),
                    install_label: "Apply firmware updates".to_string(),
                });
            }
        }

        Ok(out)
    })
    .await
    .map_err(|e| format!("drivers task failed: {}", e))?
}

#[tauri::command]
pub async fn install_driver(winget_id: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let family = distro_family();
        match winget_id.as_str() {
            "fwupdmgr" => run_elevated("fwupdmgr", &["update", "-y"]),
            "gpu.nvidia" => install_package(&family, GpuVendor::Nvidia),
            "gpu.amd" => install_package(&family, GpuVendor::Amd),
            "gpu.intel" => install_package(&family, GpuVendor::Intel),
            other => Err(format!("Unknown Linux driver id: {}", other)),
        }
    })
    .await
    .map_err(|e| format!("install task failed: {}", e))?
}

fn install_package(family: &str, vendor: GpuVendor) -> Result<String, String> {
    let pkg = match (family, vendor) {
        ("debian", GpuVendor::Nvidia) => "nvidia-driver",
        ("debian", GpuVendor::Amd) => "mesa-vulkan-drivers",
        ("debian", GpuVendor::Intel) => "intel-media-va-driver",
        ("rhel", GpuVendor::Nvidia) => "akmod-nvidia",
        ("rhel", GpuVendor::Amd) => "mesa-vulkan-drivers",
        ("rhel", GpuVendor::Intel) => "intel-media-driver",
        ("arch", GpuVendor::Nvidia) => "nvidia",
        ("arch", GpuVendor::Amd) => "vulkan-radeon",
        ("arch", GpuVendor::Intel) => "intel-media-driver",
        ("suse", GpuVendor::Nvidia) => "nvidia-driver-G06",
        ("suse", GpuVendor::Amd) => "Mesa-vulkan-device-select",
        ("suse", GpuVendor::Intel) => "intel-media-driver",
        _ => return Err(format!("No package mapping for vendor on {family}")),
    };
    let (program, args): (&str, Vec<&str>) = match family {
        "debian" => ("apt-get", vec!["install", "-y", pkg]),
        "rhel" => ("dnf", vec!["install", "-y", pkg]),
        "arch" => ("pacman", vec!["-S", "--noconfirm", "--needed", pkg]),
        "suse" => ("zypper", vec!["--non-interactive", "install", pkg]),
        _ => return Err(format!("Unsupported distro family: {family}")),
    };
    run_elevated(program, &args)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum GpuVendor {
    Nvidia,
    Amd,
    Intel,
    Unknown,
}

fn detect_vendor(line: &str) -> GpuVendor {
    let lower = line.to_lowercase();
    if lower.contains("nvidia") {
        GpuVendor::Nvidia
    } else if lower.contains("amd")
        || lower.contains("advanced micro devices")
        || lower.contains("radeon")
    {
        GpuVendor::Amd
    } else if lower.contains("intel") {
        GpuVendor::Intel
    } else {
        GpuVendor::Unknown
    }
}

fn split_pci_blocks(verbose: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut current = String::new();
    for line in verbose.lines() {
        if !line.starts_with(char::is_whitespace) && line.contains(' ') && !current.is_empty() {
            blocks.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push('\n');
        }
        current.push_str(line);
    }
    if !current.is_empty() {
        blocks.push(current);
    }
    blocks
}

fn build_gpu_reco(
    vendor: GpuVendor,
    family: &str,
    kernel_driver: Option<String>,
) -> DriverRecommendation {
    let (vendor_name, device_label, id, url, label) = match vendor {
        GpuVendor::Nvidia => (
            "NVIDIA",
            "NVIDIA GPU",
            "gpu.nvidia",
            "https://www.nvidia.com/en-us/drivers/",
            match family {
                "debian" => "Install nvidia-driver (apt)",
                "rhel" => "Install akmod-nvidia (dnf)",
                "arch" => "Install nvidia (pacman)",
                "suse" => "Install nvidia-driver-G06 (zypper)",
                _ => "Install NVIDIA proprietary driver",
            },
        ),
        GpuVendor::Amd => (
            "AMD",
            "AMD GPU",
            "gpu.amd",
            "https://www.amd.com/en/support",
            match family {
                "debian" => "Install mesa-vulkan-drivers (apt)",
                "rhel" => "Install mesa-vulkan-drivers (dnf)",
                "arch" => "Install vulkan-radeon (pacman)",
                "suse" => "Install Mesa-vulkan-device-select (zypper)",
                _ => "Install Mesa Vulkan driver",
            },
        ),
        GpuVendor::Intel => (
            "Intel",
            "Intel GPU",
            "gpu.intel",
            "https://www.intel.com/content/www/us/en/support/detect.html",
            match family {
                "debian" => "Install intel-media-va-driver (apt)",
                "rhel" => "Install intel-media-driver (dnf)",
                "arch" => "Install intel-media-driver (pacman)",
                "suse" => "Install intel-media-driver (zypper)",
                _ => "Install Intel media driver",
            },
        ),
        GpuVendor::Unknown => unreachable!(),
    };

    DriverRecommendation {
        device_name: device_label.to_string(),
        category: DriverCategory::Gpu,
        vendor: vendor_name.to_string(),
        current_version: kernel_driver,
        current_date: None,
        download_url: url.to_string(),
        download_page: url.to_string(),
        status: DriverStatus::UpdateAvailable,
        install_action: DriverInstallAction::Winget(id.to_string()),
        install_label: label.to_string(),
    }
}
