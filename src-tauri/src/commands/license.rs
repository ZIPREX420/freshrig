// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;
use wmi::WMIConnection;

// LemonSqueezy store/product gating.
//
// PRE-LAUNCH MODE (v2.0.x): both IDs at 0. The activate/validate paths skip
// store/product matching while placeholder, so any FR-XXXXX-XXXXX-shaped key
// is accepted in dev. No paid licenses are issued in pre-launch — all
// frontend "Upgrade to Pro" buttons route to the pricing landing page
// (see PRICING_PAGE_URL in src/config/app.ts), which links to a sales mailto
// waitlist. Replace these with real numerics from the LemonSqueezy dashboard
// (Settings -> Stores for the store id; Products -> details for the product
// id) the moment the store goes live, in the same commit that replaces
// PRICING_PAGE_URL with real checkout URLs.
const EXPECTED_STORE_ID: u64 = 0;
const EXPECTED_PRODUCT_ID: u64 = 0;
const LEMONSQUEEZY_API: &str = "https://api.lemonsqueezy.com/v1";

// Variant-id allowlists for tier resolution. One LemonSqueezy product holds
// multiple variants (Pro Monthly, Pro Annual, Business Monthly, Business
// Annual). Fill in the real numeric variant ids before launch — until then
// any variant counts as Pro and Business stays empty.
const EXPECTED_PRO_VARIANT_IDS: &[u64] = &[];
const EXPECTED_BUSINESS_VARIANT_IDS: &[u64] = &[];

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LicenseTier {
    Free,
    Pro,
    Business,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseResponse {
    pub valid: bool,
    pub tier: LicenseTier,
    pub instance_id: Option<String>,
    pub license_key: Option<String>,
    pub customer_name: Option<String>,
    pub customer_email: Option<String>,
    pub expires_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LsActivateResponse {
    activated: Option<bool>,
    error: Option<String>,
    instance: Option<LsInstance>,
    meta: Option<LsMeta>,
    license_key: Option<LsLicenseKey>,
}

#[derive(Debug, Deserialize)]
struct LsValidateResponse {
    valid: Option<bool>,
    error: Option<String>,
    meta: Option<LsMeta>,
    license_key: Option<LsLicenseKey>,
}

#[derive(Debug, Deserialize)]
struct LsInstance {
    id: String,
}

#[derive(Debug, Deserialize)]
struct LsMeta {
    store_id: Option<u64>,
    product_id: Option<u64>,
    variant_id: Option<u64>,
    customer_name: Option<String>,
    customer_email: Option<String>,
}

fn resolve_tier(variant_id: Option<u64>) -> LicenseTier {
    let Some(vid) = variant_id else {
        // No variant_id from LemonSqueezy → activate-but-no-tier-info. Treat
        // as Pro (the conservative pre-Business default) so existing flows
        // keep working.
        return LicenseTier::Pro;
    };
    if EXPECTED_BUSINESS_VARIANT_IDS.contains(&vid) {
        LicenseTier::Business
    } else if EXPECTED_PRO_VARIANT_IDS.is_empty() || EXPECTED_PRO_VARIANT_IDS.contains(&vid) {
        // While the allowlist is empty (pre-launch), every paid variant is Pro.
        LicenseTier::Pro
    } else {
        LicenseTier::Free
    }
}

#[derive(Debug, Deserialize)]
struct LsLicenseKey {
    status: Option<String>,
    expires_at: Option<String>,
    key: Option<String>,
}

fn read_machine_guid() -> String {
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Cryptography")
        .and_then(|k| k.get_value::<String, _>("MachineGuid"))
        .unwrap_or_else(|_| "unknown".to_string())
}

fn read_cpu_id() -> String {
    let wmi = match WMIConnection::new() {
        Ok(c) => c,
        Err(_) => return "unknown".to_string(),
    };
    let rows: Vec<HashMap<String, wmi::Variant>> =
        match wmi.raw_query("SELECT ProcessorId FROM Win32_Processor") {
            Ok(r) => r,
            Err(_) => return "unknown".to_string(),
        };
    rows.first()
        .and_then(|r| match r.get("ProcessorId") {
            Some(wmi::Variant::String(s)) => Some(s.trim().to_string()),
            _ => None,
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn read_smbios_uuid() -> String {
    let wmi = match WMIConnection::new() {
        Ok(c) => c,
        Err(_) => return "unknown".to_string(),
    };
    let rows: Vec<HashMap<String, wmi::Variant>> =
        match wmi.raw_query("SELECT UUID FROM Win32_ComputerSystemProduct") {
            Ok(r) => r,
            Err(_) => return "unknown".to_string(),
        };
    rows.first()
        .and_then(|r| match r.get("UUID") {
            Some(wmi::Variant::String(s)) => Some(s.trim().to_string()),
            _ => None,
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

#[tauri::command]
pub async fn get_machine_fingerprint() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        let guid = read_machine_guid();
        let cpu = read_cpu_id();
        let uuid = read_smbios_uuid();
        let combined = format!("{}|{}|{}", guid, cpu, uuid);
        let mut hasher = Sha256::new();
        hasher.update(combined.as_bytes());
        let hash = hasher.finalize();
        Ok::<String, String>(hex_lower(&hash))
    })
    .await
    .map_err(|e| format!("fingerprint task failed: {}", e))?
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(hex_digit(b >> 4));
        s.push(hex_digit(b & 0x0f));
    }
    s
}

fn hex_digit(n: u8) -> char {
    match n {
        0..=9 => (b'0' + n) as char,
        10..=15 => (b'a' + (n - 10)) as char,
        _ => '0',
    }
}

fn url_encode(s: &str) -> String {
    // RFC 3986 percent-encode for application/x-www-form-urlencoded bodies.
    // Unreserved: A-Z a-z 0-9 - _ . ~ ; everything else percent-encoded.
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push('%');
                out.push(hex_digit(b >> 4).to_ascii_uppercase());
                out.push(hex_digit(b & 0x0f).to_ascii_uppercase());
            }
        }
    }
    out
}

fn truncate_fingerprint(fp: &str) -> String {
    // LemonSqueezy instance_name is limited (≤255) — 64 hex chars fits, but
    // keep a short human-readable prefix in case the API trims display output.
    if fp.len() > 32 {
        fp[..32].to_string()
    } else {
        fp.to_string()
    }
}

#[tauri::command]
pub async fn activate_license(
    license_key: String,
    fingerprint: String,
) -> Result<LicenseResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("http client: {}", e))?;

    let instance_name = truncate_fingerprint(&fingerprint);
    let body = format!(
        "license_key={}&instance_name={}",
        url_encode(&license_key),
        url_encode(&instance_name),
    );

    let resp = match client
        .post(format!("{}/licenses/activate", LEMONSQUEEZY_API))
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some(format!("Network error: {}", e)),
            });
        }
    };

    let status = resp.status();
    let body: LsActivateResponse = match resp.json().await {
        Ok(b) => b,
        Err(e) => {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some(format!("Invalid response (status {}): {}", status, e)),
            });
        }
    };

    if !body.activated.unwrap_or(false) {
        return Ok(LicenseResponse {
            valid: false,
            tier: LicenseTier::Free,
            instance_id: None,
            license_key: None,
            customer_name: None,
            customer_email: None,
            expires_at: None,
            error: Some(body.error.unwrap_or_else(|| "Activation refused".into())),
        });
    }

    // Store/product gating — skip when placeholders are still 0.
    let meta = body.meta.as_ref();
    if EXPECTED_STORE_ID != 0 {
        let store_id = meta.and_then(|m| m.store_id).unwrap_or(0);
        if store_id != EXPECTED_STORE_ID {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some("License belongs to a different store".into()),
            });
        }
    }
    if EXPECTED_PRODUCT_ID != 0 {
        let product_id = meta.and_then(|m| m.product_id).unwrap_or(0);
        if product_id != EXPECTED_PRODUCT_ID {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some("License is for a different product".into()),
            });
        }
    }

    let lk = body.license_key.as_ref();
    if let Some(s) = lk.and_then(|l| l.status.as_deref()) {
        if s != "active" {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some(format!("License status: {}", s)),
            });
        }
    }

    Ok(LicenseResponse {
        valid: true,
        tier: resolve_tier(meta.and_then(|m| m.variant_id)),
        instance_id: body.instance.map(|i| i.id),
        license_key: lk
            .and_then(|l| l.key.clone())
            .or_else(|| Some(license_key.clone())),
        customer_name: meta.and_then(|m| m.customer_name.clone()),
        customer_email: meta.and_then(|m| m.customer_email.clone()),
        expires_at: lk.and_then(|l| l.expires_at.clone()),
        error: None,
    })
}

#[tauri::command]
pub async fn validate_license(
    license_key: String,
    instance_id: String,
) -> Result<LicenseResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("http client: {}", e))?;

    let body = format!(
        "license_key={}&instance_id={}",
        url_encode(&license_key),
        url_encode(&instance_id),
    );

    let resp = match client
        .post(format!("{}/licenses/validate", LEMONSQUEEZY_API))
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some(format!("Network error: {}", e)),
            });
        }
    };

    let status = resp.status();
    let body: LsValidateResponse = match resp.json().await {
        Ok(b) => b,
        Err(e) => {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some(format!("Invalid response (status {}): {}", status, e)),
            });
        }
    };

    let is_valid = body.valid.unwrap_or(false);
    if !is_valid {
        return Ok(LicenseResponse {
            valid: false,
            tier: LicenseTier::Free,
            instance_id: None,
            license_key: None,
            customer_name: None,
            customer_email: None,
            expires_at: None,
            error: Some(
                body.error
                    .unwrap_or_else(|| "License no longer valid".into()),
            ),
        });
    }

    let meta = body.meta.as_ref();
    if EXPECTED_STORE_ID != 0 {
        let store_id = meta.and_then(|m| m.store_id).unwrap_or(0);
        if store_id != EXPECTED_STORE_ID {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some("License belongs to a different store".into()),
            });
        }
    }
    if EXPECTED_PRODUCT_ID != 0 {
        let product_id = meta.and_then(|m| m.product_id).unwrap_or(0);
        if product_id != EXPECTED_PRODUCT_ID {
            return Ok(LicenseResponse {
                valid: false,
                tier: LicenseTier::Free,
                instance_id: None,
                license_key: None,
                customer_name: None,
                customer_email: None,
                expires_at: None,
                error: Some("License is for a different product".into()),
            });
        }
    }

    let lk = body.license_key.as_ref();
    Ok(LicenseResponse {
        valid: true,
        tier: resolve_tier(meta.and_then(|m| m.variant_id)),
        instance_id: Some(instance_id),
        license_key: lk
            .and_then(|l| l.key.clone())
            .or_else(|| Some(license_key.clone())),
        customer_name: meta.and_then(|m| m.customer_name.clone()),
        customer_email: meta.and_then(|m| m.customer_email.clone()),
        expires_at: lk.and_then(|l| l.expires_at.clone()),
        error: None,
    })
}

// =============================================================================
// Release-readiness gate.
//
// In pre-launch dev mode the LemonSqueezy IDs are zero and any FR-XXXXX-XXXXX
// shape is accepted as Pro. That's fine for development, but it must NOT ship.
//
// This test always exists, but only asserts in release builds (where
// `debug_assertions` is off). The release workflow runs:
//     cargo test --release ... release_gate::lemonsqueezy_ids_set_for_release
// before tauri-action; the test fails with a clear message if the placeholders
// are still in place, blocking the release until they're filled in.
// =============================================================================
#[cfg(test)]
mod release_gate {
    use super::{EXPECTED_PRODUCT_ID, EXPECTED_PRO_VARIANT_IDS, EXPECTED_STORE_ID};

    #[test]
    fn lemonsqueezy_ids_set_for_release() {
        if cfg!(debug_assertions) {
            // Pre-launch dev mode: zeros are intentionally allowed.
            return;
        }
        assert_ne!(
            EXPECTED_STORE_ID, 0,
            "EXPECTED_STORE_ID is still 0 — set it to the LemonSqueezy store id before tagging a release",
        );
        assert_ne!(
            EXPECTED_PRODUCT_ID, 0,
            "EXPECTED_PRODUCT_ID is still 0 — set it to the LemonSqueezy product id before tagging a release",
        );
        assert!(
            !EXPECTED_PRO_VARIANT_IDS.is_empty(),
            "EXPECTED_PRO_VARIANT_IDS is empty — list the live Pro variant ids before tagging a release",
        );
    }
}
