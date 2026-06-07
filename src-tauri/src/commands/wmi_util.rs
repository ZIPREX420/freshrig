// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Shared WMI Variant extraction helpers for the Windows command modules.
//
// Only `extract_u32` lives here: it was byte-identical in `hardware.rs` and
// `report.rs`. `extract_string` is deliberately NOT shared — those two modules
// need different missing-field fallbacks ("Unknown" vs ""), so each keeps its
// own. `extract_u64` has a single caller (report.rs) and stays there.
use std::collections::HashMap;

/// Coerce a WMI `Variant` map entry into a `u32`, accepting the integer shapes
/// WMI commonly returns plus a numeric string. `None` for missing/unparseable.
pub fn extract_u32(map: &HashMap<String, wmi::Variant>, key: &str) -> Option<u32> {
    match map.get(key) {
        Some(wmi::Variant::UI4(n)) => Some(*n),
        Some(wmi::Variant::I4(n)) => Some(*n as u32),
        Some(wmi::Variant::UI2(n)) => Some(*n as u32),
        Some(wmi::Variant::String(s)) => s.parse().ok(),
        _ => None,
    }
}
