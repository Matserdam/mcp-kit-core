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
  - Call a tool: `{ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "demo.echo", "params": { "msg": "hi" } } }`
