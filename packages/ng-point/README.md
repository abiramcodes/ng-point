# ng-point

Dev-mode-only Angular package. **Alt+Click** any element in your running dev app → a small overlay shows the component name, `file:line`, template, cleaned HTML, directives and parent component → type an optional instruction → **Enter** copies a compact, LLM-friendly context block to the clipboard and adds it to a recent-selections queue.

- **Clipboard is the zero-friction path** — nothing is ever pushed into an agent session; you paste.
- **Does nothing in production builds.**
- **No custom build plugin, no UI framework** — source locations come from the Angular AOT compiler's own dev-mode metadata; the overlay is a native `<dialog>` with a few KB of self-contained CSS.

**Docs & landing:** <https://abiramcodes.github.io/ng-point/>

Works with Angular **21 and 22** (`@angular/core`/`@angular/common` `^21.0.0 || ^22.0.0`). The only version-dependent feature is the optional `Template:` line, which needs an app compiler of **22.1.4+** (see the setup variations below); everything else behaves identically on 21 and 22, zone-based or zoneless — ng-point uses no zone APIs and inherits your app's change-detection mode.

## Install

```bash
# npm
npm install -D @abiramcodes/ng-point

# pnpm
pnpm add -D @abiramcodes/ng-point
```

## Setup

```ts
// app.config.ts
import { provideNgPoint } from '@abiramcodes/ng-point';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideNgPoint()],
};
```

That's it. In `ng serve` (development), Alt+Click any element (macOS: Option+Click — the same key, labeled ⌥). In production builds the provider's initializer returns immediately — no listeners, no overlay, nothing.

### Optional: exact template `file:line` (`Template:` line) — Angular 22.1.4+ only

The compiler option behind this (`enableTemplateSourceLocations`) exists only in Angular **22.1.4 and later**. On Angular 21.x (and 22.0–22.1.3) skip this section entirely: ng-point works the same, context blocks simply omit the `Template:` line. Adding the option on older compilers is harmless — it is silently ignored and no attributes are stamped (verified on 20/21 toolchains).

On 22.1.4+, Angular can stamp every element with its template source location. Create a **dev-only** tsconfig:

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

### Optional: fully excluding ng-point from production

You don't need this for the overlay: in production the `ngDevMode` guard constant-folds away, so the overlay chunk is not emitted at all. Only the tiny `provideNgPoint()` stub remains in your initial bundle. To drop even that, register the provider only in dev:

```ts
// main.ts
import { isDevMode } from '@angular/core';

bootstrapApplication(App, {
  providers: [provideRouter(routes), ...(isDevMode() ? [provideNgPoint()] : [])],
});
```

Note for module-federation setups that externalize `@angular/core`: `isDevMode()` stays a runtime call there and cannot fold the reference away — use a production file replacement that omits the ng-point import instead.

## Setup variations by Angular version

Install and `provideNgPoint()` are identical on every supported version. The only differences:

| | Angular 21.x | Angular 22.0–22.1.3 | Angular 22.1.4+ |
| --- | --- | --- | --- |
| `Component:` / `File:` lines (compiler `debugInfo`) | ✔ | ✔ | ✔ |
| `Template:` line | — (line omitted) | — (line omitted) | ✔ with the dev-only tsconfig above |
| `enableTemplateSourceLocations` in tsconfig | Silently ignored — safe to leave in | Silently ignored — safe to leave in | Required for `Template:` |
| Change detection | Zone or zoneless — inherited from your app | Same | Same |

## Usage

| Action | Effect |
| --- | --- |
| `Alt+Click` (macOS: `Option+Click`) | Open the panel with selection #1 (while open: re-pick/replace the **active** selection) |
| `Alt+Shift+Click` (panel open) (macOS: `Option+Shift+Click`) | **Add** another element — each selection is its own full context block with its own instruction (up to 5 per session) |
| `Alt+↑` / `Alt+↓` (macOS: `Option+↑/↓`) | Re-target the active selection to the parent / first-child element |
| Click a card | Make it the active selection (arrows / re-pick act on it) |
| Card `✕` | Remove that selection |
| `Enter` | Copy **all** blocks (joined by `---`), queue each as its own entry, close — a brief `copied` toast confirms |
| `Ctrl+Enter` (macOS: `⌘+Enter`) or per-card `copy` | Copy one block without queueing |
| `Shift+Enter` | Newline in the instruction (collapsed in the output) |
| `Escape` | Close without queueing |

**macOS vs Windows/Linux — same gesture, different keycap.** The pick modifier is the key
labeled **option ⌥** on Apple keyboards and **Alt** everywhere else. Both set the same
`altKey` event property, so every interaction above behaves identically on all platforms;
the panel's hints print the label yours uses (`Option+Click` on a Mac, `Alt+Click`
elsewhere). The `activationModifier: 'ctrl-shift'` mode is identical everywhere too — its
add-click reads `Ctrl+Shift+Option+Click` on a Mac.

The block preview in the panel is **editable** — what's in the textarea is exactly what gets copied and queued. On Enter the final text is re-scanned for secret shapes and a warn-only `possible secret` badge appears if one is detected.

The panel itself is **draggable by its header** and clamped so it always stays fully on screen (its cards and queue scroll inside). Multiple selections spread **horizontally**: the panel widens by a card slot per pick up to the screen edge, and the cards row scrolls sideways when the space runs out. `Enter` commits from anywhere on the panel — instruction or not — and the Recent queue has its own `copy all` that puts every queued entry on the clipboard at once. Alt+Clicks that land **on the panel itself** pick the element visually beneath it, and a suppressed pick (an `ngPointIgnore` subtree) explains itself in the status line instead of silently doing nothing.

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
  sensitiveSelectors: ['input[autocomplete="cc-number"]'],
  extraRedactionPatterns: [/TICKET-\d+/],
  includeTemplateLine: true,
  // Module federation: file:line is build-root-relative per remote —
  // disambiguate paths before they enter context blocks.
  resolveFilePath: (filePath, element) => `remotes/checkout/${filePath}`,
})
```

Kill-switch: set `localStorage.ngPointDisabled = '1'` at runtime to disable picking without a rebuild.

## Opting out (per element)

Mark any element — and its whole subtree — as off-limits to ng-point picks:

```ts
import { NgPointIgnoreDirective } from '@abiramcodes/ng-point';

@Component({
  imports: [NgPointIgnoreDirective],
  template: `<div ngPointIgnore>Alt+Click inside me does nothing.</div>`,
})
```

Or conditionally:

```html
<section [ngPointIgnore]="isThirdPartyPanel">Conditional opt-out.</section>
```

Clicks inside an ignored subtree are left completely untouched: no capture, no overlay, no
`preventDefault()` — the app's own click behavior runs as if ng-point were not installed.
`Alt+↑`/`Alt+↓` retargeting skips ignored zones, and `[ngPointIgnore]="false"` re-enables
picking. A plain `ng-point-ignore` attribute (without importing the directive) is honored too.

## Security & redaction (dev mode is not a reason to leak secrets)

Redaction happens **at capture time** — the clipboard, queue and `sessionStorage` only ever hold already-redacted text:

- `input.value` is **never read**; the snippet is built from an attribute **allowlist** (plus `aria-*`/`data-*`).
- Angular noise and leak vectors are always stripped: `ng-reflect-*` (Angular can render bound values — including typed passwords — into dev-mode DOM), `_ngcontent-*`, `_nghost-*`, `ng-star-inserted`.
- `input[type=password|secret|token|passphrase]` selections are **allowed** (e.g. "add a show/hide toggle") but always carry `Note: sensitive values redacted`.
- Secret-shaped content is replaced with `«redacted»`: JWTs, `sk_live_…`/`sk-…` keys, AWS `AKIA…` key IDs, GitHub/Slack tokens, ≥32-char hex and base64 blobs, plus your `extraRedactionPatterns`.
- Attribute values >60 chars and text >120 chars are truncated — long opaque blobs are redaction candidates anyway.
- The editable preview shows the exact final block; a warn-only re-scan flags leftover secret shapes after manual edits.
- `sessionStorage` persistence (refresh-safe queue) holds only redacted blocks.

## What ng-point does *not* do

- It never pushes anything into an open agent session — you paste, the agent reads.
- It never modifies app behavior outside the click/overlay flow (capture-phase listener only acts when the modifier is held; `preventDefault`/`stopPropagation` are called only for ng-point's own clicks).
- It does not survive HMR state loss incorrectly: the queue rehydrates from a `globalThis` cache + `sessionStorage`.
- Known limits: Shadow DOM encapsulation, elements inside `<iframe>`s, and SVG internals are best-effort; components from npm libraries report `(source location unavailable)`.

## Module federation

Works when `@angular/core` is a shared singleton (required by every standard Angular MF setup) — picks in remote-rendered DOM resolve via the same `window.ng` surface Angular DevTools uses. See the root [`README.md`](https://github.com/abiramcodes/ng-point#module-federation-shell--runtime-loaded-remotes) for the full analysis: what works, what degrades gracefully (version-skewed non-singleton remotes), and per-remote caveats (build-root-relative `file:line`, per-remote dev tsconfig for template locations, sharing `ng-point` itself as a singleton).

## How source locations work (no build plugin)

- **Component `file:line`** — the AOT compiler emits `ɵsetClassDebugInfo(Class, { className, filePath, lineNumber })` in dev builds; ng-point reads it from the component definition (`ɵcmp.debugInfo`). `filePath` is project-relative; `lineNumber` is the 1-based line of the class declaration.
- **Template `file:line`** — `enableTemplateSourceLocations` (dev-only tsconfig) emits `ɵɵattachSourceLocations`, stamping `data-ng-source-location="<templatePath>@o:<offset>,l:<line>,c:<column>"` on each element; ng-point parses it into a `Template:` line.
- Both mechanisms are dev-only and rely on documented Angular internals (`window.ng`, `ɵcmp.debugInfo`). ng-point degrades gracefully when they are absent.

## Local development

```bash
pnpm build:lib     # APF output → dist/ng-point
pnpm test:lib      # single-run vitest with coverage
```

The workspace develops on Angular 22; Angular 21 support is verified by the `angular21` CI job (`.github/workflows/ci.yml`), which swaps the workspace to the Angular 21 toolchain via `scripts/ci-angular21.mjs` and runs the full build/test suite. Release builds of the package should be produced with the Angular 21 toolchain (the oldest supported major), so the published APF output is consumable by both 21 and 22 apps.

## Changelog

See the root [`CHANGELOG.md`](https://github.com/abiramcodes/ng-point/blob/main/CHANGELOG.md).

## License

MIT — see the root [`LICENSE`](https://github.com/abiramcodes/ng-point/blob/main/LICENSE).
