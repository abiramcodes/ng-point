# Data sources — where every line of a context block comes from

The cheat sheet for "how does ng-point know X?" — every field of the copied
block, its exact origin, and the code that reads it. File paths are relative
to `packages/ng-point/src/lib`.

```md
Component: SubmitButtonComponent
File: src/app/orders/submit-button.component.ts:19
Template: src/app/orders/submit-button.component.ts:16
Element: <button type="button" class="btn btn-primary">Approve selected</button>
Directives: RouterLink, NgIf
Parent: OrdersPage (src/app/pages/orders-page.ts:110)
Instruction: disable while loading
```

| Block line | Origin | Read by |
| --- | --- | --- |
| `Component:` | `ctor.ɵcmp.debugInfo.className` — the AOT compiler's dev-only `ɵsetClassDebugInfo()` call, present on every **app-source** component in dev builds | `resolve.ts → readComponentInfo` |
| `File:` | `debugInfo.filePath` + `debugInfo.lineNumber` (1-based line of the class declaration). Project-root-relative as the compiler recorded it | `resolve.ts → readComponentInfo` |
| `Template:` | the `data-ng-source-location` attribute the compiler stamps on every element when the dev tsconfig sets `enableTemplateSourceLocations` (**app compiler 22.1.4+ only** — the option does not exist in 21.x / 22.0–22.1.3, where this line is omitted); format `<path>@o:<offset>,l:<line>,c:<column>`, line +1 | `resolve.ts → readTemplateLocation` |
| `Element:` | the clicked element's DOM, **rebuilt through an attribute allowlist** (`class`, `id`, `name`, `type`, `role`, … + `aria-*`/`data-*`); Angular noise (`ng-reflect-*`, `_ngcontent-*`, `_nghost-*`, `ng-star-inserted`) stripped; values >60 chars truncated | `snippet.ts → cleanElementHtml` |
| `Directives:` | `window.ng.getDirectives(element)` — constructor names, deduped, the owning component excluded | `resolve.ts → readDirectives` |
| `Parent:` | `window.ng.getComponent()` walked one level up the parent chain | `resolve.ts → findParentComponent` |
| `Instruction:` | typed by the user, per card; folded into the block at format time | `format.ts → formatBlock` |
| `Note:` | added when the element is structurally sensitive (e.g. `input[type=password]`) — the value itself is never read | `snippet.ts` + `format.ts` |

## The three Angular surfaces being read

1. **`ngDevMode`** — a global the application builder replaces with `true`
   (dev) / `false` (prod). ng-point's initializer checks it once;
   constant-folding makes the overlay import dead code in production.
   Read in: `provide-ng-point.ts`.

2. **`window.ng`** — Angular publishes this devtools API during **dev-mode
   bootstrap** (the same surface Angular DevTools uses). Two methods are
   used, nothing else: `getComponent(element)`,
   `getDirectives(element)`. Because it appears *during* bootstrap, it is
   read **lazily at click time** via `dev-guard.ts → getNg()` — never at
   provider initialization.

3. **`ctor.ɵcmp.debugInfo`** — left on every app-source component class by
   the compiler's dev-only `ɵsetClassDebugInfo(...)` emission. Read at click
   time off the component instance the `window.ng` call returned:
   `ctor['ɵcmp']['debugInfo'] → { className, filePath, lineNumber }`.
   Library components (partial-compiled npm packages) have none, and
   degrade to a name plus `(source location unavailable)`.

## What is deliberately NOT read

- `input.value` — never. Sensitive inputs are captured structurally.
- Anything outside the attribute allowlist — so `ng-reflect-*` bound values
  (which can contain typed passwords in dev DOM) cannot enter a block.
- No network, no `window` APIs beyond the two `window.ng` calls and the
  clipboard.

## Where the block goes after Enter

1. **Clipboard** — `clipboard.ts → copyText()`: Async Clipboard API with a
   synchronous `execCommand` fallback; failure keeps the panel open.
2. **Queue** — `session.ts → entries()` → `queue.ts`: in-memory signal store
   mirrored to `globalThis.__ngPointQueue` (HMR-safe) and
   `sessionStorage['ng-point.queue.v1']` (refresh-safe), FIFO-capped at
   `maxQueueEntries`. Redacted *before* it ever reaches either.
