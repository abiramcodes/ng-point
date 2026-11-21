# AGENTS.md

Notes for AI coding agents working in this repository.

## Skills to consult

### Angular-related changes

Apps (`apps/demo`), the library (`packages/ng-point`), `angular.json`, tsconfigs, and all
Angular tests: load the **`angular-developer`** skill before writing or reviewing Angular code —
components, providers, signals, DI, routing, forms, testing, and CLI/build tooling.

### Frontend-related changes

The landing site (`site/`) and any HTML/CSS/client-side JS work:

- load the **`frontend-design`** skill for design direction (tokens, layout, motion) before
  writing UI code, and keep the page free of templated defaults;
- run **`modern-web-guidance`** search/retrieve first for any web platform feature (dark mode,
  motion, clipboard, dialogs, forms, etc.) and apply its fallback rules.

### Verification

- Anything visual is verified in a real browser with the **`webapp-testing`** skill
  (Playwright): screenshots at 1440 and 390, geometry checks, console errors — in every theme
  the page supports.
- Anything Angular is verified with `pnpm test:lib && pnpm test && pnpm build:lib && pnpm build`,
  plus `node scripts/check-prod-clean.mjs` after production builds.

### Video generation

Promo, launch, or demo videos made with Go: load the **`mygo-render`** skill — it wraps the
mygo render plugin (`github.com/egoist/mygo/plugins/render`, native-UI frames drawn on the
GPU, system-encoded MP4/MOV/WebM/PNG) with a validated setup, API map, and known-good
starter program.

### MCP work

Changes to `packages/ng-point-mcp`: consult the **`mcp-builder`** skill.
