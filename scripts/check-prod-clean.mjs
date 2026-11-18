#!/usr/bin/env node
/**
 * check-prod-clean.mjs — verifies that ng-point does not leak into the
 * production build's INITIAL bundles.
 *
 * Expected production behavior:
 * - No ng-point runtime markers in any chunk referenced from index.html.
 * - The overlay is allowed to exist in a lazy chunk (emitted but never
 *   loaded, because the `ngDevMode` guard short-circuits the dynamic import).
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

let failed = false;
for (const script of initialScripts) {
  const contents = readFileSync(join(DIST, script), 'utf8');
  const hits = MARKERS.filter((marker) => contents.includes(marker));
  if (hits.length > 0) {
    failed = true;
    console.error(`✗ ${script} contains ng-point markers: ${hits.join(', ')}`);
  } else {
    console.log(`✓ ${script} clean`);
  }
}

// Informational: the overlay lazy chunk may exist (never loaded in prod).
const allJs = readdirSync(DIST).filter((f) => f.endsWith('.js'));
const initial = new Set(initialScripts);
const lazyWithMarkers = allJs.filter((file) => {
  if (initial.has(file)) {
    return false;
  }
  try {
    return readFileSync(join(DIST, file), 'utf8').includes('ng-point-panel');
  } catch {
    return false;
  }
});
for (const file of lazyWithMarkers) {
  console.log(`ℹ ${file} contains the (never-loaded) ng-point lazy chunk — expected dev-gated output`);
}

if (failed) {
  console.error('\n✗ ng-point runtime code leaked into initial production bundles');
  process.exit(1);
}

console.log('\n✓ production build is clean of ng-point runtime code in initial bundles');
