#!/usr/bin/env node
// FreshRig launch automation — one command per phase of the paid launch.
//
//   npm run launch:check                 validate launch.config.json, report readiness
//   npm run go-live                      wire LemonSqueezy checkout + bump version (Phase 3 + 6)
//   npm run release -- <patch|minor|major>   ordinary version bump for a normal release
//   node scripts/launch.mjs cname        write site/CNAME from the configured domain (Phase 4)
//
// All LemonSqueezy values live in launch.config.json at the repo root — the
// single source of truth. Those values are public (they ship in the binary
// and on the landing page), so the file is committed.
//
// The script never commits or tags — it mutates files, validates the
// frontend, and prints the exact git commands for you to run.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(ROOT, "launch.config.json");

const C = {
  reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m", bold: "\x1b[1m",
};
const log = (m) => console.log(m);
const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}!${C.reset} ${m}`);
const head = (m) => console.log(`\n${C.bold}${C.cyan}${m}${C.reset}`);
const die = (m) => { console.error(`\n${C.red}✗ ${m}${C.reset}`); process.exit(1); };

// ---------- io helpers ----------

function readConfig() {
  if (!existsSync(CONFIG)) die("launch.config.json not found at the repo root.");
  try {
    return JSON.parse(readFileSync(CONFIG, "utf8"));
  } catch (e) {
    die(`launch.config.json is not valid JSON: ${e.message}`);
  }
}

const rd = (rel) => readFileSync(join(ROOT, rel), "utf8");
const wr = (rel, s) => writeFileSync(join(ROOT, rel), s);

// Apply one find->replace to a file. `find` is a string or RegExp.
// Asserts exactly one match (ambiguous edits abort). With { optional:true }
// a zero-match is treated as "already applied" so re-runs are safe.
function sub(rel, find, replace, label, { optional = false } = {}) {
  const before = rd(rel);
  let count;
  if (typeof find === "string") {
    count = before.split(find).length - 1;
  } else {
    const flags = find.flags.includes("g") ? find.flags : find.flags + "g";
    count = (before.match(new RegExp(find.source, flags)) || []).length;
  }
  if (count === 0) {
    if (optional) { log(`  ${C.dim}· ${label} — already applied${C.reset}`); return; }
    die(`${rel}: could not apply "${label}" — anchor not found (file in an unexpected state).`);
  }
  if (count > 1) {
    die(`${rel}: "${label}" anchor matched ${count} times — ambiguous, aborting.`);
  }
  wr(rel, before.replace(find, replace));
  ok(`${rel} — ${label}`);
}

// ---------- validation ----------

function validateLaunch(cfg) {
  const errs = [];
  const ls = cfg.lemonSqueezy || {};
  if (!Number.isInteger(ls.storeId) || ls.storeId <= 0)
    errs.push("lemonSqueezy.storeId must be a positive integer");
  if (!Number.isInteger(ls.productId) || ls.productId <= 0)
    errs.push("lemonSqueezy.productId must be a positive integer");
  const arr = (a) => Array.isArray(a) && a.length > 0 && a.every((n) => Number.isInteger(n) && n > 0);
  if (!arr(ls.proVariantIds))
    errs.push("lemonSqueezy.proVariantIds must be a non-empty array of positive integers");
  if (!arr(ls.businessVariantIds))
    errs.push("lemonSqueezy.businessVariantIds must be a non-empty array of positive integers");
  const u = cfg.checkoutUrls || {};
  for (const k of ["proMonthly", "proAnnual", "founderLifetime", "businessMonthly", "businessAnnual"]) {
    if (typeof u[k] !== "string" || !/^https:\/\/\S+$/.test(u[k]))
      errs.push(`checkoutUrls.${k} must be an https:// URL`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(cfg.releaseVersion || ""))
    errs.push("releaseVersion must be a semver string (x.y.z)");
  return errs;
}

// ---------- shared mutations ----------

function bumpVersion(v) {
  sub("package.json", /"version": "[^"]*"/, `"version": "${v}"`, `package.json → ${v}`);
  sub("src-tauri/tauri.conf.json", /"version": "[^"]*"/, `"version": "${v}"`, `tauri.conf.json → ${v}`);
  sub("src-tauri/Cargo.toml", /^version = "[^"]*"$/m, `version = "${v}"`, `Cargo.toml → ${v}`);
  sub("src/config/app.ts", /export const APP_VERSION = "[^"]*";/, `export const APP_VERSION = "${v}";`, `app.ts APP_VERSION → ${v}`);
}

function addChangelog(v, body) {
  const rel = "src/data/changelog.ts";
  const s = rd(rel);
  if (s.includes(`"${v}":`)) { log(`  ${C.dim}· changelog already has a v${v} entry${C.reset}`); return; }
  const anchor = "export const CHANGELOG: Record<string, string> = {\n";
  if (!s.includes(anchor)) die("changelog.ts: CHANGELOG object anchor not found.");
  wr(rel, s.replace(anchor, anchor + `  "${v}": \`${body}\n\`,\n`));
  ok(`changelog.ts — added v${v} entry`);
}

function runTsc() {
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "inherit" });
    ok("npx tsc --noEmit — clean");
  } catch {
    die("npx tsc --noEmit failed — fix the errors above before committing.");
  }
}

function currentVersion() {
  const m = rd("src-tauri/tauri.conf.json").match(/"version": "([^"]*)"/);
  if (!m) die("could not read current version from tauri.conf.json");
  return m[1];
}

function semverBump(cur, kind) {
  const p = cur.split(".").map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isInteger(n))) die(`current version "${cur}" is not semver`);
  if (kind === "major") return `${p[0] + 1}.0.0`;
  if (kind === "minor") return `${p[0]}.${p[1] + 1}.0`;
  if (kind === "patch") return `${p[0]}.${p[1]}.${p[2] + 1}`;
  die(`release type must be patch | minor | major (got "${kind}")`);
}

// The pre-launch CI carve-out that skips the LemonSqueezy release gate.
// Removed by go-live so the gate enforces real IDs on every future tag.
const CI_CARVE_OUT = `        if: >
          matrix.platform == 'windows-latest' &&
          github.ref_name != 'v2.3.0' &&
          !startsWith(github.ref_name, 'v2.4.') &&
          !startsWith(github.ref_name, 'v2.5.') &&
          inputs.tag != 'v2.3.0' &&
          !startsWith(inputs.tag, 'v2.4.') &&
          !startsWith(inputs.tag, 'v2.5.')`;

function launchChangelogBody(v) {
  return `### FreshRig v${v} — Paid Pro & Business now available 🚀

FreshRig Pro and Pro Business are now purchasable. Every premium feature shipped over the v2.x line is unlocked with a license key: Disk Cleanup, Privacy Dashboard with Drift Detection, Network Tools, Services Manager, Context Menu Editor, PDF Health Reports, Watchdog Mode, Encrypted Profile Sync, SMART Disk Monitoring — plus the full Pro Business suite (white-label reports, Fleet dashboard, bulk deploy, maintenance contracts, RepairShopr / Syncro / NinjaOne integrations).

**Buy once, activate anywhere.**
License activation works on Windows, Linux, and macOS. Start a 7-day free trial with no credit card, or go straight to Pro ($5.99/mo · $49/yr), the Founder's Lifetime deal ($149 one-time, first 500), or Pro Business ($14.99/mo · $149/yr per technician).

The free tier is unchanged — hardware dashboard, drivers, 15 essential apps, optimize, startup and themes stay free forever.`;
}

// ---------- subcommands ----------

function cmdCheck() {
  head("FreshRig — launch readiness check");
  const cfg = readConfig();
  const errs = validateLaunch(cfg);
  const ls = cfg.lemonSqueezy || {};
  const u = cfg.checkoutUrls || {};
  const mark = (good) => (good ? `${C.green}set${C.reset}` : `${C.yellow}missing${C.reset}`);
  log(`  releaseVersion        ${mark(/^\d+\.\d+\.\d+$/.test(cfg.releaseVersion || ""))}  ${cfg.releaseVersion || ""}`);
  log(`  storeId               ${mark(Number.isInteger(ls.storeId) && ls.storeId > 0)}`);
  log(`  productId             ${mark(Number.isInteger(ls.productId) && ls.productId > 0)}`);
  log(`  proVariantIds         ${mark(Array.isArray(ls.proVariantIds) && ls.proVariantIds.length > 0)}  [${(ls.proVariantIds || []).join(", ")}]`);
  log(`  businessVariantIds    ${mark(Array.isArray(ls.businessVariantIds) && ls.businessVariantIds.length > 0)}  [${(ls.businessVariantIds || []).join(", ")}]`);
  for (const k of ["proMonthly", "proAnnual", "founderLifetime", "businessMonthly", "businessAnnual"]) {
    log(`  checkout.${k.padEnd(16)}${mark(typeof u[k] === "string" && u[k].length > 0)}`);
  }
  log(`  domain                ${cfg.domain ? `${C.green}${cfg.domain}${C.reset}` : `${C.dim}(optional, unset)${C.reset}`}`);
  if (errs.length) {
    log("");
    errs.forEach((e) => warn(e));
    log(`\n${C.yellow}Not ready.${C.reset} Fill the fields above in launch.config.json, then re-run.`);
    process.exit(1);
  }
  log(`\n${C.green}${C.bold}Ready for go-live.${C.reset} Run:  ${C.cyan}npm run go-live${C.reset}`);
}

function cmdGoLive() {
  head("FreshRig — going live (Phase 3 + Phase 6)");
  const cfg = readConfig();
  const errs = validateLaunch(cfg);
  if (errs.length) {
    errs.forEach((e) => warn(e));
    die("launch.config.json is incomplete — run `npm run launch:check` for details.");
  }
  const ls = cfg.lemonSqueezy;
  const u = cfg.checkoutUrls;
  const v = cfg.releaseVersion;

  head("1/5  license.rs — LemonSqueezy IDs");
  const LIC = "src-tauri/src/commands/license.rs";
  sub(LIC, /const EXPECTED_STORE_ID: u64 = \d+;/, `const EXPECTED_STORE_ID: u64 = ${ls.storeId};`, "EXPECTED_STORE_ID");
  sub(LIC, /const EXPECTED_PRODUCT_ID: u64 = \d+;/, `const EXPECTED_PRODUCT_ID: u64 = ${ls.productId};`, "EXPECTED_PRODUCT_ID");
  sub(LIC, /const EXPECTED_PRO_VARIANT_IDS: &\[u64\] = &\[[^\]]*\];/, `const EXPECTED_PRO_VARIANT_IDS: &[u64] = &[${ls.proVariantIds.join(", ")}];`, "EXPECTED_PRO_VARIANT_IDS");
  sub(LIC, /const EXPECTED_BUSINESS_VARIANT_IDS: &\[u64\] = &\[[^\]]*\];/, `const EXPECTED_BUSINESS_VARIANT_IDS: &[u64] = &[${ls.businessVariantIds.join(", ")}];`, "EXPECTED_BUSINESS_VARIANT_IDS");

  head("2/5  app.ts — checkout URLs");
  const APP = "src/config/app.ts";
  const urlMap = [
    ["PRO_PURCHASE_URL_MONTHLY", "proMonthly"],
    ["PRO_PURCHASE_URL_ANNUAL", "proAnnual"],
    ["PRO_PURCHASE_URL_FOUNDER", "founderLifetime"],
    ["BUSINESS_PURCHASE_URL_MONTHLY", "businessMonthly"],
    ["BUSINESS_PURCHASE_URL_ANNUAL", "businessAnnual"],
  ];
  for (const [name, key] of urlMap) {
    sub(APP, new RegExp(`export const ${name} = [^\\n]*;`), `export const ${name} = "${u[key]}";`, name);
  }
  // Drop the now-unused PRICING_PAGE_URL declaration + pre-launch comment.
  sub(
    APP,
    /\/\/ PRE-LAUNCH MODE:[\s\S]*?const PRICING_PAGE_URL = "[^"]*";\n/,
    "// Paid checkout (LemonSqueezy). Wired by scripts/launch.mjs from\n// launch.config.json — edit that file and re-run `npm run go-live`.\n",
    "remove PRICING_PAGE_URL placeholder",
    { optional: true },
  );

  head("3/5  release.yml — re-arm the CI license gate");
  sub(".github/workflows/release.yml", CI_CARVE_OUT, "        if: matrix.platform == 'windows-latest'", "remove v2.3-v2.5 carve-out", { optional: true });

  head("4/5  site/index.html — landing page");
  sub("site/index.html", /"softwareVersion": "[^"]*"/, `"softwareVersion": "${v}"`, "JSON-LD softwareVersion");
  sub("site/index.html", /(<p class="text-2xl font-bold text-amber-400" id="founder-counter">)[^<]*(<\/p>)/, `$1${cfg.founderSpotsRemaining} / 500$2`, "founder spots counter");
  sub("site/index.html", /href="mailto:sales@freshrig\.app\?subject=FreshRig%20Founder[^"]*"/, `href="${u.founderLifetime}"`, "Founder CTA → checkout", { optional: true });
  sub("site/index.html", "Notify Me &mdash; Founder $149", "Claim Founder's Lifetime &mdash; $149", "Founder CTA label", { optional: true });
  sub("site/index.html", /href="mailto:sales@freshrig\.app\?subject=FreshRig%20Pro[^"]*"/, `href="${u.proAnnual}"`, "Pro CTA → checkout", { optional: true });
  sub("site/index.html", "Notify Me &mdash; Pro", "Start Free Trial &mdash; Pro", "Pro CTA label", { optional: true });

  head(`5/5  version bump → ${v}`);
  bumpVersion(v);
  addChangelog(v, launchChangelogBody(v));

  head("Validating frontend");
  runTsc();

  head(`${C.green}Go-live wiring complete.${C.reset}`);
  log("");
  log("The Business landing-page button was left as Contact Sales (deferred Phase 2");
  log("decision). The in-app Business upsell already points at the wired checkout URL.");
  log("");
  log(`${C.bold}Next — run these yourself:${C.reset}`);
  log(`  ${C.cyan}cargo generate-lockfile --manifest-path src-tauri/Cargo.toml${C.reset}`);
  log(`  ${C.cyan}cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings${C.reset}`);
  log(`  ${C.cyan}cargo fmt --manifest-path src-tauri/Cargo.toml -- --check${C.reset}`);
  log(`  ${C.cyan}npm run build${C.reset}`);
  log(`  ${C.cyan}git add -A && git commit -m "feat: wire LemonSqueezy checkout — v${v} paid launch"${C.reset}`);
  log(`  ${C.cyan}git tag v${v} && git push origin main --tags${C.reset}`);
  log("");
  log(`The release workflow runs the re-armed license gate — it passes with the real`);
  log(`IDs now in license.rs, and would hard-fail if they were ever placeholders again.`);
  if (cfg.domain) log(`\nDomain is set — run ${C.cyan}node scripts/launch.mjs cname${C.reset} to write site/CNAME.`);
}

function cmdRelease(kind) {
  head("FreshRig — version bump");
  if (!kind) die("usage: npm run release -- <patch|minor|major>");
  const cur = currentVersion();
  const next = semverBump(cur, kind);
  log(`  ${cur}  →  ${next}\n`);
  bumpVersion(next);
  addChangelog(next, `### FreshRig v${next}\n\nTODO: describe this release before tagging.`);
  head("Validating frontend");
  runTsc();
  head(`${C.green}Version bumped to ${next}.${C.reset}`);
  log(`\n${C.bold}Next:${C.reset}`);
  log(`  1. Edit the v${next} entry in src/data/changelog.ts (replace the TODO).`);
  log(`  2. ${C.cyan}cargo generate-lockfile --manifest-path src-tauri/Cargo.toml${C.reset}`);
  log(`  3. ${C.cyan}cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings${C.reset}`);
  log(`  4. ${C.cyan}git add -A && git commit -m "chore: release v${next}"${C.reset}`);
  log(`  5. ${C.cyan}git tag v${next} && git push origin main --tags${C.reset}`);
}

function cmdCname() {
  head("FreshRig — write site/CNAME");
  const cfg = readConfig();
  if (!cfg.domain) die("launch.config.json `domain` is empty — set it after registering the domain.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cfg.domain)) die(`"${cfg.domain}" does not look like a domain.`);
  wr("site/CNAME", cfg.domain + "\n");
  ok(`site/CNAME → ${cfg.domain}`);
  log(`\nCommit it, then in GitHub repo Settings → Pages set the custom domain`);
  log(`to ${cfg.domain} and enable "Enforce HTTPS" once the DNS check passes.`);
}

// ---------- dispatch ----------

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case "check": cmdCheck(); break;
  case "go-live": cmdGoLive(); break;
  case "release": cmdRelease(arg); break;
  case "cname": cmdCname(); break;
  default:
    log("FreshRig launch automation\n");
    log("  node scripts/launch.mjs check                 readiness check");
    log("  node scripts/launch.mjs go-live               wire checkout + bump (Phase 3 + 6)");
    log("  node scripts/launch.mjs release <patch|minor|major>   ordinary version bump");
    log("  node scripts/launch.mjs cname                 write site/CNAME from config");
    process.exit(cmd ? 1 : 0);
}
