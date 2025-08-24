import type { MCPResponse, MCPResourceReadParams, MCPResourceReadResult } from '../../../types/server';
import type { MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../../../types/toolkit';
import type { ResourceUri } from '../../../types/server';
import { uriMatchesTemplate } from './util';

export const handleResourcesRead = async (
  id: string | number | null,
  params: MCPResourceReadParams,
  toolkits: MCPToolkit[],
  contextInit: { requestId?: string | number | null }
): Promise<MCPResponse> => {
  const uri: string | undefined = (params as { uri?: string }).uri;
  if (!uri) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected uri' } };
  }

  const providers: Array<MCPResourceProvider<unknown>> = toolkits.flatMap((tk) => tk.resources ?? []);
  const provider: MCPResourceProvider<unknown> | undefined = providers.find((p) => p.uri === (uri as ResourceUri));
  if (provider) {
    const tk = toolkits.find((t) => (t.resources ?? []).includes(provider));
    const contextResult = tk?.createContext?.(contextInit) ?? {};
    const context: Record<string, unknown> = contextResult instanceof Promise ? await contextResult : contextResult;
    const resultPromise = provider.read(context as any);
    const result: MCPResourceReadResult = resultPromise instanceof Promise ? await resultPromise : resultPromise;
    return { jsonrpc: '2.0', id, result };
  }

  const templates: Array<MCPResourceTemplateProvider<unknown>> = toolkits.flatMap((tk) => tk.resourceTemplates ?? []);
  for (const tpl of templates) {
    const { ok, params: pathParams } = uriMatchesTemplate(uri, tpl.descriptor.uriTemplate);
    if (!ok) continue;
    const tk = toolkits.find((t) => (t.resourceTemplates ?? []).includes(tpl));
    const contextResult = tk?.createContext?.(contextInit) ?? {};
    const context: Record<string, unknown> = contextResult instanceof Promise ? await contextResult : contextResult;
    const resultPromise = tpl.read(uri as ResourceUri, Object.assign({}, context, { params: pathParams }) as any);
    const result: MCPResourceReadResult = resultPromise instanceof Promise ? await resultPromise : resultPromise;
    return { jsonrpc: '2.0', id, result };
  }

  return { jsonrpc: '2.0', id, error: { code: -32002, message: 'Resource not found' } };
};


