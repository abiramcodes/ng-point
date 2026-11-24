import {
  EnvironmentProviders,
  Injector,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { NG_POINT_CONFIG, resolveNgPointConfig, type NgPointConfig, type ResolvedNgPointConfig } from './config';

// Module-scoped declaration of Angular's build-time dev-mode flag. The
// application builder replaces `ngDevMode` with `false` in production, so
// the positive guard below constant-folds away and esbuild never even
// emits the lazy overlay chunk (an early-return negative guard still
// leaves an orphaned, never-loaded chunk behind).
// Inlined (instead of importing `dev-guard`) so the eagerly loaded entry
// chunk has no static path to any module with runtime markers.
declare const ngDevMode: unknown;

/**
 * ng-point — dev-mode-only element context picker for Angular apps.
 *
 * Usage (app.config.ts):
 * ```ts
 * providers: [provideRouter(routes), provideNgPoint()]
 * ```
 *
 * Production behavior: the initializer body constant-folds away when
 * `ngDevMode` is falsy — no listeners are registered and the overlay
 * chunk is not emitted at all.
 */
export function provideNgPoint(config: NgPointConfig = {}): EnvironmentProviders {
  const resolved: ResolvedNgPointConfig = resolveNgPointConfig(config);
  return makeEnvironmentProviders([
    { provide: NG_POINT_CONFIG, useValue: resolved },
    provideEnvironmentInitializer(() => {
      // Layer 1: dev builds only. MUST stay a positive guard around the
      // dynamic import: with `ngDevMode=false` esbuild drops the whole
      // block and emits no overlay chunk, whereas an early-return
      // negative guard still emits an orphaned chunk. The overlay (95%
      // of the code) stays behind this import.
      if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        const injector = inject(Injector);
        void import('./overlay/init').then((m) => m.initNgPoint(resolved, injector));
      }
    }),
  ]);
}
