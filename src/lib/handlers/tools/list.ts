import type { MCPResponse } from '../../../types/server';
import type { MCPToolkit, MCPTool } from '../../../types/toolkit';
import { getValidSchema } from '../../../utils';
import { canonicalFetchInputSchema, canonicalSearchInputSchema } from './schemas';

export const handleToolsList = (id: string | number | null, toolkits: MCPToolkit[]): MCPResponse => {
  const listed = toolkits
    .flatMap((tk: MCPToolkit) => (tk.tools ?? []).map((tool: MCPTool) => ({
      name: `${tk.namespace}_${tool.name}`,
      description: tool.description ?? '',
      inputSchema: getValidSchema(tool.input),
      outputSchema: getValidSchema(tool.output),
    })));

  listed.push({
    name: 'search',
    description: 'Canonical search tool',
    inputSchema: getValidSchema({ zod: canonicalSearchInputSchema }),
    outputSchema: { type: 'object' },
  });
  listed.push({
    name: 'fetch',
    description: 'Canonical fetch tool',
    inputSchema: getValidSchema({ zod: canonicalFetchInputSchema }),
    outputSchema: { type: 'object' },
  });

  return { jsonrpc: '2.0', id, result: { tools: listed } };
};


