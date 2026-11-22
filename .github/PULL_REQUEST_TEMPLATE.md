## Summary

<!-- What this changes and why. One or two sentences. -->

Fixes #

## Type

<!-- Check the one that applies. -->

- [ ] Library (`packages/ng-point`)
- [ ] Demo app (`apps/demo`)
- [ ] Landing site (`site/`)
- [ ] Docs (`README.md`, package README, `SKILL.md`)
- [ ] Tooling / scripts / CI

## Verification

<!-- Fill in honestly — CI runs the full bar regardless. -->

- [ ] `pnpm test:lib` green (new behavior has specs)
- [ ] `pnpm test` green
- [ ] `pnpm build:lib && pnpm build` green
- [ ] `node scripts/check-prod-clean.mjs` clean — **no ng-point in initial production chunks**
- [ ] Visual changes verified in a real browser (both themes, mobile 390, reduced motion, no console errors)
- [ ] Behavior changes update `README.md`, the package README, and `SKILL.md`

## Notes

<!-- Design decisions, screenshots, probe output, anything a reviewer needs. -->
