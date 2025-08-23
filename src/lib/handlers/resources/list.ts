import type { MCPResponse } from '../../../types/server';
import type { MCPToolkit, MCPResourceProvider } from '../../../types/toolkit';

export const handleResourcesList = (id: string | number | null, toolkits: MCPToolkit[]): MCPResponse => {
  const resources = toolkits.flatMap((tk: MCPToolkit) => (
    (tk.resources ?? []).map((provider: MCPResourceProvider) => ({
      uri: provider.uri,
      name: provider.name,
      title: provider.title,
      description: provider.description,
      mimeType: provider.mimeType,
      size: provider.size,
    }))
  ));
  return { jsonrpc: '2.0', id, result: { resources } };
};


