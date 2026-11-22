# ng-point

**Dev-mode-only Angular package: Alt+Click any element in your running app to capture an LLM-ready context block — component name, `file:line`, template, cleaned HTML, directives, parent component — copied to the clipboard with an optional instruction, ready for your AI coding agent.**

What a captured block looks like:

```
Component: SubmitButtonComponent
File: src/app/orders/submit-button.component.ts:19
Template: src/app/orders/submit-button.component.ts:16
Element: <button class="btn btn-primary">Approve selected</button>
Directives: RouterLink
Parent: OrdersPage (src/app/pages/orders-page.ts:110)
Instruction: disable this while orders are loading
```

## Install

```bash
npm i -D ng-point
```

Installed as a **devDependency**: the provider is dev-mode-only and production builds constant-fold it away — it is never needed at runtime.

## Setup

1. Add the provider once, in `app.config.ts`:

```ts
import { provideNgPoint } from 'ng-point';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideNgPoint()],
};
```

2. Run your dev server — ng-point is dev-mode only, production builds never load it.
3. **Alt+Click** any element (macOS: **Option+Click** — the same key, labeled ⌥) → review the block → type an optional instruction → **Enter**. The block is on your clipboard; up to 5 elements copy together with one Enter.

## Why it's safe

- **Dev-only by construction** — an `ngDevMode` guard, a lazy `window.ng` check, and an overlay chunk production builds never load (`pnpm check:prod` proves it).
- **Redacted at capture** — JWTs, API keys, and typed values are stripped before anything reaches the clipboard or the queue.
- **You choose what is pointable** — mark anything with `ngPointIgnore` and Alt+Clicks pass straight through to your app, as if ng-point were not there.

## Public API

| Export | What it is |
| --- | --- |
| `provideNgPoint(config?)` | The environment provider — add to `app.config.ts` |
| `NgPointIgnoreDirective` | Standalone directive for `[ngPointIgnore]` — import into components that use it |
| `NgPointConfig` | TypeScript interface for the provider's options |

## Learn more

- **Docs & landing: <https://abiramcodes.github.io/ng-point/>** — hosted on GitHub Pages.
- [`packages/ng-point/README.md`](./packages/ng-point) — full usage, keyboard shortcuts, configuration, security and redaction notes, and module federation behavior.

## Repository

| | What it is |
| --- | --- |
| [`packages/ng-point`](./packages/ng-point) | The Angular library — published as `ng-point` |
| `apps/demo` | Example Angular 22 app (login / orders / settings) |
| [`SKILL.md`](./SKILL.md) | Agent skill file — everything an AI coding agent needs to set up and use ng-point |
| [`site/`](./site) | Landing page — live at <https://abiramcodes.github.io/ng-point/> — deployed to GitHub Pages by `.github/workflows/landing.yml` |
| [`video/launch`](./video/launch) | Launch video source in Go (mygo render plugin) — renders `video/ng-point-launch.mp4` |

### Development

```bash
pnpm install
pnpm start          # demo app at localhost:4200 (dev mode, ng-point active)
pnpm test:all       # demo + library tests
pnpm build:lib      # build the library (dist/ng-point)
pnpm publish:lib    # build + publish dist/ng-point to npm
pnpm check:prod     # verify ng-point never leaks into initial prod bundles
```
