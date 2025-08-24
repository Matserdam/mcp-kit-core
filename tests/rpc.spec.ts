import { describe, it, expect } from 'vitest';
import { handleRPC } from '../src/lib/rpc';
import type { MCPRequest, MCPToolkit, MCPTool, MCPResponse } from '../src/index';
import { z } from 'zod';

describe('handleRPC', () => {
  const makeToolkit = (tools: MCPTool[]): MCPToolkit => ({ namespace: 'ns', tools });

  it('returns initialize payload', async () => {
    const req: MCPRequest = { id: 1, method: 'initialize', params: {} };
    const res = await handleRPC(req, []);
    expect(res.jsonrpc).toBe('2.0');
    const response = res as MCPResponse & { result: { protocolVersion: unknown; capabilities: { tools: { listChanged: boolean } } } };
    expect(response.result && response.result.protocolVersion).toBeDefined();
    expect(response.result.capabilities.tools.listChanged).toBe(true);
  });

  it('responds to ping with empty result', async () => {
    const req: MCPRequest = { id: 99, method: 'ping' } as MCPRequest;
    const res = await handleRPC(req, []);
    const response = res as { result: Record<string, never> };
    expect(response.result).toEqual({});
  });

  it('lists tools with schemas', async () => {
    const tool: MCPTool = {
      name: 't',
      description: 'test',
      input: { zod: z.object({ a: z.string() }) },
      output: { zod: z.object({ ok: z.boolean() }) },
      run: () => ({ content: [{ type: 'text', text: 'ok' }] }),
    };
    const req: MCPRequest = { id: 'a', method: 'tools/list' } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit([tool])]);
    const response = res as { result: { tools: Array<{ name: string; inputSchema: unknown }> } };
    const tools = response.result.tools;
    const found = tools.find((t) => t.name === 'ns_t');
    expect(found).toBeTruthy();
    expect(found?.inputSchema).toBeDefined();
  });

  it('calls a tool and returns MCPToolCallResult', async () => {
    const tool: MCPTool = {
      name: 'sum',
      run: (args: Record<string, unknown>) => ({ content: [{ type: 'text', text: String((args?.a as number ?? 0) + (args?.b as number ?? 0)) }] }),
    } as MCPTool;
    const req: MCPRequest = { id: 2, method: 'tools/call', params: { name: 'ns_sum', arguments: { a: 1, b: 2 } } } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit([tool])]);
    const response = res as { result: { content: Array<{ text: string }> } };
    expect(response.result.content[0].text).toBe('3');
  });

  it('errors when toolkit not found', async () => {
    const req: MCPRequest = { id: 3, method: 'tools/call', params: { name: 'missing_sum', arguments: {} } } as MCPRequest;
    const res = await handleRPC(req, []);
    expect(res.error?.code).toBe(-32601);
  });

  it('errors when tool not found', async () => {
    const req: MCPRequest = { id: 4, method: 'tools/call', params: { name: 'ns_missing', arguments: {} } } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit([])]);
    expect(res.error?.code).toBe(-32601);
  });

  it('validates zod and errors on invalid args', async () => {
    const tool: MCPTool = {
      name: 'needsA',
      input: { zod: z.object({ a: z.string() }) },
      run: () => ({ content: [{ type: 'text', text: 'ok' }] }),
    } as MCPTool;
    const req: MCPRequest = { id: 5, method: 'tools/call', params: { name: 'ns_needsA', arguments: { a: 1 } } } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit([tool])]);
    expect(res.error?.code).toBe(-32602);
  });

  it('errors when params missing', async () => {
    const req: MCPRequest = { id: 6, method: 'tools/call' } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit([])]);
    expect(res.error?.code).toBe(-32601);
  });
});


