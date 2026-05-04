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
