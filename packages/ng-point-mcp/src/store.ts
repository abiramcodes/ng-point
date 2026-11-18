/** One recent selection context, as pushed by the ng-point overlay. */
export interface NgPointQueueEntry {
  id: string;
  /** ISO 8601 timestamp. */
  capturedAt: string;
  component: string;
  file: string;
  template?: string;
  element: string;
  directives: string[];
  parent?: string;
  instruction: string;
  /** The final, user-reviewed context block exactly as it was copied. */
  block: string;
}

export interface QueueStore {
  add(entries: NgPointQueueEntry[]): void;
  remove(id: string): boolean;
  clear(): void;
  list(): readonly NgPointQueueEntry[];
}

function isEntry(value: unknown): value is NgPointQueueEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NgPointQueueEntry).id === 'string' &&
    typeof (value as NgPointQueueEntry).block === 'string'
  );
}

function capFifo(entries: NgPointQueueEntry[], max: number): NgPointQueueEntry[] {
  return entries.length > max ? entries.slice(entries.length - max) : entries;
}

/**
 * In-memory mirror of the browser's recent-selections queue (max 6, FIFO).
 * Entries arrive via the localhost-only HTTP ingest and are served to AI
 * agents through the MCP tools. Entries are already redacted client-side
 * before they ever reach this process.
 */
export function createQueueStore(maxEntries = 6): QueueStore {
  let entries: NgPointQueueEntry[] = [];
  return {
    add(list) {
      const valid = list.filter(isEntry);
      if (valid.length === 0) {
        return;
      }
      entries = capFifo([...entries, ...valid], maxEntries);
    },
    remove(id) {
      const before = entries.length;
      entries = entries.filter((entry) => entry.id !== id);
      return entries.length !== before;
    },
    clear() {
      entries = [];
    },
    list() {
      return entries.slice();
    },
  };
}
