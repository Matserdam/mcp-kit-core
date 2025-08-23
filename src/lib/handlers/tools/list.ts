import type { MCPResponse } from '../../../types/server';
import type { MCPToolkit, MCPTool } from '../../../types/toolkit';
import { getValidSchema } from '../../../utils';

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
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        topK: { type: 'number' },
        site: { type: 'string' },
        timeRange: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
      },
      required: ['query']
    },
    outputSchema: { type: 'object' },
  });
  listed.push({
    name: 'fetch',
    description: 'Canonical fetch tool',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, uri: { type: 'string' } }, required: ['id'] },
    outputSchema: { type: 'object' },
  });

  return { jsonrpc: '2.0', id, result: { tools: listed } };
};


