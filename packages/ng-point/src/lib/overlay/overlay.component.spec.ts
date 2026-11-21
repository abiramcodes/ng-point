import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveNgPointConfig, NG_POINT_CONFIG } from '../config';
import { copyText } from '../clipboard';
import { NgPointQueue } from '../queue';
import type { NgPointContext } from '../types';
import { NgPointOverlayComponent } from './overlay.component';
import { NgPointSession } from './session';
import { NG_POINT_SESSION } from './tokens';

function context(name: string, sensitive = false): NgPointContext {
  return {
    component: { name, file: `src/app/${name.toLowerCase()}.component.ts`, line: 10 },
    directives: sensitive ? [] : ['RouterLink'],
    element: `<button class="x">${name}</button>`,
    parent: null,
    template: null,
    sensitive,
    redacted: sensitive,
  };
}

describe('NgPointOverlayComponent', () => {
  let session: NgPointSession;
  let queue: NgPointQueue;
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  function cleanGlobalState(): void {
    const g = globalThis as Record<string, unknown>;
    delete g['__ngPointQueue'];
    delete g['__ngPointQueueInstance'];
    globalThis.sessionStorage?.clear();
  }

  async function createFixture(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(NgPointOverlayComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    cleanGlobalState();
    queue = new NgPointQueue(6);
    const config = resolveNgPointConfig({});
    session = new NgPointSession(config, (el) => context(`Comp-${el.tagName}`), queue);

    clipboardWriteText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText: clipboardWriteText } });

    TestBed.configureTestingModule({
      providers: [
        { provide: NG_POINT_SESSION, useValue: session },
        { provide: NG_POINT_CONFIG, useValue: config },
      ],
    });
    await createFixture();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
    document.querySelectorAll('ng-point-overlay').forEach((n) => n.remove());
  });

  it('renders a closed dialog until a session opens', async () => {
    const el = await createFixture();
    const dialog = el.querySelector('dialog.ng-point-panel')!;
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('renders the card context fields once opened', async () => {
    const el = await createFixture();
    session.openWith(context('SubmitButtonComponent'), document.createElement('button'), 40, 40);
    await TestBed.flushEffects();
    await Promise.resolve();

    const card = el.querySelector<HTMLElement>('.ng-point-card')!;
    expect(card).toBeTruthy();
    expect(card.querySelector('.ng-point-card-name')!.textContent?.trim()).toBe(
      'SubmitButtonComponent',
    );
    const block = card.querySelector<HTMLTextAreaElement>('.ng-point-block')!;
    expect(block.value).toContain('Component: SubmitButtonComponent');
    expect(block.value).toContain(
      'File: src/app/submitbuttoncomponent.component.ts:10',
    );
    expect(block.value).toContain('Directives: RouterLink');
    expect(card.querySelector('label[for="ng-point-instr-0"]')).toBeTruthy();
  });

  it('marks sensitive selections with a badge', async () => {
    const el = await createFixture();
    session.openWith(context('PasswordField', true), document.createElement('input'), 1, 1);
    await TestBed.flushEffects();
    await Promise.resolve();

    expect(el.querySelector('.ng-point-badge')!.textContent?.trim()).toContain('sensitive');
  });

  it('shows a warn-only badge when the edited block still contains a secret shape', async () => {
    const el = await createFixture();
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    session.cards()[0]!.setBlockText('key ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
    await TestBed.flushEffects();
    await Promise.resolve();

    expect(el.querySelector('.ng-point-badge-warn')?.textContent).toContain('possible secret');
  });

  it('renders one card per selection with distinct accessible labels', async () => {
    const el = await createFixture();
    const button = document.createElement('button');
    session.openWith(context('A'), button, 1, 1);
    session.addSelection(context('B'), button);
    await TestBed.flushEffects();
    await Promise.resolve();

    expect(el.querySelectorAll('.ng-point-card').length).toBe(2);
    const labels = Array.from(el.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(labels.some((l) => l?.includes('selection 1'))).toBe(true);
    expect(labels.some((l) => l?.includes('selection 2'))).toBe(true);
  });

  it('Enter commits: copies the assembled blocks, queues each entry, closes the panel', async () => {
    const el = await createFixture();
    const button = document.createElement('button');
    session.openWith(context('A'), button, 1, 1);
    session.addSelection(context('B'), button);
    session.cards()[0]!.setInstruction('first');
    session.cards()[1]!.setInstruction('second');
    await TestBed.flushEffects();

    const input = el.querySelector<HTMLInputElement>('.ng-point-instr')!;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => expect(clipboardWriteText).toHaveBeenCalledTimes(1));
    const copied = clipboardWriteText.mock.calls[0]![0] as string;
    expect(copied).toContain('Component: A');
    expect(copied).toContain('Instruction: first');
    expect(copied).toContain('\n\n---\n\n');
    expect(copied).toContain('Instruction: second');

    await vi.waitFor(() => expect(session.open()).toBe(false));
    expect(queue.entries().length).toBe(2);
    expect(queue.entries()[0]!.block).toContain('Instruction: first');

    const dialog = el.querySelector('dialog.ng-point-panel')!;
    await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
  });

  it('Enter anywhere on the panel (no instruction, nothing focused) still commits', async () => {
    const el = await createFixture();
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    await TestBed.flushEffects();

    const dialog = el.querySelector('dialog.ng-point-panel')!;
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => expect(clipboardWriteText).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(session.open()).toBe(false));
    expect(queue.entries().length).toBe(1);
  });

  it('the queue "copy all" copies every queued entry, not just the latest', async () => {
    const el = await createFixture();
    queue.addMany([
      {
        id: 'q1',
        capturedAt: 't1',
        component: 'First',
        file: 'src/first.ts',
        element: '<i>1</i>',
        directives: [],
        instruction: '',
        block: 'Component: First',
      },
      {
        id: 'q2',
        capturedAt: 't2',
        component: 'Second',
        file: 'src/second.ts',
        element: '<i>2</i>',
        directives: [],
        instruction: '',
        block: 'Component: Second',
      },
    ]);
    await TestBed.flushEffects();

    const copyAll = el.querySelector<HTMLButtonElement>('.ng-point-copy-queue')!;
    expect(copyAll).toBeTruthy();
    copyAll.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(clipboardWriteText).toHaveBeenCalledTimes(1));
    const copied = clipboardWriteText.mock.calls[0]![0] as string;
    expect(copied).toContain('Component: First');
    expect(copied).toContain('\n\n---\n\n');
    expect(copied).toContain('Component: Second');
  });

  it('dragging the header moves the panel by the pointer delta', async () => {
    const el = await createFixture();
    session.openWith(context('A'), document.createElement('button'), 100, 100);
    await TestBed.flushEffects();

    const head = el.querySelector<HTMLElement>('.ng-point-head')!;
    head.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 200,
      }),
    );
    head.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 260, clientY: 240 }));
    head.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 260, clientY: 240 }));

    expect(session.positionX()).toBe(160);
    expect(session.positionY()).toBe(140);
  });

  it('Ctrl+Enter copies a single block without queueing', async () => {
    const el = await createFixture();
    const button = document.createElement('button');
    session.openWith(context('A'), button, 1, 1);
    session.addSelection(context('B'), button);
    await TestBed.flushEffects();

    const input = el.querySelector<HTMLInputElement>('.ng-point-instr')!;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => expect(clipboardWriteText).toHaveBeenCalledTimes(1));
    const copied = clipboardWriteText.mock.calls[0]![0] as string;
    expect(copied).not.toContain('---');
    expect(queue.entries().length).toBe(0);
    expect(session.open()).toBe(true);
  });

  it('keeps the overlay open with an error when the clipboard fails', async () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
    });
    const el = await createFixture();
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    await TestBed.flushEffects();

    const input = el.querySelector<HTMLInputElement>('.ng-point-instr')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await vi.waitFor(() =>
      expect(el.querySelector('.ng-point-status')!.textContent).toContain('Copy failed'),
    );
    expect(session.open()).toBe(true);
    expect(queue.entries().length).toBe(0);
  });

  it('suppression notices surface in the panel status region', async () => {
    const el = await createFixture();
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    await TestBed.flushEffects();

    session.notifySuppressed('ngPointIgnore: that element opts out of picking.');
    await TestBed.flushEffects();

    expect(el.querySelector('.ng-point-status')!.textContent).toContain('ngPointIgnore');
  });

  it('the panel widens for additional cards and clamps to the viewport', async () => {
    const el = await createFixture();
    const button = document.createElement('button');
    session.openWith(context('A'), button, 10, 10);
    await TestBed.flushEffects();
    const dialog = el.querySelector('dialog.ng-point-panel') as HTMLElement;
    expect(dialog.style.width).toBe('440px');

    session.addSelection(context('B'), button);
    session.addSelection(context('C'), button);
    await TestBed.flushEffects();
    // 440 base + 2 card slots (260 + 8 gap) = 976, under the 1024-16 cap.
    expect(dialog.style.width).toBe('976px');

    session.addSelection(context('D'), button);
    await TestBed.flushEffects();
    // 1244 would exceed the viewport: clamped, and the cards row scrolls.
    expect(dialog.style.width).toBe('1008px');
  });

  it('the remove button drops a card without closing the session', async () => {
    const el = await createFixture();
    const button = document.createElement('button');
    session.openWith(context('A'), button, 1, 1);
    session.addSelection(context('B'), button);
    await TestBed.flushEffects();
    await Promise.resolve();

    const removeButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.ng-point-card button')).filter((b) =>
      b.getAttribute('aria-label')?.includes('Remove selection 1'),
    );
    removeButtons[0]!.click();

    await vi.waitFor(() => expect(el.querySelectorAll('.ng-point-card').length).toBe(1));
    expect(session.open()).toBe(true);
  });

  it('the recent queue section lists, copies and removes entries', async () => {
    const el = await createFixture();
    session.queue.addMany([
      {
        id: 'q1',
        capturedAt: new Date(0).toISOString(),
        component: 'FormComponent',
        file: 'src/app/form.component.ts:18',
        element: '<form>…</form>',
        directives: [],
        instruction: '',
        block: 'Component: FormComponent',
      },
    ]);
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    await TestBed.flushEffects();
    await Promise.resolve();

    const list = el.querySelector('.ng-point-queue')!;
    expect(list.textContent).toContain('FormComponent');
    expect(list.textContent).toContain('src/app/form.component.ts:18');

    const copyBtn = list.querySelector<HTMLButtonElement>(
      'button[aria-label^="Copy queued context"]',
    )!;
    copyBtn.click();
    await vi.waitFor(() => expect(clipboardWriteText).toHaveBeenCalled());

    const removeBtn = list.querySelector<HTMLButtonElement>(
      'button[aria-label^="Remove queued context"]',
    )!;
    removeBtn.click();
    await Promise.resolve();
    await TestBed.flushEffects();

    expect(session.queue.entries().length).toBe(0);
  });

  it('Clear all empties the local queue', async () => {
    const el = await createFixture();
    session.queue.addMany([
      {
        id: 'q1',
        capturedAt: new Date(0).toISOString(),
        component: 'FormComponent',
        file: 'src/app/f.ts:1',
        element: '<form>…</form>',
        directives: [],
        instruction: '',
        block: 'Component: FormComponent',
      },
    ]);
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    await TestBed.flushEffects();
    await Promise.resolve();

    el.querySelector<HTMLButtonElement>('.ng-point-clear')!.click();
    await Promise.resolve();

    expect(session.queue.entries().length).toBe(0);
  });

  it('copyText uses the Async Clipboard API when available', async () => {
    expect(await copyText('hello')).toBe(true);
    expect(clipboardWriteText).toHaveBeenCalledWith('hello');
  });
});
