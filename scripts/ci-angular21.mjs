// ci-angular21.mjs — rewrites the workspace manifests IN PLACE to the
// Angular 21 toolchain, for the `angular21` CI job (.github/workflows/ci.yml).
//
// CI ONLY: this mutates package.json and removes pnpm-lock.yaml. It refuses
// to run locally unless passed --yes. The library's peer range
// (^21.0.0 || ^22.0.0) already covers both majors, so only the root
// workspace toolchain needs swapping. After running this, CI does:
//   pnpm install --no-frozen-lockfile && pnpm test:lib && pnpm test && ...
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

if (!process.env.CI && !process.argv.includes('--yes')) {
  console.error('Refusing to run outside CI without --yes (this rewrites package.json).');
  process.exit(1);
}

const path = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(path, 'utf8'));
for (const section of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(pkg[section] ?? {})) {
    if (name.startsWith('@angular/') || name === 'ng-packagr') {
      pkg[section][name] = '^21.0.0';
    }
  }
}
pkg.devDependencies.typescript = '~5.9.2';
writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
rmSync(new URL('../pnpm-lock.yaml', import.meta.url), { force: true });
console.log('Workspace manifest swapped to the Angular 21 toolchain (lockfile removed).');
