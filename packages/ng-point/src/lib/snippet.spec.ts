import { describe, expect, it } from 'vitest';
import { cleanElementHtml, detectSecrets, redactSecrets } from './snippet';

function el(html: string): Element {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild!;
}

describe('cleanElementHtml', () => {
  it('serializes tag, allowlisted attributes and text', () => {
    const snippet = cleanElementHtml(el('<button class="submit-btn" id="save">Save</button>'));
    expect(snippet.html).toBe('<button class="submit-btn" id="save">Save</button>');
    expect(snippet.sensitive).toBe(false);
    expect(snippet.redacted).toBe(false);
  });

  it('drops attributes outside the allowlist', () => {
    const snippet = cleanElementHtml(el('<a href="/orders" target="_blank" style="color:red">Orders</a>'));
    expect(snippet.html).toBe('<a href="/orders" target="_blank">Orders</a>');
  });

  it('never captures the value attribute', () => {
    const snippet = cleanElementHtml(el('<input name="token" type="text" value="hunter2">'));
    expect(snippet.html).not.toContain('hunter2');
    expect(snippet.html).not.toContain('value');
  });

  it('marks password inputs as sensitive (selection still allowed, values never captured)', () => {
    const snippet = cleanElementHtml(
      el('<input type="password" name="pwd" placeholder="Enter password">'),
    );
    expect(snippet.html).toBe('<input type="password" name="pwd" placeholder="Enter password">');
    expect(snippet.sensitive).toBe(true);
    expect(snippet.redacted).toBe(true);
  });

  it('strips Angular debug noise (ng-reflect-*, _ngcontent-*, ng-star-inserted)', () => {
    const snippet = cleanElementHtml(
      el(
        '<div class="box ng-star-inserted" ng-reflect-model="secret-model" _ngcontent-c1="">Hi</div>',
      ),
    );
    expect(snippet.html).toBe('<div class="box">Hi</div>');
  });

  it('redacts JWTs from text content at capture time', () => {
    const snippet = cleanElementHtml(
      el(
        '<p>session: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV</p>',
      ),
    );
    expect(snippet.html).toContain('«redacted»');
    expect(snippet.html).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV');
    expect(snippet.redacted).toBe(true);
  });

  it('redacts provider-shaped API keys from attribute values', () => {
    const snippet = cleanElementHtml(
      el('<dd data-key="sk_live_51H8xQ2eZvKYlo2CRaBcdEFGHIJKLMNOP">key</dd>'),
    );
    expect(snippet.html).toContain('«redacted»');
    expect(snippet.html).not.toContain('sk_live_');
    expect(snippet.redacted).toBe(true);
  });

  it('redacts AWS access key IDs and long hex secrets', () => {
    expect(redactSecrets('key AKIAIOSFODNN7EXAMPLE')).toContain('«redacted»');
    expect(redactSecrets('sig a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toContain('«redacted»');
  });

  it('keeps aria-* and data-* attributes', () => {
    const snippet = cleanElementHtml(
      el('<span role="status" aria-live="polite" data-testid="toast">Saved</span>'),
    );
    expect(snippet.html).toContain('aria-live="polite"');
    expect(snippet.html).toContain('data-testid="toast"');
  });

  it('excludes the compiler data-ng-source-location attribute', () => {
    const snippet = cleanElementHtml(el('<p data-ng-source-location="x.html@o:1,l:2,c:3">t</p>'));
    expect(snippet.html).toBe('<p>t</p>');
  });

  it('truncates attribute values over 60 characters', () => {
    // Dashes keep the value from looking like a secret (long opaque runs
    // are redacted first — see the redaction specs).
    const long = 'resource-path-segment-'.repeat(6);
    const snippet = cleanElementHtml(el(`<a href="https://example.com/${long}">link</a>`));
    expect(snippet.html).not.toContain(long);
    expect(snippet.html).toContain('…');
  });

  it('collapses whitespace and truncates long text at 120 characters', () => {
    const longText = 'word-with-dashes '.repeat(40);
    const snippet = cleanElementHtml(el(`<p>  lots   of\n\nwhitespace  ${longText} </p>`));
    expect(snippet.html).not.toContain('\n');
    expect((snippet.html.match(/word-with-dashes/g) ?? []).length).toBeGreaterThan(4);
    expect(snippet.html).toContain('…');
  });

  it('flattens descendant text without serializing child elements', () => {
    const snippet = cleanElementHtml(el('<button><span>Save</span> now</button>'));
    expect(snippet.html).toBe('<button>Save now</button>');
  });

  it('escapes angle brackets and quotes', () => {
    const snippet = cleanElementHtml(el('<p title="a&quot;b">a < b</p>'));
    expect(snippet.html).toContain('a &lt; b');
  });

  it('honors sensitiveSelectors from user config', () => {
    const snippet = cleanElementHtml(el('<span class="masked">value</span>'), {
      sensitiveSelectors: ['.masked'],
    });
    expect(snippet.sensitive).toBe(true);
    expect(snippet.redacted).toBe(true);
  });

  it('applies extraRedactionPatterns from user config', () => {
    const snippet = cleanElementHtml(el('<p>ticket-98765</p>'), {
      extraRedactionPatterns: [/ticket-\d+/],
    });
    expect(snippet.html).toContain('«redacted»');
  });

  it('serializes elements with no text as open tags only', () => {
    expect(cleanElementHtml(el('<input type="checkbox" checked="">')).html).toBe(
      '<input type="checkbox" checked>',
    );
  });
});

describe('detectSecrets (warn-only re-scan of edited blocks)', () => {
  it('detects leftover secrets in edited text', () => {
    expect(detectSecrets('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')).toBe(true);
    expect(detectSecrets('Component: Foo\nElement: <button>OK</button>')).toBe(false);
  });

  it('respects extra patterns', () => {
    expect(detectSecrets('ticket-98765', [/ticket-\d+/])).toBe(true);
  });
});
