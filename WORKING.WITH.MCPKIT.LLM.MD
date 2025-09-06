## Working with MCP Kit (for LLM implementers)

This guide shows how an LLM can implement a complete API using MCP Kit. It covers HTTP and STDIO transports, tools, prompts, resources, authentication, discovery, and every available configuration.

### What MCP Kit provides
- JSON-RPC 2.0 server for MCP methods: `initialize`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get`, `resources/list`, `resources/read`, `resources/templates/list`, `ping`.
- HTTP transport (single `fetch` handler), with discovery endpoints per RFC 8414 and RFC 9728 when configured.
- STDIO transport (NDJSON) with backpressure handling and notifications.
- Pluggable Toolkits: define tools, prompts, resources, and resource templates.
- Optional per-toolkit authentication (HTTP OAuth 2.1-style or STDIO env-based).

---

## Quickstarts

### Minimal HTTP server
```ts
import { MCPServer, type MCPTool, type MCPToolCallResult } from '@mcp-kit/core';
import z from 'zod';

const echo: MCPTool<unknown, { text: string }> = {
  name: 'echo',
  description: 'Echo text',
  input: { zod: z.object({ text: z.string().min(1) }) },
  run: ({ text }) => ({ content: [{ type: 'text', text }] } satisfies MCPToolCallResult),
};

const server = new MCPServer({
  toolkits: [
    { namespace: 'demo', tools: [echo] }
  ],
});

(Bun as { serve: (c: { port: number; fetch: unknown }) => void }).serve({
  port: 3000,
  fetch: server.fetch,
});
```

Call with JSON:
```bash
curl -sS -X POST http://localhost:3000 \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"demo_echo","arguments":{"text":"hi"}}}'
```

### Minimal STDIO server
```ts
import { MCPServer, type MCPTool, type MCPToolCallResult } from '@mcp-kit/core';
import z from 'zod';

const sum: MCPTool<unknown, { a: number; b: number }> = {
  name: 'sum',
  description: 'a + b',
  input: { zod: z.object({ a: z.number(), b: z.number() }) },
  run: ({ a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] } satisfies MCPToolCallResult),
};

const server = new MCPServer({ toolkits: [{ namespace: 'demo', tools: [sum] }] });
server.startStdio();
```

Send one request per line (NDJSON):
```text
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"demo_sum","arguments":{"a":1,"b":2}}}
```

---

## Core concepts

### Toolkits
- A toolkit groups related capabilities under a `namespace`.
- A toolkit may include: `tools`, `prompts`, `resources`, `resourceTemplates`, optional `createContext`, and optional `auth`.

```ts
import type { MCPToolkit } from '@mcp-kit/core';

const toolkit: MCPToolkit<{ userId?: string }, { userId: string }> = {
  namespace: 'demo',
  description: 'Demo toolkit',
  tools: [/* MCPTool */],
  prompts: [/* MCPPromptDef */],
  resources: [/* MCPResourceProvider */],
  resourceTemplates: [/* MCPResourceTemplateProvider */],
  createContext: async ({ requestId }) => ({ requestId }),
  auth: /* MCPHTTPAuthMiddleware | MCPSTDIOAuthMiddleware (see Auth) */ undefined,
};
```

### Tools
- Tools expose actions via `tools/call`.
- Names are qualified as `"<namespace>_<tool>"` when calling.
- Input/output schemas can be defined with Zod or plain JSON Schema.

```ts
import type { MCPTool, MCPToolCallResult } from '@mcp-kit/core';
import z from 'zod';

export const search: MCPTool<unknown, { query: string; topK?: number }> = {
  name: 'search',
  description: 'Search example',
  input: { zod: z.object({ query: z.string().min(1), topK: z.number().int().positive().max(50).optional() }) },
  output: { jsonSchema: { type: 'object' } },
  async run({ query, topK }) {
    void topK;
    const data = { results: [], query };
    return { content: [{ type: 'text', text: JSON.stringify(data) }] } satisfies MCPToolCallResult;
  },
};
```

### Prompts
```ts
import type { MCPPromptDef } from '@mcp-kit/core';

export const greetingPrompt: MCPPromptDef<unknown, { name?: string }> = {
  name: 'greet',
  title: 'Greet user',
  description: 'Returns a greeting conversation',
  arguments: [{ name: 'name', description: 'Name to greet', required: false }],
  async messages({ name }) {
    const who = name ?? 'there';
    return [
      { role: 'system', content: { type: 'text', text: 'Be friendly.' } },
      { role: 'assistant', content: { type: 'text', text: `Hello, ${who}!` } },
    ];
  },
};
```

### Resources and Resource Templates
```ts
import { createMCPResourceProvider, createMCPResourceTemplateProvider } from '@mcp-kit/core';

export const profile = createMCPResourceProvider({
  uri: 'app://profile/me',
  name: 'my-profile',
  mimeType: 'application/json',
  async read() {
    return { contents: [{ uri: 'app://profile/me', text: JSON.stringify({ id: 'u1' }), mimeType: 'application/json' }] };
  },
});

export const userById = createMCPResourceTemplateProvider({
  descriptor: {
    uriTemplate: 'app://user/{userId}',
    name: 'user-by-id',
    title: 'User by id',
    description: 'Resolve user by id',
    mimeType: 'application/json',
  },
  async read(uri, context) {
    void uri; void context;
    return { contents: [{ text: JSON.stringify({ id: 'u1' }), mimeType: 'application/json' }] };
  },
});
```

URI template matching supports `{name}` (single path segment) and `{*rest}` (greedy) in the part after the scheme, and requires scheme match.

---

## Transport layers

### HTTP
- Expose `server.fetch` as your route handler.
- Accepts POST JSON-RPC requests.
- Serves discovery endpoints when configured:
  - `GET /.well-known/oauth-authorization-server`
  - `GET /.well-known/oauth-protected-resource`
- CORS: permissive defaults for discovery responses; preflight (`OPTIONS`) handled.
- Content negotiation: if `Accept: text/event-stream`, the server replies with a single-event SSE stream; otherwise JSON.

### STDIO (NDJSON)
- `server.startStdio(options?)` starts the NDJSON loop.
- Each line is a JSON-RPC request; each response is written on a new line.
- `MCPStdioController.notify(method, params?)` sends notifications (id=null envelopes) to the client.

---

## Authentication (per-toolkit)

Attach `auth` to a toolkit. Two middleware shapes are available.

### HTTP OAuth 2.1-style
```ts
import type { MCPHTTPAuthMiddleware } from '@mcp-kit/core';

const httpAuth: MCPHTTPAuthMiddleware<{ userId: string }> = {
  type: 'http',
  requiredScopes: ['read'],
  validateToken: async (token, resourceUri, request) => {
    void request; // validate token against your AS, using resourceUri (audience)
    if (token === 'valid-token' && resourceUri) return { userId: 'u1' };
    return null;
  },
  // Optionally add enhanced validation to support scope/audience checks automatically
  // validateTokenWithSecurity: async (token) => ({ sub: 'u1', scope: 'read', aud: ['app://resource'] }),
  onAuthError: (e) => console.error('auth error', e.message),
};

const server = new MCPServer({ toolkits: [{ namespace: 'secure', tools: [], auth: httpAuth }] });
```

Resource URI used for audience:
- `resources/read`: the `params.uri` value.
- `tools/call`: a synthesized URI `tool:<namespace>_<tool>`.
- Other methods: `mcp:<method>`.

When discovery is configured (see below) and an auth error occurs over HTTP, the server returns `WWW-Authenticate` with `authorization_uri`, `token_uri`, and a JSON-RPC error body including discovery hints.

### STDIO env-based
```ts
import type { MCPSTDIOAuthMiddleware } from '@mcp-kit/core';

const stdioAuth: MCPSTDIOAuthMiddleware<{ userId: string; apiKey: string }> = {
  type: 'stdio',
  extractCredentials: async (env) => {
    const apiKey = env.MCP_API_KEY;
    const userId = env.MCP_USER_ID;
    return apiKey && userId ? { apiKey, userId } : null;
  },
};

const server = new MCPServer({ toolkits: [{ namespace: 'cli', tools: [], auth: stdioAuth }] });
```

Auth failures return JSON-RPC error `-32001` (Authentication required).

---

## OAuth 2.1 Discovery (HTTP)

Enable discovery to advertise your Authorization Server and Protected Resource metadata.

```ts
import type { MCPAuthServerConfig, MCPDiscoveryConfig } from '@mcp-kit/core';

const as: MCPAuthServerConfig = {
  issuer: 'https://auth.example.com',
  authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
  tokenEndpoint: 'https://auth.example.com/oauth2/token',
  introspectionEndpoint: 'https://auth.example.com/oauth2/introspect',
  revocationEndpoint: 'https://auth.example.com/oauth2/revoke',
  registrationEndpoint: 'https://auth.example.com/oauth2/register',
  supportedResponseTypes: ['code'],
  supportedGrantTypes: ['authorization_code', 'client_credentials'],
  supportedCodeChallengeMethods: ['S256'],
  supportedScopes: ['read', 'write'],
  supportedTokenAuthMethods: ['client_secret_basic'],
  supportedIntrospectionAuthMethods: ['client_secret_basic'],
  supportedRevocationAuthMethods: ['client_secret_basic'],
};

const discovery: MCPDiscoveryConfig = {
  authorizationServer: as,
  protectedResource: {
    resourceUri: 'https://mcp.example.com',
    scopes: ['read', 'write'],
    audience: ['https://mcp.example.com'],
    authorizationServers: [as],
    resourceSigningAlgorithms: ['RS256'],
  },
  enableDiscoveryEndpoints: true,     // default: true
  discoveryCacheTtl: 3600,            // seconds, default: 3600
};

const server = new MCPServer({ toolkits: [...], discovery });
```

Endpoints provided (when `enableDiscoveryEndpoints !== false`):
- `GET /.well-known/oauth-authorization-server` → RFC 8414 metadata
- `GET /.well-known/oauth-protected-resource` → RFC 9728 metadata

On auth failures for HTTP JSON-RPC, the server may set:
- Header: `WWW-Authenticate: Bearer realm="mcp-server", authorization_uri=..., token_uri=..., discovery_uri=...`
- Body: JSON-RPC error with `error.data.discovery_endpoints` containing both well-known URLs.

---

## Canonical tools always available

`tools/list` includes two canonical entries even if you define no tools:
- `search` with input schema `{ query: string; topK?: number; site?: string; timeRange?: 'day'|'week'|'month'|'year' }`
- `fetch` with input schema `{ id: string; uri?: string }`

Behavior:
- `fetch` tries to resolve `uri` via your resource providers/templates (for accessible toolkits). On success it returns a `resource` content item; otherwise an empty `content` array.

---

## JSON-RPC methods and envelopes

- initialize: `{ method: 'initialize', params?: { protocolVersion?: string } }`
- tools/list, tools/call
- prompts/list, prompts/get
- resources/list, resources/read, resources/templates/list
- ping

Response envelopes always follow `MCPResponse`:
```json
{
  "jsonrpc": "2.0",
  "id": "...",
  "result": { ... } | undefined,
  "error": { "code": number, "message": string, "data"?: any } | undefined
}
```

Common error codes (JSON-RPC):
- -32700: Parse error
- -32601: Method not found
- -32602: Invalid params
- -32000: Tool execution error (generic)
- -32001: Authentication required/failed
- -32002: Resource not found

---

## Content types you can return from tools

```ts
// ContentItem union
type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string; annotations?: { audience?: string[]; priority?: number } }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource_link'; name: string; uri: string }
  | { type: 'resource'; resource:
      | { uri: string; name?: string; mimeType?: string }
      | { text: string; name?: string; mimeType?: string }
      | { blob: string; mimeType: string; name?: string } };
```

---

## Full configuration reference (all possible config)

### Server
- `new MCPServer(options: MCPServerOptions)`
  - `toolkits: MCPToolkit[]` (required)
  - `discovery?: MCPDiscoveryConfig` (optional)

### Discovery (`MCPDiscoveryConfig`)
- `authorizationServer: MCPAuthServerConfig`
  - `issuer: string`
  - `authorizationEndpoint: string`
  - `tokenEndpoint: string`
  - `introspectionEndpoint?: string`
  - `revocationEndpoint?: string`
  - `registrationEndpoint?: string`
  - `supportedResponseTypes: string[]`
  - `supportedGrantTypes: string[]`
  - `supportedCodeChallengeMethods?: string[]`
  - `supportedScopes?: string[]`
  - `supportedTokenAuthMethods?: string[]`
  - `supportedIntrospectionAuthMethods?: string[]`
  - `supportedRevocationAuthMethods?: string[]`
- `protectedResource: MCPProtectedResourceConfig`
  - `resourceUri: string`
  - `scopes: string[]`
  - `audience: string[]`
  - `authorizationServers: MCPAuthServerConfig[]`
  - `resourceSigningAlgorithms?: string[]`
- `enableDiscoveryEndpoints?: boolean` (default: true)
- `discoveryCacheTtl?: number` (seconds; default: 3600)

### Toolkit (`MCPToolkit<TContext, TAuth>`) 
- `namespace: string`
- `description?: string`
- `tools?: MCPTool[]`
- `prompts?: MCPPromptDef[]`
- `resources?: MCPResourceProvider[]`
- `resourceTemplates?: MCPResourceTemplateProvider[]`
- `createContext?(init: { requestId?: string | number | null }): Promise<Record<string, unknown>> | Record<string, unknown>`
- `auth?: MCPHTTPAuthMiddleware<TAuth> | MCPSTDIOAuthMiddleware<TAuth>`

### Tool (`MCPTool<TContext, TInput>`) 
- `name: string`
- `description?: string`
- `input?: MCPSchemaDef` (either `{ zod }` or `{ jsonSchema }`)
- `output?: MCPSchemaDef`
- `run(input: TInput, context: TContext): MCPToolCallResult | Promise<MCPToolCallResult>`

### Prompt (`MCPPromptDef<TContext, TInput>`) 
- `name: string`
- `title: string`
- `description?: string`
- `arguments?: Array<{ name: string; description?: string; required?: boolean }>`
- `messages(input: TInput, context: TContext): Promise<MCPMessage[]>`

### Resource Provider
- Create via `createMCPResourceProvider({ uri, name, title?, description?, mimeType?, size?, read(context) })`

### Resource Template Provider
- Create via `createMCPResourceTemplateProvider({ descriptor, read(uri, context) })`
- `descriptor: { uriTemplate: string; name: string; title: string; description: string; mimeType: string }`

### Auth middlewares
- HTTP (`MCPHTTPAuthMiddleware<TAuth>`)
  - `type: 'http'`
  - `validateToken(token, resourceUri, request) => Promise<TAuth | null>`
  - `requiredScopes?: string[]`
  - `validateTokenWithSecurity?(token) => Promise<MCPOAuthTokenInfo | null>`
  - `onAuthError?(error: Error & { statusCode: number }): void`
- STDIO (`MCPSTDIOAuthMiddleware<TAuth>`)
  - `type: 'stdio'`
  - `extractCredentials(env: NodeJS.ProcessEnv) => Promise<TAuth | null>`

### STDIO options (`MCPStdioOptions`)
- `input?: NodeJS.ReadStream | ReadableStream<Uint8Array>`
- `output?: NodeJS.WriteStream | WritableStream<Uint8Array>`
- `framing?: 'ndjson' | 'length-prefixed'` (current implementation operates as NDJSON)
- `enableSignalHandlers?: boolean` (default: true)

### Server settings (`MCPServerSettingsConfig`)
- Reserved placeholder (present in types; no fields currently).

---

## CORS behavior (HTTP)
- Preflight (`OPTIONS`) is handled when applicable.
- Discovery responses add:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - `Access-Control-Expose-Headers: Content-Type, Authorization`
  - `Cache-Control: public, max-age=3600`

---

## Implementation checklist (LLM-friendly)

- Define one or more `MCPTool`s with schemas and a `run` implementation.
- Optionally define `MCPPromptDef`s, `MCPResourceProvider`s, and/or `MCPResourceTemplateProvider`s.
- Create a `MCPToolkit` with a unique `namespace` and attach your items.
- If security is required, attach `auth` middleware (HTTP or STDIO) to the toolkit.
- Instantiate `MCPServer` with `toolkits` and optional `discovery` config.
- For HTTP: mount `server.fetch` on your runtime (Bun, Node, frameworks). For STDIO: call `server.startStdio()`.
- Test with `tools/list`, `tools/call`, etc. Ensure tool names use `namespace_tool` in requests.

---

## Example: Full HTTP server with discovery and auth
```ts
import { MCPServer, type MCPTool, type MCPToolCallResult } from '@mcp-kit/core';
import type { MCPHTTPAuthMiddleware, MCPAuthServerConfig, MCPDiscoveryConfig } from '@mcp-kit/core';
import z from 'zod';

const calc: MCPTool<{ userId?: string }, { a: number; b: number }> = {
  name: 'calc',
  description: 'a + b',
  input: { zod: z.object({ a: z.number(), b: z.number() }) },
  run: ({ a, b }, ctx) => {
    void ctx; return { content: [{ type: 'text', text: String(a + b) }] } satisfies MCPToolCallResult;
  },
};

const auth: MCPHTTPAuthMiddleware<{ userId: string }> = {
  type: 'http',
  requiredScopes: ['read'],
  validateToken: async (token, resourceUri) => token && resourceUri ? { userId: 'u1' } : null,
};

const as: MCPAuthServerConfig = {
  issuer: 'https://auth.example.com',
  authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
  tokenEndpoint: 'https://auth.example.com/oauth2/token',
  supportedResponseTypes: ['code'],
  supportedGrantTypes: ['authorization_code'],
};

const discovery: MCPDiscoveryConfig = {
  authorizationServer: as,
  protectedResource: {
    resourceUri: 'https://api.example.com',
    scopes: ['read'],
    audience: ['https://api.example.com'],
    authorizationServers: [as],
  },
};

const server = new MCPServer({
  toolkits: [{ namespace: 'demo', tools: [calc], auth }],
  discovery,
});

(Bun as { serve: (c: { port: number; fetch: unknown }) => void }).serve({ port: 3000, fetch: server.fetch });
```

---

## Test requests (HTTP)

List tools:
```bash
curl -sS -X POST http://localhost:3000 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

Call tool:
```bash
curl -sS -X POST http://localhost:3000 \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer valid-token' \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"demo_calc","arguments":{"a":1,"b":2}}}'
```

Discovery metadata:
```bash
curl -sS http://localhost:3000/.well-known/oauth-authorization-server | jq .
curl -sS http://localhost:3000/.well-known/oauth-protected-resource | jq .
```

---

## Notes

- Zod schemas are converted to JSON Schema for `tools/list` via `zod-to-json-schema` with `$ref` disabled.
- `tools/call` validates input with Zod when provided; otherwise your tool should validate manually.
- For SSE responses, set `Accept: text/event-stream`.
- Canonical `search` and `fetch` appear in `tools/list` automatically.


