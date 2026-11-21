import { beforeEach, describe, expect, it } from 'vitest';
import { resolveNgPointConfig } from '../config';
import { formatBlock } from '../format';
import { NgPointQueue } from '../queue';
import type { NgPointContext } from '../types';
import { NgPointSession } from './session';

function context(name: string, sensitive = false): NgPointContext {
  return {
    component: { name, file: `src/app/${name.toLowerCase()}.ts`, line: 10 },
    directives: sensitive ? [] : ['RouterLink'],
    element: `<button>${name}</button>`,
    parent: { name: 'FormComponent', file: 'src/app/form.component.ts', line: 18 },
    template: null,
    sensitive,
    redacted: sensitive,
  };
}

function freshQueue(): NgPointQueue {
  const g = globalThis as Record<string, unknown>;
  delete g['__ngPointQueue'];
  delete g['__ngPointQueueInstance'];
  globalThis.sessionStorage?.clear();
  return new NgPointQueue(6);
}

function makeSession(maxSelections = 5): { session: NgPointSession; queue: NgPointQueue } {
  const queue = freshQueue();
  const config = resolveNgPointConfig({ maxSelections });
  const session = new NgPointSession(
    config,
    (el) => {
      const tag = el.tagName.toLowerCase();
      return { ...context(`Comp-${tag}`), element: `<${tag}>Comp-${tag}</${tag}>` };
    },
    queue,
  );
  return { session, queue };
}

beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g['__ngPointQueue'];
  delete g['__ngPointQueueInstance'];
  globalThis.sessionStorage?.clear();
});

describe('NgPointSession lifecycle', () => {
  it('opens with one card, focused and active', () => {
    const { session } = makeSession();
    const el = document.createElement('button');
    session.openWith(context('SubmitButtonComponent'), el, 100, 100);

    expect(session.open()).toBe(true);
    expect(session.cards().length).toBe(1);
    expect(session.activeId()).toBe(session.cards()[0]!.id);
    expect(session.positionX()).toBe(100);
  });

  it('a suppression notice clears on the next successful pick', () => {
    const { session } = makeSession();
    session.notifySuppressed('ngPointIgnore');
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    expect(session.notice()).toBe('');
  });

  it('moveTo clamps the panel origin so the whole panel stays on screen', () => {
    const { session } = makeSession();
    session.moveTo(5000, 5000, 1280, 800, 400);
    expect(session.positionX()).toBe(1280 - 440 - 8);
    expect(session.positionY()).toBe(800 - 400 - 8);
  });

  it('moveTo keeps drag deltas inside the viewport bounds', () => {
    const { session } = makeSession();
    session.moveTo(160, 140, 1280, 800, 400);
    expect(session.positionX()).toBe(160);
    expect(session.positionY()).toBe(140);
  });

  it('moveTo lets the min bound win on viewports smaller than the panel', () => {
    const { session } = makeSession();
    session.moveTo(-500, -500, 300, 200, 400);
    expect(session.positionX()).toBe(8);
    expect(session.positionY()).toBe(8);
  });

  it('adds independent contexts up to the cap (default 5), then refuses', () => {
    const { session } = makeSession();
    const el = document.createElement('button');
    session.openWith(context('A'), el, 1, 1);
    for (let i = 0; i < 4; i++) {
      expect(session.addSelection(context(`Extra${i}`), el)).toBe(true);
    }
    expect(session.cards().length).toBe(5);
    expect(session.addSelection(context('OneTooMany'), el)).toBe(false);
    expect(session.cards().length).toBe(5);
  });

  it('replaces the active card, keeping its id and instruction', () => {
    const { session } = makeSession();
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    const card = session.cards()[0]!;
    card.setInstruction('fix this');

    session.replaceActive(context('B'), document.createElement('button'));
    const replaced = session.cards()[0]!;
    expect(replaced.id).toBe(card.id);
    expect(replaced.instruction()).toBe('fix this');
    expect(replaced.context.component?.name).toBe('B');
    expect(replaced.blockText()).toContain('Instruction: fix this');
  });

  it('retargets a card up to the parent element and regenerates its context', () => {
    const { session } = makeSession();
    const parent = document.createElement('div');
    const button = document.createElement('button');
    parent.append(button);
    session.openWith(context('FromButton'), button, 1, 1);
    const cardId = session.cards()[0]!.id;

    session.retarget(cardId, 'up');
    const retargeted = session.cards()[0]!;
    expect(retargeted.context.component?.name).toBe('Comp-div');
    expect(retargeted.context.element).toContain('<div>');
  });

  it('retargeting down uses the first child', () => {
    const { session } = makeSession();
    const parent = document.createElement('div');
    const button = document.createElement('button');
    parent.append(button);
    session.openWith(context('FromDiv'), parent, 1, 1);

    session.retarget(session.cards()[0]!.id, 'down');
    expect(session.cards()[0]!.context.component?.name).toBe('Comp-button');
  });

  it('retargeting is a no-op at the top/bottom of the tree', () => {
    const { session } = makeSession();
    const button = document.createElement('button');
    session.openWith(context('A'), button, 1, 1);
    session.retarget(session.cards()[0]!.id, 'down');
    expect(session.cards()[0]!.context.component?.name).toBe('A');
  });

  it('retargeting up skips ngPointIgnore zones', () => {
    const { session } = makeSession();
    const outer = document.createElement('section');
    const zone = document.createElement('div');
    zone.setAttribute('ng-point-ignore', '');
    const button = document.createElement('button');
    zone.append(button);
    outer.append(zone);
    session.openWith(context('FromButton'), button, 1, 1);

    session.retarget(session.cards()[0]!.id, 'up');
    expect(session.cards()[0]!.context.component?.name).toBe('Comp-section');
  });

  it('retargeting down skips ngPointIgnore zones', () => {
    const { session } = makeSession();
    const parent = document.createElement('div');
    const zone = document.createElement('span');
    zone.setAttribute('data-ng-point-ignore', '');
    const ok = document.createElement('p');
    parent.append(zone, ok);
    session.openWith(context('FromDiv'), parent, 1, 1);

    session.retarget(session.cards()[0]!.id, 'down');
    expect(session.cards()[0]!.context.component?.name).toBe('Comp-p');
  });

  it('removeCard keeps the session open and activates the last remaining card', () => {
    const { session } = makeSession();
    const el = document.createElement('button');
    session.openWith(context('A'), el, 1, 1);
    session.addSelection(context('B'), el);
    const [first, second] = session.cards()!;

    session.removeCard(first.id);
    expect(session.cards().map((c) => c.id)).toEqual([second.id]);
    expect(session.activeId()).toBe(second.id);
    expect(session.open()).toBe(true);

    session.removeCard(second.id);
    expect(session.cards()).toEqual([]);
    expect(session.open()).toBe(true); // hint state: keep picking
  });

  it('close discards uncommitted selections', () => {
    const { session } = makeSession();
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    session.close();
    expect(session.open()).toBe(false);
    expect(session.cards()).toEqual([]);
  });
});

describe('card block editing (WYSIWYG)', () => {
  it('the block preview contains exactly what will be copied', () => {
    const { session } = makeSession();
    session.openWith(context('SubmitButtonComponent'), document.createElement('button'), 1, 1);
    const card = session.cards()[0]!;

    expect(card.blockText()).toBe(formatBlock(context('SubmitButtonComponent'), ''));
  });

  it('typing an instruction updates the block automatically', () => {
    const { session } = makeSession();
    session.openWith(context('SubmitButtonComponent'), document.createElement('button'), 1, 1);
    const card = session.cards()[0]!;

    card.setInstruction('make this disabled');
    expect(card.blockText()).toContain('Instruction: make this disabled');
  });

  it('manual edits take precedence over auto-regeneration', () => {
    const { session } = makeSession();
    session.openWith(context('SubmitButtonComponent'), document.createElement('button'), 1, 1);
    const card = session.cards()[0]!;

    card.setBlockText('Component: CustomBlock');
    card.setInstruction('fix this');
    expect(card.blockText()).toBe('Component: CustomBlock'); // not overwritten

    card.regenerate();
    expect(card.blockText()).toContain('Component: SubmitButtonComponent');
    expect(card.blockText()).toContain('Instruction: fix this');
  });
});

describe('committing entries', () => {
  it('assembles multiple blocks with the --- separator', () => {
    const { session } = makeSession();
    const el = document.createElement('button');
    session.openWith(context('A'), el, 1, 1);
    session.addSelection(context('B'), el);
    session.cards()[0]!.setInstruction('first');
    session.cards()[1]!.setInstruction('second');

    expect(session.assembledBlocks()).toContain('\n\n---\n\n');
    expect(session.blocks().length).toBe(2);
  });

  it('toEntry produces the structured wire format', () => {
    const { session } = makeSession();
    session.openWith(context('SubmitButtonComponent'), document.createElement('button'), 1, 1);
    const card = session.cards()[0]!;
    card.setInstruction('make this disabled when form is invalid');

    const entry = session.toEntry(card);
    expect(entry.component).toBe('SubmitButtonComponent');
    expect(entry.file).toBe('src/app/submitbuttoncomponent.ts:10');
    expect(entry.element).toBe('<button>SubmitButtonComponent</button>');
    expect(entry.directives).toEqual(['RouterLink']);
    expect(entry.parent).toBe('FormComponent (src/app/form.component.ts:18)');
    expect(entry.instruction).toBe('make this disabled when form is invalid');
    expect(entry.block).toBe(card.blockText());
    expect(entry.id).toBe(card.id);
    expect(Number.isNaN(Date.parse(entry.capturedAt))).toBe(false);
  });
});

describe('warn-only secret re-scan', () => {
  it('flags leftover secret shapes in the final block text', () => {
    const { session } = makeSession();
    session.openWith(context('A'), document.createElement('button'), 1, 1);
    const card = session.cards()[0]!;

    expect(session.hasSecretWarning(card)).toBe(false);
    card.setBlockText('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
    expect(session.hasSecretWarning(card)).toBe(true);
  });
});
