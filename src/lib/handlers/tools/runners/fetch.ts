import type { MCPResponse, MCPToolsCallParams, MCPToolCallResult, ResourceUri } from '../../../../types/server';
import type { MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../../../../types/toolkit';
import { uriMatchesTemplate } from '../../resources/util';

export const runFetch = async (
  id: string | number | null,
  params: MCPToolsCallParams,
  toolkits?: MCPToolkit[]
): Promise<MCPResponse> => {
  const args: unknown = params.arguments ?? {};
  const argsObj = (typeof args === 'object' && args !== null) ? args as Record<string, unknown> : {};
  const resId: string | undefined = typeof argsObj.id === 'string' ? argsObj.id : undefined;
  const uriArg: string | undefined = typeof argsObj.uri === 'string' ? argsObj.uri : undefined;
  if (!resId || resId.length === 0) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected { id: string, uri?: string }' } };
  }
  const targetUri = uriArg && uriArg.length > 0
    ? uriArg
    : (resId.startsWith('http://') || resId.startsWith('https://'))
      ? resId
      : '';
  if (!targetUri) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: provide a resolvable uri or use id as a url' } };
  }
  // Resolve via resource providers/templates if available
  if (toolkits && toolkits.length > 0) {
    const viaProviders = await readViaProviders(id, targetUri, toolkits);
    if (viaProviders) return viaProviders;
  }
  // Fallback: empty content (no duplicate link echo)
  const result: MCPToolCallResult = { content: [] };
  return { jsonrpc: '2.0', id, result };
};

const readViaProviders = async (
  id: string | number | null,
  uri: string,
  toolkits: MCPToolkit[]
): Promise<MCPResponse | null> => {
  const providers: Array<MCPResourceProvider<unknown>> = toolkits.flatMap((tk) => tk.resources ?? []);
  const provider = providers.find((p) => p.uri === (uri as ResourceUri));
  if (provider) {
    // Best-effort read without context for canonical runner
    try {
      const result = await provider.read({} as any);
      const contents = result.contents ?? [];
      const linkFallback: MCPToolCallResult = { content: [{ type: 'resource_link', name: provider.name, uri }] };
      if (!Array.isArray(contents) || contents.length === 0) return { jsonrpc: '2.0', id, result: linkFallback };
      const first = contents[0];
      const resource = first.text
        ? { text: first.text, name: first.name, mimeType: first.mimeType }
        : first.blob
          ? { blob: first.blob, name: first.name, mimeType: first.mimeType! }
          : { uri: first.uri, name: first.name, mimeType: first.mimeType };
      const toolResult: MCPToolCallResult = { content: [{ type: 'resource', resource }] };
      return { jsonrpc: '2.0', id, result: toolResult };
    } catch {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'resource_link', name: provider.name, uri }] } };
    }
  }
  const templates: Array<MCPResourceTemplateProvider<unknown>> = toolkits.flatMap((tk) => tk.resourceTemplates ?? []);
  for (const tpl of templates) {
    const { ok } = uriMatchesTemplate(uri, tpl.descriptor.uriTemplate);
    if (!ok) continue;
    try {
      const result = await tpl.read(uri as ResourceUri, {} as any);
      const contents = result.contents ?? [];
      if (!Array.isArray(contents) || contents.length === 0) continue;
      const first = contents[0];
      const resource = first.text
        ? { text: first.text, name: first.name, mimeType: first.mimeType }
        : first.blob
          ? { blob: first.blob, name: first.name, mimeType: first.mimeType! }
          : { uri: first.uri, name: first.name, mimeType: first.mimeType };
      const toolResult: MCPToolCallResult = { content: [{ type: 'resource', resource }] };
      return { jsonrpc: '2.0', id, result: toolResult };
    } catch {
      continue;
    }
  }
  // No resolution possible: return empty content
  return { jsonrpc: '2.0', id, result: { content: [] } };
};


