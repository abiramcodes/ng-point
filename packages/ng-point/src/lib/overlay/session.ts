import { signal } from '@angular/core';
import type { ResolvedNgPointConfig } from '../config';
import { assembleBlocks, formatBlock } from '../format';
import { detectSecrets } from '../snippet';
import type { NgPointContext, NgPointQueueEntry } from '../types';
import type { NgPointQueue } from '../queue';

let nextCardId = 0;

function newCardId(): string {
  return `np-${Date.now().toString(36)}-${(nextCardId++).toString(36)}`;
}

export type ElementResolver = (element: Element) => NgPointContext;

/**
 * One picked element in the current selection session.
 * `blockText` is the editable, WYSIWYG preview: what is in the textarea is
 * exactly what gets copied and queued.
 */
export class SelectionCard {
  readonly id: string;
  readonly instruction = signal('');
  readonly blockText = signal('');
  /** True once the user edited the block manually (auto-regeneration stops). */
  readonly manualEdit = signal(false);

  constructor(
    readonly context: NgPointContext,
    readonly element: Element,
    private readonly format: (instruction: string) => string,
    options: { id?: string; instruction?: string } = {},
  ) {
    this.id = options.id ?? newCardId();
    if (options.instruction) {
      this.instruction.set(options.instruction);
    }
    this.blockText.set(this.format(this.instruction()));
  }

  setInstruction(value: string): void {
    this.instruction.set(value);
    if (!this.manualEdit()) {
      this.blockText.set(this.format(value));
    }
  }

  setBlockText(value: string): void {
    this.blockText.set(value);
    this.manualEdit.set(true);
  }

  regenerate(): void {
    this.manualEdit.set(false);
    this.blockText.set(this.format(this.instruction()));
  }
}

/**
 * State machine for one overlay "selection session":
 * open → pick/replace/add/retarget/remove cards → commit all (Enter) or discard (Escape).
 */
export class NgPointSession {
  readonly open = signal(false);
  readonly cards = signal<SelectionCard[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly positionX = signal(0);
  readonly positionY = signal(0);
  readonly mcpStatus = signal<'checking' | 'up' | 'down'>('checking');

  constructor(
    private readonly config: ResolvedNgPointConfig,
    private readonly resolve: ElementResolver,
    readonly queue: NgPointQueue,
  ) {}

  openWith(context: NgPointContext, element: Element, x: number, y: number): void {
    this.positionX.set(x);
    this.positionY.set(y);
    const card = this.createCard(context, element);
    this.cards.set([card]);
    this.activeId.set(card.id);
    this.open.set(true);
  }

  /** Adds another independent context. Returns false when the session cap is reached. */
  addSelection(context: NgPointContext, element: Element): boolean {
    if (this.cards().length >= this.config.maxSelections) {
      return false;
    }
    const card = this.createCard(context, element);
    this.cards.set([...this.cards(), card]);
    this.activeId.set(card.id);
    return true;
  }

  /** Re-picks the active card's element (Alt+Click while the session is open). */
  replaceActive(context: NgPointContext, element: Element): void {
    const activeId = this.activeId();
    const cards = this.cards();
    const index = cards.findIndex((card) => card.id === activeId);
    if (index < 0) {
      return;
    }
    const old = cards[index];
    const replacement = this.createCard(context, element, {
      id: old.id,
      instruction: old.instruction(),
    });
    const next = [...cards];
    next[index] = replacement;
    this.cards.set(next);
  }

  /** Moves a card's target to the parent (up) or first child (down) element. */
  retarget(id: string, direction: 'up' | 'down'): void {
    const cards = this.cards();
    const index = cards.findIndex((card) => card.id === id);
    if (index < 0) {
      return;
    }
    const card = cards[index];
    const nextEl =
      direction === 'up' ? card.element.parentElement : card.element.firstElementChild;
    if (!nextEl) {
      return;
    }
    const context = this.resolve(nextEl);
    const replacement = this.createCard(context, nextEl, {
      id: card.id,
      instruction: card.instruction(),
    });
    const next = [...cards];
    next[index] = replacement;
    this.cards.set(next);
    this.activeId.set(id);
  }

  removeCard(id: string): void {
    const cards = this.cards().filter((card) => card.id !== id);
    this.cards.set(cards);
    if (this.activeId() === id) {
      this.activeId.set(cards.length ? cards[cards.length - 1].id : null);
    }
  }

  activate(id: string): void {
    if (this.cards().some((card) => card.id === id)) {
      this.activeId.set(id);
    }
  }

  /** Closes the session and discards uncommitted selections. */
  close(): void {
    this.open.set(false);
    this.cards.set([]);
    this.activeId.set(null);
  }

  /** Warn-only secret re-scan of a card's final block text. */
  hasSecretWarning(card: SelectionCard): boolean {
    return detectSecrets(card.blockText(), this.config.extraRedactionPatterns);
  }

  /** Final context blocks of all cards (exactly what the user sees). */
  blocks(): string[] {
    return this.cards().map((card) => card.blockText());
  }

  assembledBlocks(): string {
    return assembleBlocks(this.blocks());
  }

  /** Structured queue entry for one card (wire format for clipboard + MCP). */
  toEntry(card: SelectionCard): NgPointQueueEntry {
    const c = card.context;
    const file = c.component?.file
      ? `${c.component.file}${c.component.line ? `:${c.component.line}` : ''}`
      : '(source location unavailable)';
    return {
      id: card.id,
      capturedAt: new Date().toISOString(),
      component: c.component?.name ?? '(no component)',
      file,
      template: c.template ? `${c.template.path}:${c.template.line}` : undefined,
      element: c.element,
      directives: c.directives,
      parent: c.parent
        ? c.parent.file
          ? `${c.parent.name} (${c.parent.file}${c.parent.line ? `:${c.parent.line}` : ''})`
          : c.parent.name
        : undefined,
      instruction: card.instruction(),
      block: card.blockText(),
    };
  }

  entries(): NgPointQueueEntry[] {
    return this.cards().map((card) => this.toEntry(card));
  }

  private createCard(
    context: NgPointContext,
    element: Element,
    options: { id?: string; instruction?: string } = {},
  ): SelectionCard {
    const includeTemplateLine = this.config.includeTemplateLine;
    const format = (instruction: string) =>
      formatBlock(context, instruction, includeTemplateLine);
    return new SelectionCard(context, element, format, options);
  }
}
