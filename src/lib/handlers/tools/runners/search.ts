import type { MCPResponse, MCPToolsCallParams, MCPToolCallResult, MCPRequest } from '../../../../types/server';
import type { MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../../../../types/toolkit';
import type { MCPRPCContext } from '../../../../lib/rpc';
import type { MCPRequestWithHeaders } from '../../../../types/auth';
import { defaultAuthMiddlewareManager } from '../../../../lib/auth/middleware';

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
      { id, method: 'tools/call', params: { name: 'search' } } as MCPRequest,
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

export const runSearch = async (
  id: string | number | null,
  params: MCPToolsCallParams,
  toolkits: MCPToolkit<unknown, unknown>[],
  rpcContext?: MCPRPCContext
): Promise<MCPResponse> => {
  const args: unknown = params.arguments ?? {};
  const argsObj = (typeof args === 'object' && args !== null) ? args as Record<string, unknown> : {};
  const queryUnknown = argsObj.query;
  const topK: number | undefined = typeof argsObj.topK === 'number' ? argsObj.topK : undefined;
  const siteRaw = argsObj.site;
  const site: string | undefined = typeof siteRaw === 'string' && siteRaw.length > 0 ? siteRaw : undefined;

  if (typeof queryUnknown !== 'string' || queryUnknown.length === 0) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected { query: string }' } };
  }

  const queryLower = queryUnknown.toLowerCase();
  const siteLower = site?.toLowerCase();

  const resources: Array<{
    uri: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
    size?: number;
  }> = [];

  const templates: Array<{
    uriTemplate: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
  }> = [];

  // Check each toolkit's accessibility and collect resources/templates from accessible ones
  for (const toolkit of toolkits) {
    const isAccessible = await isToolkitAccessible(toolkit, id, rpcContext);
    if (isAccessible) {
      // Add resources from this toolkit
      if (toolkit.resources) {
        const toolkitResources = toolkit.resources.map((provider: MCPResourceProvider<unknown>) => ({
          uri: provider.uri,
          name: provider.name,
          title: provider.title,
          description: provider.description,
          mimeType: provider.mimeType,
          size: provider.size,
        }));
        resources.push(...toolkitResources);
      }

      // Add resource templates from this toolkit
      if (toolkit.resourceTemplates) {
        const toolkitTemplates = toolkit.resourceTemplates.map((tpl: MCPResourceTemplateProvider<unknown>) => ({
          uriTemplate: tpl.descriptor.uriTemplate,
          name: tpl.descriptor.name,
          title: tpl.descriptor.title,
          description: tpl.descriptor.description,
          mimeType: tpl.descriptor.mimeType,
        }));
        templates.push(...toolkitTemplates);
      }
    }
  }

  const textMatches = (text?: string) => text ? text.toLowerCase().includes(queryLower) : false;
  const hostMatches = (uri: string) => {
    if (!siteLower) return true;
    try {
      const u = new URL(uri);
      return u.host.toLowerCase().includes(siteLower);
    } catch {
      return uri.toLowerCase().includes(siteLower);
    }
  };

  const filteredResources = resources.filter((r) => (
    textMatches(r.name) || textMatches(r.title) || textMatches(r.description) || textMatches(r.uri)
  ) && hostMatches(r.uri));

  const filteredTemplates = templates.filter((t) => (
    textMatches(t.name) || textMatches(t.title) || textMatches(t.description) || textMatches(t.uriTemplate)
  ));

  const limitedResources = typeof topK === 'number' && topK > 0 ? filteredResources.slice(0, topK) : filteredResources;

  const lines: string[] = [];
  lines.push(`Search: "${queryUnknown}"`);
  lines.push(`Resources matched: ${filteredResources.length}${typeof topK === 'number' ? ` (showing ${limitedResources.length})` : ''}`);
  for (const r of limitedResources) {
    const display = r.name || r.title || r.uri;
    lines.push(`- ${display} -> ${r.uri}`);
  }
  lines.push(`Templates matched: ${filteredTemplates.length}`);
  for (const t of filteredTemplates.slice(0, 20)) {
    const display = t.name || t.title || t.uriTemplate;
    lines.push(`- ${display} :: ${t.uriTemplate}`);
  }

  const content: MCPToolCallResult['content'] = [
    { type: 'text', text: lines.join('\n') }
  ];
  for (const r of limitedResources) {
    const display = r.name || r.title || r.uri;
    content.push({ type: 'resource_link', name: display, uri: r.uri });
  }

  const structuredContent = {
    results: limitedResources.map((r) => ({ title: r.title || r.name || r.uri, url: r.uri, snippet: r.description })),
    templates: filteredTemplates,
    total: { resources: filteredResources.length, templates: filteredTemplates.length },
  };

  const result: MCPToolCallResult = { content, structuredContent };
  return { jsonrpc: '2.0', id, result };
};


