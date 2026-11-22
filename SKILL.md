# ng-point — agent skill

Dev-mode-only Angular package: Alt+Click any element in your running app to capture an
LLM-ready context block — component, `file:line`, template, cleaned HTML, directives,
parent — copied to the clipboard with an optional instruction, ready for an AI coding agent.

If you are an AI agent working in a project that has ng-point installed (or should have it),
this file tells you everything you need to set it up, use it, and configure it.

Hosted docs & landing: <https://abiramcodes.github.io/ng-point/>

## Install

```bash
npm install -D ng-point
```

DevDependency — the provider is constant-folded out of production builds.

## Setup (30 seconds)

```ts
// app.config.ts
import { provideNgPoint } from 'ng-point';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideNgPoint()],
};
```

That is the entire setup. `ng serve` → Alt+Click any element (macOS: Option+Click) → the overlay opens.

## What you get

```
Component: SubmitButtonComponent
File: src/app/orders/submit-button.component.ts:19
Template: src/app/orders/submit-button.component.ts:16
Element: <button class="btn btn-primary">Approve selected</button>
Directives: RouterLink
Parent: OrdersPage (src/app/pages/orders-page.ts:110)
Instruction: disable this while orders are loading
```

Lines are omitted when empty or unavailable — no invented data.

## Keyboard

| Action | Effect |
|---|---|
| `Alt+Click` (macOS: `Option+Click`) | Pick (or re-pick the active selection while the panel is open) |
| `Alt+Shift+Click` (macOS: `Option+Shift+Click`) | Add another element (up to 5 per session) |
| `Alt+↑` / `Alt+↓` (macOS: `Option+↑/↓`) | Retarget to parent / first-child |
| `Enter` | Copy all blocks (joined by `---`), queue, close |
| `Ctrl+Enter` (macOS: `⌘+Enter`) | Copy one block without queueing |
| `Esc` | Close without queueing |

`Enter` works from anywhere on the panel — no instruction typed, nothing focused.

**Same key on every platform.** On a MacBook the pick modifier is the keycap labeled
**option ⌥**; on Windows and Linux it is **Alt**. Both set the browser's `altKey` event
property, so picking, adding, and retargeting behave identically everywhere — the panel's
hints print the label your platform uses (`Option+Click` on a Mac, `Alt+Click` elsewhere).
`Ctrl+Shift+Click` activation (`activationModifier: 'ctrl-shift'`) works unchanged on all
platforms; its add-click is `Ctrl+Shift+Option+Click` on a Mac.

## Configuration

```ts
provideNgPoint({
  activationModifier: 'alt',          // or 'ctrl-shift'
  maxSelections: 5,
  maxQueueEntries: 6,
  sensitiveSelectors: ['input[autocomplete="cc-number"]'],
  extraRedactionPatterns: [/TICKET-\d+/],
  includeTemplateLine: true,
  resolveFilePath: (filePath, element) => `remotes/checkout/${filePath}`,
})
```

All fields are optional; the values above are the defaults.

## Opt out per element

```ts
import { NgPointIgnoreDirective } from 'ng-point';

@Component({
  imports: [NgPointIgnoreDirective],
  template: `<div ngPointIgnore>Alt+Click inside me does nothing.</div>`,
})
```

Alt+Clicks inside an ignored subtree pass straight through to the app — no capture,
no overlay, no `preventDefault()`. Retargeting skips ignored zones too.

## Kill-switch

```js
localStorage.ngPointDisabled = '1';  // disables picking without a rebuild
```

## How it works (no build plugin)

- `provideNgPoint()` registers a `provideEnvironmentInitializer()` that checks
  `ngDevMode` — constant-folded `false` in production, so the overlay chunk is dead code.
- The overlay attaches a non-modal `<dialog>` to `<body>` and a capture-phase
  `click` listener on `document`.
- On Alt+Click it reads `window.ng` (Angular's dev-mode devtools API) to resolve
  the component, and `ctor.ɵcmp.debugInfo` (the compiler's dev-only metadata)
  for the exact `file:line`.
- The element's HTML is rebuilt through an attribute allowlist; `input.value`
  is never read; secret-shaped content (JWTs, API keys, tokens) is replaced with
  `«redacted»` before anything reaches the clipboard.

## Template `file:line` (Angular 22.1.4+ only)

Create a dev-only tsconfig:

```json
// tsconfig.app.dev.json
{
  "extends": "./tsconfig.app.json",
  "angularCompilerOptions": {
    "enableTemplateSourceLocations": true
  }
}
```

Reference it only from the `development` configuration in `angular.json`.
On Angular 21 or 22.0-22.1.3, the `Template:` line is simply omitted.

## Module federation

Works when `@angular/core` is a shared singleton (every standard MF setup) —
picks inside remote-rendered DOM resolve via the same `window.ng` surface.
Share `ng-point` as a singleton too: one copy, one config source, one panel.

## Version compatibility

Angular 21 and 22. Zone-based or zoneless. No zone APIs used.
The only version-dependent feature is the `Template:` line (22.1.4+).
