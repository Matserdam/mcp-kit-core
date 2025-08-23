import type { MCPResponse, MCPToolsCallParams, MCPToolCallResult } from '../../../../types/server';
import type { MCPToolkit } from '../../../../types/toolkit';

export const runSearch = (
  id: string | number | null,
  params: MCPToolsCallParams,
  toolkits: MCPToolkit[]
): MCPResponse => {
  const args: unknown = params.arguments ?? {};
  const argsObj = (typeof args === 'object' && args !== null) ? args as Record<string, unknown> : {};
  const queryUnknown = argsObj.query as unknown;
  const topK: number | undefined = typeof argsObj.topK === 'number' ? argsObj.topK as number : undefined;
  const siteRaw = argsObj.site as unknown;
  const site: string | undefined = typeof siteRaw === 'string' && siteRaw.length > 0 ? siteRaw : undefined;

  if (typeof queryUnknown !== 'string' || queryUnknown.length === 0) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected { query: string }' } };
  }

  const queryLower = queryUnknown.toLowerCase();
  const siteLower = site?.toLowerCase();

  const resources = toolkits.flatMap((tk: MCPToolkit) => (
    (tk.resources ?? []).map((provider) => ({
      uri: provider.uri,
      name: provider.name,
      title: provider.title,
      description: provider.description,
      mimeType: provider.mimeType,
      size: provider.size,
    }))
  ));

  const templates = toolkits.flatMap((tk: MCPToolkit) => (
    (tk.resourceTemplates ?? []).map((tpl) => ({
      uriTemplate: tpl.descriptor.uriTemplate,
      name: tpl.descriptor.name,
      title: tpl.descriptor.title,
      description: tpl.descriptor.description,
      mimeType: tpl.descriptor.mimeType,
    }))
  ));

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
    content.push({ type: 'resource_link', name: display, uri: r.uri } as { type: 'resource_link'; name: string; uri: string });
  }

  const structuredContent = {
    results: limitedResources.map((r) => ({ title: r.title || r.name || r.uri, url: r.uri, snippet: r.description })),
    templates: filteredTemplates,
    total: { resources: filteredResources.length, templates: filteredTemplates.length },
  } as Record<string, unknown>;

  const result: MCPToolCallResult = { content, structuredContent };
  return { jsonrpc: '2.0', id, result };
};


