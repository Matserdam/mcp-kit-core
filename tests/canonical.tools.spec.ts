import { describe, it, expect } from 'vitest';
import { handleRPC } from '../src/lib/rpc';
import type { MCPRequest, MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../src/types/server';
import type { MCPTool, MCPToolkit as TK } from '../src/types/toolkit';

const makeToolkit = (init: Partial<TK>): TK => ({ namespace: 'ns', tools: [], ...init });

describe('Canonical tools: search and fetch', () => {
  it('tools/list includes canonical search and fetch', async () => {
    const req = { id: 'list', method: 'tools/list' } as MCPRequest;
    const res = await handleRPC(req, []);
    const tools = (res as any).result.tools as Array<{ name: string }>;
    const names = tools.map(t => t.name);
    expect(names).toContain('search');
    expect(names).toContain('fetch');
  });

  it('search returns text and resource_link items, filters by query/site/topK', async () => {
    const providers: MCPResourceProvider[] = [
      {
        uri: 'https://example.com/a/pikachu',
        name: 'pikachu-a',
        read: () => ({ contents: [{ uri: 'https://example.com/a/pikachu' }] }),
      },
      {
        uri: 'https://raw.githubusercontent.com/img/pikachu.png',
        name: 'pikachu-github',
        read: () => ({ contents: [{ uri: 'https://raw.githubusercontent.com/img/pikachu.png' }] }),
      },
    ];
    const templates: MCPResourceTemplateProvider[] = [
      {
        descriptor: { uriTemplate: 'https://cdn.example.com/{name}.png', name: 'front' },
        read: () => ({ contents: [{ uri: 'https://cdn.example.com/pikachu.png' }] }),
      },
    ];
    const req = { id: 1, method: 'tools/call', params: { name: 'search', arguments: { query: 'pikachu', site: 'githubusercontent', topK: 1 } } } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit({ namespace: 'x', resources: providers as any, resourceTemplates: templates as any })]);
    const content = (res as any).result.content as any[];
    expect(content[0]).toMatchObject({ type: 'text' });
    const links = content.filter(c => c.type === 'resource_link');
    expect(links.length).toBe(1);
    expect(links[0].uri).toContain('raw.githubusercontent.com');
  });

  it('fetch resolves via provider to resource', async () => {
    const target = 'https://assets.example.com/pikachu.txt';
    const providers: MCPResourceProvider[] = [
      { uri: target, name: 'pikachu-text', read: () => ({ contents: [{ uri: target, name: 'pikachu-text', mimeType: 'text/plain', text: 'PIKACHU' }] }) },
    ];
    const req = { id: 2, method: 'tools/call', params: { name: 'fetch', arguments: { id: 'pikachu', uri: target } } } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit({ namespace: 'x', resources: providers as any })]);
    const content = (res as any).result.content as any[];
    expect(content[0].type).toBe('resource');
    expect(content[0].resource.text).toBe('PIKACHU');
  });

  it('fetch resolves via template to resource', async () => {
    const target = 'https://cdn.example.com/pikachu.png';
    const templates: MCPResourceTemplateProvider[] = [
      {
        descriptor: { uriTemplate: 'https://cdn.example.com/{name}.png', name: 'front' },
        read: (uri) => ({ contents: [{ uri, name: 'front', mimeType: 'image/png', blob: 'BASE64' }] }),
      },
    ];
    const req = { id: 3, method: 'tools/call', params: { name: 'fetch', arguments: { id: 'pikachu', uri: target } } } as MCPRequest;
    const res = await handleRPC(req, [makeToolkit({ namespace: 'x', resourceTemplates: templates as any })]);
    const content = (res as any).result.content as any[];
    expect(content[0].type).toBe('resource');
    expect(content[0].resource.blob).toBe('BASE64');
  });

  it('fetch falls back to resource_link when no provider/template matches', async () => {
    const target = 'https://nowhere.invalid/file.bin';
    const req = { id: 4, method: 'tools/call', params: { name: 'fetch', arguments: { id: target } } } as MCPRequest;
    const res = await handleRPC(req, []);
    const content = (res as any).result.content as any[];
    expect(content[0].type).toBe('resource_link');
    expect(content[0].uri).toBe(target);
  });
});


