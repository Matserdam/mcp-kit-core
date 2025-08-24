import type { MCPResponse, MCPRequest, MCPToolsListResult } from '../../../types/server';
import type { MCPToolkit, MCPTool } from '../../../types/toolkit';
import type { MCPRPCContext } from '../../rpc';
import type { MCPRequestWithHeaders } from '../../../types/auth';
import { defaultAuthMiddlewareManager } from '../../auth/middleware';
import { getValidSchema } from '../../../utils';
import { canonicalFetchInputSchema, canonicalSearchInputSchema } from './schemas';

// Helper function to convert HTTP request to MCPRequestWithHeaders
function createMCPRequestWithHeaders(
  mcpRequest: MCPRequest, 
  httpRequest?: Request
): MCPRequestWithHeaders | null {
  if (!httpRequest) {
    return null;
  }

  // Extract headers from HTTP request
  const headers: Record<string, string> = {};
  httpRequest.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    ...mcpRequest,
    headers
  };
}

// Helper function to check if toolkit is accessible (auth passes or no auth required)
async function isToolkitAccessible(
  toolkit: MCPToolkit<unknown, unknown>,
  id: string | number | null,
  rpcContext?: MCPRPCContext
): Promise<boolean> {
  if (!toolkit.auth) {
    return true; // No auth required
  }

  try {
    const mcpRequestWithHeaders = createMCPRequestWithHeaders(
      { id, method: 'tools/list' } as MCPRequest,
      rpcContext?.httpRequest
    );
    
    const authResult = await defaultAuthMiddlewareManager.executeToolkitAuth(
      toolkit, 
      mcpRequestWithHeaders, 
      rpcContext?.env || null
    );
    return authResult !== null;
  } catch (error) {
    // Auth failed, exclude this toolkit
    return false;
  }
}

export const handleToolsList = async (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[],
  rpcContext?: MCPRPCContext
): Promise<MCPResponse> => {
  const tools: MCPToolsListResult['tools'] = [];

  // Check each toolkit's accessibility and collect tools from accessible ones
  for (const toolkit of toolkits) {
    const isAccessible = await isToolkitAccessible(toolkit, id, rpcContext);
    if (isAccessible && toolkit.tools) {
      // Add namespace prefix to tool names
      const namespaceTools = toolkit.tools.map((tool: MCPTool<unknown, unknown>) => ({
        name: `${toolkit.namespace}_${tool.name}`,
        description: tool.description ?? '',
        inputSchema: getValidSchema(tool.input),
        outputSchema: getValidSchema(tool.output),
      }));
      tools.push(...namespaceTools);
    }
  }

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

  return {
    jsonrpc: '2.0',
    id,
    result: { tools }
  };
};


