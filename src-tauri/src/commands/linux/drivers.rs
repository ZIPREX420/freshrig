//! Linux driver recommendations — scans `lspci -vnn` for GPUs and offers
//! distro-specific package names. Also surfaces pending firmware updates from
//! `fwupdmgr`.

use crate::commands::linux::util::{
    apt_install_args, distro_family, refresh_package_index, require_elevation, run_cmd,
    run_cmd_lossy, run_elevated, which,
};
use crate::models::drivers::*;

/// Read `ID=` from /etc/os-release — needed to special-case Ubuntu (which
/// uses versioned NVIDIA package names like `nvidia-driver-535` and ships
/// the `ubuntu-drivers` helper that picks the right one automatically).
fn distro_id() -> String {
    std::fs::read_to_string("/etc/os-release")
        .unwrap_or_default()
        .lines()
        .find_map(|l| l.strip_prefix("ID=").map(|v| v.trim_matches('"').to_string()))
        .unwrap_or_default()
}

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
        require_elevation()?;
        let family = distro_family();
        match winget_id.as_str() {
            "fwupdmgr" => {
                if !which("fwupdmgr") {
                    return Err("fwupdmgr is not installed".to_string());
                }
                run_elevated("fwupdmgr", &["update", "-y"])
            }
            "gpu.nvidia" => install_gpu_package(&family, GpuVendor::Nvidia),
            "gpu.amd" => install_gpu_package(&family, GpuVendor::Amd),
            "gpu.intel" => install_gpu_package(&family, GpuVendor::Intel),
            other => Err(format!("Unknown Linux driver id: {}", other)),
        }
    })
    .await
    .map_err(|e| format!("install task failed: {}", e))?
}

/// Install the right GPU driver package for the running distro. Ubuntu
/// (and Ubuntu-derivatives that ship `ubuntu-drivers`) is special-cased
/// to use the helper, which picks the correct versioned NVIDIA package
/// automatically — Ubuntu has no unversioned `nvidia-driver` meta-package.
fn install_gpu_package(family: &str, vendor: GpuVendor) -> Result<String, String> {
    // Refresh the package index first so a stale cache doesn't yield
    // "Unable to locate package …" errors after a fresh boot.
    let _ = refresh_package_index(family);

    // Ubuntu / derivatives that ship ubuntu-drivers: prefer the helper
    // for NVIDIA — it picks the right versioned package automatically.
    if vendor == GpuVendor::Nvidia && family == "debian" && which("ubuntu-drivers") {
        // `ubuntu-drivers install` defaults to the recommended driver.
        return run_elevated("ubuntu-drivers", &["install"]);
    }

    let pkg = match (family, vendor) {
        // Plain Debian uses `nvidia-driver` from non-free-firmware. Most
        // users will need to enable that component first; surface a clear
        // error if the package isn't present at install time.
        ("debian", GpuVendor::Nvidia) if distro_id() != "ubuntu" => "nvidia-driver",
        // Ubuntu without ubuntu-drivers (extremely rare) — try the
        // current LTS recommended version; if missing, error is clear.
        ("debian", GpuVendor::Nvidia) => "nvidia-driver-550",
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
        _ => return Err(format!("No package mapping for {:?} on {}", vendor, family)),
    };

    match family {
        "debian" => {
            let (program, args) = apt_install_args(&[pkg]);
            let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            run_cmd(&program, &arg_refs)
        }
        "rhel" => run_elevated("dnf", &["install", "-y", pkg]),
        "arch" => run_elevated("pacman", &["-S", "--noconfirm", "--needed", pkg]),
        "suse" => run_elevated("zypper", &["--non-interactive", "install", pkg]),
        _ => Err(format!("Unsupported distro family: {family}")),
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_LSPCI: &str = "\
00:02.0 VGA compatible controller [0300]: Intel Corporation UHD Graphics 630 [8086:3e9b]
\tDeviceName: Onboard - Video
\tSubsystem: ASUSTeK Computer Inc. UHD Graphics 630 [1043:8694]
\tKernel driver in use: i915
\tKernel modules: i915
01:00.0 3D controller [0302]: NVIDIA Corporation GeForce RTX 4070 [10de:2783]
\tSubsystem: NVIDIA Corporation Device [10de:1467]
\tKernel driver in use: nvidia
\tKernel modules: nvidiafb, nouveau, nvidia_drm, nvidia
02:00.0 Audio device [0403]: Realtek Semiconductor Co., Ltd. ALC4080 [10ec:4080]
";

    #[test]
    fn split_pci_blocks_isolates_each_device() {
        let blocks = split_pci_blocks(SAMPLE_LSPCI);
        assert_eq!(blocks.len(), 3, "expected one block per top-level device");
        assert!(blocks[0].starts_with("00:02.0"));
        assert!(blocks[1].starts_with("01:00.0"));
        assert!(blocks[2].starts_with("02:00.0"));
        // First block keeps its indented child lines.
        assert!(blocks[0].contains("Kernel driver in use: i915"));
    }

    #[test]
    fn detect_vendor_recognises_each_brand() {
        assert_eq!(
            detect_vendor("00:02.0 VGA compatible controller [0300]: Intel Corporation UHD"),
            GpuVendor::Intel
        );
        assert_eq!(
            detect_vendor("01:00.0 3D controller [0302]: NVIDIA Corporation GeForce RTX 4070"),
            GpuVendor::Nvidia
        );
        assert_eq!(
            detect_vendor("06:00.0 VGA: Advanced Micro Devices, Inc. [AMD/ATI] Radeon RX"),
            GpuVendor::Amd
        );
        // "Radeon" alone (no "AMD") still resolves.
        assert_eq!(
            detect_vendor("01:00.0 VGA: Some OEM Radeon Pro variant"),
            GpuVendor::Amd
        );
        assert_eq!(
            detect_vendor("00:01.0 VGA: VirtualBox SVGA"),
            GpuVendor::Unknown
        );
    }

    #[test]
    fn classic_snap_list_covers_known_classics() {
        use crate::commands::linux::util::is_classic_snap;
        assert!(is_classic_snap("code"));
        assert!(is_classic_snap("discord"));
        assert!(is_classic_snap("slack"));
        assert!(!is_classic_snap("firefox"));
        assert!(!is_classic_snap("vlc"));
    }
}
