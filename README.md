# @mcp-kit/core

Lightweight TypeScript Model Context Protocol (MCP) server package.

## Quickstart (fetch-only)

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
  fetch: (req) => {
    const url = new URL(req.url);
    if (url.pathname === '/mcp' && req.method === 'POST') {
      return server.fetch(req);
    }
    return new Response('OK');
  },
});
```

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
