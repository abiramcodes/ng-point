/**
 * Minimal shape of the `window.ng` devtools API that Angular publishes
 * automatically in development builds (`ngDevMode`).
 * Same surface the official Angular DevTools extension relies on.
 */
export interface NgDevToolsApi {
  getComponent(element: Element): unknown | null;
  getDirectives(element: Element): Array<unknown> | null;
}

declare const ngDevMode: unknown;

/** True when the app runs inside an Angular development build. */
export function isNgDevMode(): boolean {
  // `typeof` guard keeps this safe in production builds where the global is absent.
  return typeof ngDevMode !== 'undefined' && !!ngDevMode;
}

/** Kill-switch: users can disable ng-point at runtime via `localStorage.ngPointDisabled = '1'`. */
export function isDisabledByUser(): boolean {
  try {
    return globalThis.localStorage?.getItem('ngPointDisabled') === '1';
  } catch {
    return false;
  }
}

/**
 * The Angular devtools API, or null.
 * Angular publishes `window.ng` during bootstrap — it may NOT exist yet when
 * Angular's `ENVIRONMENT_INITIALIZER`s run, so always call this lazily
 * (at click time), never during provider initialization.
 */
export function getNg(): NgDevToolsApi | null {
  return (globalThis as { ng?: NgDevToolsApi }).ng ?? null;
}
