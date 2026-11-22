/**
 * True on Apple platforms, where the modifier key browsers expose as `altKey`
 * is the keycap labeled "option ⌥". The pick gesture — that modifier plus a
 * click — is the same physical key and the same event property on every
 * platform (`e.altKey` is true for Option on macOS and Alt on Windows/Linux);
 * only the printed label differs. This exists purely so hint copy can say
 * "Option+Click" where the keyboard says so, and "Alt+Click" elsewhere.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false; // non-browser hosts (SSR) — the overlay never mounts there
  }
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /mac/i.test(platform) || /mac/i.test(nav.userAgent ?? '');
}
