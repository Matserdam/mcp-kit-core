import { describe, it, expect } from 'vitest';
import { MCPServer, createMCPResourceProvider, createMCPResourceTemplateProvider } from '../src/index';

const jsonrpc = async (server: MCPServer, body: any) => {
  const res = await server.fetch(new Request('http://localhost/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const txt = await res.text();
  return JSON.parse(txt);
};

describe('MCP resources', () => {
  it('resources/list returns an array', async () => {
    const server = new MCPServer({ toolkits: [
      {
        namespace: 'demo',
        resources: [
          createMCPResourceProvider({ uri: 'https://example.com/a', name: 'a', async read() { return { contents: [{ uri: 'https://example.com/a', text: 'A' }] }; } }),
          createMCPResourceProvider({ uri: 'https://example.com/b', name: 'b', async read() { return { contents: [{ uri: 'https://example.com/b', text: 'B' }] }; } }),
        ],
      }
    ] });
    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 1, method: 'resources/list' });
    expect(Array.isArray(resp?.result?.resources)).toBe(true);
    expect('nextCursor' in (resp?.result ?? {})).toBe(false);
    const uris = resp.result.resources.map((r: any) => r.uri);
    expect(uris).toContain('https://example.com/a');
    expect(uris).toContain('https://example.com/b');
  });

  it('resources/read returns contents array (empty ok for now)', async () => {
    const server = new MCPServer({ toolkits: [
      {
        namespace: 'demo',
        resources: [
          createMCPResourceProvider({ uri: 'https://example.com', name: 'res', async read() { return { contents: [{ uri: 'https://example.com', text: 'hello' }] }; } }),
        ],
      }
    ] });
    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'https://example.com' } });
    expect(Array.isArray(resp?.result?.contents)).toBe(true);
    expect(resp.result.contents[0].text).toBe('hello');
  });

  it('resources/templates/list returns templates', async () => {
    const server = new MCPServer({ toolkits: [
      {
        namespace: 'demo',
        resourceTemplates: [
          createMCPResourceTemplateProvider({
            descriptor: { uriTemplate: 'https://example.com/{id}', name: 'Example', title: 'Example Tpl' },
            read: async (uri: string) => ({ contents: [{ uri, text: '' }] }),
          }),
        ],
      }
    ] });
    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 4, method: 'resources/templates/list' });
    expect(Array.isArray(resp?.result?.resourceTemplates)).toBe(true);
    expect(resp.result.resourceTemplates[0].uriTemplate).toBe('https://example.com/{id}');
  });

  it('resources/read resolves via template when provider not found', async () => {
    const server = new MCPServer({ toolkits: [
      {
        namespace: 'demo',
        resourceTemplates: [
          createMCPResourceTemplateProvider({
            descriptor: { uriTemplate: 'https://example.com/{id}', name: 'Example' },
            read: async (uri: string) => ({ contents: [{ uri, text: 'from-template' }] }),
          }),
        ],
      }
    ] });
    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 5, method: 'resources/read', params: { uri: 'https://example.com/123' } });
    expect(resp?.result?.contents?.[0]?.text).toBe('from-template');
  });

  it('resources/read returns -32002 when not found', async () => {
    const server = new MCPServer({ toolkits: [] });
    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: 'https://nope' } });
    expect(resp?.error?.code).toBe(-32002);
  });
});



