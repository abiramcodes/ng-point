# ng-point

**Dev-mode-only Angular package: Alt+Click any element in your running app to capture an LLM-ready context block — component name, `file:line`, template, cleaned HTML, directives, parent component — copy it to the clipboard with an optional instruction, and mirror the recent queue to a local MCP server for AI coding agents.**

Monorepo layout (pnpm workspaces):

| Package | What it is |
| --- | --- |
| [`packages/ng-point`](./packages/ng-point) | The Angular library (`provideNgPoint()`) — published as `ng-point` |
| [`packages/ng-point-mcp`](./packages/ng-point-mcp) | The local MCP server (`npx ng-point-mcp`) — two pull-based tools |
| `apps/demo` | Example Angular 22 app (login / orders / settings pages) |

## Quick start

```bash
pnpm install
pnpm start            # demo app at http://localhost:4200 (dev mode, ng-point active)
pnpm mcp              # local MCP server on http://127.0.0.1:7317 (run in another terminal)
```

Then, in the running app: **Alt+Click** an element → review the context block → type an optional instruction → **Enter**.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm start` | Serve the demo app (development build) |
| `pnpm build` | Production build of the demo app |
| `pnpm build:lib` | Build the `ng-point` library (APF output in `dist/ng-point`) |
| `pnpm test` / `test:lib` / `test:mcp` | Single-run tests (no watch) with coverage |
| `pnpm test:all` | Everything above in one run |
| `pnpm mcp` | Run the MCP server (stdio + localhost HTTP ingest) |
| `pnpm check:prod` | Production build + verify ng-point never leaks into initial prod bundles |

## How it works (no custom build plugin)

- **Component `file:line`**: Angular's AOT compiler emits a dev-mode-only `ɵsetClassDebugInfo` call for every app-source component. ng-point reads `{ className, filePath, lineNumber }` from `ɵcmp.debugInfo` at click time.
- **Template `file:line`** (optional): the dev-only tsconfig option `enableTemplateSourceLocations` makes the compiler stamp `data-ng-source-location` on every DOM element; ng-point parses it into a `Template:` line.
- **Element/directive/parent resolution**: `window.ng` — the same devtools API surface Angular publishes in dev builds and that Angular DevTools uses.
- **Dev-only guarantee**: three layers — `ngDevMode` init guard, lazy `window.ng` check at click time, and the overlay lives in a lazy chunk that production never loads (verified by `pnpm check:prod`).

See [`packages/ng-point/README.md`](./packages/ng-point) for install/setup, the exact clipboard format, configuration, security/redaction notes — and [`packages/ng-point-mcp/README.md`](./packages/ng-point-mcp) for MCP setup in Claude Code, Cursor, VS Code and Gemini.

## Module Federation (shell + runtime-loaded remotes)

**Short answer: it works in the standard setup — for the same reason Angular DevTools works there — but that reason is narrower than "DevTools works".**

What actually happens with module federation:

1. **Every standard Angular MF setup (`@angular-architects/module-federation` and Native Federation) requires `@angular/core` as a shared singleton.** One framework instance lives on the page, publishes one `window.ng`, and resolves views for the shell *and* all remotes. That is exactly why DevTools works — and ng-point rides the same surface, so picks inside any remote resolve correctly. ng-point's click listener is on the shared `document` (capture phase) and the recent-queue is a `globalThis` singleton, so all contexts land in one queue regardless of which remote rendered the element.

2. **Where the "DevTools works" reasoning breaks down** — DevTools is a browser extension with its own backend; it never runs inside your apps, so it is immune to everything below. ng-point is not:

   | Scenario | Effect | Status |
   | --- | --- | --- |
   | `@angular/core` shared as singleton (standard) | Everything works, including remote-rendered elements | ✅ supported |
   | Version-skewed remotes, core **not** singleton | `window.ng` is last-writer-wins: components from other framework copies resolve to `(no component found)` — graceful degradation, no crash (DevTools degrades identically in this setup) | ⚠️ degraded |
   | Each remote calls `provideNgPoint()` | A `globalThis` guard makes only the first bootstrap (shell) attach the overlay; remotes are silently skipped — one panel, one queue, one listener | ✅ by design |
   | Remote-internal route changes | The shell's `Router` won't see them; ng-point also closes the session on `popstate`/`hashchange` as an MF-agnostic fallback. Contexts are captured at pick time, so a stale session can never produce a *wrong* block — worst case you re-pick | ✅ handled |
   | `file:line` across remotes | `filePath` is **build-root-relative per remote** — two remotes can both report `src/app/foo.component.ts`. Use the `resolveFilePath` config hook to disambiguate (e.g. prefix `remotes/checkout/`); agents should resolve paths against the correct remote's workspace root | ⚠️ configurable |
   | ShadowDom-encapsulated remote content | Click retargeting is unwrapped via the event's composed path, so the *inner* element is captured, not the shadow host | ✅ handled |
   | `Template:` lines | `enableTemplateSourceLocations` must be enabled in **each remote's dev-only tsconfig** | per-remote opt-in |

3. **Recommendation for MF apps:** share `ng-point` itself as a singleton in your federation config (one copy, one config source, one lazy chunk), enable the dev-only tsconfig option in every remote that should report template locations, and add a `resolveFilePath` hook to prefix remote paths so `file:line` is unambiguous for agents. ShadowDom-encapsulated remote content is handled via composed-path click unwrapping.
