# Changelog

All notable changes to `@abiramcodes/ng-point` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-11-24

### Added

- **Copy confirmation toast.** After Enter copies and queues, a brief `❮ copied — N context(s) queued` toast (~2s) confirms success once the panel has closed — previously the "Copied…" status was written inside the dialog and hidden by the close, so a successful commit looked identical to an Esc discard. The toast is screen-reader announced (`role="status"`), non-interactive (picks pass through it), and reduced-motion safe; discards stay silent.

### Fixed

- **Production builds no longer emit an orphaned overlay chunk.** The dev-mode guard in `provideNgPoint()` is now a positive `ngDevMode` guard around the dynamic import, so with `ngDevMode=false` esbuild drops the overlay entirely — no chunk is emitted and the prod initializer does no work. Previously (early-return guard) esbuild removed the import call but still shipped a never-loaded ~28 kB async chunk, most visible in Native Federation builds. Only the tiny `provideNgPoint()` stub remains; see the README's production-exclusion note (including the file-replacement path for setups that externalize `@angular/core`, where `isDevMode()` stays a runtime call).

### Changed

- Setup documentation simplified: the `Template:` line is enabled via your existing `tsconfig.base.json` (or `tsconfig.app.json`) — no separate dev tsconfig — and the version-compatibility table (Angular 21.x / 22.0–22.1.3 / 22.1.4+) now appears in the README and the agent skill.

## [1.0.0] - 2026-11-22

### Added

- Initial public release as `@abiramcodes/ng-point`: dev-mode-only Alt+Click picker (macOS: Option+Click) that captures LLM-ready context blocks — component, `file:line`, template, cleaned element HTML, directives, parent — onto the clipboard with an optional instruction, plus a recent-selections queue, at-capture secret redaction, and the `ngPointIgnore` per-element opt-out. Angular 21 and 22, zone-based or zoneless, no build plugin.
