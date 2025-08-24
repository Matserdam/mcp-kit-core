import type { MCPResponse, MCPToolsListResult } from '../../../types/server';
import type { MCPToolkit, MCPTool } from '../../../types/toolkit';
import { getValidSchema } from '../../../utils';
import { canonicalFetchInputSchema, canonicalSearchInputSchema } from './schemas';

export const handleToolsList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[]
): MCPResponse => {
  const tools = toolkits.flatMap((toolkit) =>
    (toolkit.tools ?? []).map((tool: MCPTool<unknown, unknown>) => {
      const fullName = `${toolkit.namespace}_${tool.name}`;
      const inputSchema = getValidSchema(tool.input);
      const outputSchema = getValidSchema(tool.output);
      return {
        name: fullName,
        description: tool.description ?? '',
        inputSchema,
        outputSchema
      };
    })
  );

  // Always include canonical tools
  tools.push({
    name: 'search',
    description: 'Canonical search tool',
    inputSchema: getValidSchema({ zod: canonicalSearchInputSchema }),
    outputSchema: { type: 'object' },
  });
  tools.push({
    name: 'fetch',
    description: 'Canonical fetch tool',
    inputSchema: getValidSchema({ zod: canonicalFetchInputSchema }),
    outputSchema: { type: 'object' },
  });

  const result: MCPToolsListResult = { tools };
  return { jsonrpc: '2.0', id, result };
};


