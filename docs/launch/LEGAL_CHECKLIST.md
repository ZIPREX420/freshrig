# Phase 5 — Legal & Admin Checklist

External steps that gate revenue. None can be automated — but none block the
*code* being ready. Start the bijberoep registration now; it has the longest
lead time and you legally cannot earn before it is effective.

> Not legal or tax advice. FreshRig is a one-person Belgian operation; confirm
> the specifics with an accountant (boekhouder) or a business one-stop-shop
> (ondernemingsloket: Securex, Liantis, Xerius, etc.).

## 1. Bijberoep registration (REQUIRED before first sale)

Self-employed-as-a-secondary-occupation registration. Must be effective before
any revenue settles.

- [ ] Register the activity at an ondernemingsloket → get a KBO/BCE company number.
- [ ] Register for VAT (BTW/TVA) — software sales are VAT-relevant even in bijberoep.
- [ ] Join a social insurance fund (sociaal verzekeringsfonds).
- [ ] Budget the registration cost (~€170-190) and recurring social contributions.
- [ ] Open a separate bank account for the business if you don't have one.

## 2. VAT / cross-border EU sales

FreshRig sells digital goods across the EU. Two things matter:

- [ ] **Merchant of record:** LemonSqueezy acts as the merchant of record — it
      collects and remits VAT/sales tax on most sales for you. Confirm in the
      LemonSqueezy dashboard exactly what they remit vs. what you must declare.
- [ ] **OSS scheme:** for any sales where you (not LS) are liable, the EU
      One-Stop-Shop scheme lets you file cross-border VAT in one return.
      Confirm with your accountant whether you need to register, given LS is MoR.
- [ ] Keep LemonSqueezy payout statements for your bookkeeping.

## 3. Microsoft Store

- [ ] Finish the Microsoft Partner Center individual developer account ($19 one-time).
- [ ] Submit FreshRig (the MSIX/installer) for certification — can happen after
      the public launch, not a blocker.

## 4. EU Cyber Resilience Act (deadline ~Sept 2026)

Not a launch blocker, but calendar it:

- [ ] Vulnerability-reporting process — `SECURITY.md` + GitHub Security Advisories
      already cover this.
- [ ] SBOMs — already generated per release (`sbom-rust.cdx.json`,
      `sbom-npm.cdx.json`). Good.
- [ ] Document a coordinated-disclosure policy and a support/patch window.

## 5. Pre-sale paperwork

- [ ] Privacy policy (`site/privacy.html`) reviewed — confirm it reflects
      LemonSqueezy as a data processor (customer name/email flow through LS).
- [ ] Terms (`site/terms.html`) reviewed — refund policy, license terms,
      Founder's Lifetime conditions (500 cap / 30-day window / exclusions).
- [ ] Refund policy stated on the pricing page and consistent with LS settings.

## Bottom line

The code is ready independent of all of this. The **bijberoep registration is
the true long pole** — begin it the same week you start Phase 3, so the legal
entity is effective by the time `npm run go-live` ships v2.6.0.
