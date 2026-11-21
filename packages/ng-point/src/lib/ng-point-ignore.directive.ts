import { Directive, booleanAttribute, input } from '@angular/core';

/**
 * Selector that marks an ignore zone. Matches both the directive-managed
 * `data-ng-point-ignore` attribute (set for `[ngPointIgnore]="true"` bindings)
 * and a plain `ngPointIgnore` template attribute — attribute name matching is
 * case-insensitive in HTML documents.
 */
const IGNORE_SELECTOR = '[data-ng-point-ignore], [ng-point-ignore]';

/**
 * True when `element` or any of its ancestors is marked with `ngPointIgnore`.
 * `closest()` does not cross shadow boundaries, which matches where the click
 * lands (the composed-path inner element).
 */
export function isNgPointIgnored(element: Element | null): boolean {
  return !!element?.closest(IGNORE_SELECTOR);
}

/** The nearest ancestor above `element` that is outside every ignore zone. */
export function firstUnignoredAncestor(element: Element): Element | null {
  let node: Element | null = element.parentElement;
  while (node && isNgPointIgnored(node)) {
    node = node.parentElement;
  }
  return node;
}

/** The first child of `element` that is not inside an ignore zone. */
export function firstUnignoredChild(element: Element): Element | null {
  let node: Element | null = element.firstElementChild;
  while (node && isNgPointIgnored(node)) {
    node = node.nextElementSibling;
  }
  return node;
}

/**
 * Marks an element — and its whole subtree — as off-limits to ng-point picks.
 *
 * Usage:
 * ```html
 * <div ngPointIgnore>Alt+Click inside me does nothing.</div>
 * <section [ngPointIgnore]="isThirdParty">Conditional opt-out.</section>
 * ```
 *
 * Alt+Clicks inside an ignored subtree are left completely untouched: no
 * capture, no overlay, no `preventDefault()` — the app's own click behavior
 * runs as if ng-point were not installed. `Alt+↑`/`Alt+↓` retargeting skips
 * ignored zones, and `[ngPointIgnore]="false"` re-enables picking.
 */
@Directive({
  selector: '[ngPointIgnore]',
  host: {
    '[attr.data-ng-point-ignore]': 'ngPointIgnore() ? "" : null',
  },
})
export class NgPointIgnoreDirective {
  /** Bind `[ngPointIgnore]="false"` to re-enable pointing conditionally. */
  readonly ngPointIgnore = input(true, { transform: booleanAttribute });
}
