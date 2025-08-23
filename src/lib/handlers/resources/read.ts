import type { MCPResponse, MCPResourceReadParams } from '../../../types/server';
import type { MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../../../types/toolkit';
import type { ResourceUri } from '../../../types/server';

const uriMatchesTemplate = (uri: string, template: string): { ok: boolean; params: Record<string, string> } => {
  // MVP matcher: {var} = one segment; {*rest} = remainder
  const [proto, rest] = uri.split('://');
  const [tProto, tRest] = template.split('://');
  if (!tRest || proto + '://' !== tProto + '://') return { ok: false, params: {} };
  const uriParts = rest.split('/');
  const tplParts = tRest.split('/');
  const params: Record<string, string> = {};
  for (let i = 0, j = 0; i < tplParts.length; i += 1, j += 1) {
    const part = tplParts[i];
    if (part.startsWith('{') && part.endsWith('}')) {
      const key = part.slice(1, -1);
      if (key.startsWith('*')) {
        params[key.slice(1)] = uriParts.slice(j).join('/');
        return { ok: true, params };
      }
      if (uriParts[j] === undefined) return { ok: false, params: {} };
      params[key] = uriParts[j];
      continue;
    }
    if (part !== uriParts[j]) return { ok: false, params: {} };
  }
  return { ok: true, params };
};

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
    const context = await (tk?.createContext?.(contextInit) ?? {});
    const result = await provider.read(context as unknown);
    return { jsonrpc: '2.0', id, result };
  }

  const templates: Array<MCPResourceTemplateProvider<unknown>> = toolkits.flatMap((tk) => tk.resourceTemplates ?? []);
  for (const tpl of templates) {
    const { ok, params: pathParams } = uriMatchesTemplate(uri, tpl.descriptor.uriTemplate);
    if (!ok) continue;
    const tk = toolkits.find((t) => (t.resourceTemplates ?? []).includes(tpl));
    const context = await (tk?.createContext?.(contextInit) ?? {});
    const result = await tpl.read(uri as ResourceUri, Object.assign({}, context, { params: pathParams }) as unknown);
    return { jsonrpc: '2.0', id, result };
  }

  return { jsonrpc: '2.0', id, error: { code: -32002, message: 'Resource not found' } };
};


