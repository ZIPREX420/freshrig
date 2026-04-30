// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Pro Business integrations: RepairShopr/Syncro/NinjaOne webhooks +
// SMTP email for maintenance contract notifications.
//
// All sensitive credentials (API keys, SMTP passwords) live in the OS
// keyring via `commands::secrets`; the on-disk JSON only stores the
// non-secret bits (subdomain, generic-webhook URL, SMTP host/port/user
// without password).
//
// Frontend gates the affordance behind the Business tier; backend trusts
// `is_business: bool` the same way other Pro-gated commands do.

use serde::{Deserialize, Serialize};
use std::fs;

use crate::commands::secrets;
use crate::portable::get_data_dir;

const CFG_FILENAME: &str = "integrations.json";
const KEY_REPAIRSHOPR_API: &str = "repairshopr_api_key";
const KEY_SMTP_PASSWORD: &str = "smtp_password";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct IntegrationConfig {
    pub repairshopr: Option<RepairShoprConfig>,
    pub generic_webhook_url: Option<String>,
    pub smtp: Option<SmtpConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairShoprConfig {
    /// Stored client-side as a placeholder (the actual key lives in keyring).
    /// On read, we restore "********" so the UI can show "configured" without
    /// leaking the real value.
    #[serde(default)]
    pub api_key: String,
    pub subdomain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    /// Same convention as RepairShoprConfig.api_key — the real password is in
    /// the keyring; this field carries "********" on read and the new value
    /// (or empty string for "keep") on write.
    #[serde(default)]
    pub password: String,
    pub from_address: String,
}

fn cfg_path() -> std::path::PathBuf {
    get_data_dir().join(CFG_FILENAME)
}

fn load_config() -> IntegrationConfig {
    let raw = match fs::read_to_string(cfg_path()) {
        Ok(s) => s,
        Err(_) => return IntegrationConfig::default(),
    };
    let mut cfg: IntegrationConfig = serde_json::from_str(&raw).unwrap_or_default();
    // Re-attach masked secrets so the UI shows "configured" without leaking.
    if let Some(rs) = cfg.repairshopr.as_mut() {
        if has_secret(KEY_REPAIRSHOPR_API) {
            rs.api_key = "********".to_string();
        } else {
            rs.api_key = String::new();
        }
    }
    if let Some(s) = cfg.smtp.as_mut() {
        if has_secret(KEY_SMTP_PASSWORD) {
            s.password = "********".to_string();
        } else {
            s.password = String::new();
        }
    }
    cfg
}

fn has_secret(key: &str) -> bool {
    matches!(secrets::read(key), Ok(Some(_)))
}

#[tauri::command]
pub async fn get_integrations() -> Result<IntegrationConfig, String> {
    tokio::task::spawn_blocking(|| Ok::<_, String>(load_config()))
        .await
        .map_err(|e| format!("get_integrations task: {}", e))?
}

#[tauri::command]
pub async fn set_integrations(config: IntegrationConfig, is_business: bool) -> Result<(), String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || {
        // Pull the to-be-stored secrets into the keyring before persisting
        // the masked-only blob to disk.
        let mut sanitized = config.clone();

        if let Some(rs) = sanitized.repairshopr.as_mut() {
            if !rs.api_key.is_empty() && rs.api_key != "********" {
                secrets::write(KEY_REPAIRSHOPR_API, &rs.api_key)?;
            }
            rs.api_key = String::new();
        }
        if let Some(s) = sanitized.smtp.as_mut() {
            if !s.password.is_empty() && s.password != "********" {
                secrets::write(KEY_SMTP_PASSWORD, &s.password)?;
            }
            s.password = String::new();
        }

        let json = serde_json::to_string_pretty(&sanitized)
            .map_err(|e| format!("serialize integrations: {}", e))?;
        fs::write(cfg_path(), json).map_err(|e| format!("write integrations.json: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("set_integrations task: {}", e))?
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WebhookProvider {
    Repairshopr,
    Generic,
    Smtp,
}

#[tauri::command]
pub async fn test_webhook(provider: WebhookProvider) -> Result<(), String> {
    match provider {
        WebhookProvider::Repairshopr => test_repairshopr().await,
        WebhookProvider::Generic => test_generic().await,
        WebhookProvider::Smtp => tokio::task::spawn_blocking(test_smtp_blocking)
            .await
            .map_err(|e| format!("smtp test task: {}", e))?,
    }
}

async fn test_repairshopr() -> Result<(), String> {
    let cfg_disk = load_config();
    let rs = cfg_disk
        .repairshopr
        .ok_or_else(|| "RepairShopr is not configured".to_string())?;
    let api_key = secrets::read(KEY_REPAIRSHOPR_API)?
        .ok_or_else(|| "RepairShopr API key missing from keyring".to_string())?;
    let url = format!("https://{}.repairshopr.com/api/v1/customers", rs.subdomain);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let resp = client
        .get(&url)
        .bearer_auth(api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("network: {}", e))?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("RepairShopr returned {}", resp.status()))
    }
}

async fn test_generic() -> Result<(), String> {
    let cfg = load_config();
    let url = cfg
        .generic_webhook_url
        .ok_or_else(|| "Generic webhook URL is not configured".to_string())?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let body = serde_json::json!({
        "event": "freshrig.test",
        "timestamp": crate::commands::fleet::chrono_now(),
        "summary": "Test ping from FreshRig"
    });
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network: {}", e))?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("Webhook returned {}", resp.status()))
    }
}

fn test_smtp_blocking() -> Result<(), String> {
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::{Message, SmtpTransport, Transport};

    let cfg = load_config();
    let s = cfg
        .smtp
        .ok_or_else(|| "SMTP is not configured".to_string())?;
    let pw = secrets::read(KEY_SMTP_PASSWORD)?
        .ok_or_else(|| "SMTP password missing from keyring".to_string())?;

    let from_parsed = s
        .from_address
        .parse()
        .map_err(|e| format!("invalid from address: {}", e))?;
    let email = Message::builder()
        .from(from_parsed)
        .to(s
            .username
            .parse()
            .map_err(|e| format!("invalid to: {}", e))?)
        .subject("FreshRig SMTP test")
        .body("This is a test email from FreshRig — your SMTP credentials work.".to_string())
        .map_err(|e| format!("build message: {}", e))?;

    let creds = Credentials::new(s.username.clone(), pw);
    let mailer = SmtpTransport::relay(&s.host)
        .map_err(|e| format!("smtp relay: {}", e))?
        .credentials(creds)
        .port(s.port)
        .build();
    mailer.send(&email).map_err(|e| format!("send: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn send_report_to_provider(
    provider: WebhookProvider,
    report_path: String,
    machine_id: String,
) -> Result<(), String> {
    match provider {
        WebhookProvider::Repairshopr => send_to_repairshopr(report_path, machine_id).await,
        WebhookProvider::Generic => send_to_generic(report_path, machine_id).await,
        WebhookProvider::Smtp => Err("SMTP send is reserved for contract runs".into()),
    }
}

async fn send_to_repairshopr(report_path: String, machine_id: String) -> Result<(), String> {
    let cfg_disk = load_config();
    let rs = cfg_disk
        .repairshopr
        .ok_or_else(|| "RepairShopr is not configured".to_string())?;
    let api_key = secrets::read(KEY_REPAIRSHOPR_API)?
        .ok_or_else(|| "RepairShopr API key missing from keyring".to_string())?;
    let url = format!("https://{}.repairshopr.com/api/v1/tickets", rs.subdomain);
    let payload = serde_json::json!({
        "subject": format!("FreshRig health report — {}", machine_id),
        "problem_type": "Maintenance",
        "status": "New",
        "comments_attributes": [{
            "subject": "FreshRig report",
            "body": format!("Attached report path: {}", report_path),
            "hidden": false,
        }],
    });
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let resp = client
        .post(&url)
        .bearer_auth(api_key)
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("network: {}", e))?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("RepairShopr returned {}", resp.status()))
    }
}

async fn send_to_generic(report_path: String, machine_id: String) -> Result<(), String> {
    let cfg = load_config();
    let url = cfg
        .generic_webhook_url
        .ok_or_else(|| "Generic webhook URL is not configured".to_string())?;
    let body = serde_json::json!({
        "machine_id": machine_id,
        "report_url": report_path,
        "summary": "FreshRig health report",
        "timestamp": crate::commands::fleet::chrono_now(),
    });
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network: {}", e))?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("Webhook returned {}", resp.status()))
    }
}

/// Send a contract-run notification email. Called from `fleet::run_contract_internal`.
/// Returns Ok if SMTP is unconfigured (skip silently) so a missing email setup
/// doesn't prevent the contract itself from completing.
pub fn send_contract_email(to: &str, machine_id: &str, actions: &[String]) -> Result<(), String> {
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::{Message, SmtpTransport, Transport};

    let cfg = load_config();
    let Some(s) = cfg.smtp else {
        eprintln!("contract email: SMTP unconfigured; skipping");
        return Ok(());
    };
    let Ok(Some(pw)) = secrets::read(KEY_SMTP_PASSWORD) else {
        eprintln!("contract email: SMTP password not in keyring; skipping");
        return Ok(());
    };
    let body_lines = actions
        .iter()
        .map(|a| format!("  • {}", a))
        .collect::<Vec<_>>()
        .join("\n");
    let body = format!(
        "FreshRig ran a maintenance contract on machine {}.\n\nActions:\n{}\n",
        machine_id, body_lines
    );
    let from_parsed = s
        .from_address
        .parse()
        .map_err(|e| format!("invalid from: {}", e))?;
    let to_parsed = to.parse().map_err(|e| format!("invalid to: {}", e))?;
    let email = Message::builder()
        .from(from_parsed)
        .to(to_parsed)
        .subject(format!("FreshRig — maintenance run on {}", machine_id))
        .body(body)
        .map_err(|e| format!("build message: {}", e))?;
    let creds = Credentials::new(s.username.clone(), pw);
    let mailer = SmtpTransport::relay(&s.host)
        .map_err(|e| format!("smtp relay: {}", e))?
        .credentials(creds)
        .port(s.port)
        .build();
    mailer.send(&email).map_err(|e| format!("send: {}", e))?;
    Ok(())
}
