#!/usr/bin/env node
/**
 * check-prod-clean.mjs — verifies that ng-point does not leak into the
 * production build AT ALL.
 *
 * Expected production behavior:
 * - No ng-point runtime markers in ANY emitted JS file (initial or lazy).
 *   The positive `ngDevMode` guard in `provide-ng-point.ts` makes esbuild
 *   drop the overlay import entirely, so no overlay chunk is emitted —
 *   an orphaned (never-loaded) chunk is a failure, not a footnote.
 * - No `data-ng-source-location` emission (that tsconfig option is scoped to
 *   the development configuration).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist/demo/browser';
const MARKERS = [
  'ng-point-panel',
  'ng-point.queue.v1',
  '__ngPointActive',
  'ngPointDisabled',
  'data-ng-source-location',
];

const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const initialScripts = [...indexHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);

if (initialScripts.length === 0) {
  console.error('✗ no initial scripts found in dist/demo/browser/index.html — build first');
  process.exit(1);
}

const allJs = readdirSync(DIST).filter((f) => f.endsWith('.js'));
const initial = new Set(initialScripts);

let failed = false;
for (const file of allJs) {
  const contents = readFileSync(join(DIST, file), 'utf8');
  const hits = MARKERS.filter((marker) => contents.includes(marker));
  const kind = initial.has(file) ? 'initial' : 'lazy';
  if (hits.length > 0) {
    failed = true;
    console.error(`✗ ${file} (${kind}) contains ng-point markers: ${hits.join(', ')}`);
  } else {
    console.log(`✓ ${file} (${kind}) clean`);
  }
}

if (failed) {
  console.error('\n✗ ng-point runtime code leaked into the production build');
  process.exit(1);
}

console.log('\n✓ production build is clean of ng-point runtime code in every emitted bundle');
