## What & why

<!-- One or two sentences: what does this PR change, and why. -->

## Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` passes
- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passes
- [ ] Cross-platform code paths (Windows / Linux / macOS) all still compile
- [ ] `src/data/changelog.ts` updated if this is user-facing
- [ ] Tests added or updated for the changed behaviour

## Notes for the reviewer

<!-- Anything non-obvious: trade-offs, follow-ups, things you're unsure about. -->
