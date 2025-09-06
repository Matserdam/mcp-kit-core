import type { MCPResourceTemplatesListResult, MCPResponse } from "../../../types/server.d.ts";
import type { MCPResourceTemplateProvider, MCPToolkit } from "../../../types/toolkit.d.ts";
import type { EventSink } from "../../../types/observability.d.ts";

export const handleResourceTemplatesList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[],
  eventSink?: EventSink,
): MCPResponse => {
  try {
    eventSink?.resourcesTemplatesListStart?.({ id });
  } catch { /* ignore sink errors */ }

  const resourceTemplates = toolkits.flatMap((toolkit) =>
    (toolkit.resourceTemplates ?? []).map((template: MCPResourceTemplateProvider<unknown>) => ({
      uriTemplate: template.descriptor.uriTemplate,
      name: template.descriptor.name,
      title: template.descriptor.title,
      description: template.descriptor.description,
      mimeType: template.descriptor.mimeType,
    }))
  );

  const result: MCPResourceTemplatesListResult = { resourceTemplates };
  try {
    eventSink?.resourcesTemplatesListSuccess?.({ id, count: resourceTemplates.length });
  } catch { /* ignore sink errors */ }
  return { jsonrpc: "2.0", id, result };
};
