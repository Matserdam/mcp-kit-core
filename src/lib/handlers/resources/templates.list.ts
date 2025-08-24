import type { MCPToolkit, MCPResourceTemplateProvider } from '../../../types/toolkit';
import type { MCPResponse, MCPRequest, MCPResourceTemplatesListResult } from '../../../types/server';
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
      { id, method: 'resources/templates/list' } as MCPRequest,
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

export const handleResourceTemplatesList = async (
  id: string | number | null, 
  toolkits: MCPToolkit<unknown, unknown>[],
  rpcContext?: MCPRPCContext
): Promise<MCPResponse> => {
  const resourceTemplates: MCPResourceTemplatesListResult['resourceTemplates'] = [];

  // Check each toolkit's accessibility and collect resource templates from accessible ones
  for (const toolkit of toolkits) {
    const isAccessible = await isToolkitAccessible(toolkit, id, rpcContext);
    if (isAccessible && toolkit.resourceTemplates) {
      const toolkitTemplates = toolkit.resourceTemplates.map((tpl: MCPResourceTemplateProvider<unknown>) => ({
        uriTemplate: tpl.descriptor.uriTemplate,
        name: tpl.descriptor.name,
        title: tpl.descriptor.title,
        description: tpl.descriptor.description,
        mimeType: tpl.descriptor.mimeType,
      }));
      resourceTemplates.push(...toolkitTemplates);
    }
  }

  return { jsonrpc: '2.0', id, result: { resourceTemplates } };
};


