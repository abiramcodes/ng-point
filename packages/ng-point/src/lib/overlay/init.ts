import { ApplicationRef, EnvironmentInjector, Injector, createComponent } from '@angular/core';
import type { ResolvedNgPointConfig } from '../config';
import { getNg, isDisabledByUser } from '../dev-guard';
import { checkHealth } from '../mcp-bridge';
import { getSharedQueue } from '../queue';
import { resolveContext, type ResolveOptions } from '../resolve';
import { emptyContext } from '../snippet';
import { NgPointOverlayComponent } from './overlay.component';
import { NgPointSession, type ElementResolver } from './session';
import { createOverlayElementInjector } from './tokens';

// Guards against double init: multiple providers, or HMR module swaps that
// re-evaluate this module. The process-wide flag survives HMR module swaps,
// so it (alone) is the guard — a module-local flag would also block
// intentional re-initialization after cleanup (e.g. in tests).
export function initNgPoint(config: ResolvedNgPointConfig, injector: Injector): void {
  const g = globalThis as { __ngPointActive?: boolean };
  if (g.__ngPointActive) {
    return;
  }
  g.__ngPointActive = true;

  const resolveOptions: ResolveOptions = {
    sensitiveSelectors: config.sensitiveSelectors,
    extraRedactionPatterns: config.extraRedactionPatterns,
    resolveFilePath: config.resolveFilePath,
  };
  const resolve: ElementResolver = (el) => {
    // Layer 2: the devtools API is checked lazily, at pick time.
    const ng = getNg();
    return ng ? resolveContext(el, ng, resolveOptions) : emptyContext();
  };

  const queue = getSharedQueue(config.maxQueueEntries);
  const session = new NgPointSession(config, resolve, queue);

  // Attach the overlay directly to <body>: it survives SPA route changes and
  // stays independent of the app's DOM structure and styles.
  const appRef = injector.get(ApplicationRef);
  const envInjector = injector.get(EnvironmentInjector);
  const elementInjector = createOverlayElementInjector(envInjector, session, config);
  const ref = createComponent(NgPointOverlayComponent, {
    environmentInjector: envInjector,
    elementInjector,
  });
  appRef.attachView(ref.hostView);
  document.body.appendChild(ref.location.nativeElement);

  // MCP status chip probe (fire-and-forget).
  void checkHealth({ endpoint: config.mcpEndpoint, token: config.mcpToken }).then((up) => {
    session.mcpStatus.set(up ? 'up' : 'down');
  });

  const isPickClick = (e: MouseEvent): boolean =>
    config.activationModifier === 'alt'
      ? e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey
      : e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;

  const isAddClick = (e: MouseEvent): boolean =>
    config.activationModifier === 'alt'
      ? e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey
      : e.ctrlKey && e.shiftKey && e.altKey && !e.metaKey;

  // Capture-phase document listener: zero work unless the modifier is held.
  document.addEventListener(
    'click',
    (event) => {
      const e = event as MouseEvent;
      if (isDisabledByUser()) {
        return;
      }
      const add = isAddClick(e);
      const pick = isPickClick(e);
      if (!add && !pick) {
        return;
      }
      // composedPath()[0] unwraps click retargeting inside (open) shadow
      // roots — common with ShadowDom-encapsulated components and some
      // micro-frontend wrappers, where `e.target` is only the host element.
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const raw = path.length > 0 ? path[0] : e.target;
      const target = raw instanceof Element ? raw : null;
      if (!target) {
        return;
      }
      if (ref.location.nativeElement.contains(target)) {
        return; // never pick the panel itself
      }
      const ng = getNg();
      if (!ng) {
        return; // devtools surface missing — do nothing, keep app behavior
      }
      e.preventDefault();
      e.stopPropagation();
      const context = resolveContext(target, ng, resolveOptions);
      if (!session.open()) {
        session.openWith(context, target, e.clientX, e.clientY);
      } else if (add) {
        session.addSelection(context, target);
      } else {
        session.replaceActive(context, target);
      }
    },
    { capture: true },
  );

  document.addEventListener('keydown', (event) => {
    if (!session.open()) {
      return;
    }
    const e = event as KeyboardEvent;
    if (e.key === 'Escape') {
      session.close();
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const activeId = session.activeId();
      if (activeId) {
        session.retarget(activeId, e.key === 'ArrowUp' ? 'up' : 'down');
      }
    }
  });

  // Close the session on SPA navigation — the picked elements may be stale.
  // Module-federation note: the Router subscription covers the app that
  // bootstrapped ng-point (usually the shell). popstate/hashing navigation
  // triggered by remotes is covered by the history listeners below; contexts
  // are captured at pick time, so a stale session only risks re-targeting a
  // dead element — never a wrong output block.
  void import('@angular/router')
    .then(({ Router, NavigationStart }) => {
      const router = injector.get(Router, null);
      if (router) {
        router.events.subscribe((event) => {
          if (event instanceof NavigationStart) {
            session.close();
          }
        });
      }
    })
    .catch(() => {
      // The app does not use the router — nothing to wire up.
    });

  // MF-agnostic navigation fallbacks (no Router dependency):
  window.addEventListener('popstate', () => session.close());
  window.addEventListener('hashchange', () => session.close());
}
