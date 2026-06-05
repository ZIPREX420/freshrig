// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// errMessage — surface a backend error as the string the backend sent, or a
// caller-supplied fallback label when it is not a string.
//
// This mirrors, exactly, the `typeof e === "string" ? e : "<label>"` idiom that
// was duplicated across the page components (32 call sites, 9 files). Extracting
// it puts the coercion in one place without changing behavior.
//
// NOTE: this intentionally does NOT inspect `.message` or fall back to
// `String(e)` — callers depend on their specific label being shown for
// non-string errors. For the generic best-effort extraction used by the invoke
// wrapper, see `errorMessage` in ./invoke.ts.
export function errMessage(e: unknown, fallback: string): string {
  return typeof e === "string" ? e : fallback;
}
