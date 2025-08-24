import type { MCPResponse, MCPResourcesListResult } from '../../../types/server';
import type { MCPToolkit, MCPResourceProvider } from '../../../types/toolkit';

export const handleResourcesList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[]
): MCPResponse => {
  const resources = toolkits.flatMap((toolkit) =>
    (toolkit.resources ?? []).map((resource: MCPResourceProvider<unknown>) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }))
  );

  const result: MCPResourcesListResult = { resources };
  return { jsonrpc: '2.0', id, result };
};


