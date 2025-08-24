import type { MCPRequest, MCPResponse, MCPToolsCallParams } from '../../../types/server';
import type { MCPToolkit } from '../../../types/toolkit';
import { runToolkitTool } from './runners/toolkit';
import { runSearch } from './runners/search';
import { runFetch } from './runners/fetch';
import { canonicalFetchInputSchema, canonicalSearchInputSchema } from './schemas';

export const handleToolCall = async (
  request: MCPRequest,
  toolkits: MCPToolkit[]
): Promise<MCPResponse> => {
  const { id, params } = request;

  if (!params) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Params missing' } };
  }

  // Type guard to ensure this is a tools/call request
  if (request.method !== 'tools/call') {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Invalid method for tools/call handler' } };
  }

  const toolName: string = (params as MCPToolsCallParams).name ?? '';

  switch (toolName) {
    case 'search':
      {
        const v = canonicalSearchInputSchema.safeParse((params as MCPToolsCallParams).arguments);
        if (!v.success) return { jsonrpc: '2.0', id, error: { code: -32602, message: v.error.message } };
      }
      return runSearch(id, params as MCPToolsCallParams, toolkits);
    case 'fetch':
      {
        const v = canonicalFetchInputSchema.safeParse((params as MCPToolsCallParams).arguments);
        if (!v.success) return { jsonrpc: '2.0', id, error: { code: -32602, message: v.error.message } };
      }
      return runFetch(id, params as MCPToolsCallParams, toolkits);
    default:
      return runToolkitTool(id, params as MCPToolsCallParams, toolkits);
  }
};


// toolkit runner moved to ./runners/toolkit


