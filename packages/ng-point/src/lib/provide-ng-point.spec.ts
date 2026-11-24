import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideNgPoint } from './provide-ng-point';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>)['__ngPointActive'];
  document.querySelectorAll('ng-point-overlay').forEach((node) => node.remove());
});

describe('provideNgPoint dev-mode gate', () => {
  it('does nothing in production builds (ngDevMode === false, as builders substitute it)', async () => {
    vi.stubGlobal('ngDevMode', false);
    TestBed.configureTestingModule({ providers: [provideNgPoint()] });
    TestBed.inject(Injector); // forces injector creation → the initializer ran

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect((globalThis as Record<string, unknown>)['__ngPointActive']).toBeUndefined();
    expect(document.querySelector('.ng-point-panel')).toBeNull();
  });

  it('does nothing in production builds (ngDevMode absent)', async () => {
    vi.stubGlobal('ngDevMode', undefined);
    TestBed.configureTestingModule({ providers: [provideNgPoint()] });
    TestBed.inject(Injector); // forces injector creation → the initializer ran

    // Give any (incorrectly started) dynamic import a chance to land.
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect((globalThis as Record<string, unknown>)['__ngPointActive']).toBeUndefined();
    expect(document.querySelector('.ng-point-panel')).toBeNull();
  });

  it('initializes the overlay lazily in dev builds and attaches it to <body>', async () => {
    vi.stubGlobal('ngDevMode', true);
    TestBed.configureTestingModule({ providers: [provideNgPoint()] });
    TestBed.inject(Injector);

    await vi.waitFor(
      () => {
        expect((globalThis as Record<string, unknown>)['__ngPointActive']).toBe(true);
      },
      { timeout: 8000 },
    );
    await vi.waitFor(
      () => {
        expect(document.querySelector('.ng-point-panel')).toBeTruthy();
      },
      { timeout: 8000 },
    );

    // The overlay panel is a native <dialog> that stays closed until a pick.
    const dialog = document.querySelector<HTMLDialogElement>('.ng-point-panel')!;
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.getAttribute('aria-labelledby')).toBe('ng-point-title');
  });

  it('respects the localStorage kill-switch at runtime', async () => {
    globalThis.localStorage?.setItem('ngPointDisabled', '1');
    vi.stubGlobal('ngDevMode', true);
    TestBed.configureTestingModule({ providers: [provideNgPoint()] });
    TestBed.inject(Injector);
    await vi.waitFor(() => {
      expect((globalThis as Record<string, unknown>)['__ngPointActive']).toBe(true);
    });

    // With the kill-switch on, an Alt+Click must NOT open the session,
    // even though the overlay is initialized.
    const target = document.createElement('button');
    document.body.append(target);
    target.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.querySelector('.ng-point-panel[open]')).toBeNull();

    globalThis.localStorage?.removeItem('ngPointDisabled');
    target.remove();
  });
});
