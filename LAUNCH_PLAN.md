# FreshRig — Launch Plan (v2.2 → v3.0)

**Drafted:** 2026-05-06
**Strategy:** Launch-readiness first (per audit roadmap, Phase 8 in `AUDIT_2026-05-06.md`)
**Quality bar:** per-item PR-shaped commits — code change + clippy/tsc green + test where applicable + changelog line
**Scope:** top 10 items across 4 phases. macOS deferred until Mac access.

This document is the executable plan. Each item below has:
- the concrete files touched
- the test added (if applicable)
- the changelog entry
- the validation command
- a clear delineation of **🤖 my action** vs **🧑 your action**

---

## Phase 1 — Land what's already built (3 items)

### 1.1 Commit + push the hardening pass

**🤖 my action:** Generated `commit-hardening-pass.bat` (cmd.exe-safe, three-commit split).

**🧑 your action:** Run from cmd.exe:
```cmd
cd C:\Users\Seppe\Desktop\PROJECTS\FreshRig
commit-hardening-pass.bat
```

**Validation:** `git log --oneline -5` shows three new commits on top of `d2119eb`. `git status` is clean.

---

### 1.2 Verify CI passes after push

**🧑 your action:** Watch <https://github.com/ZIPREX420/freshrig/actions> for the CI run kicked off by the push. The new steps fire for the first time:
- `cargo audit --file src-tauri/Cargo.lock --deny warnings` — fails if a new RustSec advisory hits a transitive dep.
- `cargo test` — runs the 7 new `scrub_tests` (must all pass).

**If `cargo audit` fails:** open the output, find the advisory ID, add a documented entry to `src-tauri/.cargo/audit.toml` with the reason. Commit + push that as a separate `chore: suppress <RUSTSEC-id>` commit.

**If a `scrub_tests` test fails:** the test exposed a regex regression. Fix `scrub_sensitive_data` in `src-tauri/src/lib.rs` and amend.

---

### 1.3 Bump v2.2.0 → v2.3.0 + changelog

**🤖 my action:** edit 4 files + add changelog entry.

**Files:**
- `package.json` — `"version": "2.3.0"`
- `src-tauri/Cargo.toml` — `version = "2.3.0"`
- `src-tauri/tauri.conf.json` — `"version": "2.3.0"`
- `src/config/app.ts` — `APP_VERSION = "2.3.0"`
- `src/data/changelog.ts` — new top entry: hardening + bundle splitting + visual fixes

**Changelog entry covers:**
- CSP set + dev CSP for HMR
- `tauri-plugin-shell` removed; capabilities tightened
- Headless `pending-apply.json` ACL-restricted + version-envelope
- Cargo audit step in CI; license-readiness gate in release
- 7 unit tests for `scrub_sensitive_data`
- Route-level code splitting via `lazyNamed`; vendor chunks; preload-on-hover
- Dashboard: HDD chip GB→TB formatting; Network sparkline suppressed offline
- Cleanup empty state: "What gets scanned" preview grid

**🧑 your action:** Run validation, then:
```cmd
cargo generate-lockfile --manifest-path src-tauri/Cargo.toml
git add -A
git commit -m "chore: release v2.3.0"
git tag v2.3.0
git push origin main --tags
```

The tag-push triggers `release.yml`. Verify the draft GitHub release builds cleanly and contains the NSIS installer.

---

## Phase 2 — Pre-launch hardening (4 items)

### 2.4 P-1 — `run_with_timeout` subprocess helper

**🤖 my action:**
- New `src-tauri/src/runtime/mod.rs` and `src-tauri/src/runtime/timeout.rs`. (Or co-locate as `src-tauri/src/util_timeout.rs` if `runtime/` feels heavy — reuse `util.rs` namespace.)
- Implementation:
  ```rust
  use std::time::Duration;
  use tokio::process::Command;

  pub async fn run_with_timeout(
      mut cmd: Command,
      timeout: Duration,
  ) -> Result<std::process::Output, String> {
      let mut child = cmd.spawn().map_err(|e| format!("spawn: {e}"))?;
      let pid = child.id();
      match tokio::time::timeout(timeout, child.wait_with_output()).await {
          Ok(Ok(out)) => Ok(out),
          Ok(Err(e)) => Err(format!("wait: {e}")),
          Err(_) => {
              if let Some(pid) = pid {
                  let _ = std::process::Command::new("taskkill")
                      .args(["/F", "/T", "/PID", &pid.to_string()])
                      .output();
              }
              Err(format!("subprocess timeout after {:?}", timeout))
          }
      }
  }
  ```
- Retro-apply at every `Command::new` / `silent_cmd` call site:
  - `src-tauri/src/util.rs::silent_cmd` (Windows) — pass through to `run_with_timeout`
  - `src-tauri/src/commands/linux/util.rs::run_cmd` + `run_cmd_lossy`
  - `src-tauri/src/commands/macos/util.rs::run_cmd`
  - per-call timeout overrides in `commands/apps.rs::install_apps` (5 min), `commands/smart_monitor.rs` (15 s), `commands/cleanup.rs` (60 s)

**Tests:**
- `cargo test`: spawn `cmd /C "ping 127.0.0.1 -n 60"`, configure 1 s timeout, assert `Err(Timeout)`.
- spawn `cmd /C echo hi`, 5 s timeout, assert `Ok` with `"hi"` in stdout.

**Changelog:** "Reliability: subprocess calls now time out after 30 s by default (per-call override available); a hung WMI/winget/smartctl no longer freezes the GUI."

**Validation:** `cargo clippy -- -D warnings && cargo test`

---

### 2.5 S-5 — PowerShell injection audit

**🤖 my action:**
- `src-tauri/src/commands/network.rs::set_dns_servers`:
  - validate each entry in `dns_ips: Vec<String>` matches IPv4/IPv6 regex before formatting.
  - reject empty list early.
  - prefer the WMI/CIM-direct path via `Set-DnsClientServerAddress` cmdlet with `-ServerAddresses @("a","b")` argv form (each IP a separate argument string PowerShell parses without re-shell-interpolation).
- `src-tauri/src/commands/services.rs::apply_start_type_sync`:
  - Replace string interpolation with PowerShell here-strings + parameter binding, OR convert `start_type` to a strict enum match (`"Auto"` | `"Manual"` | `"Disabled"` | `"Boot"` | `"System"`) so the formatter only ever produces a known constant.
- Audit every other `format!()` that produces a PS script (`commands/network.rs::network_reset_full`, `commands/privacy.rs::*`, `commands/cleanup.rs::*`).

**Tests:**
- `cargo test`: feed `set_dns_servers` an entry like `"1.1.1.1\"); ipconfig; (\""` — assert `Err(InvalidIp)`.
- feed `apply_start_type_sync` a `start_type` outside the allowed set — assert `Err(InvalidStartType)`.

**Changelog:** "Security: hardened all PowerShell-formatting code paths against argument injection (CWE-78). Service start types and DNS IPs now go through a strict enum + IP-format validator."

**Validation:** `cargo clippy -- -D warnings && cargo test`

---

### 2.6 T-1 — Backend unit tests for pure helpers

**🤖 my action:** add `#[cfg(test)] mod tests {}` blocks to:
- `commands/privacy.rs` — registry path encode/decode (`#`↔`\` round-trip, control-char rejection)
- `commands/startup.rs` — FILETIME→UNIX conversion (epoch delta `11_644_473_600 s`, edge cases for null bytes, max u64)
- `commands/license.rs` — `validate_key_shape("FR-XXXXX-XXXXX")` (uppercase A-Z and 0-9 only, exact length, no whitespace), `resolve_tier(variant_id)` resolution
- `data/debloat_tweaks.rs` — `tier_for(tweak_id)` returns the right enum variant
- `commands/profile_sync.rs` — JSON profile parse + version-mismatch handling

**Target:** ~60 % line coverage on these pure helpers.

**Changelog:** "Tests: backfilled unit tests on registry path encoding, FILETIME conversion, license-key validation, debloat tier resolver, and profile sync parsing."

**Validation:** `cargo test --manifest-path src-tauri/Cargo.toml` — must show >0 new passing tests.

---

### 2.7 S-9 — Windows code signing

#### 2.7a Procurement guide (🧑 your action — pick one)

**Option A: SignPath Foundation (free for OSS)** — recommended if FreshRig stays MIT.
1. Apply at <https://signpath.io/foundation> with the FreshRig GitHub repo URL and a one-liner about the project.
2. Approval typically takes 2–5 business days.
3. SignPath gives you a CI integration token. They sign each release artifact when GitHub Actions calls their API.
4. No `.pfx` file in your repo or CI secrets — SignPath holds the cert.

**Option B: Azure Trusted Signing (~$10/mo)** — fastest, no waiting.
1. Provision via Azure portal: search "Trusted Signing" → Create.
2. Verify your identity (passport / driver's license + utility bill — takes 1–2 hours real-time).
3. Get the endpoint + auth pair.

**Option C: Traditional EV cert (~$200–500/yr)** — fastest reputation buildup with SmartScreen.
- Sectigo, DigiCert, GlobalSign all sell EV cert + USB token.
- Token must be in the build machine. Awkward for CI; harder to use with GitHub Actions runners.
- Not recommended.

#### 2.7b 🤖 my action (after you complete one of the above)

Add to `.github/workflows/release.yml` after the `tauri-action` step:

For **Option A (SignPath)**:
```yaml
- name: Sign with SignPath
  if: matrix.platform == 'windows-latest'
  uses: signpath/github-action-submit-signing-request@v1
  with:
    api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id: ${{ secrets.SIGNPATH_ORG_ID }}
    project-slug: freshrig
    signing-policy-slug: release-signing
    artifact-configuration-slug: nsis-installer
    github-artifact-id: ${{ steps.tauri.outputs.artifactId }}
```

For **Option B (Azure Trusted Signing)**:
```yaml
- name: Azure login
  if: matrix.platform == 'windows-latest'
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Sign installer
  if: matrix.platform == 'windows-latest'
  uses: azure/trusted-signing-action@v0.4
  with:
    endpoint: ${{ secrets.AZURE_SIGNING_ENDPOINT }}
    trusted-signing-account-name: ${{ secrets.AZURE_SIGNING_ACCOUNT }}
    certificate-profile-name: ${{ secrets.AZURE_SIGNING_PROFILE }}
    files-folder: src-tauri/target/release/bundle/nsis
    files-folder-filter: exe
    file-digest: SHA256
    timestamp-rfc3161: http://timestamp.digicert.com
    timestamp-digest: SHA256
```

**Changelog:** "Trust: Windows installers are now Authenticode-signed. SmartScreen warnings should disappear after a week or two of downloads."

**Validation:** Next release's `.exe` passes `signtool verify /pa` (run from any Win11 machine).

---

## Phase 3 — Launch (2 items, partly external)

### 3.8 LemonSqueezy setup + live-flip

#### 3.8a LemonSqueezy product setup (🧑 your action)

1. Create a LemonSqueezy account at <https://lemonsqueezy.com> if you don't have one.
2. **Create a Store** — name "FreshRig" or your preferred legal entity.
3. Note the numeric Store ID (URL: `https://app.lemonsqueezy.com/stores/<ID>`).
4. **Create a Product** — name "FreshRig Pro". Single product, multiple variants:
   - Variant 1: "Pro Monthly" — $5.99/month subscription
   - Variant 2: "Pro Annual" — $49/year subscription
   - Variant 3: "Pro Founder Lifetime" — $149 one-time, capped at first 500 buyers
   - Variant 4: "Business Monthly" — $14.99/month subscription
   - Variant 5: "Business Annual" — $149/year subscription
5. Note the numeric Product ID and the 5 Variant IDs.
6. **Get checkout URLs** — for each variant, copy the public checkout URL (right-click → Copy checkout URL). They look like `https://[your-store].lemonsqueezy.com/checkout/buy/[uuid]`.
7. **Test** — buy each variant once with the test card `4242 4242 4242 4242`. Confirm the license-key email arrives and the key matches the `FR-XXXXX-XXXXX` shape.

Once done, send me: `STORE_ID`, `PRODUCT_ID`, `PRO_MONTHLY_VARIANT`, `PRO_ANNUAL_VARIANT`, `PRO_FOUNDER_VARIANT`, `BUSINESS_MONTHLY_VARIANT`, `BUSINESS_ANNUAL_VARIANT`, plus the 5 checkout URLs.

#### 3.8b 🤖 my action (after IDs received)

Edit two files:

**`src-tauri/src/commands/license.rs:20-29`:**
```rust
const EXPECTED_STORE_ID: u64 = <STORE_ID>;
const EXPECTED_PRODUCT_ID: u64 = <PRODUCT_ID>;
const EXPECTED_PRO_VARIANT_IDS: &[u64] = &[
    <PRO_MONTHLY_VARIANT>,
    <PRO_ANNUAL_VARIANT>,
    <PRO_FOUNDER_VARIANT>,
];
const EXPECTED_BUSINESS_VARIANT_IDS: &[u64] = &[
    <BUSINESS_MONTHLY_VARIANT>,
    <BUSINESS_ANNUAL_VARIANT>,
];
```

**`src/config/app.ts:22-32`:**
- Replace `PRICING_PAGE_URL` with the per-variant checkout URLs:
  ```ts
  export const PRO_PURCHASE_URL_MONTHLY  = "<PRO_MONTHLY_CHECKOUT_URL>";
  export const PRO_PURCHASE_URL_ANNUAL   = "<PRO_ANNUAL_CHECKOUT_URL>";
  export const PRO_PURCHASE_URL_FOUNDER  = "<PRO_FOUNDER_CHECKOUT_URL>";
  export const BUSINESS_PURCHASE_URL_MONTHLY = "<BUSINESS_MONTHLY_CHECKOUT_URL>";
  export const BUSINESS_PURCHASE_URL_ANNUAL  = "<BUSINESS_ANNUAL_CHECKOUT_URL>";
  ```
  Keep `PRICING_PAGE_URL` as a separate export for the landing-page link.

**Tests:**
- `cargo test --release release_gate::lemonsqueezy_ids_set_for_release` — should pass for the first time (was a no-op in debug, asserts in release).
- Manual: build a release binary, paste a real license key from a test purchase, verify Pro features unlock.

**Changelog:** "Paid checkout: LemonSqueezy is now live. Pro and Business plans unlock through the in-app activation flow."

**Validation:** `cargo test --release release_gate::lemonsqueezy_ids_set_for_release` passes.

---

### 3.9 Cut v3.0 release

This is a major version bump because paid checkout going live is a user-visible breaking-class change in the licensing model.

**🤖 my action:** 4-file version bump to `3.0.0` + comprehensive changelog entry.

**🧑 your action:**
```cmd
cargo generate-lockfile --manifest-path src-tauri/Cargo.toml
git add -A
git commit -m "chore: release v3.0.0 — paid checkout live"
git tag v3.0.0
git push origin main --tags
```

Watch the release workflow:
- `release_gate::lemonsqueezy_ids_set_for_release` runs and passes.
- `tauri-action` produces `.exe` / `.deb` / `.rpm` / `.AppImage`.
- SignPath / Azure step signs the `.exe`.
- Updater payload + `latest.json` published.

Promote the draft GitHub release. Existing v2.x users auto-update on next launch.

---

## Phase 4 — Post-launch quick wins (1 item)

### 4.10 Q-1 — Slice `appStore`

**🤖 my action:** `src/stores/appStore.ts` (17 fields) → 5 stores under `src/stores/apps/`:
- `useAppCatalog` — `{ catalog, loading, fetch, checkInstalledApps, installedAppIds, hideInstalled, setHideInstalled }`
- `useAppSelection` — `{ selectedIds, toggle, selectAll, clearSelection, deselectCategory }`
- `useInstallProgress` — `{ installProgress, isInstalling, installSelected, retryFailed }`
- `useCustomApps` — `{ customApps, customAppInstalling, fetchCustomApps, addCustomApp, removeCustomApp, installCustomApp }`
- `useWingetSearch` — `{ wingetResults, isSearchingWinget, wingetAvailable, searchQuery, activeCategory, setSearchQuery, setActiveCategory, searchWinget, checkWinget }`
- `useAppPreflight` — `{ diskSpaceGb, networkAvailable, checkDiskSpace, checkNetwork }`

(That's 6 — the 17 fields naturally split into 6 cohesive groups, not 5. Will use 6.)

Migrate every consumer (grep for `useAppStore`):
- `src/components/apps/AppsPage.tsx` — main consumer
- `src/components/apps/AppCard.tsx`
- `src/components/apps/InstallProgressPanel.tsx`
- `src/components/apps/AddCustomAppDialog.tsx`
- `src/components/apps/WingetSearchResults.tsx`
- `src/components/apps/CategoryFilter.tsx`
- `src/components/apps/PresetSelector.tsx`
- `src/components/dashboard/ActionStrip.tsx` (if it touches apps)

Keep the old `useAppStore` as a thin re-export shim for one release so any external code (skill plugins?) doesn't break:
```ts
// src/stores/appStore.ts
/** @deprecated migrate to slice stores in src/stores/apps/ */
export const useAppStore = ...
```

**Tests:** spot-check existing happy paths still work via React DevTools — no formal test added (covered by future T-2 frontend test pass).

**Changelog:** "Internals: `appStore` was sliced into 6 cohesive stores under `stores/apps/`. Reduces re-renders on heavy consumers (AppsPage). Old `useAppStore` import kept as a deprecation shim."

**Validation:** `npx tsc --noEmit && npm run build` passes; AppsPage still renders correctly in `npm run tauri dev`.

---

## Backlog (post-launch v3.x)

The 9 audit items NOT in this top-10 push, in roughly this order:

1. **A-1 `FreshRigError` enum** — `thiserror`-based; touches every command return. Big diff, post-launch makes sense.
2. **A-2 `SystemBackend` trait** — incremental migration, one feature per PR.
3. **T-2 frontend tests** — vitest + Playwright + tauri-driver.
4. **T-3 coverage gating** — tarpaulin + vitest --coverage in CI.
5. **A-4 `ts-rs` type generation** — eliminates frontend↔backend type drift.
6. **Q-2 split AppsPage** — natural follow-up to Q-1.
7. **P-2 stream winget install progress** — reuses the events pattern from cleanup.
8. **P-4 stream cleanup scan progress** — same pattern.
9. **Q-7 lazy-load Dashboard heavy children** — HealthRing, SystemMetricsBar sparklines.
10. **S-6 add MAC to fingerprint**, **S-8 updater mirror endpoint** — security hardening.
11. **HMAC-sign headless marker** — once a GUI-side reader exists.
12. **A-3 commands/mod.rs hygiene macro** — declarative command registration.
13. **macOS fill-stubs** — once Mac access exists.

---

## Validation gates

After every commit in this plan:

```cmd
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npx tsc --noEmit
npm run build
```

If any fails, the commit is held until fixed. No half-work.

---

## Status legend (used in TASKS.md and below)

- `[ ]` not started
- `[~]` in progress
- `[!]` blocked on external action (you, vendor, GitHub, LemonSqueezy approval)
- `[x]` done

Mark each item as you go. The `dashboard.html` reads `TASKS.md` live.

---

## Current state, 2026-05-06

- Working tree at v2.2.0; ~26 modified files (hardening pass + visual fixes + your fmt drift) **uncommitted**.
- Phase 1.1 in flight; awaiting `commit-hardening-pass.bat` execution.
- Phases 2–4 queued; will execute in order, validation gate after each commit.
- Items A and B (cert procurement, LemonSqueezy setup) flagged as your external prerequisites — guides above.
