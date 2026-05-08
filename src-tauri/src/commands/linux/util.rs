//! Shared helpers for Linux command implementations.

use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// Run a command and return its stdout as a trimmed String.
/// Error includes the command + stderr so callers can surface a useful message.
pub fn run_cmd(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("Failed to spawn {}: {}", program, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "{} exited with status {}: {}",
            program,
            output.status,
            stderr.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Run a command, returning Ok on success and the stderr-enriched error on failure.
#[allow(dead_code)]
pub fn run_cmd_ok(program: &str, args: &[&str]) -> Result<(), String> {
    run_cmd(program, args).map(|_| ())
}

/// Run a command but don't fail on a non-zero exit status — return stdout either way.
/// Useful for probes like `systemctl is-enabled <unit>` where "disabled" exits 1.
pub fn run_cmd_lossy(program: &str, args: &[&str]) -> String {
    Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

/// Return true if the requested binary is on PATH.
pub fn which(program: &str) -> bool {
    Command::new("which")
        .arg(program)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Return distro family (e.g. "debian", "arch", "rhel", "suse") — never None.
pub fn distro_family() -> String {
    crate::platform::current::get_distro_family().unwrap_or_default()
}

/// Return true if the current process is running as root.
pub fn is_root() -> bool {
    crate::platform::current::is_admin()
}

/// Reads the current user's home directory from $HOME.
pub fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

/// Read a file and trim trailing whitespace/newlines. Returns None on IO error.
pub fn read_trim(path: &str) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Wrap a command with `pkexec` when the process is not root.
/// Returns the full (program, args) pair to hand to Command::new.
pub fn elevate<'a>(program: &'a str, args: &'a [&'a str]) -> (String, Vec<String>) {
    if is_root() {
        (
            program.to_string(),
            args.iter().map(|s| s.to_string()).collect(),
        )
    } else {
        let mut all = Vec::with_capacity(args.len() + 1);
        all.push(program.to_string());
        all.extend(args.iter().map(|s| s.to_string()));
        ("pkexec".to_string(), all)
    }
}

/// Convenience wrapper: run_cmd that transparently uses pkexec when non-root.
pub fn run_elevated(program: &str, args: &[&str]) -> Result<String, String> {
    let (p, a) = elevate(program, args);
    let args_refs: Vec<&str> = a.iter().map(|s| s.as_str()).collect();
    run_cmd(&p, &args_refs)
}

/// Check whether elevation is reachable. Returns Ok(()) when:
///
/// * we're already root, OR
/// * `pkexec` is on PATH (and a polkit agent is presumed to be running
///   in the desktop session — we can't probe the agent directly, but
///   binary presence is the right gating heuristic since CLI-only
///   environments wouldn't ship pkexec anyway).
///
/// Returns Err with a user-friendly message when not.
pub fn require_elevation() -> Result<(), String> {
    if is_root() || which("pkexec") {
        Ok(())
    } else {
        Err(
            "This action needs administrator rights, but `pkexec` (polkit) \
             isn't installed. Install `policykit-1` (Debian/Ubuntu) or \
             `polkit` (Fedora/Arch/openSUSE) and try again."
                .to_string(),
        )
    }
}

/// Run `apt-get update` (or distro equivalent) without prompting. Best-
/// effort: failures are returned for surfacing to the user but the caller
/// may choose to proceed. Refresh once before an install batch, not per
/// item — package-manager refresh on a fresh boot is the difference
/// between "Unable to locate package nodejs" and a working install.
pub fn refresh_package_index(family: &str) -> Result<(), String> {
    let (program, args): (&str, Vec<&str>) = match family {
        "debian" => ("apt-get", vec!["update", "-qq"]),
        "rhel" => ("dnf", vec!["check-update", "--quiet", "--refresh"]),
        "arch" => ("pacman", vec!["-Sy", "--noconfirm"]),
        "suse" => ("zypper", vec!["--non-interactive", "refresh"]),
        _ => return Ok(()),
    };
    let result = run_elevated(program, &args);
    if family == "rhel" {
        // dnf check-update signals "updates available" with status 100;
        // run_elevated turns any non-zero into Err. Detect + swallow.
        if let Err(ref e) = result {
            if e.contains("status: 100") || e.contains("exit code: 100") {
                return Ok(());
            }
        }
    }
    result.map(|_| ())
}

/// Build a one-shot env-prefixed apt command so `DEBIAN_FRONTEND` survives
/// pkexec's environment scrubbing. Use for non-interactive apt installs
/// that may otherwise hang on dpkg conf-file prompts.
pub fn apt_install_args(packages: &[&str]) -> (String, Vec<String>) {
    let mut all: Vec<String> = vec![
        "env".into(),
        "DEBIAN_FRONTEND=noninteractive".into(),
        "apt-get".into(),
        "install".into(),
        "-y".into(),
        "--no-install-recommends".into(),
    ];
    all.extend(packages.iter().map(|p| p.to_string()));
    if is_root() {
        let program = all.remove(0); // "env"
        return (program, all);
    }
    ("pkexec".into(), all)
}

/// Snap packages that need `--classic` confinement to install. Snap install
/// without this flag fails with a clear "use --classic" error, so the list
/// only needs to cover apps in our catalog. Add to it when adding new
/// snap-only entries to the catalog.
pub const CLASSIC_SNAPS: &[&str] = &[
    "code",
    "code-insiders",
    "discord",
    "slack",
    "spotify",
    "sublime-text",
    "intellij-idea-community",
    "pycharm-community",
    "node",
    "go",
    "kotlin",
    "android-studio",
    "obsidian",
];

pub fn is_classic_snap(name: &str) -> bool {
    CLASSIC_SNAPS.iter().any(|s| *s == name)
}

/// Ensure the Flathub remote is configured for the current user. Idempotent.
/// Returns Ok if Flathub is already known or was added; Err if `flatpak`
/// isn't on PATH or the add command itself failed.
pub fn ensure_flathub_remote() -> Result<(), String> {
    if !which("flatpak") {
        return Err("flatpak is not installed".into());
    }
    let listing = run_cmd_lossy("flatpak", &["remotes", "--columns=name"]);
    if listing.lines().any(|l| l.trim() == "flathub") {
        return Ok(());
    }
    run_cmd(
        "flatpak",
        &[
            "remote-add",
            "--if-not-exists",
            "--user",
            "flathub",
            "https://flathub.org/repo/flathub.flatpakrepo",
        ],
    )
    .map(|_| ())
}
