# Phase 4 — Domain & Email Setup

Manual steps (domain registration can't be automated) plus the in-repo
automation that finishes the job.

## 1. Register the domain

Register **`freshrig.app`** — Cloudflare Registrar is at-cost (~$14/yr for
`.app`; `.app` is on the HSTS preload list so HTTPS is mandatory, which is fine,
GitHub Pages serves HTTPS).

## 2. Email aliases (Cloudflare Email Routing — free)

In the Cloudflare dashboard → Email → Email Routing, create two routes
forwarding to `<your-personal-mailbox>`:

- `sales@freshrig.app` → used by the landing page Site-License contact and the
  Business CTA, and `SITE_CONTACT_URL` in `src/config/app.ts`.
- `security@freshrig.app` → referenced in `SECURITY.md`.

After they work, update `SECURITY.md` to drop the "coming soon" note.

## 3. Point the landing page at the domain (optional but recommended)

The site currently lives at `https://ZIPREX420.github.io/freshrig/`. To serve it
from `https://freshrig.app`:

1. Set `"domain": "freshrig.app"` in `launch.config.json`.
2. Run `node scripts/launch.mjs cname` — this writes `site/CNAME`.
3. Commit `site/CNAME`.
4. Cloudflare DNS: add the GitHub Pages records for the apex domain —
   `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153` (and a `CNAME` for `www` → `ziprex420.github.io`).
   Set these DNS records to **DNS-only** (grey cloud), not proxied.
5. GitHub repo → Settings → Pages → Custom domain → `freshrig.app` → Save.
   Wait for the DNS check, then tick **Enforce HTTPS**.

> Don't commit `site/CNAME` before the DNS records exist — GitHub Pages will
> fail its domain check. Register → DNS → then CNAME.

## 4. Update absolute URLs (after the domain is live)

These still point at the `github.io` URL — search-and-replace once the custom
domain serves:

- `site/index.html` — `og:image`, `og:url`, `canonical`, JSON-LD `url`.
- `README.md` — pricing / landing links.
- `src/config/app.ts` — none required (checkout URLs come from LemonSqueezy).

This is cosmetic/SEO — not a launch blocker. The `github.io` URL keeps working
as long as Pages is enabled.

## Checklist

- [ ] `freshrig.app` registered
- [ ] `sales@` + `security@` forwarding verified (send a test email)
- [ ] `SECURITY.md` "coming soon" note removed
- [ ] (optional) `site/CNAME` committed + GitHub Pages custom domain set + HTTPS enforced
- [ ] (optional) absolute `github.io` URLs swapped to `freshrig.app`
