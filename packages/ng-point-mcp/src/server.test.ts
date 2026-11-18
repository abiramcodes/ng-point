import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import { createQueueStore, type NgPointQueueEntry } from './store.js';
import { startIngestServer, type IngestServer } from './http.js';

function entry(id: string, overrides: Partial<NgPointQueueEntry> = {}): NgPointQueueEntry {
  return {
    id,
    capturedAt: new Date(0).toISOString(),
    component: 'SubmitButtonComponent',
    file: 'src/app/submit-button/submit-button.component.ts:42',
    element: '<button class="submit-btn">Save</button>',
    directives: ['RouterLink'],
    instruction: 'make this disabled when form is invalid',
    block: `Component: SubmitButtonComponent\nFile: src/app/submit-button/submit-button.component.ts:42\nElement: <button class="submit-btn">Save</button>\nDirectives: RouterLink\nInstruction: make this disabled when form is invalid`,
    ...overrides,
  };
}

describe('createQueueStore', () => {
  it('appends entries and lists them in order', () => {
    const store = createQueueStore(6);
    store.add([entry('1'), entry('2')]);
    expect(store.list().map((e) => e.id)).toEqual(['1', '2']);
  });

  it('caps at 6 entries, evicting the oldest (FIFO)', () => {
    const store = createQueueStore(6);
    store.add([1, 2, 3, 4, 5, 6, 7].map((n) => entry(String(n))));
    expect(store.list().map((e) => e.id)).toEqual(['2', '3', '4', '5', '6', '7']);
  });

  it('drops payloads that are not valid entries', () => {
    const store = createQueueStore(6);
    store.add([{ garbage: true } as unknown as NgPointQueueEntry, entry('ok')]);
    expect(store.list().map((e) => e.id)).toEqual(['ok']);
  });

  it('removes by id and reports whether it existed', () => {
    const store = createQueueStore(6);
    store.add([entry('a')]);
    expect(store.remove('a')).toBe(true);
    expect(store.remove('a')).toBe(false);
    expect(store.list()).toEqual([]);
  });

  it('clear is idempotent', () => {
    const store = createQueueStore(6);
    store.add([entry('a')]);
    store.clear();
    store.clear();
    expect(store.list()).toEqual([]);
  });
});

describe('ingest HTTP server', () => {
  let ingest: IngestServer;
  let baseUrl: string;

  beforeEach(async () => {
    ingest = await startIngestServer(createQueueStore(6), { port: 0 });
    baseUrl = `http://127.0.0.1:${ingest.port}`;
  });

  afterEach(async () => {
    await ingest.close();
  });

  it('GET /health returns ok and the queue count', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, count: 0 });
  });

  it('POST /ingest accepts a single entry object', async () => {
    const res = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry('single')),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; count: number };
    expect(body).toEqual({ ok: true, count: 1 });

    const health = (await (await fetch(`${baseUrl}/health`)).json()) as { count: number };
    expect(health.count).toBe(1);
  });

  it('POST /ingest accepts { entries: [...] } batches and caps at 6', async () => {
    const res = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry(String(n))) }),
    });
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(6);
  });

  it('POST /ingest rejects malformed JSON with 400', async () => {
    const res = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /ingest/:id removes the entry, 404 when missing', async () => {
    await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries: [entry('gone')] }),
    });
    const ok = await fetch(`${baseUrl}/ingest/gone`, { method: 'DELETE' });
    expect(ok.status).toBe(200);
    const missing = await fetch(`${baseUrl}/ingest/gone`, { method: 'DELETE' });
    expect(missing.status).toBe(404);
  });

  it('DELETE /ingest clears the whole mirror', async () => {
    await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries: [entry('1'), entry('2')] }),
    });
    const res = await fetch(`${baseUrl}/ingest`, { method: 'DELETE' });
    const body = (await res.json()) as { ok: boolean; cleared: number };
    expect(body).toEqual({ ok: true, cleared: 2 });
    expect(((await (await fetch(`${baseUrl}/health`)).json()) as { count: number }).count).toBe(0);
  });

  it('echoes CORS headers for localhost origins only', async () => {
    const allowed = await fetch(`${baseUrl}/health`, {
      headers: { origin: 'http://localhost:4200' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:4200');

    const denied = await fetch(`${baseUrl}/health`, {
      headers: { origin: 'http://evil.example.com' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers CORS preflight with the allowed methods', async () => {
    const res = await fetch(`${baseUrl}/health`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('DELETE');
  });

  it('returns 404 for unknown paths', async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });
});

describe('ingest HTTP server with --token', () => {
  let ingest: IngestServer;
  let baseUrl: string;

  beforeEach(async () => {
    ingest = await startIngestServer(createQueueStore(6), { port: 0, token: 'sekrit' });
    baseUrl = `http://127.0.0.1:${ingest.port}`;
  });

  afterEach(async () => {
    await ingest.close();
  });

  it('rejects requests without the bearer token', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(401);
  });

  it('accepts requests with the bearer token', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { authorization: 'Bearer sekrit' },
    });
    expect(res.status).toBe(200);
  });
});

describe('MCP tools', () => {
  async function connectClient(store = createQueueStore(6)) {
    const server = createMcpServer(store);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
    return { client, server };
  }

  it('get_recent_contexts returns an explicit empty result when the queue is empty', async () => {
    const { client, server } = await connectClient();
    try {
      const result = await client.callTool({ name: 'get_recent_contexts', arguments: {} });
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
      const payload = JSON.parse(text) as { contexts: unknown[]; message?: string };
      expect(payload.contexts).toEqual([]);
      expect(payload.message).toContain('No recent contexts yet');
    } finally {
      await server.close();
    }
  });

  it('get_recent_contexts returns the queued entries with full blocks', async () => {
    const store = createQueueStore(6);
    store.add([entry('1'), entry('2', { component: 'FormComponent', id: '2' })]);
    const { client, server } = await connectClient(store);
    try {
      const result = await client.callTool({ name: 'get_recent_contexts', arguments: {} });
      const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
      const payload = JSON.parse(text) as {
        contexts: Array<{
          id: string;
          component: string;
          file: string;
          element: string;
          block: string;
          instruction: string;
        }>;
      };
      expect(payload.contexts.map((c) => c.id)).toEqual(['1', '2']);
      expect(payload.contexts[0]!.block).toContain('Component: SubmitButtonComponent');
      expect(payload.contexts[0]!.block).toContain(
        'File: src/app/submit-button/submit-button.component.ts:42',
      );
      expect(payload.contexts[1]!.component).toBe('FormComponent');
    } finally {
      await server.close();
    }
  });

  it('clear_recent_contexts clears the store and is idempotent', async () => {
    const store = createQueueStore(6);
    store.add([entry('1'), entry('2')]);
    const { client, server } = await connectClient(store);
    try {
      const first = await client.callTool({ name: 'clear_recent_contexts', arguments: {} });
      const text = (first.content as Array<{ type: string; text: string }>)[0]!.text;
      expect(text).toContain('Cleared 2 recent context(s)');

      const second = await client.callTool({ name: 'clear_recent_contexts', arguments: {} });
      const secondText = (second.content as Array<{ type: string; text: string }>)[0]!.text;
      expect(secondText).toContain('Cleared 0 recent context(s)');

      expect(store.list()).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it('lists both tools for MCP clients', async () => {
    const { client, server } = await connectClient();
    try {
      const response = await client.listTools();
      const names = response.tools.map((tool) => tool.name).sort();
      expect(names).toEqual(['clear_recent_contexts', 'get_recent_contexts']);
    } finally {
      await server.close();
    }
  });
});
