# Phase 7 — Marketing Launch Kit

Ready-to-post copy. Posting is manual (no automation — these are real accounts
with real community rules). Launch *after* a real purchase has gone through
end-to-end. Sequence: Reddit soft launch → Reddit main → Product Hunt → Show HN.

Replace `LINK` with the live landing-page URL (`freshrig.app` once the domain
is up, else `https://ZIPREX420.github.io/freshrig/`).

---

## 1. Reddit soft launch — r/SideProject, r/opensource

Post only after 1-2 weeks of genuine participation in the subreddit. Respect the
~9:1 give-to-promote ratio. Tone: builder-to-builders, no hype.

**Title:** I built a cross-platform "nuke-and-pave" PC setup tool in Rust/Tauri — hardware detection, driver finder, batch app install, debloat

**Body:**
> After one too many evenings rebuilding a fresh Windows install, I made FreshRig — one app that detects your hardware, points you at the right drivers, batch-installs your apps silently, and runs the cleanup/optimize/privacy passes you'd otherwise do by hand across a dozen tools.
>
> It's cross-platform — Windows (winget), Linux (apt/dnf/pacman/zypper/Flatpak), macOS (Homebrew) — built with Tauri v2 + Rust + React. Open source (MIT), no telemetry.
>
> Free tier covers hardware dashboard, drivers, 15 essential apps, optimize, startup. There's a paid Pro tier for the heavier maintenance features, and a Pro Business tier for repair shops.
>
> Repo and downloads: LINK
>
> Happy to answer anything about the Tauri side — the cross-platform command abstraction was the interesting part.

---

## 2. Reddit main — r/pcmasterrace, r/buildapc, r/windows

Post window: **Tue-Thu, 12:00-15:00 CET**. Read each sub's self-promo rules first
(some require a flair or a megathread).

**Title:** FreshRig — set up a fresh PC in minutes: auto-detect hardware, find drivers, batch-install apps, debloat. Free & open source.

**Body:**
> Fresh Windows install always means the same hours-long ritual: identify hardware, hunt down drivers, download 20 installers one site at a time, then debloat. FreshRig collapses that into one app.
>
> - **Hardware dashboard** — CPU/GPU/board/storage/network/audio, detected automatically.
> - **Drivers** — finds your GPU/audio/network vendors and routes you to the right tool.
> - **Apps** — pick from a catalog, batch-installed silently (winget on Windows; apt/dnf/pacman/zypper/Flatpak on Linux; Homebrew on macOS).
> - **Optimize / Startup** — debloat tweaks in Safe/Moderate/Expert tiers, every change reversible with a restore point.
>
> Free, open source (MIT), no telemetry, no bundled junk. Windows / Linux / macOS.
>
> Download: LINK
>
> It's a solo project — feedback and bug reports very welcome.

---

## 3. Product Hunt

Launch **Tuesday, 00:01 PST**. Have the assets ready: logo, 3-5 screenshots, a
30-60s demo GIF/video.

- **Name:** FreshRig
- **Tagline (60 char max):** Set up any PC in minutes, not hours
- **Description:**
> FreshRig is the post-install toolkit for a fresh or cleaned PC. It detects your hardware, finds the right drivers, batch-installs your apps silently, and runs the cleanup, privacy, and optimization passes — all in one open-source app for Windows, Linux, and macOS. Built with Rust and Tauri. No telemetry.
- **First comment (maker):**
> Hi PH! I'm Seppe, a solo dev in Belgium. I built FreshRig because every fresh Windows install meant the same hours of driver-hunting and installer-downloading. It's free and open source; there's a Pro tier for deeper maintenance features and a Business tier aimed at one-tech repair shops. Ask me anything — especially about the Tauri cross-platform side.

---

## 4. Hacker News — Show HN

Post midweek mornings (US Eastern). Lead with the technical angle; HN dislikes
marketing tone.

**Title:** Show HN: FreshRig – cross-platform PC setup tool in Rust/Tauri

**Body:**
> FreshRig automates the post-install grind on a fresh machine: hardware detection, driver discovery, silent batch app installs, debloat/optimize, privacy and SMART-disk checks.
>
> It's a Tauri v2 app — Rust backend, React front end. The part I'd call out technically is the platform abstraction: every feature has Windows/Linux/macOS command twins behind a single `invoke()` name, so the front end is OS-agnostic. Windows uses WMI/winget, Linux uses /proc + lspci + the native package managers, macOS uses system_profiler + Homebrew.
>
> MIT-licensed, no telemetry. Free tier plus paid Pro/Business tiers. Releases ship signed binaries + CycloneDX SBOMs.
>
> Repo: LINK
>
> Feedback welcome — particularly from anyone who's fought Tauri's cross-platform bundling.

---

## Pre-launch asset checklist

- [ ] 3-5 screenshots (Dashboard, Quick Setup, Tools, a Pro feature, Health Report)
- [ ] 30-60s demo GIF or video
- [ ] Landing page live and the buy buttons tested end-to-end
- [ ] One real purchase completed and refunded as a dry run
- [ ] Repo README polished (it already is)
