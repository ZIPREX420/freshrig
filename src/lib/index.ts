// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Barrel export for src/lib/* helpers. Lets callers write
//   `import { isTauri, invokeOrToast, lazyNamed } from "../../lib";`
// instead of three deep paths.

export { isTauri } from "./runtime";
export { invokeOrToast, type InvokeOptions } from "./invoke";
export { lazyNamed, preloadModule } from "./lazy";
