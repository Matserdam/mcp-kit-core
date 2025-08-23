import type { MCPRequest, MCPResponse, MCPToolsCallParams } from '../../../types/server';
import type { MCPToolkit } from '../../../types/toolkit';
import { runToolkitTool } from './runners/toolkit';
import { runSearch } from './runners/search';
import { runFetch } from './runners/fetch';
import { canonicalFetchInputSchema, canonicalSearchInputSchema } from './schemas';

export const handleToolCall = async (
  request: MCPRequest & { params?: MCPToolsCallParams },
  toolkits: MCPToolkit[]
): Promise<MCPResponse> => {
  const { id, params } = request;

  if (!params) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Params missing' } };
  }

  const toolName: string = (params.name as unknown as string) ?? '';

  switch (toolName) {
    case 'search':
      {
        const v = canonicalSearchInputSchema.safeParse(params.arguments);
        if (!v.success) return { jsonrpc: '2.0', id, error: { code: -32602, message: v.error.message } };
      }
      return runSearch(id, params, toolkits);
    case 'fetch':
      {
        const v = canonicalFetchInputSchema.safeParse(params.arguments);
        if (!v.success) return { jsonrpc: '2.0', id, error: { code: -32602, message: v.error.message } };
      }
      return runFetch(id, params, toolkits);
    default:
      return runToolkitTool(id, params, toolkits);
  }
};


// toolkit runner moved to ./runners/toolkit


