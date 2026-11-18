/**
 * Copies text to the clipboard. Async Clipboard API first; on failure
 * (permissions, non-secure context) falls back to the deprecated-but-robust
 * `execCommand` path, which must run synchronously inside the user's event turn.
 * Returns false when both paths fail — callers keep the overlay open for a retry.
 */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = (globalThis as { navigator?: { clipboard?: Clipboard } }).navigator?.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const doc = globalThis.document;
  if (!doc?.body) {
    return false;
  }
  const field = doc.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
  doc.body.append(field);
  field.select();
  try {
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
