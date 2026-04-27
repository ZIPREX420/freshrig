// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { type as osType } from "@tauri-apps/plugin-os";

export const APP_NAME = "FreshRig";
export const APP_TAGLINE = "Set up any PC in minutes — Windows, Linux, and macOS";
export const APP_VERSION = "1.2.1";
export const BUILD_FINGERPRINT = `freshrig-${APP_VERSION}-${__BUILD_TIMESTAMP__}`;

/** LemonSqueezy checkout URL for Pro purchases ($39 one-time). */
export const PRO_PURCHASE_URL = "https://freshrig.lemonsqueezy.com/buy/freshrig-pro";
/** Price shown in upsell UI. */
export const PRO_PRICE_LABEL = "$39 one-time";
/** Free trial duration in days. */
export const TRIAL_DAYS = 14;

/** Platform constants — resolved once at load from `@tauri-apps/plugin-os`. */
function detectPlatform(): string {
  try {
    return osType();
  } catch {
    return "windows";
  }
}
const PLATFORM = detectPlatform();
export const IS_WINDOWS = PLATFORM === "windows";
export const IS_LINUX = PLATFORM === "linux";
export const IS_MACOS = PLATFORM === "macos";
