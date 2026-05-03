// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { type as osType } from "@tauri-apps/plugin-os";

export const APP_NAME = "FreshRig";
export const APP_TAGLINE = "Set up any PC in minutes — Windows, Linux, and macOS";
export const APP_VERSION = "2.0.0";
export const BUILD_FINGERPRINT = `freshrig-${APP_VERSION}-${__BUILD_TIMESTAMP__}`;

// ───────── Pricing (v2.0 subscription model) ─────────

export const PRO_MONTHLY_PRICE = 5.99;
export const PRO_ANNUAL_PRICE = 49;
export const PRO_FOUNDER_LIFETIME_PRICE = 149;
export const PRO_FOUNDER_CAP = 500;
export const PRO_FOUNDER_DAYS = 30;

export const PRO_PURCHASE_URL_MONTHLY =
  "{LemonSqueezy Pro Monthly checkout URL}";
export const PRO_PURCHASE_URL_ANNUAL =
  "{LemonSqueezy Pro Annual checkout URL}";
export const PRO_PURCHASE_URL_FOUNDER =
  "{LemonSqueezy Founder Lifetime checkout URL}";

export const BUSINESS_MONTHLY_PRICE = 14.99;
export const BUSINESS_ANNUAL_PRICE = 149;

export const BUSINESS_PURCHASE_URL_MONTHLY =
  "{LemonSqueezy Business Monthly checkout URL}";
export const BUSINESS_PURCHASE_URL_ANNUAL =
  "{LemonSqueezy Business Annual checkout URL}";

export const SITE_PRICE = 1499;
export const SITE_CONTACT_URL = "mailto:sales@freshrig.app";

/**
 * Default checkout URL used by ProFeatureGate's upsell card. Points at the
 * annual Pro plan since that's the recommended path; the pricing page lets
 * users pick monthly / annual / founder explicitly.
 */
export const PRO_PURCHASE_URL = PRO_PURCHASE_URL_ANNUAL;

/** Price label shown in compact upsell UI. */
export const PRO_PRICE_LABEL = `From $${PRO_MONTHLY_PRICE}/mo`;

/** Free-trial duration in days (no credit card required). */
export const TRIAL_DAYS = 7;

// ───────── Platform constants ─────────

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
