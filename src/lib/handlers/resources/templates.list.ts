import type { MCPToolkit, MCPResourceTemplateProvider } from '../../../types/toolkit';
import type { MCPResponse } from '../../../types/server';

export const handleResourceTemplatesList = (id: string | number | null, toolkits: MCPToolkit[]): MCPResponse => {
  const resourceTemplates = toolkits.flatMap((tk: MCPToolkit) => (
    (tk.resourceTemplates ?? []).map((tpl: MCPResourceTemplateProvider) => ({
      uriTemplate: tpl.descriptor.uriTemplate,
      name: tpl.descriptor.name,
      title: tpl.descriptor.title,
      description: tpl.descriptor.description,
      mimeType: tpl.descriptor.mimeType,
    }))
  ));
  return { jsonrpc: '2.0', id, result: { resourceTemplates } };
};


