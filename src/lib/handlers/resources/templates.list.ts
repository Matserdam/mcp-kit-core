import type { MCPResponse, MCPResourceTemplatesListResult } from '../../../types/server';
import type { MCPToolkit, MCPResourceTemplateProvider } from '../../../types/toolkit';
import type { EventSink } from '../../../types/observability';

export const handleResourceTemplatesList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[],
  eventSink?: EventSink
): MCPResponse => {
  try { eventSink?.resourcesTemplatesListStart?.({ id }); } catch {}
  
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
  try { eventSink?.resourcesTemplatesListSuccess?.({ id, count: resourceTemplates.length }); } catch {}
  return { jsonrpc: '2.0', id, result };
};


