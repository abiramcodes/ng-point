# Contributing to ng-point

Bug reports, features, docs, and design polish are all welcome. This repo is
small and deliberate — the best contributions keep it that way.

## Dev setup

```bash
corepack enable          # pnpm comes from packageManager in package.json
pnpm install
```

Node 22+ (CI runs its matrices on Node 24). Everything below assumes pnpm.

## Repository map

| Path | What it is |
| --- | --- |
| `packages/ng-point` | The Angular library — published as `@abiramcodes/ng-point` |
| `apps/demo` | Demo app (login / orders / settings) used by the specs |
| `site/` | Landing page, deployed to GitHub Pages |
| `scripts/` | Verification scripts (landing checks, OG cards, CI helpers) |
| `video/launch` | Launch video source (Go, mygo render plugin) — local-only, gitignored for now |
| `SKILL.md` | The public agent skill file — update it when behavior changes |

## The verification bar

CI runs two matrices (Angular 22 and Angular 21 via `scripts/ci-angular21.mjs`)
and must be green before merge. Locally, match it:

```bash
pnpm test:lib                    # library specs (vitest)
pnpm test                        # demo app specs
pnpm build:lib && pnpm build     # library + app builds
node scripts/check-prod-clean.mjs   # ng-point must NEVER appear in any prod chunk
```

The prod-clean check is the package's core promise: ng-point is dev-mode-only,
and a change that leaks it into production runtime chunks is a bug, not a
regression to discuss.

**Anything visual** (the overlay or the landing site) is verified in a real
browser with Playwright — `scripts/landing_verify.py` runs the landing matrix
(both themes, mobile 390, reduced motion, console errors). New overlay states
should be driven in the demo app and probed there.

## Design language

The overlay and the landing page share one identity — a targeting console:

- JetBrains Mono only, hard corners everywhere, a faint coordinate grid
- The `<` reticle mark, brand red-magenta `#D40F62`, amber pick/lock states
- Lowercase, terse console voice; direction over mood in copy
- Restraint: information over chrome; spend the boldness in one place

If a change adds boxes, borders, or labels, expect to be asked what each one
earns.

## Guidelines

- **Behavior changes need specs.** The suite is vitest; specs live next to
  their sources (`*.spec.ts`).
- **The overlay stays dev-only.** No runtime dependencies, no zone APIs;
  production builds must constant-fold everything away.
- **Accessibility is part of the design.** The panel is a non-modal
  `<dialog>`; keyboard paths, focus handling, reduced-motion, and
  `role="status"` feedback are features, not garnish.
- **Docs follow code.** If behavior changes, `README.md`, the package README,
  and `SKILL.md` change with it.

## Pull requests

- Small, focused diffs beat big ones. Open early if you want to talk it
  through.
- Reference the issue you're fixing.
- The PR checklist must be filled in honestly — CI runs the full bar anyway.

## Reporting bugs

Use the issue templates. A useful bug report includes: Angular version,
browser and OS, package manager, and the smallest reproduction you can manage.
The demo app (`pnpm start`) is a good repro host.

Security issues follow [SECURITY.md](./SECURITY.md) — never a public issue.
The [Code of Conduct](./CODE_OF_CONDUCT.md) applies to everything.

## License

MIT — your contributions land under it.
