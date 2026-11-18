import { beforeEach, describe, expect, it } from 'vitest';
import { getSharedQueue, NgPointQueue } from './queue';
import type { NgPointQueueEntry } from './types';

function entry(id: string): NgPointQueueEntry {
  return {
    id,
    capturedAt: new Date(0).toISOString(),
    component: `Component${id}`,
    file: `src/app/c${id}.ts:1`,
    element: `<button>${id}</button>`,
    directives: [],
    instruction: '',
    block: `Component: Component${id}`,
  };
}

beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g['__ngPointQueue'];
  delete g['__ngPointQueueInstance'];
  globalThis.sessionStorage?.clear();
});

describe('NgPointQueue', () => {
  it('keeps at most 6 entries (FIFO eviction of the oldest)', () => {
    const queue = new NgPointQueue(6);
    queue.addMany([1, 2, 3, 4, 5, 6, 7].map((n) => entry(String(n))));
    expect(queue.entries().map((e) => e.id)).toEqual(['2', '3', '4', '5', '6', '7']);
  });

  it('survives module swaps via the window cache (HMR-safe)', () => {
    const first = new NgPointQueue(6);
    first.addMany([entry('a'), entry('b')]);

    const second = new NgPointQueue(6);
    expect(second.entries().map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('survives a page refresh via sessionStorage', () => {
    const first = new NgPointQueue(6);
    first.addMany([entry('a')]);
    // Simulate a fresh page load: the window cache is gone, storage remains.
    delete (globalThis as Record<string, unknown>)['__ngPointQueue'];

    const second = new NgPointQueue(6);
    expect(second.entries().map((e) => e.id)).toEqual(['a']);
  });

  it('ignores corrupted sessionStorage instead of crashing', () => {
    globalThis.sessionStorage?.setItem('ng-point.queue.v1', 'not json at all');
    const queue = new NgPointQueue(6);
    expect(queue.entries()).toEqual([]);
  });

  it('remove() drops one entry and persists the change', () => {
    const queue = new NgPointQueue(6);
    queue.addMany([entry('a'), entry('b')]);
    queue.remove('a');
    expect(queue.entries().map((e) => e.id)).toEqual(['b']);

    const after = new NgPointQueue(6);
    expect(after.entries().map((e) => e.id)).toEqual(['b']);
  });

  it('clear() empties memory, window cache and sessionStorage', () => {
    const queue = new NgPointQueue(6);
    queue.addMany([entry('a')]);
    queue.clear();

    expect(queue.entries()).toEqual([]);
    expect((globalThis as Record<string, unknown>)['__ngPointQueue']).toEqual([]);
    expect(globalThis.sessionStorage?.getItem('ng-point.queue.v1')).toBe('[]');
  });

  it('clears only on explicit action — addMany never auto-trims below the cap', () => {
    const queue = new NgPointQueue(6);
    queue.addMany([entry('a')]);
    queue.addMany([entry('b')]);
    expect(queue.entries().length).toBe(2);
  });
});

describe('getSharedQueue', () => {
  it('returns the same instance across calls (module-level singleton)', () => {
    const a = getSharedQueue(6);
    const b = getSharedQueue(6);
    expect(a).toBe(b);
    a.addMany([entry('x')]);
    expect(b.entries().map((e) => e.id)).toEqual(['x']);
  });
});
