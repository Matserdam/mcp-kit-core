# @mcp-kit/core

Lightweight TypeScript Model Context Protocol (MCP) server package.

## Quickstart (HTTP fetch)

Expose an HTTP endpoint that accepts JSON-RPC 2.0 and routes MCP methods:

```ts
import { MCPServer } from '@mcp-kit/core';

const server = new MCPServer({
  toolkits: [
    {
      namespace: 'demo',
      tools: [
        { name: 'echo', async run(input) { return { echoed: input }; } },
      ],
    },
  ],
});

Bun.serve({
  port: 3000,
  fetch: server.fetch
});
```

### Streamable HTTP (Accept negotiation)

The `fetch` handler implements basic Streamable HTTP behavior:
- When `Accept: text/event-stream`, the server responds with a single SSE `data:` frame containing the JSON-RPC response, then closes the stream.
- When `Accept: application/json` (or omitted), the server responds with a JSON body.
- JSON-RPC notifications (no `id` in the body) and client-sent responses are acknowledged with HTTP `202 Accepted`.
- Parse/validation errors return HTTP `400` with a JSON-RPC error payload.

## STDIO transport

Run the server over stdio for MCP clients (recommended by the spec for LLM clients). Example server:

```ts
import { MCPServer } from '@mcp-kit/core';
import type { MCPStdioOptions } from '@mcp-kit/core';

const server = new MCPServer({ toolkits });
const controller = server.startStdio({ enableSignalHandlers: true } as MCPStdioOptions);
// controller.stop(); controller.notify('resources/updated', { uri: 'file://...' })
```

Test locally with MCP Inspector:

```bash
bunx @modelcontextprotocol/inspector
```

Then add a server → choose stdio and target your running process.

## Using MCP Inspector

You can explore and test your MCP server with the MCP Inspector.

- Using npx:

```bash
npx @modelcontextprotocol/inspector
```

- Using bunx:

```bash
bunx @modelcontextprotocol/inspector
```

Then in the Inspector UI:
- Choose to add a server
- Select HTTP and set the URL to your endpoint (e.g., `http://localhost:3000/mcp`)
- Send the following JSON-RPC requests to verify:
  - Initialize: `{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }`
  - List tools: `{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }`
  - Call a tool: `{ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "demo_echo", "params": { "msg": "hi" } } }`

### Ping utility (JSON-RPC)

Per MCP spec (2025-06-18), `ping` is a JSON-RPC request with no params and an empty result object.

Example (HTTP JSON):

```json
{ "jsonrpc": "2.0", "id": 1, "method": "ping" }
```

Response:

```json
{ "jsonrpc": "2.0", "id": 1, "result": {} }
```

Notes:
- Works over HTTP JSON and SSE. With `Accept: text/event-stream`, the server returns a single `data:` frame containing the same JSON.
- Also works over stdio: send a single NDJSON line with the same payload and read one response line with `result: {}`.

## Canonical tools: search and fetch

The server exposes two canonical tools without a namespace:
- `search`: traverses toolkit resources and resource templates and returns a text summary + `resource_link` items.
- `fetch`: resolves a URI via toolkit resources/templates when possible and returns in-band `resource` content; otherwise falls back to a `resource_link`.

### search (Story-033)

Input schema (Zod):

```ts
{
  query: string;             // required
  topK?: number;             // optional, max 100
  site?: string;             // optional, host filter substring
  timeRange?: 'day'|'week'|'month'|'year'; // optional
}
```

Behavior:
- Traverses all toolkits' `resources` and `resourceTemplates`.
- Matches items if `query` appears in `name`/`title`/`description`/`uri`.
- If `site` is provided, also requires the host to include `site`.
- Limits to `topK` resource links when provided.
- Returns:
  - A `text` item summarizing counts and top matches
  - One `resource_link` per matched resource (up to `topK`)
  - Optional `structuredContent` with `{ results: [{ title, url, snippet? }], templates, total }`

Example call:

```json
{ "jsonrpc":"2.0", "id": 10, "method":"tools/call", "params": { "name": "search", "arguments": { "query": "readme", "site": "githubusercontent", "topK": 3 } } }
```

### fetch (Story-034)

Input schema (Zod):

```ts
{
  id: string;    // required; used as name, and as URI if it looks like a URL
  uri?: string;  // optional explicit URI to fetch/resolve
}
```

Resolution order:
1) Exact match against toolkit `resources` by `uri` (provider wins if present), convert first returned content to a `resource` item.
2) If no provider matched, match against toolkit `resourceTemplates` by `uriTemplate`, convert first returned content to a `resource` item.
3) If neither matched, fallback to an empty `content` array.

Notes:
- Resolution is awaited (async-safe) for both providers and templates.
- This same order applies to `resources/read` calls: providers are checked before templates.

Example calls:

```json
{ "jsonrpc":"2.0", "id": 11, "method":"tools/call", "params": { "name": "fetch", "arguments": { "id": "pikachu", "uri": "https://cdn.example.com/pikachu.png" } } }
```

Returns (typical):

```json
{ "jsonrpc":"2.0", "id": 11, "result": { "content": [ { "type":"resource", "resource": { "uri":"https://cdn.example.com/pikachu.png", "name":"pikachu" } } ] } }
```

### Tool name delimiter policy

- Tools are listed and called using underscore-delimited names: `namespace_tool`.
- Rationale: some MCP clients (e.g., Claude) expect regexes that disallow dots in tool names. Using underscores avoids compatibility issues.

### Resources (MVP)

Implements `resources/list` and `resources/read` per MCP spec (2025-06-18):
- `initialize` advertises `capabilities.resources = { listChanged: false }`.
- `resources/list` returns `{ resources: [] }` (no `nextCursor` when not paginating).
- `resources/read` accepts `{ uri }` and returns `{ contents: [] }` by default.

Types (SDK):

```ts
import type { ResourceUri, MCPResourceReadResult } from '@mcp-kit/core';

interface MCPResourceProvider<TContext = unknown> {
  uri: ResourceUri;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  read(context: TContext): Promise<MCPResourceReadResult> | MCPResourceReadResult;
}
```

### Resource Templates and uriTemplate placeholders

Server owns template matching. Define templates on the toolkit; the server resolves `{uri}`s against `uriTemplate`.

- Placeholder forms:
  - `{var}`: matches one path segment (no `/`). Example: `https://api.example.com/users/{id}`
  - `{*rest}`: matches the remainder. Example: `file:///{*path}`
- On match, the server calls `template.read(uri, context)` and includes extracted params on the context under `context.params`.

These templates are used by both `resources/read` and the canonical `search`/`fetch` tools.

For custom URI schemes and naming conventions, see [Custom URI Schemes](docs/uri-schemes.md).

Factories for convenience:

```ts
import { createMCPResourceProvider, createMCPResourceTemplateProvider } from '@mcp-kit/core';

const readme = createMCPResourceProvider({
  uri: 'file:///project/README.md',
  name: 'README.md',
  async read() { return { contents: [{ uri: 'file:///project/README.md', text: '# Project' }] }; },
});

const files = createMCPResourceTemplateProvider({
  descriptor: { uriTemplate: 'file:///{*path}', name: 'Project Files' },
  async read(uri, ctx) {
    const path = ctx.params?.path ?? '';
    return { contents: [{ uri, name: path.split('/').pop() ?? 'file', text: '' }] };
  },
});
```

## Documentation

- [API Reference](docs/api-reference.md) - Comprehensive API documentation
- [Custom URI Schemes](docs/uri-schemes.md) - URI scheme conventions and examples
- [Architecture Decision Records](docs/adr/) - System architecture documentation
