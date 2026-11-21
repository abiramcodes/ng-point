import { InjectionToken } from '@angular/core';

/** Injection token carrying the resolved ng-point configuration. */
export const NG_POINT_CONFIG = new InjectionToken<ResolvedNgPointConfig>('NG_POINT_CONFIG');

/** Public configuration for ng-point. All fields are optional. */
export interface NgPointConfig {
  /**
   * Modifier used to pick elements.
   * - `'alt'` (default): `Alt+Click` picks/replaces, `Alt+Shift+Click` adds a context.
   * - `'ctrl-shift'`: `Ctrl+Shift+Click` picks, `Ctrl+Shift+Alt+Click` adds.
   */
  activationModifier?: 'alt' | 'ctrl-shift';
  /** Max independent contexts per selection session. Default 5. */
  maxSelections?: number;
  /** Max entries kept in the recent queue (memory + sessionStorage). Default 6. */
  maxQueueEntries?: number;
  /** CSS selectors for elements that must always be treated as sensitive. */
  sensitiveSelectors?: string[];
  /** Extra secret-shape patterns redacted from element snippets and text. */
  extraRedactionPatterns?: RegExp[];
  /** Include the `Template:` line when the element carries a template source location. Default true. */
  includeTemplateLine?: boolean;
  /**
   * Rewrites captured file/template paths before they enter a context block.
   * Module-federation use: `file:line` is build-root-relative per remote, so
   * two remotes can both emit `src/app/foo.component.ts` — use this hook to
   * disambiguate (e.g. prefix `remotes/checkout/`).
   */
  resolveFilePath?: (filePath: string, element: Element) => string;
}

/** NgPointConfig with defaults applied. */
export interface ResolvedNgPointConfig {
  activationModifier: 'alt' | 'ctrl-shift';
  maxSelections: number;
  maxQueueEntries: number;
  sensitiveSelectors?: string[];
  extraRedactionPatterns?: RegExp[];
  includeTemplateLine: boolean;
  resolveFilePath?: (filePath: string, element: Element) => string;
}

export function resolveNgPointConfig(config: NgPointConfig = {}): ResolvedNgPointConfig {
  return {
    activationModifier: 'alt',
    maxSelections: 5,
    maxQueueEntries: 6,
    includeTemplateLine: true,
    ...config,
  };
}
