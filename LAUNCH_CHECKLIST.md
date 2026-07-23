# FreshRig — Paid-Launch Checklist

> **Why this file exists.** FreshRig currently ships in **pre-launch mode**: the
> LemonSqueezy license gate is intentionally permissive and the automated
> release-readiness test is deliberately bypassed so pre-launch builds can ship.
> That bypass is safe **only** while no paid licenses exist. This checklist is
> the single place that records exactly what must change — and in what order —
> the moment the store goes live, so the permissive state can't be shipped to
> paying customers by accident.
>
> **Do every step in ONE commit.** Wiring the IDs without removing the release
> carve-out leaves the gate disarmed; removing the carve-out without wiring the
> IDs breaks every release. They must land together.

## Current pre-launch state (as of v2.5.x)

- `EXPECTED_STORE_ID`, `EXPECTED_PRODUCT_ID` = `0` → store/product matching is
  **skipped**, so any `FR-XXXXX-XXXXX`-shaped key validates as Pro.
- `EXPECTED_PRO_VARIANT_IDS`, `EXPECTED_BUSINESS_VARIANT_IDS` = empty → every
  paid variant resolves to **Pro**; Business tier is never assigned.
- All upgrade buttons route to the pricing/waitlist page, not real checkout.
- The `release_gate::lemonsqueezy_ids_set_for_release` test (which fails a
  release build while the IDs are `0`) is **carved out** for `v2.3.0` and the
  entire `v2.4.*` / `v2.5.*` families in `.github/workflows/release.yml`.

## Do all of these together, before tagging the first paid release

- [ ] **Set the real LemonSqueezy IDs** in `src-tauri/src/commands/license.rs`:
  - [ ] `EXPECTED_STORE_ID` → store id (LemonSqueezy → Settings → Stores).
  - [ ] `EXPECTED_PRODUCT_ID` → product id (Products → product → details).
  - [ ] `EXPECTED_PRO_VARIANT_IDS` → live Pro variant ids (monthly/annual/founder).
  - [ ] `EXPECTED_BUSINESS_VARIANT_IDS` → live Business variant ids.
- [ ] **Re-arm the release gate** in `.github/workflows/release.yml`: delete the
      `v2.3.0` / `v2.4.` / `v2.5.` carve-out clauses on the
      **"License release-readiness gate"** step so it runs for the launch tag.
      (After this, a build with placeholder `0` IDs fails CI by design.)
- [ ] **Wire real checkout URLs** in `src/config/app.ts`: replace
      `PRICING_PAGE_URL` (used by `PRO_PURCHASE_URL_*` and
      `BUSINESS_PURCHASE_URL_*`) with the live LemonSqueezy checkout links.
- [ ] **Confirm tier resolution** in `license.rs::resolve_tier` behaves as
      intended once the variant allowlists are non-empty (no variant should
      silently fall through to Pro).
- [ ] **Verify release secrets** are set: `TAURI_SIGNING_PRIVATE_KEY` (+
      password). The release already fails loudly if signing is missing — keep
      it that way.
- [ ] **Manual end-to-end test** with a real test license: activate → validate
      → correct tier → device fingerprint pinning works.

## Guardrails already in place (don't remove)

- `release_gate::lemonsqueezy_ids_set_for_release` in `license.rs` — asserts the
  IDs are non-zero in release builds. It is a no-op in dev (`debug_assertions`
  on). Removing the workflow carve-out above is what makes it enforce at release.
- CI runs `cargo audit --deny warnings` and generates SBOMs on every build.
- Actions are SHA-pinned; CI runs at least privilege (`contents: read`).

_Last reviewed: 2026-07-24 (v2.5.4)._
