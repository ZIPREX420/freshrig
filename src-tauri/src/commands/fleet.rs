// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Multi-Machine Fleet Dashboard backend (v2.0 Pro Business). Tracks
// customer endpoints in the shared SQLite db (`db::open()`), enforces a
// 25-endpoint cap on the Business tier (Site/Unlimited tiers may bypass
// in a later release), and exposes import/export of one-machine bundles
// so a tech can collect endpoints from multiple sites.
//
// Tables (created idempotently in `init_schema` below):
//   * machines       — one row per endpoint, hardware summary + last
//                      health score + last seen.
//   * change_log     — append-only log of edits and runs.
//   * reports        — link rows pointing at saved health-report files.
//   * contracts      — recurring maintenance schedules (Feature E).
//
// All commands route through `ensure_schema()` which is a no-op after
// the first call per process — keeps backward compatibility with
// pre-existing SQLite files written by Watchdog/SMART.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use crate::db;

const ENDPOINT_CAP_BUSINESS: usize = 25;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Machine {
    pub id: String,
    pub hostname: String,
    pub owner_name: String,
    #[serde(default)]
    pub serial_number: Option<String>,
    pub hardware_summary: String,
    #[serde(default)]
    pub last_health_score: Option<u32>,
    pub last_seen: String,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeLogEntry {
    pub id: i64,
    pub machine_id: String,
    pub timestamp: String,
    pub action: String,
    #[serde(default)]
    pub details_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRef {
    pub id: i64,
    pub machine_id: String,
    pub timestamp: String,
    pub file_path: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointBundle {
    pub machine: Machine,
    pub change_log: Vec<ChangeLogEntry>,
    pub recent_reports: Vec<ReportRef>,
    pub contracts: Vec<MaintenanceContract>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ContractFrequency {
    Monthly,
    Quarterly,
    OnDemand,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceContract {
    pub id: String,
    pub machine_id: String,
    pub frequency: ContractFrequency,
    pub next_run: String,
    #[serde(default)]
    pub email_to: Option<String>,
    pub auto_actions: Vec<String>,
    #[serde(default)]
    pub last_run: Option<String>,
}

static SCHEMA_READY: OnceLock<()> = OnceLock::new();

fn ensure_schema(conn: &rusqlite::Connection) -> Result<(), String> {
    if SCHEMA_READY.get().is_some() {
        return Ok(());
    }
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS machines (
            id                TEXT PRIMARY KEY,
            hostname          TEXT NOT NULL,
            owner_name        TEXT NOT NULL,
            serial_number     TEXT,
            hardware_summary  TEXT NOT NULL,
            last_health_score INTEGER,
            last_seen         TEXT NOT NULL,
            notes             TEXT
        );
        CREATE TABLE IF NOT EXISTS change_log (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id   TEXT NOT NULL,
            timestamp    TEXT NOT NULL,
            action       TEXT NOT NULL,
            details_json TEXT,
            FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_change_log_machine
            ON change_log(machine_id, timestamp DESC);
        CREATE TABLE IF NOT EXISTS reports (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT NOT NULL,
            timestamp  TEXT NOT NULL,
            file_path  TEXT NOT NULL,
            kind       TEXT NOT NULL,
            FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_reports_machine
            ON reports(machine_id, timestamp DESC);
        CREATE TABLE IF NOT EXISTS contracts (
            id            TEXT PRIMARY KEY,
            machine_id    TEXT NOT NULL,
            frequency     TEXT NOT NULL,
            next_run      TEXT NOT NULL,
            email_to      TEXT,
            auto_actions  TEXT NOT NULL,
            last_run      TEXT,
            FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_contracts_next_run
            ON contracts(next_run);
        "#,
    )
    .map_err(|e| format!("fleet init_schema: {}", e))?;
    SCHEMA_READY.set(()).ok();
    Ok(())
}

fn parse_frequency(s: &str) -> ContractFrequency {
    match s {
        "monthly" => ContractFrequency::Monthly,
        "quarterly" => ContractFrequency::Quarterly,
        _ => ContractFrequency::OnDemand,
    }
}

fn frequency_str(f: &ContractFrequency) -> &'static str {
    match f {
        ContractFrequency::Monthly => "monthly",
        ContractFrequency::Quarterly => "quarterly",
        ContractFrequency::OnDemand => "ondemand",
    }
}

#[tauri::command]
pub async fn list_machines() -> Result<Vec<Machine>, String> {
    tokio::task::spawn_blocking(|| {
        let conn = db::open()?;
        ensure_schema(&conn)?;
        let mut stmt = conn
            .prepare(
                "SELECT id, hostname, owner_name, serial_number, hardware_summary, \
                 last_health_score, last_seen, notes FROM machines ORDER BY last_seen DESC",
            )
            .map_err(|e| format!("prepare: {}", e))?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Machine {
                    id: r.get(0)?,
                    hostname: r.get(1)?,
                    owner_name: r.get(2)?,
                    serial_number: r.get(3)?,
                    hardware_summary: r.get(4)?,
                    last_health_score: r.get::<_, Option<i64>>(5)?.map(|n| n as u32),
                    last_seen: r.get(6)?,
                    notes: r.get(7)?,
                })
            })
            .map_err(|e| format!("query: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("row: {}", e))?);
        }
        Ok(out)
    })
    .await
    .map_err(|e| format!("list_machines task: {}", e))?
}

#[tauri::command]
pub async fn add_machine(machine: Machine, is_business: bool) -> Result<(), String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        ensure_schema(&conn)?;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM machines", [], |r| r.get(0))
            .map_err(|e| format!("count machines: {}", e))?;
        if count as usize >= ENDPOINT_CAP_BUSINESS {
            return Err("ENDPOINT_CAP_REACHED".into());
        }
        conn.execute(
            "INSERT OR REPLACE INTO machines \
             (id, hostname, owner_name, serial_number, hardware_summary, last_health_score, last_seen, notes) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                machine.id,
                machine.hostname,
                machine.owner_name,
                machine.serial_number,
                machine.hardware_summary,
                machine.last_health_score.map(|n| n as i64),
                machine.last_seen,
                machine.notes,
            ],
        )
        .map_err(|e| format!("insert machine: {}", e))?;
        let now = chrono_now();
        conn.execute(
            "INSERT INTO change_log (machine_id, timestamp, action, details_json) VALUES (?1, ?2, ?3, ?4)",
            params![machine.id, now, "machine.added", serde_json::Value::Null.to_string()],
        )
        .map_err(|e| format!("log add: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("add_machine task: {}", e))?
}

#[tauri::command]
pub async fn delete_machine(id: String, is_business: bool) -> Result<(), String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        ensure_schema(&conn)?;
        conn.execute("DELETE FROM machines WHERE id = ?1", params![id])
            .map_err(|e| format!("delete: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("delete_machine task: {}", e))?
}

#[tauri::command]
pub async fn get_machine_detail(id: String) -> Result<EndpointBundle, String> {
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        ensure_schema(&conn)?;
        let machine = conn
            .query_row(
                "SELECT id, hostname, owner_name, serial_number, hardware_summary, \
                 last_health_score, last_seen, notes FROM machines WHERE id = ?1",
                params![id],
                |r| {
                    Ok(Machine {
                        id: r.get(0)?,
                        hostname: r.get(1)?,
                        owner_name: r.get(2)?,
                        serial_number: r.get(3)?,
                        hardware_summary: r.get(4)?,
                        last_health_score: r.get::<_, Option<i64>>(5)?.map(|n| n as u32),
                        last_seen: r.get(6)?,
                        notes: r.get(7)?,
                    })
                },
            )
            .map_err(|e| format!("machine row: {}", e))?;

        let mut log_stmt = conn
            .prepare(
                "SELECT id, machine_id, timestamp, action, details_json FROM change_log \
                 WHERE machine_id = ?1 ORDER BY timestamp DESC LIMIT 200",
            )
            .map_err(|e| format!("prep log: {}", e))?;
        let log_iter = log_stmt
            .query_map(params![machine.id], |r| {
                Ok(ChangeLogEntry {
                    id: r.get(0)?,
                    machine_id: r.get(1)?,
                    timestamp: r.get(2)?,
                    action: r.get(3)?,
                    details_json: r.get(4)?,
                })
            })
            .map_err(|e| format!("query log: {}", e))?;
        let mut change_log = Vec::new();
        for r in log_iter {
            change_log.push(r.map_err(|e| format!("log row: {}", e))?);
        }

        let mut rep_stmt = conn
            .prepare(
                "SELECT id, machine_id, timestamp, file_path, kind FROM reports \
                 WHERE machine_id = ?1 ORDER BY timestamp DESC LIMIT 50",
            )
            .map_err(|e| format!("prep reports: {}", e))?;
        let rep_iter = rep_stmt
            .query_map(params![machine.id], |r| {
                Ok(ReportRef {
                    id: r.get(0)?,
                    machine_id: r.get(1)?,
                    timestamp: r.get(2)?,
                    file_path: r.get(3)?,
                    kind: r.get(4)?,
                })
            })
            .map_err(|e| format!("query reports: {}", e))?;
        let mut recent_reports = Vec::new();
        for r in rep_iter {
            recent_reports.push(r.map_err(|e| format!("report row: {}", e))?);
        }

        let mut con_stmt = conn
            .prepare(
                "SELECT id, machine_id, frequency, next_run, email_to, auto_actions, last_run \
                 FROM contracts WHERE machine_id = ?1 ORDER BY next_run ASC",
            )
            .map_err(|e| format!("prep contracts: {}", e))?;
        let con_iter = con_stmt
            .query_map(params![machine.id], |r| {
                let actions_json: String = r.get(5)?;
                let actions: Vec<String> = serde_json::from_str(&actions_json).unwrap_or_default();
                let freq: String = r.get(2)?;
                Ok(MaintenanceContract {
                    id: r.get(0)?,
                    machine_id: r.get(1)?,
                    frequency: parse_frequency(&freq),
                    next_run: r.get(3)?,
                    email_to: r.get(4)?,
                    auto_actions: actions,
                    last_run: r.get(6)?,
                })
            })
            .map_err(|e| format!("query contracts: {}", e))?;
        let mut contracts = Vec::new();
        for r in con_iter {
            contracts.push(r.map_err(|e| format!("contract row: {}", e))?);
        }

        Ok(EndpointBundle {
            machine,
            change_log,
            recent_reports,
            contracts,
        })
    })
    .await
    .map_err(|e| format!("get_machine_detail task: {}", e))?
}

#[tauri::command]
pub async fn export_endpoint_summary() -> Result<String, String> {
    // Snapshot the *current* machine into a JSON blob the operator can copy
    // off this PC and import into their main FreshRig instance later. Uses
    // a hostname-derived ID so collisions across customer machines are rare.
    tokio::task::spawn_blocking(|| {
        let hostname = whoami_hostname();
        let id = format!(
            "ep_{}",
            sha2_short(&format!("{}|{}", hostname, chrono_now()))
        );
        let machine = Machine {
            id,
            hostname: hostname.clone(),
            owner_name: hostname,
            serial_number: None,
            hardware_summary: short_hw_summary(),
            last_health_score: None,
            last_seen: chrono_now(),
            notes: None,
        };
        serde_json::to_string_pretty(&machine).map_err(|e| format!("serialize: {}", e))
    })
    .await
    .map_err(|e| format!("export task: {}", e))?
}

#[tauri::command]
pub async fn import_endpoint_summary(path: String, is_business: bool) -> Result<Machine, String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || {
        let raw = std::fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path, e))?;
        let machine: Machine =
            serde_json::from_str(&raw).map_err(|e| format!("parse endpoint json: {}", e))?;
        let conn = db::open()?;
        ensure_schema(&conn)?;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM machines", [], |r| r.get(0))
            .map_err(|e| format!("count: {}", e))?;
        if count as usize >= ENDPOINT_CAP_BUSINESS {
            return Err("ENDPOINT_CAP_REACHED".into());
        }
        conn.execute(
            "INSERT OR REPLACE INTO machines \
             (id, hostname, owner_name, serial_number, hardware_summary, last_health_score, last_seen, notes) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                machine.id,
                machine.hostname,
                machine.owner_name,
                machine.serial_number,
                machine.hardware_summary,
                machine.last_health_score.map(|n| n as i64),
                machine.last_seen,
                machine.notes,
            ],
        )
        .map_err(|e| format!("insert: {}", e))?;
        Ok(machine)
    })
    .await
    .map_err(|e| format!("import task: {}", e))?
}

// ───────── Maintenance contracts (Feature E) ─────────

#[tauri::command]
pub async fn list_contracts(
    machine_id: Option<String>,
) -> Result<Vec<MaintenanceContract>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        ensure_schema(&conn)?;
        let (sql, mid_filter) = if machine_id.is_some() {
            (
                "SELECT id, machine_id, frequency, next_run, email_to, auto_actions, last_run \
                 FROM contracts WHERE machine_id = ?1 ORDER BY next_run ASC",
                machine_id.clone(),
            )
        } else {
            (
                "SELECT id, machine_id, frequency, next_run, email_to, auto_actions, last_run \
                 FROM contracts ORDER BY next_run ASC",
                None,
            )
        };
        let mut stmt = conn.prepare(sql).map_err(|e| format!("prep: {}", e))?;
        let map = |r: &rusqlite::Row<'_>| {
            let freq: String = r.get(2)?;
            let actions_json: String = r.get(5)?;
            let actions: Vec<String> = serde_json::from_str(&actions_json).unwrap_or_default();
            Ok(MaintenanceContract {
                id: r.get(0)?,
                machine_id: r.get(1)?,
                frequency: parse_frequency(&freq),
                next_run: r.get(3)?,
                email_to: r.get(4)?,
                auto_actions: actions,
                last_run: r.get(6)?,
            })
        };
        let rows = if let Some(mid) = mid_filter {
            let iter = stmt
                .query_map(params![mid], map)
                .map_err(|e| format!("query: {}", e))?;
            collect_contracts(iter)?
        } else {
            let iter = stmt
                .query_map([], map)
                .map_err(|e| format!("query: {}", e))?;
            collect_contracts(iter)?
        };
        Ok(rows)
    })
    .await
    .map_err(|e| format!("list_contracts task: {}", e))?
}

fn collect_contracts<I>(iter: I) -> Result<Vec<MaintenanceContract>, String>
where
    I: Iterator<Item = rusqlite::Result<MaintenanceContract>>,
{
    let mut out = Vec::new();
    for r in iter {
        out.push(r.map_err(|e| format!("row: {}", e))?);
    }
    Ok(out)
}

#[tauri::command]
pub async fn create_contract(
    contract: MaintenanceContract,
    is_business: bool,
) -> Result<(), String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        ensure_schema(&conn)?;
        let actions_json = serde_json::to_string(&contract.auto_actions)
            .map_err(|e| format!("serialize actions: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO contracts \
             (id, machine_id, frequency, next_run, email_to, auto_actions, last_run) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                contract.id,
                contract.machine_id,
                frequency_str(&contract.frequency),
                contract.next_run,
                contract.email_to,
                actions_json,
                contract.last_run,
            ],
        )
        .map_err(|e| format!("insert contract: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("create_contract task: {}", e))?
}

#[tauri::command]
pub async fn delete_contract(id: String, is_business: bool) -> Result<(), String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || {
        let conn = db::open()?;
        ensure_schema(&conn)?;
        conn.execute("DELETE FROM contracts WHERE id = ?1", params![id])
            .map_err(|e| format!("delete: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("delete_contract task: {}", e))?
}

#[tauri::command]
pub async fn run_contract_now(id: String, is_business: bool) -> Result<(), String> {
    if !is_business {
        return Err("PRO_REQUIRED".into());
    }
    tokio::task::spawn_blocking(move || run_contract_internal(&id))
        .await
        .map_err(|e| format!("run_contract_now task: {}", e))?
}

/// Runs a single contract by id. Used by both `run_contract_now` (manual)
/// and the headless `run-contracts` task (scheduled). Logs the run in
/// change_log, optionally emails the recipient via SMTP (Feature E).
pub fn run_contract_internal(id: &str) -> Result<(), String> {
    let conn = db::open()?;
    ensure_schema(&conn)?;
    let (machine_id, email_to, actions_json, frequency_s): (
        String,
        Option<String>,
        String,
        String,
    ) = conn
        .query_row(
            "SELECT machine_id, email_to, auto_actions, frequency FROM contracts WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|e| format!("contract lookup: {}", e))?;

    let actions: Vec<String> = serde_json::from_str(&actions_json).unwrap_or_default();
    let now = chrono_now();
    let details = serde_json::json!({ "actions": actions }).to_string();
    conn.execute(
        "INSERT INTO change_log (machine_id, timestamp, action, details_json) VALUES (?1, ?2, ?3, ?4)",
        params![machine_id, now, "contract.run", details],
    )
    .map_err(|e| format!("log run: {}", e))?;

    let next = next_run_for(&parse_frequency(&frequency_s), &now);
    conn.execute(
        "UPDATE contracts SET last_run = ?1, next_run = ?2 WHERE id = ?3",
        params![now, next, id],
    )
    .map_err(|e| format!("update last_run: {}", e))?;

    if let Some(addr) = email_to {
        if !addr.trim().is_empty() {
            if let Err(e) =
                crate::commands::integrations::send_contract_email(&addr, &machine_id, &actions)
            {
                eprintln!("contract email failed: {}", e);
            }
        }
    }

    Ok(())
}

pub fn next_run_for(freq: &ContractFrequency, from_iso: &str) -> String {
    let secs = parse_iso_or_now(from_iso);
    let bump = match freq {
        ContractFrequency::Monthly => 30 * 86400,
        ContractFrequency::Quarterly => 90 * 86400,
        ContractFrequency::OnDemand => 365 * 86400,
    };
    iso_from_secs(secs + bump)
}

pub fn run_due_contracts() -> Result<usize, String> {
    let conn = db::open()?;
    ensure_schema(&conn)?;
    let now = chrono_now();
    let mut stmt = conn
        .prepare("SELECT id FROM contracts WHERE next_run <= ?1")
        .map_err(|e| format!("prep due: {}", e))?;
    let ids: Vec<String> = stmt
        .query_map(params![now], |r| r.get::<_, String>(0))
        .map_err(|e| format!("query due: {}", e))?
        .filter_map(Result::ok)
        .collect();
    drop(stmt);
    let mut count = 0;
    for id in ids {
        if run_contract_internal(&id).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

/// Headless entry point invoked by `freshrig --headless --task=run-contracts`.
/// Returns process exit code (0 = success, 1 = failure).
pub fn run_headless_contracts() -> i32 {
    match run_due_contracts() {
        Ok(n) => {
            println!("ran {} due contracts", n);
            0
        }
        Err(e) => {
            eprintln!("contract run failed: {}", e);
            1
        }
    }
}

// ───────── Tiny helpers (kept here to avoid pulling in chrono) ─────────

pub fn chrono_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    iso_from_secs(secs)
}

fn iso_from_secs(secs: u64) -> String {
    // Reproduces the same civil-from-days arithmetic used in profile_sync.rs.
    let days = (secs / 86400) as i64;
    let tod = (secs % 86400) as u32;
    let hour = tod / 3600;
    let min = (tod % 3600) / 60;
    let sec = tod % 60;
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hour, min, sec
    )
}

fn parse_iso_or_now(iso: &str) -> u64 {
    // Best-effort: extract YYYY-MM-DDTHH:MM:SSZ and convert to Unix seconds.
    // On any parse failure, fall back to "now" so a malformed timestamp
    // doesn't pin the contract to a stale value forever.
    let bytes = iso.as_bytes();
    if iso.len() < 19
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
    {
        return std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
    }
    let parse = |a: usize, b: usize| -> Option<u64> { iso[a..b].parse().ok() };
    let (Some(y), Some(m), Some(d), Some(hh), Some(mm), Some(ss)) = (
        parse(0, 4),
        parse(5, 7),
        parse(8, 10),
        parse(11, 13),
        parse(14, 16),
        parse(17, 19),
    ) else {
        return std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
    };
    days_from_civil(y as i64, m as u32, d as u32) as u64 * 86400 + hh * 3600 + mm * 60 + ss
}

fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u64;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) as u64 + 2) / 5 + d as u64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe as i64 - 719468
}

fn whoami_hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown-host".to_string())
}

fn short_hw_summary() -> String {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_all();
    let cpu = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_default();
    let ram_gb = (sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0).round();
    let os = System::long_os_version().unwrap_or_default();
    format!("{} • {} GB RAM • {}", cpu.trim(), ram_gb as u64, os)
}

fn sha2_short(s: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    let r = h.finalize();
    let mut out = String::with_capacity(16);
    for b in &r[..8] {
        out.push_str(&format!("{:02x}", b));
    }
    out
}
