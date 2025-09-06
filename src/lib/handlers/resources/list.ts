import type { MCPResourcesListResult, MCPResponse } from "../../../types/server.d.ts";
import type { MCPResourceProvider, MCPToolkit } from "../../../types/toolkit.d.ts";
import type { EventSink } from "../../../types/observability.d.ts";

export const handleResourcesList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[],
  eventSink?: EventSink,
): MCPResponse => {
  try {
    eventSink?.resourcesListStart?.({ id });
  } catch { /* ignore sink errors */ }

  const resources = toolkits.flatMap((toolkit) =>
    (toolkit.resources ?? []).map((resource: MCPResourceProvider<unknown>) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }))
  );

  const result: MCPResourcesListResult = { resources };
  try {
    eventSink?.resourcesListSuccess?.({ id, count: resources.length });
  } catch { /* ignore sink errors */ }
  return { jsonrpc: "2.0", id, result };
};
