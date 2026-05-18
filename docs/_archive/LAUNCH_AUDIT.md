# FreshRig Launch-Readiness Guide

A repeatable playbook for auditing FreshRig before any public release. This document captures the methodology used for the v1.2.0 launch audit (commit `ed51c76`) and is structured so you can re-run the same review for v1.3.0, v2.0.0, or any future tag.

> **Most recent audit:** v1.2.0 — 11 issues fixed, 6 judgment calls deferred to product owner. See [v1.2.0 audit results](#v120-audit-results) below.

---

## Table of contents

1. [When to run this audit](#when-to-run-this-audit)
2. [Methodology](#methodology)
3. [Validation commands](#validation-commands)
4. [Severity rubric](#severity-rubric)
5. [Audit checklist](#audit-checklist)
6. [v1.2.0 audit results](#v120-audit-results)
7. [Open decisions (carry-forward)](#open-decisions-carry-forward)
8. [Pre-launch checklist](#pre-launch-checklist)
9. [Re-running this audit](#re-running-this-audit)
10. [Appendix: known-pattern allowlist](#appendix-known-pattern-allowlist)

---

## When to run this audit

Run this end-to-end when:

- Bumping to a new minor or major version (e.g. v1.2.0 → v1.3.0, v1.x → v2.0)
- Adding a new platform (we did this for Linux v1.1.0 and macOS v1.2.0)
- Before a marketing push or a paid-tier launch
- After a security advisory in any direct or transitive dependency

Skip the full audit for patch releases (vX.Y.Z+1) unless the patch touches license/security/cross-platform code. For patch releases run only the **validation commands**.

---

## Methodology

The full audit takes ~30 minutes of wall time and ~10 of human attention. Five phases:

### Phase 1 — Surface checks (~5 min)

Quick `Grep`/`Glob`/`Bash` sweeps for known smells:

```
- TODO|FIXME|XXX|HACK comments
- unwrap() / expect() in src-tauri/src/
- console.log/warn/error/debug in src/
- ': any' or 'as any' in src/
- Hardcoded version strings (should use APP_VERSION)
- Stale username/URL references (Sepje420 vs ZIPREX420)
- Missing favicon links in site/*.html
- Cargo.toml description / package.json metadata gaps
- Placeholder license constants (EXPECTED_STORE_ID = 0 etc.)
```

### Phase 2 — Three parallel deep-audit agents (~10 min wall, parallel)

Spawn three `Explore` subagents in a single message with self-contained briefs:

1. **Rust backend audit** — panic safety, error handling, process spawning (silent_cmd discipline), cross-platform handler twins in `lib.rs`, license validation, Tauri config, Cargo dependencies, WMI timeouts, winget invocation, JSON parsing safety, crash-log scrubbing, portable mode.
2. **Frontend / React audit** — stale UI references, type safety, React anti-patterns, cross-platform UX gating in `Sidebar.tsx` + page-level invokes, error handling on every `await invoke()` and `.then()`, accessibility (aria-label/role/alt), strings/i18n consistency, license + settings store persistence, theme tokens, console logs, bundle size, lucide icon name validity.
3. **Docs + metadata audit** — version consistency across all 4+ files, description/tagline drift, URL consistency, README.md/CLAUDE.md/CONTRIBUTING.md/SECURITY.md accuracy, changelog ordering + accuracy, landing page links + content, GitHub workflow files, dependabot/release/FUNDING/ISSUE_TEMPLATE, package.json metadata, favicon presence, OG image format.

Each agent reports findings in markdown with severity tags (BLOCKER/HIGH/MEDIUM/LOW/NIT) and `file:line` citations.

### Phase 3 — Tooling validation (~5 min)

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tsc --noEmit
npm run build
npm audit
cd src-tauri && cargo audit && cd ..
```

All six must pass clean. The `cargo audit` allow-list lives in `src-tauri/.cargo/audit.toml` — update only with documented rationale.

### Phase 4 — Live preview verification (~5 min)

Start the static landing page server and visually verify:

```bash
# .claude/launch.json already has a "Landing Page" config:
#   { "name": "Landing Page", "runtimeExecutable": "npx",
#     "runtimeArgs": ["--yes", "serve", "-l", "4173", "site"], "port": 4173 }
```

In-preview checks:

- Hero CTA auto-detects to your OS (`USER_OS` evaluates correctly)
- Version badge shows clean `v1.2.0` (no double-v)
- "Other platforms →" link goes to `download.html`
- Top-right nav button matches your OS (visible only ≥ sm: 640px)
- Comparison table accurate
- FAQ entries still accurate
- `download.html` OS tabs switch correctly
- Linux distro sub-tabs (Ubuntu/Debian, Fedora, Arch/AUR, AppImage) all work
- Copy buttons → "✓ Copied" → reverts after 2s
- macOS panel shows Coming Soon explainer
- No console errors
- Favicon serves 200 OK with `image/svg+xml` (or PNG once added)

For the Tauri app itself (when changes affect React UI), run `npm run tauri dev` and click through every Sidebar item to verify nothing throws.

### Phase 5 — Synthesize + fix + report

- Sort all findings into the [severity rubric](#severity-rubric)
- Apply safe + obvious fixes (HIGH copy errors, MEDIUM metadata gaps, LOW polish)
- List judgment-call items in the launch-readiness report so the product owner can decide
- Re-run validation
- Single `chore: launch-readiness audit fixes` commit
- Push, then write the human-readable report

---

## Validation commands

The minimum validation set, as a copy-pasteable block:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tsc --noEmit
npm run build
npm audit
```

`cargo audit` runs without `--manifest-path`:

```powershell
cd src-tauri ; cargo audit ; cd ..
```

All must exit clean. `npm run build` will emit two pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` warnings (TitleBar + SettingsPage) — those are non-blocking and tracked.

---

## Severity rubric

| Tag | Meaning | Example |
|---|---|---|
| **BLOCKER** | Will crash for end users, ship broken binaries, or expose secrets | `.expect()` panic during startup; license validation skipped due to placeholder IDs going live |
| **HIGH** | Real user-visible bug or strongly stale messaging | Sidebar shows page that errors on click for non-Windows users; tagline still says "Windows only" after Linux/macOS shipped |
| **MEDIUM** | Polish item that should be fixed but doesn't break the product | Missing favicon; package.json missing `repository` field |
| **LOW** | Optional improvement; cosmetic | OG image as PNG vs SVG fallback |
| **NIT** | Suggestion / observation; no action expected | Existing `#![allow(dead_code)]` on intentional scaffolding |

---

## Audit checklist

Use this as a printed checklist during the audit. Each item produces a finding (or a confirmed ✅).

### Backend / Rust

- [ ] Every `.unwrap()` / `.expect()` in `src-tauri/src/` is on infallible-by-construction data (constant arrays, `Default` impls). Anything that could fail at runtime → safe fallback.
- [ ] Every `panic!` / `unreachable!` / `todo!` / `unimplemented!` is justified with a comment.
- [ ] Every Tauri command returns `Result<T, String>` with actionable error messages (not just `?`-propagated stack traces).
- [ ] Every `Command::new("cmd")` / `Command::new("powershell")` on Windows uses `crate::util::silent_cmd()`. Linux + macOS subtrees use `Command::new` directly.
- [ ] Every winget call is wrapped with `cmd /C "chcp 65001 >nul && winget ..."` per CLAUDE.md.
- [ ] Every WMI query has a timeout (5-second per-query is the documented standard).
- [ ] `tauri::generate_handler!` in `lib.rs`: every cross-platform command has Windows + Linux + macOS arms cfg-gated. Windows-only commands (license, profiles, winget_search, installed_apps, debloat, custom_apps, context_menu) have only the Windows arm.
- [ ] `commands/mod.rs` and `platform/mod.rs` cfg-gates align.
- [ ] `src-tauri/src/commands/license.rs`: `EXPECTED_STORE_ID` and `EXPECTED_PRODUCT_ID` populated with real LemonSqueezy IDs (or accept dev-mode risk knowingly).
- [ ] `src-tauri/Cargo.toml` description matches reality.
- [ ] `src-tauri/.cargo/audit.toml` allow-list still has accurate rationale.
- [ ] `src-tauri/src/lib.rs::scrub_sensitive_data` regexes correctly redact MAC/serial/username without over-matching backtrace addresses.
- [ ] Tauri `bundle.targets` in `tauri.conf.json` matches the active CI matrix (`nsis`/`deb`/`rpm`/`appimage` always; `dmg`/`app` if macOS CI is enabled).
- [ ] Updater pubkey + endpoints in `tauri.conf.json` correct; private key still secret.

### Frontend / React

- [ ] No `: any` or `as any` types in `src/`.
- [ ] No `// @ts-ignore` / `// @ts-expect-error` comments.
- [ ] No stray `console.log` / `console.debug`. Targeted `console.error("...:", err)` in stores is OK.
- [ ] Every `await invoke('...')` call is wrapped in try/catch or `.then().catch()` with a user-facing toast.
- [ ] Every `useEffect` cleanup function returns or no-ops cleanly.
- [ ] Every `.map()` render has a unique `key`.
- [ ] No hardcoded version strings; all use `APP_VERSION` from `src/config/app.ts`.
- [ ] No hardcoded `"FreshRig"`; all use `APP_NAME`.
- [ ] `Sidebar.tsx` `WINDOWS_ONLY` set includes every page that calls Windows-only `invoke`s. Currently: `optimize`, `contextMenu`, `profiles`.
- [ ] All AboutPage links point to live URLs (or are clearly placeholders for unprovisioned domains).
- [ ] All copy that says "Windows" describes Windows-only behavior; cross-platform behavior says so.
- [ ] License store uses persistent storage (`localStorage` via `tauri-plugin-store` or `createJSONStorage`).
- [ ] Trial replay protection: `trialStartedAt` survives app restart.
- [ ] Lucide icon names all exist in the installed `lucide-react` version.
- [ ] Modal dialogs have `role="dialog"` + `aria-modal` + `aria-labelledby`.
- [ ] Icon-only buttons have `aria-label`.

### Docs + metadata

- [ ] Version matches across `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `package.json`, `src/config/app.ts`, `site/index.html` JSON-LD `softwareVersion`, and the newest `src/data/changelog.ts` key.
- [ ] `src-tauri/Cargo.toml` description, `package.json` description, `<meta name="description">`, `og:description`, and the AboutPage tagline all describe current platforms.
- [ ] All `github.com/<org>/freshrig` URLs use the canonical `ZIPREX420`.
- [ ] No stale `Sepje420` URL references (the git committer alias is unrelated to GitHub URLs).
- [ ] LemonSqueezy purchase URL in `src/config/app.ts::PRO_PURCHASE_URL` is correct.
- [ ] Contact emails in `SECURITY.md` and `site/privacy.html` / `site/terms.html` are real.
- [ ] README Platform Support table accurate (✅ Stable / 🔜 Coming Soon).
- [ ] CLAUDE.md "What this project is" + tech stack reflect current platforms.
- [ ] CLAUDE.md `## macOS support` admonition matches the current CI state (enabled or disabled).
- [ ] CONTRIBUTING.md prerequisites cover Windows, Linux, and macOS contributors.
- [ ] SECURITY.md contact + supported-versions accurate.
- [ ] changelog.ts entries in descending order, newest entry matches what shipped.
- [ ] Comparison table on `site/index.html` accurate per competitor.
- [ ] FAQ entries on `site/index.html` accurate post-release.
- [ ] All `site/*.html` pages have `<link rel="icon">`.
- [ ] OG image referenced in `og:image` exists in `site/assets/`.
- [ ] `package.json` has `description`, `repository`, `bugs`, `homepage`, `keywords`, `author`, `license`.

### Workflows + release

- [ ] `.github/workflows/ci.yml` matrix matches what we want to validate (currently `[windows-latest, ubuntu-22.04]` — macOS intentionally disabled).
- [ ] `.github/workflows/release.yml` matrix matches CI matrix.
- [ ] Apple env vars only present in release.yml when macOS-latest is in the matrix.
- [ ] Tag pushed only after `Cargo.lock` is regenerated (`cargo generate-lockfile --manifest-path src-tauri/Cargo.toml`) and committed.
- [ ] Release tag matches `version` in tauri.conf.json + Cargo.toml + package.json + app.ts.

---

## v1.2.0 audit results

Audit run on `2026-04-26`. Source-of-truth commit before audit: `bda9c74`. Audit-fixes commit: `ed51c76`.

### Tooling baseline

| Tool | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo clippy -D warnings` | ✅ clean |
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ built in 2.41s |
| `npm audit` | ✅ 0 vulnerabilities (193 deps) |
| `cargo audit` | ✅ clean (17 allowed warnings = 2 documented suppressions × transitive duplicates) |

### Issues fixed in `ed51c76`

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | HIGH | `src/components/about/AboutPage.tsx:96` | "Pro features coming soon" contradicted v1.0.0 Pro launch |
| 2 | HIGH | `src/config/app.ts:5` | `APP_TAGLINE` was Windows-only |
| 3 | HIGH | `src-tauri/Cargo.toml:4` | Crate description still said "fresh Windows install" |
| 4 | HIGH | `README.md:24` | "free, open-source Windows desktop app" → cross-platform |
| 5 | HIGH | `README.md:42` | Hardware Dashboard listed only WMI |
| 6 | HIGH | `CLAUDE.md:4-9` | "What this project is" + tech stack still Windows-only |
| 7 | HIGH | `src/components/layout/Sidebar.tsx:54-62` | **Real bug**: `profiles` page visible on Linux/macOS but commands are Windows-only — moved into `WINDOWS_ONLY` set |
| 8 | HIGH | `src-tauri/src/portable.rs:18-22` | Two `.expect()` calls could panic during startup — replaced with safe fallbacks |
| 9 | MEDIUM | `package.json` | Missing description/repository/bugs/homepage/keywords/author/license |
| 10 | MEDIUM | `site/{index,download,privacy,terms}.html` | Blank browser-tab icon — added SVG favicon |
| 11 | MEDIUM | `site/privacy.html:45` | "What FreshRig Does" only mentioned WMI |

---

## Open decisions (carry-forward)

These items were intentionally deferred to the product owner. Re-evaluate before each launch.

### 🔴 Real launch blocker if going live with paid Pro

**`src-tauri/src/commands/license.rs:11-12`**

```rust
const EXPECTED_STORE_ID: u64 = 0;
const EXPECTED_PRODUCT_ID: u64 = 0;
```

Both `0` skip the LemonSqueezy store/product matching guard (the comment in `license.rs` documents this as dev-friendly). With these values, **any** valid LemonSqueezy license key from any LemonSqueezy account will activate Pro on FreshRig. Replace with the real numeric IDs from your LemonSqueezy dashboard before the first paid sale.

### 🟡 Polish before launch

| Area | Decision needed |
|---|---|
| Favicon | Currently `og-image.svg` placeholder. Generate a dedicated 32×32 + 16×16 PNG set for crisper rendering at small sizes. |
| OG image fallback | `og-image.svg` works but Twitter/Facebook scrapers prefer 1200×630 PNG. Add a PNG fallback for better social previews. |
| Mobile nav menu | Below 640px the right-side Download button hides; below 768px the Features/Pro/Pricing/FAQ links hide. No hamburger menu. Mobile users can scroll but can't jump. |
| `https://freshrig.app` | Placeholder in `AboutPage.tsx:19`. Register the domain or remove. |
| `https://discord.gg/freshrig` | Placeholder in `AboutPage.tsx:22`. Create or remove. |
| `security@freshrig.app` | Placeholder in `SECURITY.md:11`. Provision the alias or replace with the real `seppewillemsens@icloud.com` only. |
| Comparison table breadth | Currently FreshRig / Ninite / WinUtil / Manual. Adding Wintoys + linutil columns would broaden the cross-platform claim. |
| WMI per-query timeouts | `commands/hardware.rs` wraps the entire batch in a 15s timeout. CLAUDE.md documents 5s per-query as the standard. Pre-existing pattern; not a regression. Worth a follow-up issue. |

### 🟢 Acknowledged risks (no fix needed)

| Pattern | Why it's acceptable |
|---|---|
| `serde_json::Value` field accesses use `.and_then(...)` chains in macOS `report.rs`/`hardware.rs` | Silent degradation if `system_profiler` schema changes — never panics. Could add structured logging later. |
| `#![allow(dead_code)]` on `platform/mod.rs` | Intentional scaffolding documented in the file. |
| 2 `cargo audit` advisories suppressed | `glib 0.18.5` (RUSTSEC-2024-0429) is Linux-only via gtk-rs 0.18; `rand 0.7.3` (RUSTSEC-2026-0097) is build-time codegen via `kuchikiki`. Both transitive Tauri deps with no patch path until upstream upgrades. Documented in `src-tauri/.cargo/audit.toml`. |
| macOS CI disabled in the matrix | Apple Developer secrets not yet configured. macOS Rust code is in place behind `#[cfg(target_os = "macos")]`. Re-enable steps documented in CLAUDE.md `## macOS support`. |

---

## Pre-launch checklist

Run this immediately before pushing the release tag:

1. [ ] `EXPECTED_STORE_ID` and `EXPECTED_PRODUCT_ID` populated in `license.rs` (or accept dev-mode risk in writing).
2. [ ] All four version files at the new version: `tauri.conf.json`, `Cargo.toml`, `package.json`, `app.ts`.
3. [ ] `Cargo.lock` regenerated: `cargo generate-lockfile --manifest-path src-tauri/Cargo.toml`.
4. [ ] New changelog entry added to `src/data/changelog.ts` (top of the file).
5. [ ] All six validation commands pass clean.
6. [ ] `npm audit` shows 0 vulnerabilities.
7. [ ] `cargo audit` clean (only documented suppressions).
8. [ ] Live preview verified: hero CTA + nav button auto-detect, version badge clean, download.html tabs work.
9. [ ] If Pro features touched: license activation tested with the LemonSqueezy test key from CLAUDE.md.
10. [ ] If macOS CI re-enabled: all 6 Apple secrets present in GitHub repo settings.
11. [ ] Decide on `https://freshrig.app`, `discord.gg/freshrig`, `security@freshrig.app` — provision or remove.
12. [ ] Tag + push: `git tag vX.Y.Z && git push origin main --tags`.
13. [ ] Watch the release workflow run; verify the draft release has the expected artifacts (`.exe`, `.deb`, `.rpm`, `.AppImage`, plus `.dmg` if macOS enabled).
14. [ ] Promote draft release to published once artifacts are verified.

---

## Re-running this audit

Quick playbook to repeat the audit before the next launch:

```bash
# 1. Pull latest main
git pull origin main

# 2. Surface checks (run in parallel via a single message)
#    - Grep for TODO|FIXME|XXX|HACK
#    - Grep for unwrap()|expect( in src-tauri/src/
#    - Grep for console\.(log|warn|error|debug) in src/
#    - Grep for ': any' or 'as any' in src/
#    - Glob site/assets/* + check for favicon
#    - Grep for EXPECTED_STORE_ID|EXPECTED_PRODUCT_ID

# 3. Spawn 3 parallel Explore agents (single message, 3 tool calls)
#    See "Phase 2" above for the prompts.

# 4. Tooling validation
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tsc --noEmit
npm run build
npm audit
cd src-tauri && cargo audit && cd ..

# 5. Live preview
#    Use mcp__Claude_Preview__preview_start with the "Landing Page" config
#    (already in .claude/launch.json).
#    Verify the in-preview checklist from Phase 4.

# 6. Apply safe fixes, re-validate, single commit:
git add -A && git commit -m "chore: launch-readiness audit fixes" && git push origin main
```

---

## Appendix: known-pattern allowlist

Things that look like findings but are intentional. Don't re-flag.

| Location | Pattern | Why it's intentional |
|---|---|---|
| `.cargo/audit.toml` ignored advisories | `RUSTSEC-2024-0429` (glib 0.18.5), `RUSTSEC-2026-0097` (rand 0.7.3) | Both transitive Tauri deps with no upstream patch yet. Documented in CLAUDE.md "Known upstream issues". Re-evaluate when Tauri bumps gtk-rs or replaces kuchikiki. |
| `platform/mod.rs:4` | `#![allow(dead_code, unused_imports)]` | Scaffolding for future commands as they migrate off direct WMI/winreg calls. Documented inline. |
| `commands/macos/util.rs` | `STUB_ERR` const | Legacy from the v1.2.0 stub-then-implement workflow. Harmless after stubs went away; left in place in case any future macOS command needs it. |
| `commands/macos/report.rs` etc. | `#![allow(dead_code)]` | Same intentional pattern as Linux: structs defined for forward use, gated. |
| `src-tauri/src/lib.rs` `scrub_sensitive_data` | Regex `\b[0-9A-Fa-f]{20,}\b` for serial scrubbing | May over-redact long backtrace addresses. Acceptable trade-off — over-scrubbing is safer than under-scrubbing for crash logs. |
| `src/components/about/AboutPage.tsx:19,22` | `https://freshrig.app`, `discord.gg/freshrig` | Forward-looking placeholders. Tracked in [open decisions](#open-decisions-carry-forward). |
| `SECURITY.md:11` | `security@freshrig.app coming soon` | Placeholder. Real contact below it. Tracked in [open decisions](#open-decisions-carry-forward). |
| `site/index.html` GitHub fetch | `data.tag_name.replace(/^v/, '')` | Defensive: GitHub API returns `v1.2.0` and HTML literal already prints `v` — strip to avoid `vv1.2.0`. |
| Sidebar `WINDOWS_ONLY` set | `optimize`, `contextMenu`, `profiles` | Each calls Windows-only commands in `lib.rs`. If a new Pro page launches Windows-only, add it here. |
| `EXPECTED_STORE_ID = 0` | Dev-friendly skip in `license.rs` | Documented in CLAUDE.md as intentional. **Becomes a launch blocker** when shipping paid Pro. |

---

*Last updated: 2026-04-26 · v1.2.0 audit · commit `ed51c76`*
