// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
use std::process::Command;

/// Create a Command that won't flash a console window on Windows.
/// Use this instead of raw Command::new() for cmd.exe/powershell.exe.
#[cfg(windows)]
pub fn silent_cmd(program: &str) -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub fn silent_cmd(program: &str) -> Command {
    Command::new(program)
}
