import type { MCPResponse, MCPToolsListResult } from "../../../types/server.d.ts";
import type { MCPTool, MCPToolkit } from "../../../types/toolkit.d.ts";
import type { EventSink } from "../../../types/observability.d.ts";
import { getValidSchema } from "../../../utils.ts";
import { canonicalFetchInputSchema, canonicalSearchInputSchema } from "./schemas.ts";

export const handleToolsList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[],
  eventSink?: EventSink,
): MCPResponse => {
  try {
    eventSink?.toolsListStart?.({ id });
  } catch { /* ignore sink errors */ }
  const tools = toolkits.flatMap((toolkit) =>
    (toolkit.tools ?? []).map((tool: MCPTool<unknown, unknown>) => {
      const fullName = `${toolkit.namespace}_${tool.name}`;
      const inputSchema = getValidSchema(tool.input);
      const outputSchema = getValidSchema(tool.output);
      return {
        name: fullName,
        description: tool.description ?? "",
        inputSchema,
        outputSchema,
      };
    })
  );

  // Always include canonical tools
  tools.push({
    name: "search",
    description: "Canonical search tool",
    inputSchema: getValidSchema({ zod: canonicalSearchInputSchema }),
    outputSchema: { type: "object" },
  });
  tools.push({
    name: "fetch",
    description: "Canonical fetch tool",
    inputSchema: getValidSchema({ zod: canonicalFetchInputSchema }),
    outputSchema: { type: "object" },
  });

  const result: MCPToolsListResult = { tools };
  try {
    eventSink?.toolsListSuccess?.({ id, count: tools.length });
  } catch { /* ignore sink errors */ }
  return { jsonrpc: "2.0", id, result };
};
