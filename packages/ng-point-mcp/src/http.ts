import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { NgPointQueueEntry, QueueStore } from './store.js';

export interface IngestServerOptions {
  /** Bind host. Defaults to `127.0.0.1` — the ingest is loopback-only on purpose. */
  host?: string;
  /** Defaults to 7317. Use port 0 for an ephemeral port (tests). */
  port?: number;
  /** Optional bearer token (`--token`). When set, requests must carry it. */
  token?: string;
  /** Max request body size. Defaults to 256 KiB. */
  maxBodyBytes?: number;
}

export interface IngestServer {
  server: Server;
  port: number;
  close(): Promise<void>;
}

const DEFAULT_PORT = 7317;
const MAX_BODY_BYTES = 256 * 1024;

const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && LOCAL_ORIGIN.test(origin)) {
    return { 'access-control-allow-origin': origin, vary: 'origin' };
  }
  return { vary: 'origin' };
}

function json(res: ServerResponse, status: number, body: unknown, cors: Record<string, string>): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...cors,
  });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage, token: string | undefined): boolean {
  if (!token) {
    return true;
  }
  const header = req.headers.authorization;
  return header === `Bearer ${token}`;
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseIngestPayload(raw: string): NgPointQueueEntry[] {
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed as NgPointQueueEntry[];
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const entries = (parsed as { entries?: unknown }).entries;
    if (Array.isArray(entries)) {
      return entries as NgPointQueueEntry[];
    }
    return [parsed as NgPointQueueEntry];
  }
  throw new Error('invalid payload');
}

/**
 * Localhost-only HTTP ingest for the ng-point overlay:
 * - `GET  /health`        → `{ ok: true, count }`
 * - `POST /ingest`        → add one entry or `{ entries: [...] }` (cap 6, FIFO)
 * - `DELETE /ingest/:id`  → remove one entry
 * - `DELETE /ingest`      → clear all
 *
 * CORS is only ever granted to localhost origins. The queue is a mirror: the
 * clipboard in the browser remains the primary path.
 */
export function startIngestServer(
  store: QueueStore,
  options: IngestServerOptions = {},
): Promise<IngestServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? DEFAULT_PORT;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.writableEnded) {
        json(res, 500, { ok: false, error: 'internal error' }, corsHeaders(req));
      }
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const cors = corsHeaders(req);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors,
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
      });
      res.end();
      return;
    }

    if (!isAuthorized(req, options.token)) {
      json(res, 401, { ok: false, error: 'unauthorized' }, cors);
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname;

    if (req.method === 'GET' && path === '/health') {
      json(res, 200, { ok: true, count: store.list().length }, cors);
      return;
    }

    if (req.method === 'POST' && path === '/ingest') {
      let entries: NgPointQueueEntry[];
      try {
        const body = await readBody(req, maxBodyBytes);
        entries = parseIngestPayload(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bad request';
        const status = message === 'payload too large' ? 413 : 400;
        json(res, status, { ok: false, error: message }, cors);
        return;
      }
      store.add(entries);
      json(res, 200, { ok: true, count: store.list().length }, cors);
      return;
    }

    if (req.method === 'DELETE' && path === '/ingest') {
      const cleared = store.list().length;
      store.clear();
      json(res, 200, { ok: true, cleared }, cors);
      return;
    }

    const single = req.method === 'DELETE' ? /^\/ingest\/([^/]+)$/.exec(path) : null;
    if (single) {
      const id = decodeURIComponent(single[1]!);
      const removed = store.remove(id);
      json(res, removed ? 200 : 404, { ok: removed, removed }, cors);
      return;
    }

    json(res, 404, { ok: false, error: 'not found' }, cors);
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({
        server,
        port: actualPort,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) =>
            server.close((error) => (error ? rejectClose(error) : resolveClose())),
          ),
      });
    });
  });
}
