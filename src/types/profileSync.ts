// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Mirrors the Rust `DetectedProfile` struct in
// `src-tauri/src/commands/profile_sync.rs`. Tauri auto-converts
// snake_case fields to camelCase via `#[serde(rename_all = "camelCase")]`.

export interface DetectedProfile {
  name: string;
  path: string;
  modifiedAt: string;
}
