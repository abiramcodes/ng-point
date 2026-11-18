import { signal } from '@angular/core';
import type { NgPointQueueEntry } from './types';

const STORAGE_KEY = 'ng-point.queue.v1';

function capFifo(entries: NgPointQueueEntry[], max: number): NgPointQueueEntry[] {
  const list = entries.filter((entry) => entry && typeof entry === 'object');
  return list.length > max ? list.slice(list.length - max) : list;
}

/**
 * Recent-selections queue: in-memory signal store, mirrored to
 * `window.__ngPointQueue` (HMR-safe) and `sessionStorage` (refresh-safe).
 * Cleared only by explicit user action — never automatically.
 */
export class NgPointQueue {
  readonly entries = signal<NgPointQueueEntry[]>([]);

  constructor(private readonly max = 6) {
    this.hydrate();
  }

  addMany(entries: NgPointQueueEntry[]): void {
    if (!entries.length) {
      return;
    }
    this.entries.set(capFifo([...this.entries(), ...entries], this.max));
    this.persist();
  }

  remove(id: string): void {
    this.entries.set(this.entries().filter((entry) => entry.id !== id));
    this.persist();
  }

  clear(): void {
    this.entries.set([]);
    this.persist();
  }

  private persist(): void {
    const g = globalThis as { __ngPointQueue?: NgPointQueueEntry[] };
    g.__ngPointQueue = this.entries();
    try {
      globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(this.entries()));
    } catch {
      // storage unavailable/blocked — memory-only is fine
    }
  }

  private hydrate(): void {
    const g = globalThis as { __ngPointQueue?: NgPointQueueEntry[] };
    if (Array.isArray(g.__ngPointQueue)) {
      this.entries.set(capFifo(g.__ngPointQueue, this.max));
      return;
    }
    try {
      const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries.set(capFifo(parsed as NgPointQueueEntry[], this.max));
        }
      }
    } catch {
      // corrupted storage — start empty
    }
  }
}

/** Process-wide singleton (survives HMR module swaps and SPA route changes). */
export function getSharedQueue(max = 6): NgPointQueue {
  const g = globalThis as { __ngPointQueueInstance?: NgPointQueue };
  if (!g.__ngPointQueueInstance) {
    g.__ngPointQueueInstance = new NgPointQueue(max);
  }
  return g.__ngPointQueueInstance;
}
