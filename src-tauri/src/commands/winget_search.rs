use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use crate::util::{is_valid_winget_id, quote_for_cmd, run_winget};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetSearchResult {
    pub name: String,
    pub id: String,
    pub version: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetPackageDetails {
    pub id: String,
    pub name: String,
    pub version: String,
    pub publisher: Option<String>,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
}

static WINGET_JSON_SUPPORT: OnceLock<bool> = OnceLock::new();

fn detect_winget_json_support() -> bool {
    let output = run_winget(&["--info"]);

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            // Look for version line like "Windows Package Manager v1.9.25200"
            for line in stdout.lines() {
                let line = line.trim();
                if line.contains("Windows Package Manager") {
                    // Extract version: find "v" followed by digits
                    if let Some(v_pos) = line.rfind('v') {
                        let ver_str = &line[v_pos + 1..];
                        let parts: Vec<&str> = ver_str.split('.').collect();
                        if parts.len() >= 2 {
                            let major: u32 = parts[0].parse().unwrap_or(0);
                            let minor: u32 = parts[1].parse().unwrap_or(0);
                            return major > 1 || (major == 1 && minor >= 4);
                        }
                    }
                }
            }
            false
        }
        Err(_) => false,
    }
}

fn supports_json() -> bool {
    *WINGET_JSON_SUPPORT.get_or_init(detect_winget_json_support)
}

fn parse_winget_json_search(json_str: &str) -> Option<Vec<WingetSearchResult>> {
    let parsed: serde_json::Value = serde_json::from_str(json_str).ok()?;
    let sources = parsed.get("Sources")?.as_array()?;
    let mut results = Vec::new();

    for source in sources {
        let packages = source.get("Packages")?.as_array()?;
        for pkg in packages {
            let id = pkg
                .get("PackageIdentifier")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let name = pkg
                .get("PackageName")
                .and_then(|v| v.as_str())
                .unwrap_or(&id)
                .to_string();
            let version = pkg
                .get("PackageVersion")
                .or_else(|| pkg.get("Version"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();

            if !id.is_empty() {
                results.push(WingetSearchResult {
                    name,
                    id,
                    version,
                    source: "winget".to_string(),
                });
            }
        }
    }

    if results.is_empty() {
        None
    } else {
        Some(results)
    }
}

fn parse_winget_show_json(json_str: &str) -> Option<WingetPackageDetails> {
    let parsed: serde_json::Value = serde_json::from_str(json_str).ok()?;

    // winget show --output json wraps in Sources[0].Packages[0]
    let pkg = parsed
        .get("Sources")
        .and_then(|s| s.as_array())
        .and_then(|a| a.first())
        .and_then(|s| s.get("Packages"))
        .and_then(|p| p.as_array())
        .and_then(|a| a.first())
        .unwrap_or(&parsed);

    let id = pkg
        .get("PackageIdentifier")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if id.is_empty() {
        return None;
    }

    Some(WingetPackageDetails {
        id: id.clone(),
        name: pkg
            .get("PackageName")
            .and_then(|v| v.as_str())
            .unwrap_or(&id)
            .to_string(),
        version: pkg
            .get("PackageVersion")
            .or_else(|| pkg.get("Version"))
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string(),
        publisher: pkg
            .get("Publisher")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        description: pkg
            .get("Description")
            .or_else(|| pkg.get("ShortDescription"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        homepage: pkg
            .get("Homepage")
            .or_else(|| pkg.get("PackageUrl"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        license: pkg
            .get("License")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

#[tauri::command]
pub async fn search_winget_packages(query: String) -> Result<Vec<WingetSearchResult>, String> {
    if query.trim().len() < 2 {
        return Ok(vec![]);
    }

    let quoted = quote_for_cmd(&query);

    // Try JSON output first if supported
    if supports_json() {
        let json_output = run_winget(&[
            "search",
            quoted.as_str(),
            "--source",
            "winget",
            "--accept-source-agreements",
            "--disable-interactivity",
            "--count",
            "20",
            "--output",
            "json",
        ]);

        if let Ok(out) = json_output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(results) = parse_winget_json_search(&stdout) {
                return Ok(results);
            }
        }
    }

    // Fall back to table parsing
    let output = run_winget(&[
        "search",
        quoted.as_str(),
        "--source",
        "winget",
        "--accept-source-agreements",
        "--disable-interactivity",
        "--count",
        "20",
    ])
    .map_err(|e| format!("Failed to run winget: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    parse_winget_table_output(&stdout)
}

fn parse_winget_table_output(output: &str) -> Result<Vec<WingetSearchResult>, String> {
    let lines: Vec<&str> = output.lines().collect();

    // Find the header line (starts with "Name")
    let header_idx = match lines.iter().position(|l| l.starts_with("Name")) {
        Some(idx) => idx,
        None => return Ok(vec![]),
    };

    let header = lines[header_idx];
    let separator_idx = header_idx + 1;

    // Find column positions from header
    let id_col = header.find("Id").ok_or("Id column not found")?;
    let ver_col = header.find("Version").ok_or("Version column not found")?;
    let src_col = header.find("Source");

    let mut results = Vec::new();

    for line in lines.iter().skip(separator_idx + 1) {
        let line = *line;
        if line.trim().is_empty() || line.contains("results match") {
            continue;
        }
        if line.len() < ver_col {
            continue;
        }

        let name = line[..id_col].trim().to_string();
        let id = line[id_col..ver_col].trim().to_string();
        let version = match src_col {
            Some(s) if line.len() >= s => line[ver_col..s].trim().to_string(),
            _ => line[ver_col..].trim().to_string(),
        };
        let source = src_col
            .filter(|&s| line.len() >= s)
            .map(|s| line[s..].trim().to_string())
            .unwrap_or_default();

        // Skip entries with truncated IDs (contain Unicode ellipsis)
        if id.contains('\u{2026}') || id.is_empty() {
            continue;
        }

        results.push(WingetSearchResult {
            name,
            id,
            version,
            source,
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_winget_package_info(package_id: String) -> Result<WingetPackageDetails, String> {
    // SEC-02: package ids are Publisher.Package identifiers — validate against
    // the allowlist instead of interpolating caller text into the shell.
    if !is_valid_winget_id(&package_id) {
        return Err(format!("Invalid package id: {}", package_id));
    }

    // Try JSON output first if supported
    if supports_json() {
        let json_output = run_winget(&[
            "show",
            "--id",
            package_id.as_str(),
            "-e",
            "--accept-source-agreements",
            "--disable-interactivity",
            "--output",
            "json",
        ]);

        if let Ok(out) = json_output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(details) = parse_winget_show_json(&stdout) {
                return Ok(details);
            }
        }
    }

    // Fall back to text parsing
    let output = run_winget(&[
        "show",
        "--id",
        package_id.as_str(),
        "-e",
        "--accept-source-agreements",
        "--disable-interactivity",
    ])
    .map_err(|e| format!("Failed to run winget show: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    parse_winget_show_output(&stdout)
}

fn parse_winget_show_output(output: &str) -> Result<WingetPackageDetails, String> {
    let mut details = WingetPackageDetails {
        id: String::new(),
        name: String::new(),
        version: String::new(),
        publisher: None,
        description: None,
        homepage: None,
        license: None,
    };

    for line in output.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("Id:") {
            details.id = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("Name:") {
            details.name = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("Version:") {
            details.version = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("Publisher:") {
            details.publisher = Some(val.trim().to_string());
        } else if let Some(val) = line.strip_prefix("Description:") {
            details.description = Some(val.trim().to_string());
        } else if let Some(val) = line.strip_prefix("Homepage:") {
            details.homepage = Some(val.trim().to_string());
        } else if let Some(val) = line.strip_prefix("License:") {
            details.license = Some(val.trim().to_string());
        }
    }

    if details.id.is_empty() {
        return Err("Could not parse package details".to_string());
    }

    Ok(details)
}
