import type { MCPRequest, MCPResponse, MCPToolsCallParams } from '../../../types/server';
import type { MCPToolkit } from '../../../types/toolkit';
import { runToolkitTool } from './runners/toolkit';
import { runSearch } from './runners/search';
import { runFetch } from './runners/fetch';

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
      return runSearch(id, params, toolkits);
    case 'fetch':
      return runFetch(id, params, toolkits);
    default:
      return runToolkitTool(id, params, toolkits);
  }
};


// toolkit runner moved to ./runners/toolkit


