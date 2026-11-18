import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { copyText } from '../clipboard';
import { NG_POINT_CONFIG } from '../config';
import { clearAllEntries, deleteEntry, postEntries } from '../mcp-bridge';
import type { NgPointQueueEntry } from '../types';
import { NG_POINT_SESSION } from './tokens';
import type { SelectionCard } from './session';

const PANEL_WIDTH = 440;
const PANEL_HEIGHT_ESTIMATE = 520;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/**
 * ng-point overlay panel — a NON-modal inspector dialog.
 *
 * The user keeps working in the page while the panel is open (Alt+Shift+Click
 * adds more elements), so `showModal()` must never be used: it would make the
 * page inert. The native `<dialog>` element is opened non-modally, which
 * provides the dialog semantics natively (no role="dialog"/aria-modal needed).
 */
@Component({
  selector: 'ng-point-overlay',
  imports: [],
  template: `
    <dialog
      class="ng-point-panel"
      [attr.open]="session.open() ? '' : null"
      [style.left.px]="panelLeft()"
      [style.top.px]="panelTop()"
      aria-labelledby="ng-point-title"
    >
      <header class="ng-point-head">
        <div>
          <h2 id="ng-point-title" class="ng-point-title">ng-point</h2>
          <p class="ng-point-hint">{{ hint() }}</p>
        </div>
        <button
          type="button"
          class="ng-point-icon-btn"
          (click)="close()"
          aria-label="Close ng-point panel (Escape)"
        >
          ✕
        </button>
      </header>

      @if (session.cards().length === 0) {
        <p class="ng-point-empty">
          Pick an element: {{ pickHint() }} — its context block will appear here for review
          before anything is copied.
        </p>
      }

      <div class="ng-point-cards">
        @for (card of session.cards(); track card.id; let i = $index) {
          <article
            class="ng-point-card"
            [class.ng-point-card-active]="session.activeId() === card.id"
            (click)="activate(card.id)"
          >
            <header class="ng-point-card-head">
              <span class="ng-point-card-name">
                {{ card.context.component?.name ?? '(no component)' }}
              </span>
              @if (card.context.sensitive) {
                <span class="ng-point-badge">sensitive</span>
              }
              @if (session.hasSecretWarning(card)) {
                <span class="ng-point-badge ng-point-badge-warn" role="status">
                  possible secret
                </span>
              }
              <span class="ng-point-card-actions">
                <button
                  type="button"
                  class="ng-point-icon-btn"
                  (click)="retarget(card, 'up')"
                  aria-label="Retarget selection {{ i + 1 }} to parent element"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="ng-point-icon-btn"
                  (click)="retarget(card, 'down')"
                  aria-label="Retarget selection {{ i + 1 }} to first child element"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="ng-point-text-btn"
                  (click)="copyCard(card, i)"
                  aria-label="Copy context block {{ i + 1 }} only, without queueing"
                >
                  copy
                </button>
                <button
                  type="button"
                  class="ng-point-icon-btn"
                  (click)="remove(card.id)"
                  aria-label="Remove selection {{ i + 1 }}"
                >
                  ✕
                </button>
              </span>
            </header>

            <label class="ng-point-label" [attr.for]="'ng-point-block-' + i">
              Context block
              <button
                type="button"
                class="ng-point-text-btn ng-point-regen"
                (click)="card.regenerate()"
              >
                regenerate
              </button>
            </label>
            <textarea
              class="ng-point-block"
              [id]="'ng-point-block-' + i"
              rows="8"
              spellcheck="false"
              [value]="card.blockText()"
              (input)="onBlockInput(card, $event)"
              [attr.aria-label]="'Context block for selection ' + (i + 1) + ' (editable)'"
            ></textarea>

            <label class="ng-point-label" [attr.for]="'ng-point-instr-' + i">
              Instruction for this element (optional)
            </label>
            <input
              #instrInput
              class="ng-point-instr"
              [id]="'ng-point-instr-' + i"
              type="text"
              placeholder="e.g. make this disabled when form is invalid"
              autocomplete="off"
              [value]="card.instruction()"
              (input)="onInstructionInput(card, $event)"
              (keydown)="onInstructionKeydown(card, $event, i)"
            />
          </article>
        }
      </div>

      <footer class="ng-point-foot">
        <button
          type="button"
          class="ng-point-commit"
          (click)="commitAll()"
          [disabled]="session.cards().length === 0"
        >
          Copy all &amp; queue (Enter)
        </button>
        <p class="ng-point-status" role="status">{{ statusText() }}</p>
        <span class="ng-point-mcp" [attr.data-state]="session.mcpStatus()">
          MCP {{ mcpText() }}
        </span>
      </footer>

      <section class="ng-point-queue" aria-labelledby="ng-point-queue-title">
        <h3 id="ng-point-queue-title">
          Recent ({{ session.queue.entries().length }}/{{ config.maxQueueEntries }})
        </h3>
        @if (session.queue.entries().length === 0) {
          <p class="ng-point-queue-empty">Nothing queued yet.</p>
        } @else {
          <ul class="ng-point-queue-list">
            @for (entry of session.queue.entries(); track entry.id) {
              <li class="ng-point-queue-item">
                <span class="ng-point-q-name">{{ entry.component }}</span>
                <span class="ng-point-q-file">{{ entry.file }}</span>
                <span class="ng-point-q-actions">
                  <button
                    type="button"
                    class="ng-point-text-btn"
                    (click)="copyEntry(entry)"
                    aria-label="Copy queued context for {{ entry.component }}"
                  >
                    copy
                  </button>
                  <button
                    type="button"
                    class="ng-point-icon-btn"
                    (click)="removeEntry(entry)"
                    aria-label="Remove queued context for {{ entry.component }}"
                  >
                    ✕
                  </button>
                </span>
              </li>
            }
          </ul>
          <button type="button" class="ng-point-text-btn ng-point-clear" (click)="clearQueue()">
            Clear all
          </button>
        }
      </section>
    </dialog>
  `,
  styles: `
    .ng-point-panel {
      --ng-point-bg: #14141b;
      --ng-point-surface: #1d1d27;
      --ng-point-text: #e9e9f2;
      --ng-point-muted: #9a9aad;
      --ng-point-border: #343442;
      --ng-point-accent: #7aa2ff;
      --ng-point-danger: #ff8080;
      --ng-point-warn: #ffb84d;

      position: fixed;
      inset: auto;
      z-index: 2147483646;
      display: none;
      flex-direction: column;
      gap: 8px;
      width: min(440px, calc(100vw - 24px));
      max-height: min(70vh, 560px);
      margin: 0;
      padding: 10px;
      border: 1px solid var(--ng-point-border);
      border-radius: 10px;
      background: var(--ng-point-bg);
      color: var(--ng-point-text);
      font: 12.5px/1.5 ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace;
      box-shadow: 0 12px 40px rgb(0 0 0 / 45%);
      overscroll-behavior: contain;
    }

    .ng-point-panel[open] {
      display: flex;
    }

    @media (prefers-color-scheme: light) {
      .ng-point-panel {
        --ng-point-bg: #ffffff;
        --ng-point-surface: #f4f4f8;
        --ng-point-text: #1c1c24;
        --ng-point-muted: #66667a;
        --ng-point-border: #d8d8e2;
        --ng-point-accent: #2f5fd0;
        --ng-point-danger: #b3261e;
        --ng-point-warn: #92600a;
      }
    }

    .ng-point-panel :where(button, textarea, input):focus-visible {
      outline: 2px solid var(--ng-point-accent);
      outline-offset: 2px;
    }

    .ng-point-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .ng-point-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }

    .ng-point-hint,
    .ng-point-empty,
    .ng-point-queue-empty {
      margin: 2px 0 0;
      color: var(--ng-point-muted);
    }

    .ng-point-cards {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      min-height: 40px;
      padding-inline-end: 2px;
    }

    .ng-point-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      border: 1px solid var(--ng-point-border);
      border-radius: 8px;
      background: var(--ng-point-surface);
      cursor: pointer;
    }

    .ng-point-card-active {
      border-color: var(--ng-point-accent);
    }

    .ng-point-card-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ng-point-card-name {
      font-weight: 600;
    }

    .ng-point-card-actions,
    .ng-point-q-actions {
      margin-inline-start: auto;
      display: flex;
      gap: 4px;
    }

    .ng-point-badge {
      padding: 0 6px;
      border: 1px solid var(--ng-point-warn);
      border-radius: 999px;
      color: var(--ng-point-warn);
      font-size: 10.5px;
      line-height: 18px;
      white-space: nowrap;
    }

    .ng-point-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ng-point-muted);
      font-size: 11px;
      margin-top: 2px;
    }

    .ng-point-block {
      width: 100%;
      resize: vertical;
      padding: 6px;
      border: 1px solid var(--ng-point-border);
      border-radius: 6px;
      background: var(--ng-point-bg);
      color: var(--ng-point-text);
      font: inherit;
      white-space: pre;
    }

    .ng-point-instr {
      width: 100%;
      padding: 6px;
      border: 1px solid var(--ng-point-border);
      border-radius: 6px;
      background: var(--ng-point-bg);
      color: var(--ng-point-text);
      font: inherit;
    }

    .ng-point-icon-btn,
    .ng-point-text-btn,
    .ng-point-commit,
    .ng-point-clear {
      min-block-size: 24px;
      min-inline-size: 24px;
      padding: 2px 8px;
      border: 1px solid var(--ng-point-border);
      border-radius: 6px;
      background: transparent;
      color: var(--ng-point-text);
      font: inherit;
      cursor: pointer;
    }

    .ng-point-text-btn {
      font-size: 11px;
      color: var(--ng-point-muted);
    }

    .ng-point-regen {
      margin-inline-start: auto;
    }

    .ng-point-commit {
      background: var(--ng-point-accent);
      border-color: var(--ng-point-accent);
      color: #ffffff;
      font-weight: 600;
    }

    .ng-point-commit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ng-point-foot {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ng-point-status {
      flex: 1 1 160px;
      margin: 0;
      color: var(--ng-point-muted);
      min-height: 18px;
    }

    .ng-point-mcp {
      font-size: 10.5px;
      color: var(--ng-point-muted);
      white-space: nowrap;
    }

    .ng-point-mcp[data-state='up'] {
      color: var(--ng-point-accent);
    }

    .ng-point-mcp[data-state='down'] {
      opacity: 0.6;
    }

    .ng-point-queue {
      border-top: 1px solid var(--ng-point-border);
      padding-top: 6px;
    }

    .ng-point-queue h3 {
      margin: 0 0 4px;
      font-size: 11px;
      color: var(--ng-point-muted);
    }

    .ng-point-queue-list {
      list-style: none;
      margin: 0 0 4px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 96px;
      overflow-y: auto;
    }

    .ng-point-queue-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }

    .ng-point-q-name {
      font-weight: 600;
    }

    .ng-point-q-file {
      color: var(--ng-point-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
    }

    .ng-point-clear {
      color: var(--ng-point-danger);
      border-color: var(--ng-point-danger);
    }

    @media (prefers-reduced-motion: reduce) {
      .ng-point-panel,
      .ng-point-panel * {
        transition: none !important;
        animation: none !important;
      }
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgPointOverlayComponent {
  protected readonly session = inject(NG_POINT_SESSION);
  protected readonly config = inject(NG_POINT_CONFIG);

  private readonly instructionInputs = viewChildren<ElementRef<HTMLInputElement>>('instrInput');
  private readonly statusText = signal('');
  private lastStatus = '';
  private lastCardCount = 0;
  private wasOpen = false;
  private previousFocus: HTMLElement | null = null;

  protected readonly panelLeft = computed(() => {
    const viewport = globalThis.innerWidth ?? 1024;
    return clamp(this.session.positionX() + 12, 8, viewport - PANEL_WIDTH - 8);
  });

  protected readonly panelTop = computed(() => {
    const viewport = globalThis.innerHeight ?? 768;
    return clamp(this.session.positionY() + 12, 8, viewport - PANEL_HEIGHT_ESTIMATE - 8);
  });

  private readonly bridgeOptions = {
    endpoint: this.config.mcpEndpoint,
    token: this.config.mcpToken,
  };

  constructor() {
    // Focus management: move focus to the newest card's instruction input and
    // restore focus to the invoker when the session closes (non-modal dialogs
    // do not do this natively).
    effect(() => {
      const open = this.session.open();
      const count = this.session.cards().length;
      const inputs = this.instructionInputs();
      if (open && !this.wasOpen) {
        this.previousFocus =
          globalThis.document?.activeElement instanceof HTMLElement
            ? globalThis.document.activeElement
            : null;
      }
      if (open && count > this.lastCardCount && inputs.length > 0) {
        inputs[Math.min(count, inputs.length) - 1]?.nativeElement.focus();
      }
      if (!open && this.wasOpen && this.previousFocus) {
        this.previousFocus.focus();
      }
      this.wasOpen = open;
      this.lastCardCount = count;
    });
  }

  protected pickHint(): string {
    return this.config.activationModifier === 'alt'
      ? 'Alt+Click an element (Alt+Shift+Click to add more)'
      : 'Ctrl+Shift+Click an element (Ctrl+Shift+Alt+Click to add more)';
  }

  protected hint(): string {
    return `${this.pickHint()} · Alt+↑/↓ retarget · Enter copies & queues · Esc discards`;
  }

  protected mcpText(): string {
    switch (this.session.mcpStatus()) {
      case 'up':
        return 'connected';
      case 'down':
        return 'not running';
      default:
        return 'checking…';
    }
  }

  protected activate(id: string): void {
    this.session.activate(id);
  }

  protected remove(id: string): void {
    this.session.removeCard(id);
  }

  protected retarget(card: SelectionCard, direction: 'up' | 'down'): void {
    this.session.retarget(card.id, direction);
  }

  protected onBlockInput(card: SelectionCard, event: Event): void {
    card.setBlockText((event.target as HTMLTextAreaElement).value);
  }

  protected onInstructionInput(card: SelectionCard, event: Event): void {
    card.setInstruction((event.target as HTMLInputElement).value);
  }

  protected onInstructionKeydown(card: SelectionCard, event: KeyboardEvent, index: number): void {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      void this.copyCard(card, index);
    } else {
      void this.commitAll();
    }
  }

  /** Commit: copy every block, queue each as its own entry, mirror to MCP, close. */
  protected async commitAll(): Promise<void> {
    const cards = this.session.cards();
    if (cards.length === 0) {
      return;
    }
    const entries = this.session.entries();
    const copied = await copyText(this.session.assembledBlocks());
    if (!copied) {
      this.setStatus(
        'Copy failed — clipboard unavailable. Edit/copy blocks manually, then press Esc.',
      );
      return;
    }
    this.session.queue.addMany(entries);
    // Fire-and-forget: the clipboard is the primary path, MCP is a mirror.
    void postEntries(this.bridgeOptions, entries);
    this.setStatus(`Copied ${entries.length} context(s) and queued them.`);
    this.session.close();
  }

  /** Copies a single block without queueing (Ctrl+Enter / per-card copy). */
  protected async copyCard(card: SelectionCard, index: number): Promise<void> {
    const ok = await copyText(card.blockText());
    this.setStatus(
      ok ? `Copied block ${index + 1} (not queued).` : `Copy failed for block ${index + 1}.`,
    );
  }

  protected async copyEntry(entry: NgPointQueueEntry): Promise<void> {
    const ok = await copyText(entry.block);
    this.setStatus(ok ? `Copied queued context for ${entry.component}.` : 'Copy failed.');
  }

  protected removeEntry(entry: NgPointQueueEntry): void {
    this.session.queue.remove(entry.id);
    void deleteEntry(this.bridgeOptions, entry.id);
    this.setStatus(`Removed queued context for ${entry.component}.`);
  }

  protected clearQueue(): void {
    const count = this.session.queue.entries().length;
    this.session.queue.clear();
    void clearAllEntries(this.bridgeOptions);
    this.setStatus(count ? 'Cleared local queue and MCP mirror.' : 'Queue already empty.');
  }

  protected close(): void {
    this.session.close();
  }

  /**
   * Live-region feedback. A trailing no-break space is appended when the same
   * message repeats so screen readers (VoiceOver) re-announce it; the region
   * itself is always present in the accessibility tree.
   */
  private setStatus(message: string): void {
    let text = message;
    if (text === this.lastStatus) {
      text += ' ';
    }
    this.lastStatus = text;
    this.statusText.set(text);
  }
}
