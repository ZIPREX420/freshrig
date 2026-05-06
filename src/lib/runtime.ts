// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Runtime detection helpers. Centralizes the awkward `__TAURI_INTERNALS__`
// check so individual components don't repeat the cast.

/**
 * True when this code is running inside the Tauri webview.
 * False when running in a regular browser (e.g. `vite preview`,
 * vitest happy-dom, or Storybook). Use this to guard `invoke()`
 * calls that would otherwise throw at module init.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}
