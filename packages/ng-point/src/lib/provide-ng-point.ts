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
// this check constant-folds and the lazy overlay import is dead code.
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
 * Production behavior: the initializer returns immediately when `ngDevMode`
 * is falsy — no listeners are registered and the overlay chunk is never
 * loaded. For a fully chunk-free production build, call `provideNgPoint()`
 * behind a dev-mode guard instead (see the README).
 */
export function provideNgPoint(config: NgPointConfig = {}): EnvironmentProviders {
  const resolved: ResolvedNgPointConfig = resolveNgPointConfig(config);
  return makeEnvironmentProviders([
    { provide: NG_POINT_CONFIG, useValue: resolved },
    provideEnvironmentInitializer(() => {
      const injector = inject(Injector);
      // Layer 1: no-op outside dev builds (constant-folded in production).
      // The overlay (95% of the code) stays behind the dynamic import so
      // production never loads it.
      if (typeof ngDevMode === 'undefined' || !ngDevMode) {
        return;
      }
      void import('./overlay/init').then((m) => m.initNgPoint(resolved, injector));
    }),
  ]);
}
