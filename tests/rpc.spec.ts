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
    expect((res as MCPResponse).result && (res as any).result.protocolVersion).toBeDefined();
    expect((res as any).result.capabilities.tools.listChanged).toBe(true);
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
    expect((res as any).result.tools[0].name).toBe('ns_t');
    expect((res as any).result.tools[0].inputSchema).toBeDefined();
  });

  it('calls a tool and returns MCPToolCallResult', async () => {
    const tool: MCPTool = {
      name: 'sum',
      run: (args: any) => ({ content: [{ type: 'text', text: String((args?.a ?? 0) + (args?.b ?? 0)) }] }),
    } as MCPTool;
    const req: MCPRequest = { id: 2, method: 'tools/call', params: { name: 'ns_sum', arguments: { a: 1, b: 2 } } } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit([tool])]);
    expect((res as any).result.content[0].text).toBe('3');
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


