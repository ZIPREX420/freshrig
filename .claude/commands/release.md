---
description: Prepare and tag a new release
argument-hint: patch|minor|major
---

Prepare a release for FreshRig. Releases are automated by `scripts/launch.mjs`.

1. Run `npm run release -- $ARGUMENTS` (defaults to `patch` if no argument).
   This bumps the version across all four files (`src-tauri/tauri.conf.json`,
   `src-tauri/Cargo.toml`, `package.json`, `src/config/app.ts`), scaffolds a
   changelog entry in `src/data/changelog.ts`, and runs `npx tsc --noEmit`.
2. Edit the new entry in `src/data/changelog.ts` — replace the `TODO` line with
   a real description of what shipped.
3. Run `cargo generate-lockfile --manifest-path src-tauri/Cargo.toml`.
4. Run `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` and
   `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` to verify Rust.
5. Commit: `git add -A && git commit -m "chore: release v{NEW_VERSION}"`.
6. Tell me to run: `git tag v{NEW_VERSION} && git push origin main --tags`.
7. Remind me that pushing the tag triggers `.github/workflows/release.yml`,
   which runs the license release-readiness gate and builds the draft release.

For the *paid-launch* release specifically (wiring LemonSqueezy checkout), use
`npm run go-live` instead — see `docs/launch/README.md`.
