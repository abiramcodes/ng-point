import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMacPlatform } from './platform';

describe('isMacPlatform', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false without a navigator (SSR hosts)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isMacPlatform()).toBe(false);
  });

  it('detects macOS via navigator.platform (Safari/Firefox)', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(isMacPlatform()).toBe(true);
  });

  it('detects macOS via userAgentData.platform (Chromium)', () => {
    vi.stubGlobal('navigator', { platform: '', userAgent: '', userAgentData: { platform: 'macOS' } });
    expect(isMacPlatform()).toBe(true);
  });

  it('detects macOS via the user-agent string as a last resort', () => {
    vi.stubGlobal('navigator', {
      platform: '',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    });
    expect(isMacPlatform()).toBe(true);
  });

  it('is false on Windows', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' });
    expect(isMacPlatform()).toBe(false);
  });

  it('is false on Linux', () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
    expect(isMacPlatform()).toBe(false);
  });
});
