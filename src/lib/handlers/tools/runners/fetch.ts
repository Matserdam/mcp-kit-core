import type { MCPResponse, MCPToolsCallParams, MCPToolCallResult, ResourceUri, MCPRequest } from '../../../../types/server';
import type { MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../../../../types/toolkit';
import type { MCPRPCContext } from '../../../../lib/rpc';
import type { MCPRequestWithHeaders } from '../../../../types/auth';
import { defaultAuthMiddlewareManager } from '../../../../lib/auth/middleware';
import { uriMatchesTemplate } from '../../resources/util';

// Helper function to convert HTTP request to MCPRequestWithHeaders
function createMCPRequestWithHeaders(
  mcpRequest: MCPRequest, 
  httpRequest?: Request
): MCPRequestWithHeaders | null {
  if (!httpRequest) {
    return null;
  }

  // Extract headers from HTTP request
  const headers: Record<string, string> = {};
  httpRequest.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    ...mcpRequest,
    headers
  };
}

// Helper function to check if toolkit is accessible (auth passes or no auth required)
async function isToolkitAccessible(
  toolkit: MCPToolkit<unknown, unknown>,
  id: string | number | null,
  rpcContext?: MCPRPCContext
): Promise<boolean> {
  if (!toolkit.auth) {
    return true; // No auth required
  }

  try {
    const mcpRequestWithHeaders = createMCPRequestWithHeaders(
      { id, method: 'tools/call', params: { name: 'fetch' } } as MCPRequest,
      rpcContext?.httpRequest
    );
    
    const authResult = await defaultAuthMiddlewareManager.executeToolkitAuth(
      toolkit, 
      mcpRequestWithHeaders, 
      rpcContext?.env || null
    );
    return authResult !== null;
  } catch (error) {
    // Auth failed, exclude this toolkit
    return false;
  }
}

export const runFetch = async (
  id: string | number | null,
  params: MCPToolsCallParams,
  toolkits?: MCPToolkit<unknown, unknown>[],
  rpcContext?: MCPRPCContext
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
    const viaProviders = await readViaProviders(id, targetUri, toolkits, rpcContext);
    if (viaProviders) return viaProviders;
  }
  // Fallback: empty content (no duplicate link echo)
  const result: MCPToolCallResult = { content: [] };
  return { jsonrpc: '2.0', id, result };
};

const readViaProviders = async (
  id: string | number | null,
  uri: string,
  toolkits: MCPToolkit<unknown, unknown>[],
  rpcContext?: MCPRPCContext
): Promise<MCPResponse | null> => {
  const providers: Array<MCPResourceProvider<unknown>> = [];
  const templates: Array<MCPResourceTemplateProvider<unknown>> = [];

  // Check each toolkit's accessibility and collect providers/templates from accessible ones
  for (const toolkit of toolkits) {
    const isAccessible = await isToolkitAccessible(toolkit, id, rpcContext);
    if (isAccessible) {
      if (toolkit.resources) {
        providers.push(...toolkit.resources);
      }
      if (toolkit.resourceTemplates) {
        templates.push(...toolkit.resourceTemplates);
      }
    }
  }

  const provider = providers.find((p) => p.uri === (uri as ResourceUri));
  if (provider) {
    // Best-effort read without context for canonical runner
    try {
      const result = await provider.read({} as Record<string, unknown>);
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

  for (const tpl of templates) {
    const { ok } = uriMatchesTemplate(uri, tpl.descriptor.uriTemplate);
    if (!ok) continue;
    try {
      const result = await tpl.read(uri as ResourceUri, {} as Record<string, unknown>);
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


