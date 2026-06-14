# FreshRig — Security Hardening Pass · ARCHIVE (CLOSED)

**Date:** 2026-06-14
**Status:** Complete — all fixes merged to `main`, CI green, branches cleaned up.

---

## 1. What was asked

A professional security hardening pass over the FreshRig codebase (Tauri v2 / Rust + React) covering
OWASP Top 10, auth/authz, injection, XSS, CSRF, SSRF, secret exposure, dependency vulnerabilities,
unsafe logging, privilege escalation, and misconfiguration. Mandate: fix verified issues; for each,
explain the vulnerability, the mitigation, and validate it; claim no improvement without evidence.

Scope: non-behavioural hardening, with Rust fixes validated natively via `cargo`, delivered as PRs.

---

## 2. Final outcome

| Item | Commit | Merged via |
|---|---|---|
| **INJ-1** — DNS input validation (3 OS twins) | `06827dc` | PR #69 |
| **CI-1** — pin 11 Actions to commit SHAs | `30b835e` | PR #69 |
| **DEP-1** — suppress `RUSTSEC-2026-0173` | `3a6574b` | PR #70 |

CI on the final `main`: `cargo clippy -D warnings`, `cargo fmt --check`, `cargo test`, `cargo audit`,
`tsc`, frontend build, and CodeQL (rust / actions / js-ts) — all green. The new unit test
`commands::network::tests::dns_validation_accepts_ips_rejects_injection` passed on the Windows leg.

> Process note: PR #69 merged while its Ubuntu check was still red — that red was the pre-existing
> `cargo audit` advisory (DEP-1), unrelated to the PR's diff, resolved 21 minutes later by PR #70.
> Enabling branch protection (require checks before merge) on `main` would prevent merging a red check.

---

## 3. Issues fixed (vulnerability · mitigation · validation)

### INJ-1 (High) — DNS values reached an elevated shell unvalidated
FreshRig runs as administrator. `set_dns_servers` interpolated the user-supplied `primary`/`secondary`
DNS strings into an **elevated** OS command on all three platforms with no validation:
- **Windows** (`commands/network.rs`): into a PowerShell single-quoted string (`'{}'`) — only
  `interface_name` was escaped, the IPs were not.
- **macOS** (`commands/macos/network.rs`): into a `run_elevated` shell string — `port` was quoted, `dns` was not.
- **Linux** (`commands/linux/network.rs`): into a systemd-resolved drop-in written via `pkexec tee`
  (newline-injectable). The `nmcli` path was already arg-vector-safe.

A value such as `8.8.8.8'); Stop-Service WinDefend; #` could break out and run as admin/root. The
earlier SEC-02 winget hardening did not cover this path.

**Mitigation:** an `is_ip_literal` helper validates each value with `std::net::IpAddr` before use — an
allowlist (a string that parses as an IP cannot contain a quote, `;`, `)`, `$`, `&`, or newline).
Behaviour is unchanged for every valid-IP input.

**Validation:** unit test `dns_validation_accepts_ips_rejects_injection` (accepts IPv4/IPv6, rejects
injection payloads) — passed in CI; `clippy -D warnings`, `fmt --check`, and `cargo test` green on
Windows + Ubuntu.

### CI-1 (Medium) — Actions pinned to mutable tags
Every GitHub Action was referenced by a floating tag, and `dtolnay/rust-toolchain@stable` was a moving
**branch** in `release.yml` — the workflow that holds `TAURI_SIGNING_PRIVATE_KEY`. A re-pointed
tag/branch could run attacker-controlled code with the signing key in scope.

**Mitigation:** pinned all 11 Actions to the exact commit SHAs their tags/branch resolved to (resolved
via the GitHub API), version in a trailing comment. Dependabot (`github-actions`) keeps them current.

**Validation:** behaviour-identical (same commit the tag pointed to), so it cannot change CI behaviour;
the pinned workflows ran green end-to-end.

### DEP-1 (Maintenance) — `RUSTSEC-2026-0173` (proc-macro-error2 unmaintained)
A new advisory (dated 2026-06-07) flags `proc-macro-error2 v2.0.1` as unmaintained. It's a build-time
proc-macro pulled transitively via `age → i18n-embed-fl` — never in the shipped binary, no CVE.
`cargo audit --deny warnings` fails on it. Not caused by this work (would hit `main` regardless).

**Mitigation:** added the ID to `src-tauri/.cargo/audit.toml`'s ignore list with a justification,
mirroring the existing `proc-macro-error` 1.x (`RUSTSEC-2024-0370`) suppression.

**Validation:** `cargo audit` green on `main` after PR #70.

---

## 4. Verified clean (with evidence) — no change needed

- **XSS** — React auto-escapes; the only `dangerouslySetInnerHTML` (`ReportPage.tsx`) injects a *static*
  print-CSS string (empty `useMemo` deps); the health report exports as plain text; the landing site
  renders all dynamic data (incl. the GitHub release tag) via `textContent`.
- **SQL injection** — every `rusqlite` call uses bound `params![…]`/`?1`; the one variable `sql` is a
  choice between two static literals.
- **Secret exposure** — API keys + SMTP passwords live in the OS keyring; no hardcoded secrets; no key
  material git-tracked; `license.rs` embeds only a public endpoint + documented `0` placeholder IDs.
- **Unsafe logging** — credential-adjacent logs are status-only; crash handler `scrub_sensitive_data`
  redacts usernames/MACs/serials and is unit-tested.
- **SSRF** — driver URLs are a static vendor catalog opened in the browser; the one config-driven fetch
  (`custom_apps`) is HTTPS-enforced three ways; license/updater endpoints are fixed constants.
- **Privilege escalation (headless apply-profile)** — charset-validated profile-id, queue-only marker,
  chmod `0600` on Unix / per-user ACL on Windows.
- **`delete_profile`** — canonicalizes + confines to the profiles dir.
- **Dependencies** — `npm audit` = 0; `cargo audit --deny warnings` enforced in CI with a documented
  suppression list.
- **Updater / capabilities** — minisign-signed updates over a fixed HTTPS endpoint; minimal capability
  set; no shell plugin (closes the XSS→RCE pivot).
- **Reverse tabnabbing** — every site `target="_blank"` carries `rel="noopener"`.

---

## 5. Deliberately not changed — open follow-ups

Out of the chosen scope (behavioural / pre-launch / build-gated). None merge-blocking; recorded so they
aren't lost.

| Ref | Item | Why deferred | Fix when ready |
|---|---|---|---|
| SEC-06 | License-gate carve-out (`v2.5.*` in release.yml) | Pre-launch; placeholder LemonSqueezy IDs | Fill `EXPECTED_*` IDs in `license.rs`; drop the `startsWith(…, 'v2.5.')` clauses |
| SEC-01 | Pro entitlement enforced client-side only | Needs a backend entitlement check | Server-side verification at launch |
| MISC-1 | CSP `script-src 'unsafe-inline'` (FOUC theme script) | Needs a build to hash/externalize safely | Hash the inline script or move it to an external `'self'` file |
| SITE-1 | `cdn.tailwindcss.com` unpinned / no SRI on the landing pages | Play CDN can't take SRI | Precompile Tailwind to a static stylesheet |
| LOW-1/2/3 | custom-app optional hash · `load_profile` unconfined read · macOS osascript `\` escape edge | Low / defense-in-depth | Opportunistic |

---

## 6. Traceability

- INJ-1 + CI-1: commits `06827dc`, `30b835e` → PR #69.
- DEP-1: commit `3a6574b` → PR #70.
- Architecture context for the same date: `docs/ARCHITECTURE_CHANGES_2026-06-14.md`.

*Task closed 2026-06-14. Nothing outstanding except the optional follow-ups in §5 and enabling branch
protection on `main`.*
