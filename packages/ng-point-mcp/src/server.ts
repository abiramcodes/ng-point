#!/usr/bin/env node
/**
 * ng-point-mcp — local MCP server for ng-point.
 *
 * Runs two things in one process:
 * 1. A stdio MCP server (this is what Claude Code / Cursor / VS Code connect to)
 *    with two tools:
 *      - get_recent_contexts:   returns the recent selection contexts
 *      - clear_recent_contexts: clears the server-side mirror
 * 2. A localhost-only HTTP ingest (default http://127.0.0.1:7317) that the
 *    ng-point overlay pushes committed contexts to (fire-and-forget).
 *
 * All logs go to stderr — stdout carries the MCP protocol and must stay clean.
 */
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createQueueStore, type NgPointQueueEntry, type QueueStore } from './store.js';
import { startIngestServer } from './http.js';

const DEFAULT_PORT = 7317;

export function createMcpServer(store: QueueStore, version = '0.0.1'): McpServer {
  const server = new McpServer({ name: 'ng-point-mcp', version });

  server.registerTool(
    'get_recent_contexts',
    {
      title: 'Get recent ng-point contexts',
      description:
        'Returns the most recent element contexts captured by ng-point in the running dev app. ' +
        'Each entry has the component name, file:line, optional template file:line, cleaned element HTML, ' +
        'directives, parent component, the optional developer instruction, and the ready-to-use ' +
        '"context block" string exactly as it was copied. Returns an empty array when nothing has ' +
        'been captured yet.',
      inputSchema: {},
    },
    async () => {
      const contexts = store.list();
      const payload =
        contexts.length === 0
          ? {
              contexts: [] as NgPointQueueEntry[],
              message:
                'No recent contexts yet. In the running app, Alt+Click an element and press Enter to capture one.',
            }
          : { contexts };
      return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.registerTool(
    'clear_recent_contexts',
    {
      title: 'Clear recent ng-point contexts',
      description:
        'Clears the server-side mirror of recent ng-point contexts (idempotent). ' +
        'The browser session keeps its own queue; use the overlay "Clear all" button to clear that side.',
      inputSchema: {},
    },
    async () => {
      const cleared = store.list().length;
      store.clear();
      return { content: [{ type: 'text', text: `Cleared ${cleared} recent context(s).` }] };
    },
  );

  return server;
}

interface CliOptions {
  help: boolean;
  port: number | undefined;
  token: string | undefined;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { help: false, port: undefined, token: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--port' || arg === '-p') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 0 || value > 65535) {
        throw new Error(`Invalid port: ${argv[i]}`);
      }
      options.port = value;
    } else if (arg === '--token' || arg === '-t') {
      options.token = argv[++i];
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

const USAGE = `ng-point-mcp — local MCP server for ng-point

Usage:
  npx ng-point-mcp [--port 7317] [--token <secret>]

Environment:
  NG_POINT_MCP_PORT  overrides the default port (7317)

Ingest endpoints (localhost only):
  GET    /health        liveness + queue count
  POST   /ingest        add entries: {"entries":[...]} (cap 6, FIFO)
  DELETE /ingest/<id>   remove one entry
  DELETE /ingest        clear the mirror

MCP tools:
  get_recent_contexts    returns the recent contexts (empty array when none)
  clear_recent_contexts clears the mirror (idempotent)`;

export async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  if (options.help) {
    console.error(USAGE);
    return;
  }

  const envPort = Number(process.env['NG_POINT_MCP_PORT'] ?? '');
  const port = options.port ?? (Number.isInteger(envPort) && envPort > 0 ? envPort : DEFAULT_PORT);

  const store = createQueueStore(6);
  const ingest = await startIngestServer(store, { port, token: options.token });
  console.error(`[ng-point-mcp] ingest listening on http://127.0.0.1:${ingest.port}`);
  if (options.token) {
    console.error('[ng-point-mcp] token protection enabled');
  }

  const mcp = createMcpServer(store);
  await mcp.connect(new StdioServerTransport());
  console.error('[ng-point-mcp] MCP server ready on stdio (tools: get_recent_contexts, clear_recent_contexts)');

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    void ingest.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const isDirectRun =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  void main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
