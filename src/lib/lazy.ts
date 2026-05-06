// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Lazy-loading helpers. Wraps React.lazy so call-sites are concise and
// type-preserving, plus a `preloadModule` primitive for hover/idle prefetch.

import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Lazy-load a named export from a module while preserving the component's
 * prop signature across the lazy boundary.
 *
 * Usage:
 *
 *   const SettingsPage = lazyNamed(
 *     () => import("./components/settings/SettingsPage"),
 *     "SettingsPage",
 *   );
 *   // SettingsPage now has the same prop type as the real export.
 *
 * The generic constraints flow types from the loader's return value, so
 * `<SettingsPage onNavigate={fn} />` is checked against the real component's
 * prop signature with no type cast. If the named export doesn't exist (or
 * was renamed without updating the call site), TypeScript fails at compile
 * time on `keyof M & string`, and the runtime fallback throws a readable
 * error so the failure isn't silent.
 */
export function lazyNamed<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  M extends Record<string, ComponentType<any>>,
  K extends keyof M & string,
>(
  loader: () => Promise<M>,
  exportName: K,
): LazyExoticComponent<M[K]> {
  return lazy(async () => {
    const mod = await loader();
    const Component = mod[exportName];
    if (!Component) {
      throw new Error(
        `lazyNamed: export "${String(exportName)}" not found in module ` +
          `(got: ${Object.keys(mod).join(", ")})`,
      );
    }
    return { default: Component };
  });
}

/**
 * Trigger a chunk download without rendering the component. Use on
 * `onMouseEnter` / `onFocus` of a nav link so the chunk is warm by click time.
 *
 * Dynamic imports are deduplicated by the browser/bundler — calling this
 * repeatedly with the same loader is cheap.
 *
 * Errors are swallowed: a failed preload is non-critical (the route's own
 * Suspense will surface the failure when the user actually navigates).
 */
export function preloadModule(loader: () => Promise<unknown>): void {
  loader().catch(() => {
    /* preload failed; the real load will surface the error */
  });
}
