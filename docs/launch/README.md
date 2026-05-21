# FreshRig Launch Runbook

The end-to-end sequence for taking FreshRig from pre-launch to paid. Each phase
is either **automated** (one command) or **manual** (external accounts/legal).

Single source of truth for the paid launch: **`launch.config.json`** at the repo
root. The `scripts/launch.mjs` tool reads it and wires everything.

## Phase order

| Phase | What | How |
|---|---|---|
| 1 | Feature gaps (white-label reports, cross-platform license) + housekeeping | ✅ Done — shipped in the codebase |
| 3 | Wire LemonSqueezy checkout | `npm run go-live` (after `launch.config.json` is filled) |
| 4 | Domain + email + landing page | `docs/launch/DOMAIN_EMAIL_SETUP.md` + `node scripts/launch.mjs cname` |
| 5 | Belgian registration, VAT, MS Store | `docs/launch/LEGAL_CHECKLIST.md` (manual) |
| 6 | Cut the v2.6.0 release | folded into `npm run go-live`, then `git tag` |
| 7 | Marketing launch | `docs/launch/MARKETING_KIT.md` (ready-to-post copy) |
| 2 | Pricing/packaging decisions | **deferred to the end** — revisit `launch.config.json` + landing copy |

## The one-command launch

Once you have a live LemonSqueezy store and a registered domain:

```
# 1. Fill in launch.config.json (7 numbers + 5 URLs + domain).
npm run launch:check        # validates the config, reports what's missing

# 2. Wire everything (Phase 3 + 6): license.rs, app.ts, release.yml,
#    landing page, version bump, changelog, tsc validation.
npm run go-live

# 3. Validate Rust (the script can't — no toolchain assumption):
cargo generate-lockfile --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run build

# 4. Domain (if registered): write the GitHub Pages CNAME.
node scripts/launch.mjs cname

# 5. Commit + tag — this triggers the release workflow.
git add -A && git commit -m "feat: wire LemonSqueezy checkout — v2.6.0 paid launch"
git tag v2.6.0 && git push origin main --tags
```

## What `go-live` does (Phase 3 + 6)

- `src-tauri/src/commands/license.rs` — sets `EXPECTED_STORE_ID`,
  `EXPECTED_PRODUCT_ID`, `EXPECTED_PRO_VARIANT_IDS`, `EXPECTED_BUSINESS_VARIANT_IDS`.
- `src/config/app.ts` — sets the 5 checkout URLs, removes the `PRICING_PAGE_URL`
  pre-launch placeholder.
- `.github/workflows/release.yml` — removes the v2.3-v2.5 carve-out so the
  license release-readiness gate enforces real IDs on every future tag.
- `site/index.html` — JSON-LD version, founder counter, Founder + Pro CTA
  buttons → real checkout (Business button stays Contact Sales — a deferred
  Phase 2 decision).
- Version bump across all 4 files + a `src/data/changelog.ts` entry.
- Runs `npx tsc --noEmit`.

It never commits or tags — it prints the git commands for you to run after you
review the diff and pass `cargo clippy`.

## Safety net

`src-tauri/src/commands/license.rs` has a `release_gate` test that fails any
release build while the LemonSqueezy IDs are still placeholders. `go-live`
removes the CI carve-out that currently skips it — after launch, the gate
blocks any release that regresses the IDs.
