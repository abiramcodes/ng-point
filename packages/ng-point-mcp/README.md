# ng-point-mcp

Local MCP server for [ng-point](https://github.com/abiramcodes/ng-point) — exposes the recent UI selection contexts captured in your running Angular dev app to AI coding agents.

One process, two roles:

1. **stdio MCP server** (what Claude Code / Cursor / VS Code connect to) with exactly two tools:
   - `get_recent_contexts` — returns the recent queue (array of context + instruction entries). Empty queue → `{"contexts":[]}` plus a hint message.
   - `clear_recent_contexts` — clears the server-side mirror (idempotent).
2. **Localhost-only HTTP ingest** (default `http://127.0.0.1:7317`) the ng-point overlay pushes committed contexts to — fire-and-forget; the clipboard remains the primary path.

**Pull-based only.** The server never contacts any agent session; agents call the tools when they need context. The browser pushes nothing unless the user presses Enter in the overlay.

## Install & run

```bash
npx ng-point-mcp
# options: --port 7317 (or NG_POINT_MCP_PORT env) and --token <secret>
```

Logs go to stderr (stdout carries the MCP protocol). Stop with Ctrl-C.

## Entry shape

Each entry in `get_recent_contexts`:

```jsonc
{
  "id": "np-lxyz-0",
  "capturedAt": "2026-11-18T14:55:41.297Z",
  "component": "SubmitButtonComponent",
  "file": "src/app/submit-button/submit-button.component.ts:42",
  "template": "src/app/submit-button/submit-button.component.html:7",
  "element": "<button class=\"submit-btn\">Save</button>",
  "directives": ["RouterLink", "NgClass"],
  "parent": "FormComponent (src/app/form/form.component.ts:18)",
  "instruction": "make this disabled when form is invalid",
  "block": "Component: SubmitButtonComponent\nFile: …\n…"
}
```

`block` is the exact, user-reviewed context block that was copied to the clipboard — ready to paste into a prompt. Entries are **already redacted client-side** before they ever reach this process.

## Tool reference

### `get_recent_contexts`

Returns `{ contexts: [...] }` (max 6, newest last). When empty:

```json
{
  "contexts": [],
  "message": "No recent contexts yet. In the running app, Alt+Click an element and press Enter to capture one."
}
```

### `clear_recent_contexts`

Clears the **server-side mirror** and reports the count. Idempotent. The browser keeps its own queue — use the overlay's "Clear all" button for that side (the overlay's per-entry ✕ and "Clear all" also delete from this mirror on a best-effort basis).

## HTTP ingest (localhost only)

| Endpoint | Effect |
| --- | --- |
| `GET /health` | `{ ok: true, count }` |
| `POST /ingest` | Add one entry or `{ "entries": [...] }` (cap 6, FIFO) |
| `DELETE /ingest/:id` | Remove one entry (404 when missing) |
| `DELETE /ingest` | Clear the mirror |

- Binds to **127.0.0.1 only** — never reachable from other machines.
- CORS is granted only to `localhost`/`127.0.0.1` origins.
- With `--token`, requests must carry `Authorization: Bearer <token>`. Default is tokenless: the loopback bind plus client-side redaction is the security model; add a token when other local users/processes are a concern.

## Agent configuration

### Claude Code

```bash
claude mcp add ng-point -- npx ng-point-mcp
```

or in `.mcp.json` (project) / `~/.claude.json` (user):

```json
{
  "mcpServers": {
    "ng-point": {
      "command": "npx",
      "args": ["ng-point-mcp"]
    }
  }
}
```

### Cursor

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "ng-point": {
      "command": "npx",
      "args": ["ng-point-mcp"]
    }
  }
}
```

### VS Code

`.vscode/mcp.json`:

```json
{
  "servers": {
    "ng-point": {
      "command": "npx",
      "args": ["ng-point-mcp"]
    }
  }
}
```

### Gemini CLI

`.gemini/settings.json`:

```json
{
  "mcpServers": {
    "ng-point": {
      "command": "npx",
      "args": ["ng-point-mcp"]
    }
  }
}
```

### Typical agent flow

1. You Alt+Click an element in the dev app, type "make this disabled when form is invalid", press Enter (context lands on your clipboard *and* in the server mirror).
2. The agent calls `get_recent_contexts` and gets the ready-made block with accurate `file:line`.
3. Repeat for several elements (the queue holds the last 6).
4. Done? The agent calls `clear_recent_contexts`, or you clear from the overlay.

## Local development

```bash
pnpm --filter ng-point-mcp run build
pnpm --filter ng-point-mcp run test     # single-run vitest with coverage
```
