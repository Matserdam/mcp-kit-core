# @mcp-kit/core

![MCP Kit Logo](./assets/mcpkit.core.png)

Lightweight, production-ready MCP server toolkit for modern runtimes. Build tools, prompts, and resources once — run anywhere (Deno, Bun, Node via HTTP fetch).

## Why this kit

- Simple: one server, one `fetch` handler
- Portable: edge-first, Node-free public API for JSR
- Batteries included: tools, prompts, resources (with templates)

## Model Context Protocol coverage

The table below summarizes which parts of the official MCP spec (2025-06-18) this kit implements.

| Area | Side | Status | Notes |
| --- | --- | --- | --- |
| JSON-RPC 2.0 envelope | Server | ✅ Implemented | Requests/responses validated; parse errors return -32700; notifications acknowledged with 202 over HTTP |
| initialize | Server | ✅ Implemented | Returns `protocolVersion`, `serverInfo`, and capabilities; supports protocol version strategy "ours"/"mirror" |
| ping | Server | ✅ Implemented | Returns empty result `{}`; supports JSON and SSE single-frame responses |
| Tools: tools/list | Server | ✅ Implemented | Namespaced tool names; includes canonical `search` and `fetch` tools with schemas |
| Tools: tools/call | Server | ✅ Implemented | Zod-based validation; structured `content` blocks (text, image, audio, resource_link, resource) |
| Prompts: prompts/list | Server | ✅ Implemented | Namespaced prompts with `arguments` metadata |
| Prompts: prompts/get | Server | ✅ Implemented | Returns array of messages; toolkit auth enforced when configured |
| Resources: resources/list | Server | ✅ Implemented | Lists providers from registered toolkits |
| Resources: resources/read | Server | ✅ Implemented | Reads via provider or template; returns `contents[]`; 404-style error code -32002 when missing |
| Resources: resources/templates/list | Server | ✅ Implemented | Lists template descriptors (uriTemplate, name, title, mimeType) |
| Canonical tools: search | Server | ✅ Implemented | Filters providers/templates by query/site/topK; returns text summary + resource_link items |
| Canonical tools: fetch | Server | ✅ Implemented | Resolves provider/template to concrete `resource` content |
| HTTP transport (fetch) | Server | ✅ Implemented | Content negotiation for JSON and `text/event-stream` (single-frame SSE) |
| STDIO transport | Server | ✅ Implemented | NDJSON framing, backpressure-aware; public controller with `start`, `stop`, `notify` |
| Auth (HTTP OAuth 2.1) | Server | ✅ Implemented | Toolkit-level middleware hooks; 401 responses include `WWW-Authenticate` and discovery hints |
| Auth (STDIO env) | Server | ✅ Implemented | Middleware extracts env credentials for CLI/desktop |
| OAuth 2.1 discovery | Server | ✅ Implemented | Serves `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` with CORS |
| Event sink/observability | Server | ✅ Implemented | Emits rpc/tools/resources/prompts lifecycle events; in-memory and console sinks provided |
| Streaming tool outputs | Server | ⬜️ Not yet | SSE currently sends a single frame per request; no multi-event tool streaming yet |
| Search/list roots | Client | ⬜️ Not yet | `roots/*` endpoints are client features |
| Messages API | Client | ⬜️ Not yet | `messages/*` endpoints are client features |
| Sampling / model / session | Client | ⬜️ Not yet | `sampling/*`, model and session are client features |


## Install

Deno (JSR):

```ts
import { MCPServer } from "jsr:@mcp-kit/core";
```

Bun / Node (via JSR):

```bash
npx jsr add @mcp-kit/core
```

```ts
import { MCPServer } from "@mcp-kit/core";
```

## Quick start (Tools + HTTP fetch)

Deno:

```ts
import { MCPServer, type MCPToolkit } from "jsr:@mcp-kit/core";
import z from "zod";

const helloInputSchema = z.object({ name: z.string().min(1) });
const helloOutputSchema = z.object({ message: z.string() });

const helloToolkit: MCPToolkit = {
  namespace: "hello",
  tools: [
    {
      name: "hello_say",
      description: "Say hello to a name",
      input: { zod: helloInputSchema },
      output: { zod: helloOutputSchema },
      execute: async ({ name }) => ({
        content: [{ type: "text", text: `Hello, ${name}!` }],
        structuredContent: { message: `Hello, ${name}!` },
      }),
    },
  ],
};

const server = new MCPServer({ toolkits: [helloToolkit] });
Deno.serve((req) => server.fetch(req));
```

Bun:

```ts
import { MCPServer, type MCPToolkit } from "@mcp-kit/core";
import z from "zod";

const helloInputSchema = z.object({ name: z.string().min(1) });
const helloOutputSchema = z.object({ message: z.string() });

const helloToolkit: MCPToolkit = {
  namespace: "hello",
  tools: [
    {
      name: "hello_say",
      description: "Say hello to a name",
      input: { zod: helloInputSchema },
      output: { zod: helloOutputSchema },
      execute: async ({ name }) => ({
        content: [{ type: "text", text: `Hello, ${name}!` }],
        structuredContent: { message: `Hello, ${name}!` },
      }),
    },
  ],
};

const server = new MCPServer({ toolkits: [helloToolkit] });
Bun.serve({ port: 8000, fetch: (req) => server.fetch(req) });
```

Test with curl:

```bash
curl -s -X POST http://localhost:8000 \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0", "id":1, "method":"tools/call",
    "params": { "name":"hello_say", "arguments": { "name":"Ada" } }
  }'
```

## Add a Prompt (optional)

```ts
import { MCPServer, type MCPToolkit } from "jsr:@mcp-kit/core";

const promptsToolkit: MCPToolkit = {
  namespace: "prompts",
  prompts: [
    {
      name: "greeter",
      title: "Greeter system prompt",
      messages: [
        { role: "system", content: { type: "text", text: "You are a concise assistant." } },
      ],
    },
  ],
};

const server = new MCPServer({ toolkits: [promptsToolkit] });
Deno.serve((req) => server.fetch(req));
```

## Add Resource Templates (optional)

```ts
import { createMCPResourceTemplateProvider, MCPServer, type MCPToolkit } from "jsr:@mcp-kit/core";

const templates = createMCPResourceTemplateProvider({
  // task://{id} → render a single task
  templateId: "task",
  uriTemplate: "task://{id}",
  provide: async ({ id }) => ({
    contents: [{
      uri: `task://${id}`,
      name: `Task ${id}`,
      mimeType: "application/json",
      text: JSON.stringify({ id, title: `Task ${id}` }),
    }],
  }),
});

const resourcesToolkit: MCPToolkit = {
  namespace: "resources",
  resourceTemplates: [templates],
};

const server = new MCPServer({ toolkits: [resourcesToolkit] });
Deno.serve((req) => server.fetch(req));
```

## Runtime notes

- Edge-first: JSR export uses the edge/Deno entry. Use HTTP fetch; STDIO is Node-only.
- Import paths: use explicit `.ts` in your own code for Deno projects.

## License

MIT

---

<p align="center">
  <img src="./assets/mcpkit.core.png" alt="MCP Kit Logo" width="140"/>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./assets/matserdam_avatar.png" alt="Matserdam Logo" width="140"/>
  <br/>
</p>

