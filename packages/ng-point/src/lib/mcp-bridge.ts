import type { NgPointQueueEntry } from './types';

export interface McpBridgeOptions {
  endpoint: string;
  token?: string;
}

function headers(token?: string): Record<string, string> {
  const base: Record<string, string> = { 'content-type': 'application/json' };
  if (token) {
    base['authorization'] = `Bearer ${token}`;
  }
  return base;
}

/**
 * Best-effort push of committed contexts to the local ng-point-mcp ingest
 * (http://127.0.0.1:7317). Fire-and-forget: the MCP server is optional and
 * the clipboard remains the primary path; failures are swallowed.
 */
export async function postEntries(
  options: McpBridgeOptions,
  entries: NgPointQueueEntry[],
): Promise<boolean> {
  if (!entries.length) {
    return true;
  }
  try {
    const res = await fetch(`${options.endpoint}/ingest`, {
      method: 'POST',
      headers: headers(options.token),
      body: JSON.stringify({ entries }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Best-effort removal of one entry from the MCP mirror (per-entry ✕). */
export async function deleteEntry(options: McpBridgeOptions, id: string): Promise<boolean> {
  try {
    const res = await fetch(`${options.endpoint}/ingest/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(options.token),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Best-effort clear of the whole MCP mirror (overlay "Clear all"). */
export async function clearAllEntries(options: McpBridgeOptions): Promise<boolean> {
  try {
    const res = await fetch(`${options.endpoint}/ingest`, {
      method: 'DELETE',
      headers: headers(options.token),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fast health probe used for the "MCP up/down" status chip. */
export async function checkHealth(options: McpBridgeOptions, timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${options.endpoint}/health`, {
        method: 'GET',
        headers: headers(options.token),
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
