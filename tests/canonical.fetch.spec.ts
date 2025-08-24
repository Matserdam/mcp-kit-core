import { describe, it, expect } from 'vitest';
import { handleRPC } from '../src/lib/rpc';
import type { MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../src/types/toolkit';
import type { MCPRequest, MCPResponse, ResourceUri } from '../src/types/server';

describe('canonical fetch resolves via providers/templates (async)', () => {
  const makeToolkit = (partial: Partial<MCPToolkit>): MCPToolkit => ({ namespace: 'ns', ...partial } as MCPToolkit);

  it('resolves via async resource provider', async () => {
    const tk = makeToolkit({
      resources: [{
        uri: 'custom://doc',
        name: 'doc',
        read: () => ({ contents: [{ uri: 'custom://doc' as ResourceUri, text: 'ok', mimeType: 'text/plain' }] }),
      }] as MCPResourceProvider<unknown>[],
    });
    const req: MCPRequest = { id: 1, method: 'tools/call', params: { name: 'fetch', arguments: { id: 'doc', uri: 'custom://doc' } } } as MCPRequest;
    const res = await handleRPC(req, [tk]);
    const response = res as MCPResponse & { result: { content: Array<{ type: string; resource: { text: string } }> } };
    const item = response.result?.content?.[0];
    expect(item?.type).toBe('resource');
    expect(item?.resource?.text).toBe('ok');
  });

  it('resolves via async resource template', async () => {
    const tk = makeToolkit({
      resourceTemplates: [{
        descriptor: { uriTemplate: 'notes://{name}', name: 'notes', title: 'Notes', description: 'Notes template', mimeType: 'text/plain' },
        read: (uri: ResourceUri) => ({ contents: [{ uri, text: 'hello', mimeType: 'text/plain' }] }),
      }] as MCPResourceTemplateProvider<unknown>[],
    });
    const req: MCPRequest = { id: 2, method: 'tools/call', params: { name: 'fetch', arguments: { id: 'n', uri: 'notes://readme' } } } as MCPRequest;
    const res = await handleRPC(req, [tk]);
    const response = res as MCPResponse & { result: { content: Array<{ type: string; resource: { text: string } }> } };
    const item = response.result?.content?.[0];
    expect(item?.type).toBe('resource');
    expect(item?.resource?.text).toBe('hello');
  });
});


