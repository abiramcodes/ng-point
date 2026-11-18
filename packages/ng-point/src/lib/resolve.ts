import type { NgDevToolsApi } from './dev-guard';
import { cleanElementHtml, type SnippetOptions } from './snippet';
import type { ComponentInfo, NgPointContext } from './types';

const NG_SOURCE_LOCATION_ATTR = 'data-ng-source-location';

/**
 * Options for capturing an element's context. Extends snippet cleaning with
 * the module-federation path disambiguation hook.
 */
export interface ResolveOptions extends SnippetOptions {
  /**
   * Rewrites captured component/template file paths (e.g. to prefix paths
   * from a module-federation remote). Applied where the clicked element is
   * known: the selected component's `file` and the element's template path.
   */
  resolveFilePath?: (filePath: string, element: Element) => string;
}

interface ClassDebugInfo {
  className?: unknown;
  filePath?: unknown;
  lineNumber?: unknown;
}

/**
 * Reads `{ className, filePath, lineNumber }` from the component definition.
 * Angular's AOT compiler emits a dev-mode-only `ɵsetClassDebugInfo` call for every
 * app-source component; `filePath` is project-relative and `lineNumber` is the
 * 1-based line of the class declaration.
 */
export function readComponentInfo(instance: unknown): ComponentInfo | null {
  if (!instance) {
    return null;
  }
  const ctor = (instance as { constructor?: Function }).constructor;
  if (!ctor) {
    return null;
  }
  const name = ctor.name || 'AnonymousComponent';
  const debugInfo = readClassDebugInfo(ctor);
  if (!debugInfo) {
    // Library components (partial-compiled npm packages) have no debug info.
    return { name };
  }
  return {
    name: typeof debugInfo.className === 'string' && debugInfo.className ? debugInfo.className : name,
    file: typeof debugInfo.filePath === 'string' ? debugInfo.filePath : undefined,
    line: typeof debugInfo.lineNumber === 'number' ? debugInfo.lineNumber : undefined,
  };
}

function readClassDebugInfo(ctor: Function): ClassDebugInfo | null {
  try {
    const def = (ctor as unknown as Record<string, unknown>)['ɵcmp'];
    if (!def || typeof def !== 'object') {
      return null;
    }
    const info = (def as Record<string, unknown>)['debugInfo'];
    return info && typeof info === 'object' ? (info as ClassDebugInfo) : null;
  } catch {
    return null;
  }
}

/** Nearest component instance at-or-above the element, plus the element hosting it. */
export function findComponentHost(
  el: Element,
  ng: NgDevToolsApi,
): { instance: unknown; host: Element } | null {
  let node: Element | null = el;
  while (node) {
    try {
      const instance = ng.getComponent(node);
      if (instance) {
        return { instance, host: node };
      }
    } catch {
      // Detached/unusual nodes can make the devtools API throw — keep walking.
    }
    node = node.parentElement;
  }
  return null;
}

/** The component one level above the element's owning component. */
export function findParentComponent(el: Element, ng: NgDevToolsApi): unknown | null {
  const own = findComponentHost(el, ng);
  const startFrom = own ? own.host.parentElement : el.parentElement;
  if (!startFrom) {
    return null;
  }
  const found = findComponentHost(startFrom, ng);
  return found ? found.instance : null;
}

/**
 * Directive names on the element. The selected component instance is excluded
 * (directives are reported separately from the component), names are deduped.
 */
export function readDirectives(el: Element, ng: NgDevToolsApi): string[] {
  let instances: Array<unknown> = [];
  try {
    instances = ng.getDirectives(el) ?? [];
  } catch {
    return [];
  }
  let own: unknown = null;
  try {
    own = ng.getComponent(el);
  } catch {
    own = null;
  }
  const names: string[] = [];
  for (const directive of instances) {
    if (own && directive === own) {
      continue;
    }
    const name = (directive as { constructor?: Function })?.constructor?.name;
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Parses `data-ng-source-location` (set by the compiler when
 * `enableTemplateSourceLocations` is on in the dev tsconfig).
 * Format: `<templatePath>@o:<offset>,l:<line>,c:<column>` with 0-based lines.
 */
export function readTemplateLocation(el: Element): { path: string; line: number } | null {
  const raw = el.getAttribute(NG_SOURCE_LOCATION_ATTR);
  if (!raw) {
    return null;
  }
  const marker = raw.lastIndexOf('@o:');
  if (marker <= 0) {
    return null;
  }
  const path = raw.slice(0, marker);
  const match = /,l:(\d+)/.exec(raw.slice(marker));
  if (!match) {
    return null;
  }
  return { path, line: Number(match[1]) + 1 };
}

/** Captures the full context for one clicked element (never retains the element). */
export function resolveContext(
  el: Element,
  ng: NgDevToolsApi,
  options: ResolveOptions = {},
): NgPointContext {
  const own = findComponentHost(el, ng);
  const snippet = cleanElementHtml(el, options);
  const resolveFile = options.resolveFilePath;

  let component = readComponentInfo(own?.instance ?? null);
  if (component?.file && resolveFile) {
    component = { ...component, file: resolveFile(component.file, el) };
  }

  let template = readTemplateLocation(el);
  if (template && resolveFile) {
    template = { ...template, path: resolveFile(template.path, el) };
  }

  return {
    component,
    directives: readDirectives(el, ng),
    element: snippet.html,
    parent: own ? readComponentInfo(findParentComponent(el, ng)) : null,
    template,
    sensitive: snippet.sensitive,
    redacted: snippet.redacted,
  };
}
