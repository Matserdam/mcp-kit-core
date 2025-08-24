import type { MCPResponse, MCPResourceTemplatesListResult } from '../../../types/server';
import type { MCPToolkit, MCPResourceTemplateProvider } from '../../../types/toolkit';

export const handleResourceTemplatesList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[]
): MCPResponse => {
  const resourceTemplates = toolkits.flatMap((toolkit) =>
    (toolkit.resourceTemplates ?? []).map((template: MCPResourceTemplateProvider<unknown>) => ({
      uriTemplate: template.descriptor.uriTemplate,
      name: template.descriptor.name,
      title: template.descriptor.title,
      description: template.descriptor.description,
      mimeType: template.descriptor.mimeType
    }))
  );

  const result: MCPResourceTemplatesListResult = { resourceTemplates };
  return { jsonrpc: '2.0', id, result };
};


