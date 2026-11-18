import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNgPoint } from 'ng-point';

@Component({
  selector: 'app-host',
  template: `
    <div class="wrap">
      <button type="button" class="target">Save</button>
      <span class="note">a side note</span>
    </div>
  `,
})
class HostComponent {}

/**
 * End-to-end flow through the real provideNgPoint wiring:
 * dev-mode gate → lazy overlay bootstrap → document listener → context
 * resolution (window.ng + ɵcmp.debugInfo) → panel rendering → clipboard
 * + queue commit.
 */
describe('ng-point end-to-end (demo app integration)', () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('ngDevMode', true);
    clipboardWriteText = vi.fn(async () => {});
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      clipboard: { writeText: clipboardWriteText },
    });
    const g = globalThis as Record<string, unknown>;
    delete g['__ngPointQueue'];
    delete g['__ngPointQueueInstance'];
    delete g['__ngPointActive'];
    globalThis.sessionStorage?.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as Record<string, unknown>)['__ngPointActive'];
    document.querySelectorAll('ng-point-overlay').forEach((node) => node.remove());
  });

  async function setupHost(): Promise<{ hostEl: HTMLElement; instance: HostComponent }> {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideNgPoint()] });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const instance = fixture.componentInstance;
    const hostEl = fixture.nativeElement as HTMLElement;

    // Provide debug info exactly like the AOT compiler does in dev builds.
    (HostComponent as unknown as { ɵcmp: { debugInfo: unknown } }).ɵcmp.debugInfo = {
      className: 'HostComponent',
      filePath: 'src/app/ng-point-demo.spec.ts',
      lineNumber: 7,
    };
    // A minimal fake of the devtools API Angular publishes in dev mode.
    vi.stubGlobal('ng', {
      getComponent: (el: Element) => (el === hostEl ? instance : null),
      getDirectives: () => [],
    });

    await vi.waitFor(
      () => {
        expect((globalThis as Record<string, unknown>)['__ngPointActive']).toBe(true);
      },
      { timeout: 8000 },
    );
    return { hostEl, instance };
  }

  it('Alt+Click opens the panel with an accurate context; Enter copies and queues it', async () => {
    const { hostEl } = await setupHost();

    const button = hostEl.querySelector<HTMLButtonElement>('button.target')!;
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }),
    );

    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeTruthy());

    const block = document.querySelector<HTMLTextAreaElement>('.ng-point-block')!;
    expect(block.value).toContain('Component: HostComponent');
    expect(block.value).toContain('File: src/app/ng-point-demo.spec.ts:7');
    expect(block.value).toContain('Element: <button type="button" class="target">Save</button>');
    expect(block.value).not.toContain('Directives:');

    const card = document.querySelector<HTMLElement>('.ng-point-card')!;
    const input = card.querySelector<HTMLInputElement>('.ng-point-instr')!;
    input.value = 'make this disabled when form is invalid';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => expect(clipboardWriteText).toHaveBeenCalledTimes(1));
    const copied = clipboardWriteText.mock.calls[0]![0] as string;
    expect(copied).toContain('Component: HostComponent');
    expect(copied).toContain('File: src/app/ng-point-demo.spec.ts:7');
    expect(copied).toContain('Instruction: make this disabled when form is invalid');

    await vi.waitFor(() => {
      const queue = (globalThis as { __ngPointQueue?: Array<{ block: string }> }).__ngPointQueue;
      expect(queue?.length).toBe(1);
      expect(queue![0]!.block).toContain('Instruction: make this disabled when form is invalid');
    });

    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeNull());
  });

  it('Alt+Shift+Click adds a second independent context; one Enter commits both', async () => {
    const { hostEl } = await setupHost();

    hostEl.querySelector('button.target')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }),
    );
    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeTruthy());
    hostEl.querySelector('span.note')!.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        altKey: true,
        shiftKey: true,
      }),
    );

    await vi.waitFor(() => expect(document.querySelectorAll('.ng-point-card').length).toBe(2));

    const firstInput = document.querySelector<HTMLInputElement>('.ng-point-instr')!;
    firstInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => expect(clipboardWriteText).toHaveBeenCalledTimes(1));
    const copied = clipboardWriteText.mock.calls[0]![0] as string;
    expect(copied).toContain('Element: <button type="button" class="target">Save</button>');
    expect(copied).toContain('Element: <span class="note">a side note</span>');
    expect(copied).toContain('\n\n---\n\n');

    await vi.waitFor(() => {
      const queue = (globalThis as { __ngPointQueue?: unknown[] }).__ngPointQueue;
      expect(queue?.length).toBe(2);
    });
  });

  it('picks the real inner element when a click lands inside an open shadow root', async () => {
    const { hostEl } = await setupHost();

    // Simulate ShadowDom-encapsulated content (common in micro-frontend
    // wrappers): the document-level listener only sees the retargeted host
    // unless it inspects the composed path.
    const host = document.createElement('div');
    host.className = 'shadow-host';
    hostEl.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button type="button" class="inner">Inner</button>';
    const inner = shadow.querySelector('button')!;

    inner.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, altKey: true }),
    );

    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeTruthy());
    const block = document.querySelector<HTMLTextAreaElement>('.ng-point-block')!;
    // The composed path unwraps shadow-root retargeting: the captured element
    // is the inner button, NOT the shadow host div.
    expect(block.value).toContain('Element: <button type="button" class="inner">Inner</button>');
    expect(block.value).not.toContain('shadow-host');
    host.remove();
  });

  it('ignores plain clicks and discards the session on Escape', async () => {
    const { hostEl } = await setupHost();

    hostEl.querySelector('button.target')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(document.querySelector('.ng-point-panel[open]')).toBeNull();

    hostEl.querySelector('button.target')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }),
    );
    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeTruthy());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeNull());

    // History navigation (e.g. triggered by a module-federation remote)
    // also discards a stale session — MF-agnostic fallback.
    hostEl.querySelector('button.target')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }),
    );
    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeTruthy());
    globalThis.dispatchEvent(new Event('popstate'));
    await vi.waitFor(() => expect(document.querySelector('.ng-point-panel[open]')).toBeNull());
    globalThis.dispatchEvent(new Event('hashchange'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.querySelector('.ng-point-panel[open]')).toBeNull();

    const queue = (globalThis as { __ngPointQueue?: unknown[] }).__ngPointQueue;
    expect(queue?.length ?? 0).toBe(0); // discarded — never queued
  });
});
