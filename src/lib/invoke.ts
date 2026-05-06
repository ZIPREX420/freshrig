// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Centralized `invoke` wrapper that surfaces backend errors as Sonner toasts.
// Replaces the silent-`catch` pattern that was scattered across stores
// (see audit Q-6: appStore.fetchCatalog, searchWinget; hardwareStore.fetchHardware).
//
// Usage:
//   const catalog = await invokeOrToast<AppCatalog>("get_app_catalog");
//   if (catalog) set({ catalog });
//
// For commands where you want to handle the error yourself, pass `silent: true`.
// For commands that should propagate, pass `rethrow: true`.

import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export interface InvokeOptions {
  /** Suppress the automatic toast on error. Default: false. */
  silent?: boolean;
  /** Rethrow the error after showing/suppressing the toast. Default: false. */
  rethrow?: boolean;
  /** Override the toast title. Default: `<command> failed`. */
  errorTitle?: string;
}

/**
 * Invoke a Tauri command and surface failures as Sonner toasts.
 * Returns `null` on failure (unless `rethrow: true`).
 */
export async function invokeOrToast<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: InvokeOptions,
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    const message = errorMessage(raw);
    if (!options?.silent) {
      toast.error(options?.errorTitle ?? `${command} failed`, {
        description: message,
      });
    }
    if (options?.rethrow) throw raw;
    return null;
  }
}

function errorMessage(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    if ("message" in raw && typeof (raw as { message: unknown }).message === "string") {
      return (raw as { message: string }).message;
    }
  }
  return String(raw);
}
