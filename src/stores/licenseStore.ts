// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { TRIAL_DAYS } from "../config/app";

export type LicenseTier = "free" | "pro" | "business";

const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Validate license key format. Keys must match: FR-XXXXX-XXXXX
 * where X is [A-Z0-9]. Cheap client-side gate before hitting the API.
 */
export function isValidLicenseFormat(key: string): boolean {
  if (!key.startsWith("FR-")) return false;
  if (key.length < 10) return false;
  return /^FR-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(key);
}

interface LicenseResponse {
  valid: boolean;
  tier: LicenseTier;
  instanceId: string | null;
  licenseKey: string | null;
  customerName: string | null;
  customerEmail: string | null;
  expiresAt: string | null;
  error: string | null;
}

interface LicenseState {
  tier: LicenseTier;
  licenseKey: string | null;
  instanceId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  validatedAt: string | null;
  lastValidationAttemptAt: string | null;
  expiresAt: string | null;
  trialStartedAt: string | null;
  isPro: () => boolean;
  isBusiness: () => boolean;
  isTrial: () => boolean;
  trialDaysRemaining: () => number;
  canStartTrial: () => boolean;
  startTrial: () => { ok: boolean; error?: string };
  activate: (key: string) => Promise<{ ok: boolean; error?: string }>;
  revalidate: () => Promise<void>;
  clearLicense: () => void;
}

function isTauri(): boolean {
  return !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      tier: "free" as LicenseTier,
      licenseKey: null,
      instanceId: null,
      customerName: null,
      customerEmail: null,
      validatedAt: null,
      lastValidationAttemptAt: null,
      expiresAt: null,
      trialStartedAt: null,

      isPro: () => {
        const s = get();
        // Business inherits all Pro affordances; treat both paid tiers as Pro.
        if (s.tier === "pro" || s.tier === "business") return true;
        if (s.trialStartedAt) {
          const start = new Date(s.trialStartedAt).getTime();
          if (Date.now() - start < TRIAL_DURATION_MS) return true;
        }
        return false;
      },

      isBusiness: () => get().tier === "business",

      isTrial: () => {
        const s = get();
        if (s.tier === "pro" || s.tier === "business") return false;
        if (!s.trialStartedAt) return false;
        const start = new Date(s.trialStartedAt).getTime();
        return Date.now() - start < TRIAL_DURATION_MS;
      },

      trialDaysRemaining: () => {
        const s = get();
        if (!s.trialStartedAt) return 0;
        const start = new Date(s.trialStartedAt).getTime();
        const elapsed = Date.now() - start;
        const remaining = TRIAL_DURATION_MS - elapsed;
        return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
      },

      canStartTrial: () => get().trialStartedAt === null,

      startTrial: () => {
        const s = get();
        if (s.trialStartedAt) {
          return { ok: false, error: "Trial already used on this install" };
        }
        set({ trialStartedAt: new Date().toISOString() });
        return { ok: true };
      },

      activate: async (key: string) => {
        const trimmed = key.trim();
        if (!isValidLicenseFormat(trimmed)) {
          return { ok: false, error: "Expected format: FR-XXXXX-XXXXX" };
        }
        if (!isTauri()) {
          return { ok: false, error: "License activation requires the desktop app" };
        }
        try {
          const fingerprint = await invoke<string>("get_machine_fingerprint");
          const resp = await invoke<LicenseResponse>("activate_license", {
            licenseKey: trimmed,
            fingerprint,
          });
          if (!resp.valid) {
            return { ok: false, error: resp.error ?? "Activation failed" };
          }
          set({
            // Backend resolves tier from the LemonSqueezy variant_id; fall
            // back to "pro" if the response somehow omits a tier (defensive).
            tier: resp.tier ?? "pro",
            licenseKey: resp.licenseKey ?? trimmed,
            instanceId: resp.instanceId,
            customerName: resp.customerName,
            customerEmail: resp.customerEmail,
            validatedAt: new Date().toISOString(),
            lastValidationAttemptAt: new Date().toISOString(),
            expiresAt: resp.expiresAt,
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },

      revalidate: async () => {
        const state = get();
        if (state.tier === "free" || !state.licenseKey || !state.instanceId) return;
        if (!isTauri()) return;

        const attemptAt = new Date().toISOString();
        try {
          const resp = await invoke<LicenseResponse>("validate_license", {
            licenseKey: state.licenseKey,
            instanceId: state.instanceId,
          });
          if (resp.valid) {
            set({
              tier: resp.tier ?? state.tier,
              validatedAt: new Date().toISOString(),
              lastValidationAttemptAt: attemptAt,
              customerName: resp.customerName ?? state.customerName,
              customerEmail: resp.customerEmail ?? state.customerEmail,
              expiresAt: resp.expiresAt ?? state.expiresAt,
            });
            return;
          }
          // API responded "not valid" with a definitive reason → revoke.
          const err = (resp.error ?? "").toLowerCase();
          const isTransient =
            err.includes("network") || err.includes("timeout") || err === "";
          if (!isTransient) {
            get().clearLicense();
            return;
          }
          // Transient — fall through to grace-period check.
          set({ lastValidationAttemptAt: attemptAt });
        } catch {
          // Network/IPC failure → transient, record attempt.
          set({ lastValidationAttemptAt: attemptAt });
        }

        // Grace period: if last successful validation is older than 14 days
        // AND we've been failing since, revoke.
        const latest = get();
        if (latest.validatedAt) {
          const lastGood = new Date(latest.validatedAt).getTime();
          if (Date.now() - lastGood > GRACE_PERIOD_MS) {
            latest.clearLicense();
          }
        }
      },

      clearLicense: () =>
        set({
          tier: "free" as LicenseTier,
          licenseKey: null,
          instanceId: null,
          customerName: null,
          customerEmail: null,
          validatedAt: null,
          lastValidationAttemptAt: null,
          expiresAt: null,
        }),
    }),
    {
      name: "freshrig-license",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
