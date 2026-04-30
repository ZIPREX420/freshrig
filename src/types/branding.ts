// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Mirror of the Rust `Branding` struct in
// `src-tauri/src/commands/branding.rs` (camelCase via #[serde(rename_all)]).

export interface Branding {
  logoPath: string | null;
  shopName: string;
  phone: string;
  email: string | null;
  customUrl: string | null;
  primaryColorHex: string;
  hidePoweredBy: boolean;
}

export const DEFAULT_BRANDING: Branding = {
  logoPath: null,
  shopName: "",
  phone: "",
  email: null,
  customUrl: null,
  primaryColorHex: "#00d4aa",
  hidePoweredBy: false,
};
