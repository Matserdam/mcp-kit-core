import { describe, it, expect } from 'vitest';
import { createServer } from '../examples/mcp-simple-bun-stdio/index';
import type { MCPServer } from '@mcp-kit/core';

const jsonrpc = async (fetcher: (body: Record<string, unknown>) => Promise<Response>, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const res = await fetcher(body);
  const txt = await res.text();
  return JSON.parse(txt) as Record<string, unknown>;
};

describe('example: mcp-simple-bun-stdio (via fetch handler)', () => {
  it('echo and sum tools respond', async () => {
    const server: MCPServer = createServer();
    const fetcher: (body: Record<string, unknown>) => Promise<Response> = (body: Record<string, unknown>): Promise<Response> => server.fetch(new Request('http://local/mcp', { method: 'POST', body: JSON.stringify(body) }));

    const init = await jsonrpc(fetcher, { jsonrpc: '2.0', id: 1, method: 'initialize' });
    const initResponse = init as { jsonrpc: string };
    expect(initResponse.jsonrpc).toBe('2.0');

    const list = await jsonrpc(fetcher, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const listResponse = list;
    expect(JSON.stringify(listResponse)).toContain('demo_echo');
    expect(JSON.stringify(listResponse)).toContain('demo_sum');

    const echo = await jsonrpc(fetcher, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'demo_echo', arguments: { text: 'hi' } },
    });
    const echoResponse = echo;
    expect(JSON.stringify(echoResponse)).toContain('hi');

    const sum = await jsonrpc(fetcher, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'demo_sum', arguments: { a: 2, b: 3 } },
    });
    const sumResponse = sum;
    expect(JSON.stringify(sumResponse)).toContain('5');
  });
});


