// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Shared SQLite database used by Watchdog (snapshots) and SMART Monitor
// (history). Single file at `<data_dir>/freshrig.db`. Schema is created
// idempotently on every connection — no migration system yet, just
// `CREATE TABLE IF NOT EXISTS`.

use rusqlite::Connection;

use crate::portable::get_data_dir;

const DB_FILENAME: &str = "freshrig.db";

pub fn open() -> Result<Connection, String> {
    let path = get_data_dir().join(DB_FILENAME);
    let conn = Connection::open(&path).map_err(|e| format!("open {}: {}", path.display(), e))?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS smart_history (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            captured_at     TEXT NOT NULL,
            disk_id         TEXT NOT NULL,
            model           TEXT NOT NULL,
            serial          TEXT NOT NULL,
            disk_type       TEXT NOT NULL,
            overall_status  TEXT NOT NULL,
            temperature_c   INTEGER,
            power_on_hours  INTEGER,
            attributes_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_smart_history_disk
            ON smart_history(disk_id, captured_at DESC);

        CREATE TABLE IF NOT EXISTS snapshots (
            id                  TEXT PRIMARY KEY,
            created_at          TEXT NOT NULL,
            label               TEXT NOT NULL,
            restore_point_id    INTEGER,
            registry_export_dir TEXT,
            payload_json        TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_snapshots_created
            ON snapshots(created_at DESC);
        "#,
    )
    .map_err(|e| format!("init_schema: {}", e))
}
