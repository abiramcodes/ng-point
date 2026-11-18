import { afterEach, describe, expect, it } from 'vitest';
import type { NgDevToolsApi } from './dev-guard';
import {
  findComponentHost,
  findParentComponent,
  readComponentInfo,
  readDirectives,
  readTemplateLocation,
  resolveContext,
} from './resolve';

class FormComponent {}
class SubmitButtonComponent {}
class RouterLink {}
class NgClass {}

type CtorRecord = Record<string, unknown>;

function ctorRecord(ctor: object): CtorRecord {
  return ctor as unknown as CtorRecord;
}

function setDebugInfo(ctor: unknown, className: string, filePath: string, lineNumber: number): void {
  (ctor as CtorRecord)['ɵcmp'] = { debugInfo: { className, filePath, lineNumber } };
}

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = `<div id="spec-root">${html}</div>`;
  return document.getElementById('spec-root')!;
}

function fakeNg(
  componentAt: (el: Element) => unknown,
  directivesAt: (el: Element) => unknown[] = () => [],
): NgDevToolsApi {
  return {
    getComponent: (el) => componentAt(el),
    getDirectives: (el) => directivesAt(el),
  };
}

describe('readComponentInfo', () => {
  it('reads className/filePath/lineNumber from the component def debug info', () => {
    const instance = new SubmitButtonComponent();
    setDebugInfo(SubmitButtonComponent, 'SubmitButtonComponent', 'src/app/submit-button.component.ts', 42);
    expect(readComponentInfo(instance)).toEqual({
      name: 'SubmitButtonComponent',
      file: 'src/app/submit-button.component.ts',
      line: 42,
    });
    delete ctorRecord(SubmitButtonComponent)['ɵcmp'];
  });

  it('falls back to the constructor name for library components (no debug info)', () => {
    expect(readComponentInfo(new FormComponent())).toEqual({ name: 'FormComponent' });
  });

  it('returns null for missing instances', () => {
    expect(readComponentInfo(null)).toBeNull();
  });
});

describe('findComponentHost', () => {
  it('walks up from a plain element to the component host', () => {
    const root = mount('<app-form><div><button type="button">Save</button></div></app-form>');
    const hostEl = root.querySelector('app-form')!;
    const instance = new FormComponent();
    const ng = fakeNg((el) => (el === hostEl ? instance : null));

    const found = findComponentHost(root.querySelector('button')!, ng);
    expect(found?.instance).toBe(instance);
    expect(found?.host).toBe(hostEl);
  });

  it('returns null when no component exists above the element', () => {
    const root = mount('<div><span>x</span></div>');
    expect(findComponentHost(root.querySelector('span')!, fakeNg(() => null))).toBeNull();
  });

  it('keeps walking when the devtools API throws for a node', () => {
    const root = mount('<app-form><button type="button">Save</button></app-form>');
    const hostEl = root.querySelector('app-form')!;
    const instance = new FormComponent();
    let calls = 0;
    const ng = fakeNg((el) => {
      calls++;
      if (el.tagName === 'BUTTON') {
        throw new Error('detached view');
      }
      return el === hostEl ? instance : null;
    });
    expect(findComponentHost(root.querySelector('button')!, ng)?.instance).toBe(instance);
    expect(calls).toBeGreaterThan(1);
  });
});

describe('findParentComponent', () => {
  it('returns the component one level above the owning component', () => {
    const root = mount(
      '<app-form><div class="wrapper"><app-submit-button><button type="button">Save</button></app-submit-button></div></app-form>',
    );
    const formEl = root.querySelector('app-form')!;
    const formInstance = new FormComponent();
    const submitEl = root.querySelector('app-submit-button')!;
    const submitInstance = new SubmitButtonComponent();
    const ng = fakeNg((el) =>
      el === formEl ? formInstance : el === submitEl ? submitInstance : null,
    );

    const button = root.querySelector('button')!;
    expect(findComponentHost(button, ng)?.instance).toBe(submitInstance);
    expect(findParentComponent(button, ng)).toBe(formInstance);
  });

  it('returns null at the root of the app', () => {
    const root = mount('<app-root><button type="button">Save</button></app-root>');
    const rootEl = root.querySelector('app-root')!;
    const ng = fakeNg((el) => (el === rootEl ? new FormComponent() : null));
    expect(findParentComponent(root.querySelector('button')!, ng)).toBeNull();
  });
});

describe('readDirectives', () => {
  it('lists directive names and excludes the selected component instance', () => {
    const root = mount('<app-submit-button><button type="button">Save</button></app-submit-button>');
    const component = new SubmitButtonComponent();
    const routerLink = new RouterLink();
    const ngClass = new NgClass();
    const ng = fakeNg(
      (el) => (el.tagName === 'BUTTON' ? component : null),
      (el) => (el.tagName === 'BUTTON' ? [component, routerLink, ngClass, routerLink] : []),
    );

    expect(readDirectives(root.querySelector('button')!, ng)).toEqual(['RouterLink', 'NgClass']);
  });

  it('returns an empty list when the devtools API throws', () => {
    const root = mount('<button type="button">Save</button>');
    const ng = fakeNg(
      () => null,
      () => {
        throw new Error('no');
      },
    );
    expect(readDirectives(root.querySelector('button')!, ng)).toEqual([]);
  });
});

describe('readTemplateLocation', () => {
  it('parses the data-ng-source-location attribute into a 1-based line', () => {
    const root = mount('<button data-ng-source-location="src/app/a/b.component.html@o:120,l:16,c:3">Save</button>');
    expect(readTemplateLocation(root.querySelector('button')!)).toEqual({
      path: 'src/app/a/b.component.html',
      line: 17,
    });
  });

  it('returns null without the attribute or with malformed values', () => {
    expect(readTemplateLocation(mount('<button>Save</button>').querySelector('button')!)).toBeNull();
    expect(
      readTemplateLocation(
        mount('<button data-ng-source-location="garbage">Save</button>').querySelector('button')!,
      ),
    ).toBeNull();
  });
});

describe('resolveContext', () => {
  it('captures the full context for a clicked element', () => {
    setDebugInfo(SubmitButtonComponent, 'SubmitButtonComponent', 'src/app/submit-button.component.ts', 42);
    setDebugInfo(FormComponent, 'FormComponent', 'src/app/form.component.ts', 18);
    const root = mount(
      '<app-form><app-submit-button><button type="button" class="submit-btn" data-ng-source-location="src/app/submit-button.component.html@o:88,l:6,c:4">Save</button></app-submit-button></app-form>',
    );
    const formInstance = new FormComponent();
    const submitInstance = new SubmitButtonComponent();
    const submitEl = root.querySelector('app-submit-button')!;
    const ng = fakeNg(
      (el) =>
        el === submitEl ? submitInstance : el.tagName === 'APP-FORM' ? formInstance : null,
      (el) => (el.tagName === 'BUTTON' ? [new RouterLink(), new NgClass()] : []),
    );

    const context = resolveContext(root.querySelector('button')!, ng);
    expect(context.component).toEqual({
      name: 'SubmitButtonComponent',
      file: 'src/app/submit-button.component.ts',
      line: 42,
    });
    expect(context.parent).toEqual({ name: 'FormComponent', file: 'src/app/form.component.ts', line: 18 });
    expect(context.directives).toEqual(['RouterLink', 'NgClass']);
    expect(context.element).toBe('<button type="button" class="submit-btn">Save</button>');
    expect(context.template).toEqual({ path: 'src/app/submit-button.component.html', line: 7 });

    delete ctorRecord(SubmitButtonComponent)['ɵcmp'];
    delete ctorRecord(FormComponent)['ɵcmp'];
  });

  it('degrades gracefully when no component or devtools data exists', () => {
    const root = mount('<main><h1>Hello</h1></main>');
    const context = resolveContext(root.querySelector('h1')!, fakeNg(() => null, () => []));
    expect(context.component).toBeNull();
    expect(context.parent).toBeNull();
    expect(context.element).toBe('<h1>Hello</h1>');
  });

  describe('resolveFilePath hook (module-federation path disambiguation)', () => {
    it('rewrites the selected component file and the element template path', () => {
      setDebugInfo(SubmitButtonComponent, 'SubmitButtonComponent', 'src/app/submit-button.component.ts', 42);
      const root = mount(
        '<app-submit-button><button type="button" data-ng-source-location="src/app/submit-button.component.html@o:88,l:6,c:4">Save</button></app-submit-button>',
      );
      const submitInstance = new SubmitButtonComponent();
      const submitEl = root.querySelector('app-submit-button')!;
      const ng = fakeNg((el) => (el === submitEl ? submitInstance : null));

      const context = resolveContext(root.querySelector('button')!, ng, {
        resolveFilePath: (filePath) => `remotes/checkout/${filePath}`,
      });
      expect(context.component?.file).toBe(
        'remotes/checkout/src/app/submit-button.component.ts',
      );
      expect(context.template?.path).toBe(
        'remotes/checkout/src/app/submit-button.component.html',
      );
      // The element receives the hook too, so remotes can disambiguate by DOM.
      expect(
        resolveContext(root.querySelector('button')!, ng, {
          resolveFilePath: (filePath, element) =>
            element.tagName === 'BUTTON' ? `remotes/checkout/${filePath}` : filePath,
        }).component?.file,
      ).toBe('remotes/checkout/src/app/submit-button.component.ts');

      delete ctorRecord(SubmitButtonComponent)['ɵcmp'];
    });

    it('leaves paths untouched without the hook', () => {
      setDebugInfo(SubmitButtonComponent, 'SubmitButtonComponent', 'src/app/submit-button.component.ts', 42);
      const root = mount('<app-submit-button><button type="button">Save</button></app-submit-button>');
      const ng = fakeNg(() => new SubmitButtonComponent());
      expect(resolveContext(root.querySelector('button')!, ng).component?.file).toBe(
        'src/app/submit-button.component.ts',
      );
      delete ctorRecord(SubmitButtonComponent)['ɵcmp'];
    });
  });
});
