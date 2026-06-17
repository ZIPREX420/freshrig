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

// ─── Subprocess construction choke point (SEC-02 / CQ-02) ──────────────────
//
// Historically every call site built its own `cmd /C "…{}…"` shell string by
// `format!`-interpolating variable data. In an always-elevated process that
// is a latent command-injection class: any reachable `&`, `|`, `&&`, or `%`
// in interpolated input is re-parsed by cmd.exe as shell syntax. The helpers
// below are the single sanctioned path:
//
//   • Direct spawns (no shell): use `silent_cmd(program).args([...])` — the
//     OS receives an argument vector and never re-parses a shell string.
//   • winget specifically must run under `chcp 65001` (UTF-8 output — see
//     CLAUDE.md), which forces one `cmd /C` string. `run_winget` builds that
//     string from tokens; every *variable* token must be pre-validated with
//     `is_valid_winget_id` or neutralized with `quote_for_cmd` first.

/// Conservative allowlist for winget package identifiers
/// (`Publisher.Package` style). Letters, digits, `.`, `-`, `_`, `+` only —
/// rejects whitespace, quotes, and every cmd.exe metacharacter, so a
/// validated id is safe to place in a `cmd /C` string unquoted.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn is_valid_winget_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+'))
}

/// Neutralize a free-text token for embedding in a `cmd /C` string: strips
/// embedded double quotes (cmd has no in-quote escape for them) and `%`
/// (cmd expands %VAR% even inside quotes), then wraps the result in quotes
/// so the remaining metacharacters (& | < > ^) read as literal text.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn quote_for_cmd(s: &str) -> String {
    let cleaned: String = s.chars().filter(|c| *c != '"' && *c != '%').collect();
    format!("\"{}\"", cleaned)
}

/// Run winget with the mandatory UTF-8 code-page fix. `args` are joined with
/// single spaces into the one `cmd /C` string this requires — which is why
/// variable tokens MUST already be validated (`is_valid_winget_id`) or
/// quoted (`quote_for_cmd`). Fixed flag tokens can be passed as-is.
#[cfg(windows)]
pub fn run_winget(args: &[&str]) -> std::io::Result<std::process::Output> {
    let joined = args.join(" ");
    silent_cmd("cmd")
        .args(["/C", &format!("chcp 65001 >nul && winget {}", joined)])
        .output()
}

/// Split a user-configured argument string (e.g. custom-app `silent_args`)
/// into an argument vector, honoring double-quoted segments. Replaces the
/// old pattern of handing the raw string to `cmd /C` for re-parsing.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn split_args(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_quotes = false;
    for c in s.chars() {
        match c {
            '"' => in_quotes = !in_quotes,
            c if c.is_whitespace() && !in_quotes => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
            }
            c => cur.push(c),
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn winget_id_accepts_real_catalog_ids() {
        for id in [
            "Mozilla.Firefox",
            "Microsoft.VisualStudioCode",
            "7zip.7zip",
            "Notepad++.Notepad++",
            "Python.Python.3.12",
            "OpenJS.NodeJS.LTS",
            "JetBrains.IntelliJIDEA.Community",
        ] {
            assert!(is_valid_winget_id(id), "should accept {id}");
        }
    }

    #[test]
    fn winget_id_rejects_injection_payloads() {
        for id in [
            "",
            "a b",
            "id\"",
            "id&calc",
            "id|calc",
            "id&&calc",
            "id;calc",
            "%TEMP%",
            "id>out",
            "id^",
            "id\ncalc",
            "id`calc",
        ] {
            assert!(!is_valid_winget_id(id), "should reject {id:?}");
        }
        assert!(!is_valid_winget_id(&"x".repeat(129)));
    }

    #[test]
    fn quote_for_cmd_neutralizes_metacharacters() {
        assert_eq!(quote_for_cmd("hello"), "\"hello\"");
        // Embedded quotes are stripped so the wrapper can't be broken out of.
        assert_eq!(quote_for_cmd("a\" & calc \""), "\"a & calc \"");
        // %VAR% expansion is defused.
        assert_eq!(quote_for_cmd("%TEMP%"), "\"TEMP\"");
    }

    #[test]
    fn split_args_handles_quoted_segments() {
        assert_eq!(split_args("/S /norestart"), vec!["/S", "/norestart"]);
        assert_eq!(
            split_args("\"/dir=C:\\Program Files\\App\" /quiet"),
            vec!["/dir=C:\\Program Files\\App", "/quiet"]
        );
        assert_eq!(split_args(""), Vec::<String>::new());
        assert_eq!(split_args("   "), Vec::<String>::new());
    }
}
