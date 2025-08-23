import { MCPRequest, MCPResponse, MCPResourceReadParams } from "../types/server";
import { MCPToolkit } from "../types/toolkit";

// No helper needed; arguments are already provided in the correct shape

import { handleResourcesList } from './handlers/resources/list';
import { handleResourcesRead } from './handlers/resources/read';
import { handleResourceTemplatesList } from './handlers/resources/templates.list';
import { handleToolsList } from './handlers/tools/list';
import { handleToolCall } from './handlers/tools/call';
import { handleNotificationInitialized } from './handlers/notifications/initialized';
import { handlePromptsList } from './handlers/prompts/list';
import { handlePromptsGet } from './handlers/prompts/get';

export const handleRPC = async (request: MCPRequest, toolkits: MCPToolkit[]): Promise<MCPResponse> => {
  const { id, method, params } = request;
  switch (method) {
    case 'initialize': {
      const requestedProtocol = (params as unknown as { protocolVersion?: unknown })?.protocolVersion;
      const protocolVersion = typeof requestedProtocol === 'string' && requestedProtocol.length > 0
        ? requestedProtocol
        : '2025-06-18';
      return {
        jsonrpc: '2.0', id, result: {
          protocolVersion,
          serverInfo: { name: 'mcp-kit', version: '0.0.1' },
          capabilities: { tools: { listChanged: true }, prompts: { listChanged: false }, resources: { listChanged: false } }
        }
      };
    }
    case 'notifications/initialized':
      // Notification acknowledgement for client 'initialized'
      return handleNotificationInitialized(id);
    case 'tools/list':
      return handleToolsList(id, toolkits);
    case 'prompts/list':
      return handlePromptsList(id, toolkits);
    case 'prompts/get':
      return handlePromptsGet(id, params as unknown as any, toolkits);
    case 'resources/list': {
      return handleResourcesList(id, toolkits);
    }
    case 'resources/templates/list': {
      return handleResourceTemplatesList(id, toolkits);
    }
    case 'resources/read': {
      return handleResourcesRead(id, params as MCPResourceReadParams, toolkits, { requestId: id });
    }
    case 'tools/call':
      return handleToolCall(request as any, toolkits);

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
  }
}