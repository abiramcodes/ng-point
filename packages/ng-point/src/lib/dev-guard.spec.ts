import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNg, isDisabledByUser, isNgDevMode } from './dev-guard';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isNgDevMode', () => {
  it('is false when ngDevMode is absent (production builds)', () => {
    vi.stubGlobal('ngDevMode', undefined);
    expect(isNgDevMode()).toBe(false);
  });

  it('is false for falsy values', () => {
    vi.stubGlobal('ngDevMode', false);
    expect(isNgDevMode()).toBe(false);
  });

  it('is true in development builds', () => {
    vi.stubGlobal('ngDevMode', true);
    expect(isNgDevMode()).toBe(true);
  });
});

describe('getNg', () => {
  it('returns null when the devtools API is not published', () => {
    vi.stubGlobal('ng', undefined);
    expect(getNg()).toBeNull();
  });

  it('returns window.ng once Angular publishes it (lazy — at click time)', () => {
    const api = { getComponent: () => null, getDirectives: () => [] };
    vi.stubGlobal('ng', api);
    expect(getNg()).toBe(api);
  });
});

describe('isDisabledByUser', () => {
  it('honors the localStorage kill-switch', () => {
    globalThis.localStorage?.setItem('ngPointDisabled', '1');
    try {
      expect(isDisabledByUser()).toBe(true);
    } finally {
      globalThis.localStorage?.removeItem('ngPointDisabled');
    }
  });

  it('is false by default', () => {
    expect(isDisabledByUser()).toBe(false);
  });
});
