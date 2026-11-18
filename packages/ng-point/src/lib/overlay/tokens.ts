import { InjectionToken, Injector } from '@angular/core';
import { NG_POINT_CONFIG, type ResolvedNgPointConfig } from '../config';
import type { NgPointSession } from './session';

/**
 * The active overlay session. Provided by the lazy overlay bootstrap
 * (`overlay/init.ts`) via a dedicated element injector — never part of the
 * public API surface. (The config token lives in `../config.ts` so the
 * eagerly loaded entry chunk never pulls in lazy-only modules.)
 */
export const NG_POINT_SESSION = new InjectionToken<NgPointSession>('NG_POINT_SESSION');

/** Element injector for the imperatively created overlay component. */
export function createOverlayElementInjector(
  parent: Injector,
  session: NgPointSession,
  config: ResolvedNgPointConfig,
): Injector {
  return Injector.create({
    providers: [
      { provide: NG_POINT_SESSION, useValue: session },
      { provide: NG_POINT_CONFIG, useValue: config },
    ],
    parent,
  });
}
