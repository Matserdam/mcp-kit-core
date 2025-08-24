import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { handleRPC } from '../src/lib/rpc';
import type { MCPRequest, MCPToolkit, MCPTool } from '../src';

// Minimal JSON-RPC response envelope per MCP schema (2025-06-18)
const zJSONRPCResponse = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

// InitializeResult shape
const zInitializeResult = z.object({
  protocolVersion: z.string(),
  serverInfo: z.object({ name: z.string(), version: z.string() }),
  capabilities: z.record(z.unknown()),
  instructions: z.string().optional(),
});

// Tools list shape (partial, per schema tools: Tool[])
const zToolsListResult = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      inputSchema: z.record(z.unknown()).optional(),
      outputSchema: z.record(z.unknown()).optional(),
    })
  ),
  nextCursor: z.string().optional(),
});

// Tools call result content blocks
const zContentText = z.object({ type: z.literal('text'), text: z.string() });
const zContentImage = z.object({ type: z.literal('image'), data: z.string(), mimeType: z.string() });
const zContentAudio = z.object({ type: z.literal('audio'), data: z.string(), mimeType: z.string() });
const zContentResourceLink = z.object({ type: z.literal('resource_link'), name: z.string(), uri: z.string() });
const zContentResource = z.object({
  type: z.literal('resource'),
  resource: z.union([
    z.object({ uri: z.string(), name: z.string().optional(), mimeType: z.string().optional() }),
    z.object({ text: z.string(), name: z.string().optional(), mimeType: z.string().optional() }),
    z.object({ blob: z.string(), mimeType: z.string(), name: z.string().optional() }),
  ]),
});
const zCallToolResult = z.object({
  content: z.array(z.union([zContentText, zContentImage, zContentAudio, zContentResourceLink, zContentResource])),
  structuredContent: z.record(z.unknown()).optional(),
  isError: z.boolean().optional(),
});

// Resources list
const zResourcesListResult = z.object({
  resources: z.array(
    z.object({
      uri: z.string(),
      name: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      mimeType: z.string().optional(),
      size: z.number().optional(),
    })
  ),
  nextCursor: z.string().optional(),
});

// Resources read
const zResourcesReadResult = z.object({
  contents: z.array(
    z.object({
      uri: z.string(),
      name: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      mimeType: z.string().optional(),
      size: z.number().optional(),
      text: z.string().optional(),
      blob: z.string().optional(),
    })
  ),
});

describe('Schema conformance (MCP 2025-06-18)', () => {
  it('initialize result matches schema', async () => {
    const req: MCPRequest = { id: 1, method: 'initialize', params: {} } as MCPRequest;
    const res = await handleRPC(req, []);
    expect(zJSONRPCResponse.parse(res)).toBeTruthy();
    const response = res as { result: unknown };
    expect(zInitializeResult.parse(response.result)).toBeTruthy();
  });

  it('ping returns EmptyResult {}', async () => {
    const req: MCPRequest = { id: 2, method: 'ping' } as MCPRequest;
    const res = await handleRPC(req, []);
    expect(zJSONRPCResponse.parse(res)).toBeTruthy();
    const response = res as { result: Record<string, never> };
    expect(response.result).toEqual({});
  });

  it('tools/list matches schema', async () => {
    const req: MCPRequest = { id: 3, method: 'tools/list' } as MCPRequest;
    const res = await handleRPC(req, [ { namespace: 'demo', tools: [] } as MCPToolkit<unknown, unknown> ]);
    expect(zJSONRPCResponse.parse(res)).toBeTruthy();
    const response = res as { result: unknown };
    expect(zToolsListResult.parse(response.result)).toBeTruthy();
  });

  it('tools/call returns ContentBlock[]', async () => {
    const tool: MCPTool<unknown, unknown> = { name: 'echo', run: (args: Record<string, unknown>) => ({ content: [{ type: 'text', text: String((args as { text?: string })?.text ?? '') }] }) } as MCPTool<unknown, unknown>;
    const req: MCPRequest = { id: 4, method: 'tools/call', params: { name: 'demo_echo', arguments: { text: 'hi' } } } as MCPRequest;
    const res = await handleRPC(req, [ { namespace: 'demo', tools: [tool] } as MCPToolkit<unknown, unknown> ]);
    expect(zJSONRPCResponse.parse(res)).toBeTruthy();
    const response = res as { result: unknown };
    expect(zCallToolResult.parse(response.result)).toBeTruthy();
  });

  it('resources/list matches schema', async () => {
    const req: MCPRequest = { id: 5, method: 'resources/list' } as MCPRequest;
    const res = await handleRPC(req, [ { namespace: 'demo', resources: [ { uri: 'file:///tmp/a.txt', name: 'a', read: () => ({ contents: [{ uri: 'file:///tmp/a.txt', text: 'x' }] }) } ] } as MCPToolkit<unknown, unknown> ]);
    expect(zJSONRPCResponse.parse(res)).toBeTruthy();
    const response = res as { result: unknown };
    expect(zResourcesListResult.parse(response.result)).toBeTruthy();
  });

  it('resources/read matches schema', async () => {
    const tk: MCPToolkit<unknown, unknown> = { namespace: 'demo', resources: [ { uri: 'file:///tmp/a.txt', name: 'a', read: () => ({ contents: [{ uri: 'file:///tmp/a.txt', text: 'hello' }] }) } ] } as MCPToolkit<unknown, unknown>;
    const req: MCPRequest = { id: 6, method: 'resources/read', params: { uri: 'file:///tmp/a.txt' } } as MCPRequest;
    const res = await handleRPC(req, [ tk ]);
    expect(zJSONRPCResponse.parse(res)).toBeTruthy();
    const response = res as { result: unknown };
    expect(zResourcesReadResult.parse(response.result)).toBeTruthy();
  });
});


