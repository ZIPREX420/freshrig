# FreshRig — Architecture Change Report

**Date:** 2026-06-14
**Baseline:** v2.5.4 deep audit (`project_deep_audit_v2_5_4`)
**Scope:** Architecture improvements only — no features, no behavior changes.
**Goals:** maintainability, modularity, scalability, separation of concerns,
reduce technical debt, reduce coupling, improve type safety.

---

## Executive summary

Two architectural defects from the audit were addressed end-to-end:

1. **Frontend IPC boundary was stringly-typed and decentralized.** 105 raw
   `invoke()` calls used 87 magic command-name strings across 31 files, each
   supplying its own unchecked return generic. Two commands had already drifted
   into multiple declared return types. **Fix:** a single typed IPC contract
   (`src/lib/api.ts`) — one typed function per command — with every call site
   migrated to it.

2. **Backend built elevated shell strings by interpolating caller data
   (SEC-02), and spawned PowerShell for a value `sysinfo` already exposes
   (PERF-03).** The hardening helpers existed but no call site used them.
   **Fix:** routed every winget call through the validated `run_winget` choke
   point, converted custom-app installs to argument vectors, and replaced the
   PowerShell disk-space probe with `sysinfo`.

**Validation:** `npx tsc --noEmit` passes (the frontend type gate). Rust was
changed source-level and reviewed by hand; it must be validated natively with
`cargo clippy`/`cargo build` (the sandbox has no Rust toolchain, and
`node_modules` holds Windows-only native bundler bindings, so neither `cargo`
nor `vite build` can run here).

| Metric | Before | After |
|---|---:|---:|
| Files importing `@tauri-apps/api/core` | 31 | 2 (`lib/` only) |
| Raw `invoke()` calls outside `lib/` | 105 | 0 |
| Magic command-name strings at call sites | 87 | 3 (toast-path reads, by design) |
| Typed `api.*` command functions | 0 | 87 |
| Commands with conflicting declared return types | 2 | 0 |
| Elevated winget calls interpolating caller data | 6 | 0 |
| Process spawns for free-disk-space | 1 (PowerShell) | 0 |

---

## Change 1 — Typed IPC contract (`src/lib/api.ts`)

**Rationale.** The `invoke(name, args)` boundary is the seam between the React
UI and the Rust backend. With names as free strings and return types supplied
per-call, a typo or a wrong generic is a runtime failure, not a compile error;
there is no single place that enumerates the command surface; and 31 files are
hard-coupled to `@tauri-apps/api/core`. The drift was already real:
`list_profiles` was typed `ProfileSummary[]` in two files and
`{ filePath: string }[]` in a third; `get_hardware_summary` was typed three
different ways (`HardwareSummary`, a local `HardwareSummaryBrief`, and
`Record<string, unknown>`).

**Benefit.** One typed function per command makes the contract the single source
of truth: command names exist once, arguments and return types are checked at
compile time, and the UI depends on `lib` instead of the Tauri core module.
Adding or changing a command is now a one-line, type-checked edit. Layering is
explicit: components/stores → `lib` → `types`.

**Risk.** Low and additive. The new module only adds code; nothing imported it
until migration. The contract was derived mechanically from the existing call
sites (exact names, args, and the richest existing return type), so it mirrors
current behavior rather than redefining it.

**Implementation.** Created `src/lib/api.ts` exporting `const api` with 87 thin,
typed wrappers over `invoke`. Two IPC response DTOs that previously lived inside
a store/component (`LicenseResponse`, `WingetPackageDetails`) were relocated
into the contract so layering holds (lib never imports upward from
stores/components). Re-exported `api` and the two DTOs from `src/lib/index.ts`.

**Validation.** `tsc` green immediately after creation (compiles standalone).

---

## Change 2 — Migrate the 7 Zustand stores

**Rationale.** Stores are the data layer; decoupling them first establishes the
clean `stores → lib → types` direction.

**Benefit.** Store IPC is now type-checked end to end; the silent type drift in
`list_profiles` is gone (one canonical `ProfileSummary[]`).

**Risk.** Mechanical text transform — mitigated by a deterministic migration
script plus `tsc`.

**Implementation.** Replaced raw `invoke<T>("name", args)` with `api.fn(args)`
across `appStore`, `debloatStore`, `driverStore`, `hardwareStore`,
`licenseStore`, `profileStore`, `settingsStore` (30 calls). Removed the now-dead
local `LicenseResponse` interface (its type now comes from the contract). The
three "toast-on-error, return null" reads (`get_app_catalog`,
`get_custom_apps`, `search_winget_packages`) intentionally stay on
`invokeOrToast` — that helper is a deliberate, different control-flow path.

**Validation.** `tsc` green (one orphaned-interface error surfaced and fixed).

---

## Change 3 — Migrate the 23 components

**Rationale / Benefit.** Removes the last direct `@tauri-apps/api/core`
couplings in the UI; every command call in the app is now type-checked through
one contract.

**Risk.** More files and more orphaned per-call generic imports — handled by the
same script plus `tsc`, which pinpointed each unused import.

**Implementation.** Migrated all page/section components (incl. `App.tsx`).
Merged `api` into existing `lib` barrel imports where present; removed orphaned
type imports flagged by `tsc` (`DriftEntry` in `App.tsx`, `RigProfile` in
`BulkDeployPanel`). Converted the third `get_hardware_summary` call
(`SettingsPage`, previously `Record<string, unknown>`, only `JSON.stringify`-ed)
to the typed call. Tidied one multi-line call's formatting artifact.

**Validation.** `tsc` green. Post-checks: only `lib/api.ts` and `lib/invoke.ts`
import the Tauri core module; zero raw `invoke` calls remain outside `lib/`.

---

## Change 4 — SEC-02: route all winget through the validated choke point

**Rationale.** In an always-elevated process, every
`cmd /C "... winget ... {caller_data} ..."` string is a latent command-injection
class: a `&`, `|`, `&&`, or `%` in interpolated input is re-parsed by cmd.exe.
Six sites interpolated frontend-supplied data:
`install_apps` (`app_id`), `install_driver` (`winget_id`),
`get_winget_package_info` (`package_id`, JSON + table paths), and
`search_winget_packages` (`query`, JSON + table paths). Custom-app installs
handed an attacker-influencable path and user `silent_args` straight to
`cmd /C`. The hardening helpers (`is_valid_winget_id`, `quote_for_cmd`,
`run_winget`, `split_args`) already existed in `util.rs` with unit tests, but
**no call site used them** — the mitigation was half-built.

**Benefit.** Caller data can no longer reach a shell parser. IDs are validated
against an allowlist; the free-text search query is neutralized with
`quote_for_cmd`; custom installs run as an argument vector (no shell). All
winget invocations now flow through one auditable function (`run_winget`),
which also removes the duplicated `chcp 65001` boilerplate (separation of
concerns + reduced coupling to cmd.exe).

**Risk.** Behavior-preserving for legitimate input: winget package IDs are
`Publisher.Package` identifiers that satisfy the allowlist, and search queries
keep spaces/case via `quote_for_cmd`. Cannot be compiled in this environment —
**requires native `cargo` validation.** The changes touch elevated install
paths, so this is the highest-care item.

**Implementation.**
- `commands/apps.rs` — `install_apps`: validate `app_id`; emit a Failed
  progress event and `continue` on rejection; call
  `run_winget(["install","--id",app_id,...])`. `check_winget_available`:
  `run_winget(["--version"])`.
- `commands/drivers.rs` — `install_driver`: validate `winget_id`; return `Err`
  on rejection; call `run_winget([...])`. Import switched to the helpers.
- `commands/winget_search.rs` — all five winget calls (`--info`, search ×2,
  show ×2) routed through `run_winget`; `query` via `quote_for_cmd`;
  `package_id` via `is_valid_winget_id`. `silent_cmd` import removed.
- `commands/custom_apps.rs` — install builds a `Command` argument vector
  (`msiexec /i <path>` or `<exe>`), with `silent_args` tokenized by
  `split_args`; the `cmd /C` shell string is gone.

**Cross-platform safety.** All five modules are whole-module
`#[cfg(target_os = "windows")]`, so referencing the `#[cfg(windows)]`
`run_winget` cannot affect Linux/macOS builds. The shared helpers keep their
`#[cfg_attr(not(windows), allow(dead_code))]`, so no unused-symbol warnings on
any target. The static smartmontools install string in `smart_monitor.rs` is a
user-facing copy-paste instruction (not executed) and was correctly left alone.

**Validation.** Manual review of every changed function (types, borrows,
imports, return-type parity with the original `.output()` calls). **Native gate
required:** `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
then `cargo build`. The existing `util.rs` unit tests already cover the helpers.

---

## Change 5 — PERF-03: `sysinfo` instead of PowerShell for free disk space

**Rationale.** `get_free_disk_space_gb` shelled out to PowerShell
(`(Get-PSDrive C).Free / 1GB`) although `sysinfo` (0.39, already a dependency)
exposes the value in-process. The shell-out adds latency, a process spawn, and a
dependency on PowerShell being present.

**Benefit.** No subprocess; fewer moving parts on a pre-flight path that runs
before every batch install.

**Risk.** Low. Behavior preserved: free bytes on the `C:` system drive, returned
in GiB. API-version sensitivity (sysinfo 0.39 `Disks::new_with_refreshed_list()`)
is the only concern — confirmed against the crate's 0.39 idiom already used in
`fleet.rs`. The `disk` feature is on by default. **Requires native compile** to
confirm.

**Implementation.** `commands/apps.rs::get_free_disk_space_gb` now uses
`sysinfo::Disks`, finds the disk whose mount point starts with `C:`, and returns
`available_space()` as GiB.

**Validation.** Manual review; native `cargo build` required.

---

## Change 6 — REL-02: honest `install_apps` result contract

**Rationale.** `install_apps` returned `Ok(())` even when every install failed —
the awaiting caller had no synchronous pass/fail signal (per-app status only
streamed via `install-progress` events). A `models::apps::InstallSummary`
struct had been scaffolded for this but was never constructed (dead code that
broke `cargo -D warnings`). Wired on user request after the native build
surfaced it.

**Benefit.** The command now returns `InstallSummary { installed, failed,
skipped }`, giving callers a truthful outcome and activating the dead scaffold.
Fits the type-safety/tech-debt goals.

**Risk.** Backward-compatible: both call sites (`appStore` install + retry)
discard the return value, and the per-app progress events are unchanged, so no
UI behavior changes. The IPC payload now carries data the frontend currently
ignores.

**Implementation.** `commands/apps.rs::install_apps` accumulates three
`Vec<String>` (validated-but-rejected ids → `skipped`; winget success →
`installed`; winget non-success or exec error → `failed`) and returns
`Ok(InstallSummary { .. })`. Added the `InstallSummary` interface to
`src/types/apps.ts` and changed the contract's `api.installApps` return type
`void → InstallSummary`. Removed the interim `#[allow(dead_code)]`.

**Validation.** `tsc` green. Native `cargo build` required (struct is now
constructed, so the dead-code error is resolved).

---

## Residual technical debt (intentionally not changed)

These were out of scope (not architecture, or behavior-changing, or both) and
remain as follow-ups:

- **3 magic command strings** remain at the `invokeOrToast` call sites
  (`get_app_catalog`, `get_custom_apps`, `search_winget_packages`). Kept on
  purpose — `invokeOrToast` is a deliberate toast-and-null path; folding it into
  the typed contract would require changing the helper's signature.
- **SEC-01 (client-only entitlement)** — backend runs Pro commands without
  server-side verification. Real fix needs a backend entitlement check; it is
  behavioral and pre-launch, so excluded here.
- **CICD-01 / release-gate carve-out**, **A11Y items**, **REL-04 (migrations)**,
  **INFRA-05 (signing)** — not architecture refactors.
- **`invokeOrToast`'s** local `errorMessage` and the `errMessage` helper remain
  distinct by design (see `reference_frontend_action_helpers`).

---

## Validation status & required native steps

| Layer | In-sandbox | Required natively |
|---|---|---|
| Frontend types | `npx tsc --noEmit` — **PASS** | — |
| Frontend bundle | blocked (Windows-only rolldown binding in Linux sandbox) | `npm run build` |
| Rust | source review only (no toolchain) | `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` then `cargo build` |

> Native `cargo` run (user, 2026-06-14) compiled all SEC-02/PERF-03 changes cleanly; the only error was a **pre-existing** unconstructed `InstallSummary` struct, resolved by wiring REL-02 (Change 6).
| Rust unit tests | n/a | `cargo test` (covers `util.rs` SEC-02 helpers) |

**Rollback / checkpoint.** A pre-change snapshot of `src/` and `src-tauri/src/`
was taken before any edit. No version bump, changelog entry, commit, or tag was
made — this report documents source changes only.
