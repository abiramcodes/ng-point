# ng-point

Dev-mode-only Angular package. **Alt+Click** any element in your running dev app → a small overlay shows the component name, `file:line`, template, cleaned HTML, directives and parent component → type an optional instruction → **Enter** copies a compact, LLM-friendly context block to the clipboard and adds it to a recent-selections queue (mirrored to the optional `ng-point-mcp` server for AI coding agents).

- **Clipboard is the zero-friction primary path.** MCP is pull-based only — agents fetch the queue; nothing is ever pushed into an agent session.
- **Does nothing in production builds.**
- **No custom build plugin, no UI framework** — source locations come from the Angular AOT compiler's own dev-mode metadata; the overlay is a native `<dialog>` with a few KB of self-contained CSS.

Works with Angular **v22+**.

## Install

```bash
npm install -D ng-point
```

## Setup

```ts
// app.config.ts
import { provideNgPoint } from 'ng-point';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideNgPoint()],
};
```

That's it. In `ng serve` (development), Alt+Click any element. In production builds the provider's initializer returns immediately — no listeners, no overlay, nothing.

### Optional: exact template `file:line` (`Template:` line)

Angular can stamp every element with its template source location. Create a **dev-only** tsconfig:

```jsonc
// tsconfig.app.dev.json — extends your app tsconfig
{
  "extends": "./tsconfig.app.json",
  "angularCompilerOptions": {
    "enableTemplateSourceLocations": true
  }
}
```

…and reference it only from the development configuration in `angular.json`:

```jsonc
"configurations": {
  "development": {
    "tsConfig": "tsconfig.app.dev.json"
  }
}
```

> ⚠️ Do not put this option in your shared/production tsconfig — its emission is **not** stripped from production builds.

### Optional: fully excluding the overlay chunk from production

`provideNgPoint()` already never *loads* the overlay in production, but the lazy chunk is emitted. To exclude it from the bundle entirely, register the provider only in dev:

```ts
// main.ts
import { isDevMode } from '@angular/core';

bootstrapApplication(App, {
  providers: [provideRouter(routes), ...(isDevMode() ? [provideNgPoint()] : [])],
});
```

## Usage

| Action | Effect |
| --- | --- |
| `Alt+Click` | Open the panel with selection #1 (while open: re-pick/replace the **active** selection) |
| `Alt+Shift+Click` (panel open) | **Add** another element — each selection is its own full context block with its own instruction (up to 5 per session) |
| `Alt+↑` / `Alt+↓` | Re-target the active selection to the parent / first-child element |
| Click a card | Make it the active selection (arrows / re-pick act on it) |
| Card `✕` | Remove that selection |
| `Enter` | Copy **all** blocks (joined by `---`), queue each as its own entry, mirror to the MCP server, close |
| `Ctrl+Enter` or per-card `copy` | Copy one block without queueing |
| `Shift+Enter` | Newline in the instruction (collapsed in the output) |
| `Escape` | Close without queueing |

The block preview in the panel is **editable** — what's in the textarea is exactly what gets copied, queued and mirrored. On Enter the final text is re-scanned for secret shapes and a warn-only `possible secret` badge appears if one is detected.

## Clipboard format

Single selection (matches the spec exactly):

```
Component: SubmitButtonComponent
File: src/app/submit-button/submit-button.component.ts:42
Template: src/app/submit-button/submit-button.component.html:7
Element: <button class="submit-btn">Save</button>
Directives: RouterLink, NgClass
Parent: FormComponent (src/app/form/form.component.ts:18)
Instruction: make this disabled when form is invalid
Note: sensitive values redacted
```

Multiple selections in one session are joined deterministically:

```
…block 1…

---

…block 2…
```

Omission rules: `Template:` when not enabled/present, `Directives:` when none, `Parent:` when the selection is the root component, `Instruction:` when empty, `Note:` only when redaction fired.

## Configuration

```ts
provideNgPoint({
  activationModifier: 'alt',          // or 'ctrl-shift' (picks with Ctrl+Shift+Click)
  maxSelections: 5,                    // contexts per session
  maxQueueEntries: 6,                  // recent queue cap (memory + sessionStorage)
  mcpEndpoint: 'http://127.0.0.1:7317',
  mcpToken: 'optional-bearer-token',
  sensitiveSelectors: ['input[autocomplete="cc-number"]'],
  extraRedactionPatterns: [/TICKET-\d+/],
  includeTemplateLine: true,
  // Module federation: file:line is build-root-relative per remote —
  // disambiguate paths before they enter context blocks.
  resolveFilePath: (filePath, element) => `remotes/checkout/${filePath}`,
})
```

Kill-switch: set `localStorage.ngPointDisabled = '1'` at runtime to disable picking without a rebuild.

## Security & redaction (dev mode is not a reason to leak secrets)

Redaction happens **at capture time** — the clipboard, queue, `sessionStorage` and MCP mirror only ever hold already-redacted text:

- `input.value` is **never read**; the snippet is built from an attribute **allowlist** (plus `aria-*`/`data-*`).
- Angular noise and leak vectors are always stripped: `ng-reflect-*` (Angular can render bound values — including typed passwords — into dev-mode DOM), `_ngcontent-*`, `_nghost-*`, `ng-star-inserted`.
- `input[type=password|secret|token|passphrase]` selections are **allowed** (e.g. "add a show/hide toggle") but always carry `Note: sensitive values redacted`.
- Secret-shaped content is replaced with `«redacted»`: JWTs, `sk_live_…`/`sk-…` keys, AWS `AKIA…` key IDs, GitHub/Slack tokens, ≥32-char hex and base64 blobs, plus your `extraRedactionPatterns`.
- Attribute values >60 chars and text >120 chars are truncated — long opaque blobs are redaction candidates anyway.
- The editable preview shows the exact final block; a warn-only re-scan flags leftover secret shapes after manual edits.
- `sessionStorage` persistence (refresh-safe queue) holds only redacted blocks.

## What ng-point does *not* do

- It never pushes anything into an open agent session — MCP is pull-based.
- It never modifies app behavior outside the click/overlay flow (capture-phase listener only acts when the modifier is held; `preventDefault`/`stopPropagation` are called only for ng-point's own clicks).
- It does not survive HMR state loss incorrectly: the queue rehydrates from a `globalThis` cache + `sessionStorage`.
- Known limits: Shadow DOM encapsulation, elements inside `<iframe>`s, and SVG internals are best-effort; components from npm libraries report `(source location unavailable)`.

## Module federation

Works when `@angular/core` is a shared singleton (required by every standard Angular MF setup) — picks in remote-rendered DOM resolve via the same `window.ng` surface Angular DevTools uses. See the root [`README.md`](https://github.com/ng-point/ng-point#module-federation-shell--runtime-loaded-remotes) for the full analysis: what works, what degrades gracefully (version-skewed non-singleton remotes), and per-remote caveats (build-root-relative `file:line`, per-remote dev tsconfig for template locations, sharing `ng-point` itself as a singleton).

## How source locations work (no build plugin)

- **Component `file:line`** — the AOT compiler emits `ɵsetClassDebugInfo(Class, { className, filePath, lineNumber })` in dev builds; ng-point reads it from the component definition (`ɵcmp.debugInfo`). `filePath` is project-relative; `lineNumber` is the 1-based line of the class declaration.
- **Template `file:line`** — `enableTemplateSourceLocations` (dev-only tsconfig) emits `ɵɵattachSourceLocations`, stamping `data-ng-source-location="<templatePath>@o:<offset>,l:<line>,c:<column>"` on each element; ng-point parses it into a `Template:` line.
- Both mechanisms are dev-only and rely on documented Angular internals (`window.ng`, `ɵcmp.debugInfo`). ng-point degrades gracefully when they are absent.

## Local development

```bash
pnpm build:lib     # APF output → dist/ng-point
pnpm test:lib      # single-run vitest with coverage
```
