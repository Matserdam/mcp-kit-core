import type { MCPResponse, MCPRequest, MCPResourcesListResult } from '../../../types/server';
import type { MCPToolkit, MCPResourceProvider } from '../../../types/toolkit';
import type { MCPRPCContext } from '../../rpc';
import type { MCPRequestWithHeaders } from '../../../types/auth';
import { defaultAuthMiddlewareManager } from '../../auth/middleware';

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
      { id, method: 'resources/list' } as MCPRequest,
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

export const handleResourcesList = async (
  id: string | number | null, 
  toolkits: MCPToolkit<unknown, unknown>[],
  rpcContext?: MCPRPCContext
): Promise<MCPResponse> => {
  const resources: MCPResourcesListResult['resources'] = [];

  // Check each toolkit's accessibility and collect resources from accessible ones
  for (const toolkit of toolkits) {
    const isAccessible = await isToolkitAccessible(toolkit, id, rpcContext);
    if (isAccessible && toolkit.resources) {
      const toolkitResources = toolkit.resources.map((provider: MCPResourceProvider<unknown>) => ({
        uri: provider.uri,
        name: provider.name,
        title: provider.title,
        description: provider.description,
        mimeType: provider.mimeType,
        size: provider.size,
      }));
      resources.push(...toolkitResources);
    }
  }

  return { jsonrpc: '2.0', id, result: { resources } };
};


