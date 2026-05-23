# FreshRig Improvement Masterplan

*Drafted 2026-05-21, synthesizing three parallel audits (CI/release, code-quality/security, DX/docs/perf) against the current v2.5.0 codebase.*

This plan is **parallel** to the v2.6.0 launch sequence in `docs/launch/README.md` — none of it blocks shipping the paid launch. The "P0 — before v2.6.0" list is the only one that touches the launch tag; everything else is post-launch.

---

## TL;DR

FreshRig is in genuinely strong shape for a solo-dev project: cross-platform code that compiles, strict TypeScript with zero `any`, strict clippy with zero `unsafe`, signed releases with SBOM, hardened secrets via OS keyring, hardened headless apply-profile marker, panic-log scrubbing with unit tests, well-documented `.cargo/audit.toml` suppressions, a real launch automation engine (`scripts/launch.mjs`).

**Three things are genuinely fragile and would be embarrassing to discover after launch:**

1. **Test coverage on commercial flows is 0%.** License activation, fleet, contracts, branding, encrypted profile sync, integrations — none have unit tests. A regression in any of them is a refund event.
2. **`@zxcvbn-ts` is 1.2 MB in the entry bundle** even though it's only used inside the Encrypted Profile Sync passphrase dialog. Every user pays the cost on cold start to support a feature ~1% of them will ever touch.
3. **No PR-time `cargo audit` gate.** Advisories only get caught when a release tag is pushed — too late to prevent a regression from merging into `main`.

Everything else is real but cosmetic. **Don't let this doc become a backlog.** Pick the P0s, ship them, then re-evaluate.

---

## P0 — Before v2.6.0 ships (≤ 1 day total)

The only items that should land in the same release as paid checkout.

> **STATUS 2026-05-23 — ALL FOUR P0 ITEMS ARE COMPLETE.** Shipped in commit `2722501` ("P0 pre-launch improvements"): P0-1 lazy-loaded `@zxcvbn-ts`, P0-2 release smoke-test step, P0-3 PR template, P0-4 `default_window_icon` `.unwrap()` -> `ok_or`. The table below is retained for historical context.

| # | Item | Effort | Files |
|---|---|---|---|
| P0-1 | **Lazy-load `EncryptedSyncSection` + passphrase dialog.** Move the `@zxcvbn-ts` import behind a dynamic `import()` inside the dialog component so it's not in the entry bundle. Expected gain: -1.0 MB unpacked / -500 KB gzipped from cold-start payload. | S | `src/components/profiles/EncryptedSyncSection.tsx`, `vite.config.ts` |
| P0-2 | **Smoke-test the bundled binary in `release.yml`.** After tauri-action finishes, run `./binary --headless --task=smart-check` for ≤ 5 seconds and assert exit code 0. Catches "compiles but doesn't start" regressions before they reach users. | S | `.github/workflows/release.yml` |
| P0-3 | **Add a PR template.** Empty `PULL_REQUEST_TEMPLATE.md` is fine; even a 5-line checklist (tests, changelog, clippy, tsc) keeps merge hygiene during the launch window. | XS | `.github/PULL_REQUEST_TEMPLATE.md` |
| P0-4 | **Replace `.unwrap()` on `app.default_window_icon()` (`src-tauri/src/lib.rs:240`)** with `.ok_or("missing default window icon")?`. Single line, no panic surface during Tauri init. | XS | `src-tauri/src/lib.rs` |

**Total estimate: 4–6 hours of focused work.**

---

## P1 — First 30 days after launch (the test/audit foundation)

These are the items that turn FreshRig from "ships and works" into "ships and stays working as it grows."

### 1.1 Test the commercial paths first

| # | Item | Effort | Why |
|---|---|---|---|
| P1-1 | **Unit-test `commands::license`.** Mock `reqwest` (or extract HTTP calls behind a trait). Cover: valid activation, expired key, foreign-store key rejected, variant→tier resolution for all 5 variants, network error path. ~12 tests. | M | A license regression is a billing regression. This is the single highest-ROI test surface. |
| P1-2 | **Unit-test `commands::fleet` state transitions.** Add/delete machine, endpoint cap enforcement, contract create/run/complete, frequency arithmetic. SQLite tests can use `:memory:` — no fixtures needed. | M | Fleet is the Pro Business sell. If a contract silently doesn't run, customers cancel. |
| P1-3 | **Unit-test `commands::branding` and `commands::integrations`.** Round-trip JSON, secret-replacement edge cases ("********" placeholder), `is_business: false → PRO_REQUIRED`. | S | These commands gate paid features — they're the front line for "I paid for Business but the feature doesn't activate" bug reports. |
| P1-4 | **Add a `docs/TESTING.md`.** Where tests live, how to run them, the `#[cfg(test)] mod tests` convention, the `:memory:` SQLite pattern, the "no real HTTP in tests" rule. ~50 lines. | S | New contributors and your-future-self need to find this. |

### 1.2 Tighten the CI/supply-chain perimeter

| # | Item | Effort | Why |
|---|---|---|---|
| P1-5 | **Add `cargo audit` to `ci.yml`** on PR (not just on tag push in release.yml). Use the same `audit.toml` copy step the release workflow already does. | S | Catches advisories before merge, not after release. |
| P1-6 | **Add SLSA provenance attestation to `release.yml`.** Drop in `actions/attest-build-provenance@v2` after the bundle step. ~5 lines of YAML, zero secrets needed. | S | Real supply-chain transparency badge with negligible cost. |
| P1-7 | **Add a hard bundle-size budget.** In `vite.config.ts`, configure a Rolldown `output.assetFileNames` cap, or in CI a `du -b dist/assets/*.js | sort -nr | head -1` check that fails if the biggest chunk exceeds (post-P0-1) say 300 KB. | S | Prevents the next "1 MB silently added to entry bundle" regression. |
| P1-8 | **Dependabot grouping.** Add a `groups:` block per ecosystem so all patch-level cargo/npm updates land as one PR per week, not 15. | XS | Reduces review fatigue without losing security cadence. |
| P1-9 | **Verify branch-protection on `main`** matches the CI required-status list. Has to be done in the GitHub UI; record the final state in `CONTRIBUTING.md`. | XS | Already implicitly assumed by the workflow; worth confirming once. |

### 1.3 Crash visibility

| # | Item | Effort | Why |
|---|---|---|---|
| P1-10 | **Surface the crash log in-app.** Add a Settings → Diagnostics → "Open crash.log" button that calls `tauri::api::shell::open` on `<data_dir>/crash.log`. The panic handler already writes the file; users just can't find it. | S | Right now a crash is invisible unless the user knows where `%APPDATA%` lives. |

**P1 total: ≈3–5 days spread over the first month.**

---

## P2 — First quarter (developer-experience automation)

Items that compound over time but don't change a single user-visible behaviour.

| # | Item | Effort | Notes |
|---|---|---|---|
| P2-1 | **Sidebar hover-preload.** Wire `onMouseEnter` on each nav button to `preloadModule(() => import('./PageX'))`. Makes route transitions feel instant after the first hover. | S | Pairs with the existing `lazyNamed` helper. ~6 LOC per nav entry. |
| P2-2 | **Auto-changelog draft.** In `scripts/launch.mjs cmdRelease`, parse the last 10 commits on `main` and pre-fill the changelog TODO with a conventional-commit-grouped draft the user edits down. | M | Saves 5 minutes per release; cuts the "ship without changelog" risk. |
| P2-3 | **Pre-flight check before `git tag`.** In `scripts/launch.mjs`, add a `preflight` subcommand that asserts: clean working tree, no unpushed commits, all 4 version files agree, the changelog has a non-TODO entry for the target version. Run automatically inside `go-live`. | S | Catches the half-tagged release. |
| P2-4 | **Templatize the landing-page nav + footer.** Right now nav and footer HTML are pasted into 4 files (`index/download/privacy/terms.html`). Move them to a `site/_partials/{nav,footer}.html` and use a tiny Node script in `pages.yml` to inline-include before deploy. Keeps GitHub Pages happy (static), kills the 4×-edit problem. | M | Cheap once, valuable forever. |
| P2-5 | **Sitemap.xml + robots.txt for `site/`.** 4 URLs + 2 lines. Pure SEO hygiene. | XS | |
| P2-6 | **Re-evaluation tracker for `audit.toml` suppressions.** Either a GitHub issue with `audit-suppression` label per family, or a dated table in `audit.toml` comments noting "re-check when Tauri ≥ 2.20" / etc. Currently the comments document *why* but not *when*. | S | |
| P2-7 | **macOS re-enable runbook.** Single `docs/MACOS_REBUILD.md` with the 5-line workflow diff + the 8 secret names. Already partly in `CLAUDE.md` — extract to its own doc so it's the obvious search hit. | XS | |

---

## P3 — Nice-to-have / explicit "do later"

| # | Item | Notes |
|---|---|---|
| P3-1 | Migrate `Result<T, String>` to typed errors via `thiserror`. Pretty, but a 600-line refactor across 25 command files. Won't change behaviour. **Defer indefinitely.** |
| P3-2 | Structured logging via `tracing`. Same — adds polish, doesn't fix bugs. Defer until you actually need to debug a multi-process flow. |
| P3-3 | Lighthouse CI / perf tracking dashboards. Overkill for a static landing page that doesn't change weekly. |
| P3-4 | E2E tests via Playwright or Tauri WebDriver. **High value but high cost** (CI infra, flakes, maintenance). Revisit after P1 unit tests are in — by then you'll know which flows actually need e2e coverage. |
| P3-5 | HMAC signature on the headless apply-profile marker (currently `TODO(v3)` in `lib.rs`). The chmod-0600 + parent-dir ACL already does the real work; HMAC is theatre until there's a GUI-side reader. |

---

## Don't bother

Items that look like good ideas but cost more than they're worth in this project's current shape:

- **Husky + lint-staged pre-commit hooks.** Solo dev; CI already catches every issue; pre-commit hooks slow the dev loop and don't catch anything CI doesn't.
- **ESLint + Prettier.** TypeScript strict mode + zero `any` already gives you ~80% of what ESLint would catch. Adding ESLint means a config file, a CI step, editor integration, and 5–10 false-positive PRs while you tune the ruleset. Cost ≫ value at current size.
- **CODE_OF_CONDUCT.md.** Single maintainer, no community discussion forum, no contributions arriving. Adding one signals "we have a community problem" without solving anything.
- **Test-coverage tracking (codecov etc).** Meaningless with 7 tests. Re-evaluate after P1 lands.
- **Conventional Commits enforcement.** Solo dev; commit messages are already clean. Tooling cost > gain.
- **Code-of-Conduct, CHANGELOG.md.** The changelog lives in `src/data/changelog.ts` and ships in the app — moving it to a Markdown file at root would *split* a single source of truth, not consolidate it.

---

## Phased roadmap

```
P0 (this week, alongside Step 4 of the launch)
├── lazy-load zxcvbn (P0-1)
├── smoke-test in release.yml (P0-2)
├── PR template (P0-3)
└── unwrap → ok_or fix (P0-4)

P1 (June — first 30 days after launch)
├── Test the money paths
│   ├── license.rs unit tests (P1-1)
│   ├── fleet.rs SQLite tests (P1-2)
│   ├── branding.rs + integrations.rs tests (P1-3)
│   └── docs/TESTING.md (P1-4)
├── Tighten the CI perimeter
│   ├── cargo audit in ci.yml (P1-5)
│   ├── SLSA provenance (P1-6)
│   ├── bundle-size hard cap (P1-7)
│   ├── Dependabot grouping (P1-8)
│   └── branch-protection audit (P1-9)
└── In-app crash log button (P1-10)

P2 (Q3 — Jul/Aug/Sep)
├── Sidebar hover-preload (P2-1)
├── Auto-changelog draft (P2-2)
├── Tag preflight checks (P2-3)
├── Landing-page nav/footer partials (P2-4)
├── sitemap + robots (P2-5)
├── audit.toml re-evaluation tracker (P2-6)
└── macOS re-enable runbook (P2-7)

P3 (revisit only if needed)
└── typed errors / tracing / Lighthouse / Playwright / HMAC marker
```

---

## How to use this doc

1. **During launch:** ignore everything except the four P0s. Land them in v2.6.0 if you can; otherwise patch them into v2.6.1 within a week.
2. **Post-launch:** pick one P1 group per week. The order in the table is the suggested order — the money-path tests first, then the CI perimeter, then crash visibility.
3. **Quarterly:** re-read this doc. Tick off what's done; demote items from P2 to P3 if they haven't earned their priority; **delete items that no longer matter.** An improvement plan that grows monotonically becomes wallpaper.

The honest test for any item before doing it: *if a customer files a bug tomorrow, would this item have helped catch it or fix it faster?* Items that pass that test go up the list. Items that don't get moved to "Don't bother."
