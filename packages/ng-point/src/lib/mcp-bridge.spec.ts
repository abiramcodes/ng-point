import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkHealth, clearAllEntries, deleteEntry, postEntries } from './mcp-bridge';
import type { NgPointQueueEntry } from './types';

const options = { endpoint: 'http://127.0.0.1:7317' };
const entry: NgPointQueueEntry = {
  id: 'np-1',
  capturedAt: new Date(0).toISOString(),
  component: 'SubmitButtonComponent',
  file: 'src/app/submit-button.component.ts:42',
  element: '<button class="submit-btn">Save</button>',
  directives: ['RouterLink'],
  instruction: 'make this disabled',
  block: 'Component: SubmitButtonComponent\n…',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postEntries', () => {
  it('POSTs entries as { entries: [...] } fire-and-forget', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    expect(await postEntries(options, [entry])).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:7317/ingest');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ entries: [entry] });
  });

  it('swallows network failures (the clipboard stays the primary path)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    expect(await postEntries(options, [entry])).toBe(false);
  });

  it('sends the bearer token when configured', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await postEntries({ ...options, token: 'sekrit' }, [entry]);
    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer sekrit');
  });
});

describe('deleteEntry', () => {
  it('DELETEs by URL-encoded id', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await deleteEntry(options, 'np 1/2');
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:7317/ingest/np%201%2F2');
    expect(init.method).toBe('DELETE');
  });
});

describe('clearAllEntries', () => {
  it('DELETEs the ingest root', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    expect(await clearAllEntries(options)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:7317/ingest');
    expect(init.method).toBe('DELETE');
  });
});

describe('checkHealth', () => {
  it('reports a reachable MCP server', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as unknown as Response));
    expect(await checkHealth(options)).toBe(true);
  });

  it('reports a missing MCP server without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    expect(await checkHealth(options)).toBe(false);
  });
});
