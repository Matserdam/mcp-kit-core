import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src/index';

const jsonrpc = async (server: MCPServer, body: any) => {
  const res = await server.fetch(new Request('http://localhost/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const txt = await res.text();
  return JSON.parse(txt);
};

describe('MCP resources', () => {
  it('resources/list returns an array', async () => {
    const server = new MCPServer({ toolkits: [] });
    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 1, method: 'resources/list' });
    expect(Array.isArray(resp?.result?.resources)).toBe(true);
  });

  it('resources/read returns contents array (empty ok for now)', async () => {
    const server = new MCPServer({ toolkits: [] });
    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'https://example.com' } });
    expect(Array.isArray(resp?.result?.contents)).toBe(true);
  });
});



