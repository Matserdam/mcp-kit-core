import { describe, it, expect } from 'vitest';
import { createServer } from '../examples/mcp-simple-bun-stdio/index';

const jsonrpc = async (fetcher: (body: any) => Promise<Response>, body: any) => {
  const res = await fetcher(body);
  const txt = await res.text();
  return JSON.parse(txt);
};

describe('example: mcp-simple-bun-stdio (via fetch handler)', () => {
  it('echo and sum tools respond', async () => {
    const server = createServer();
    const fetcher = (body: any) => server.fetch(new Request('http://local/mcp', { method: 'POST', body: JSON.stringify(body) }));

    const init = await jsonrpc(fetcher, { jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect(init.jsonrpc).toBe('2.0');

    const list = await jsonrpc(fetcher, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(JSON.stringify(list)).toContain('demo.echo');
    expect(JSON.stringify(list)).toContain('demo.sum');

    const echo = await jsonrpc(fetcher, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'demo.echo', arguments: { text: 'hi' } },
    });
    expect(JSON.stringify(echo)).toContain('hi');

    const sum = await jsonrpc(fetcher, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'demo.sum', arguments: { a: 2, b: 3 } },
    });
    expect(JSON.stringify(sum)).toContain('5');
  });
});


