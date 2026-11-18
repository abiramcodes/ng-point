import type { NgPointContext } from './types';

/** Result of cleaning + redacting a DOM element into an LLM-friendly HTML snippet. */
export interface ElementSnippet {
  html: string;
  sensitive: boolean;
  redacted: boolean;
}

export interface SnippetOptions {
  sensitiveSelectors?: string[];
  extraRedactionPatterns?: RegExp[];
  /** Max characters of (collapsed) text content kept. Default 120. */
  maxTextLength?: number;
  /** Max characters per attribute value before truncation. Default 60. */
  maxAttrLength?: number;
}

const REDACTED = '«redacted»';

/**
 * Attribute allowlist: only these (plus `aria-*` / `data-*`) are kept in snippets.
 * `value`, `ng-reflect-*`, `_ngcontent-*`, `_nghost-*` are NEVER captured.
 */
const ALLOWED_ATTRS = new Set([
  'class',
  'id',
  'name',
  'type',
  'role',
  'placeholder',
  'for',
  'href',
  'src',
  'target',
  'rel',
  'title',
  'alt',
  'disabled',
  'readonly',
  'required',
  'checked',
  'selected',
  'autocomplete',
  'autofocus',
  'inputmode',
  'min',
  'max',
  'step',
  'minlength',
  'maxlength',
  'pattern',
  'tabindex',
  'dir',
  'lang',
  'form',
  'method',
  'action',
  'loading',
  'cols',
  'rows',
  'open',
  'multiple',
  'accept',
  'routerlink',
  'routerlinkactive',
  'ngclass',
  'ngmodel',
  'formcontrolname',
]);

const SENSITIVE_INPUT_TYPES = new Set(['password', 'secret', 'token', 'passphrase']);

/** Secret-shaped patterns always redacted from attribute values and text content. */
const SECRET_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/, // JWTs
  /sk-(?:live|test|proj)-[A-Za-z0-9_-]{8,}/, // OpenAI/Anthropic-style keys
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/, // Stripe secret keys
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, // GitHub tokens
  /github_pat_[A-Za-z0-9_]{20,}/, // GitHub fine-grained PATs
  /AKIA[0-9A-Z]{16}/, // AWS access key IDs
  /xox[baprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /\b[A-Fa-f0-9]{32,}\b/, // long hex (MD5+)
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/, // long base64 blobs
];

const ANGULAR_NOISE_CLASS = 'ng-star-inserted';

function isAllowedAttr(name: string): boolean {
  return ALLOWED_ATTRS.has(name) || name.startsWith('aria-') || name.startsWith('data-');
}

function isAngularNoiseAttr(name: string): boolean {
  return name.startsWith('ng-reflect') || name.startsWith('_ngcontent') || name.startsWith('_nghost');
}

function isSensitiveElement(el: Element, extraSelectors: string[]): boolean {
  if (el.tagName?.toLowerCase() === 'input') {
    const type = String((el as HTMLInputElement).type ?? '').toLowerCase();
    if (SENSITIVE_INPUT_TYPES.has(type)) {
      return true;
    }
  }
  for (const selector of extraSelectors) {
    try {
      if (el.matches(selector)) {
        return true;
      }
    } catch {
      // invalid selector in user config — ignore it
    }
  }
  return false;
}

function patternsFor(extra?: RegExp[]): RegExp[] {
  return extra?.length ? [...SECRET_PATTERNS, ...extra] : SECRET_PATTERNS;
}

/** Replaces every secret-shaped match with a redaction marker. */
export function redactSecrets(value: string, extraPatterns?: RegExp[]): string {
  let out = value;
  for (const pattern of patternsFor(extraPatterns)) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/** True when the text still contains something secret-shaped (used for the warn-only re-scan). */
export function detectSecrets(value: string, extraPatterns?: RegExp[]): boolean {
  return patternsFor(extraPatterns).some((pattern) => pattern.test(value));
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Serializes an element into a compact, safe HTML snippet:
 * tag + allowlisted attributes + collapsed, truncated, redacted direct text.
 * Never reads `input.value`; children are not serialized.
 */
export function cleanElementHtml(el: Element, options: SnippetOptions = {}): ElementSnippet {
  const maxText = options.maxTextLength ?? 120;
  const maxAttr = options.maxAttrLength ?? 60;
  const sensitive = isSensitiveElement(el, options.sensitiveSelectors ?? []);
  let redacted = false;

  const tag = (el.tagName ?? 'unknown').toLowerCase();
  const attrs: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    // Never capture Angular debug attributes or runtime values.
    if (isAngularNoiseAttr(name) || name === 'value' || name === 'data-ng-source-location') {
      continue;
    }
    if (!isAllowedAttr(name)) {
      continue;
    }
    let value = attr.value ?? '';
    if (name === 'class') {
      value = value
        .split(/\s+/)
        .filter((cls) => cls && cls !== ANGULAR_NOISE_CLASS)
        .join(' ');
    }
    const beforeRedaction = value;
    value = redactSecrets(value, options.extraRedactionPatterns);
    if (value !== beforeRedaction) {
      redacted = true;
    }
    if (value.length > maxAttr) {
      value = value.slice(0, maxAttr) + '…';
    }
    attrs.push(value ? `${name}="${escapeAttr(value)}"` : name);
  }

  const tagLower = tag;
  let text = '';
  if (tagLower !== 'script' && tagLower !== 'style') {
    text = collapseWhitespace(el.textContent ?? '');
    const beforeRedaction = text;
    text = redactSecrets(text, options.extraRedactionPatterns);
    if (text !== beforeRedaction) {
      redacted = true;
    }
    if (text.length > maxText) {
      text = text.slice(0, maxText) + '…';
    }
  }

  if (sensitive) {
    redacted = true;
  }

  const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
  const html = text
    ? `<${tag}${attrText}>${escapeText(text)}</${tag}>`
    : `<${tag}${attrText}>`;

  return { html, sensitive, redacted };
}

/** Empty context used when resolution fails (defensive, keeps the flow going). */
export function emptyContext(): NgPointContext {
  return {
    component: null,
    directives: [],
    element: '',
    parent: null,
    template: null,
    sensitive: false,
    redacted: false,
  };
}
