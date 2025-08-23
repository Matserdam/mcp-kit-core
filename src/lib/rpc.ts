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
import { handleInitialize } from './handlers/initialize';
import { handlePing } from './handlers/ping';

export const handleRPC = async (request: MCPRequest, toolkits: MCPToolkit[]): Promise<MCPResponse> => {
  const { id, method, params } = request;
  switch (method) {
    // Alphabetical order of methods
    case 'initialize':
      return handleInitialize(id, params);
    case 'notifications/initialized':
      return handleNotificationInitialized(id);
    case 'ping':
      return handlePing(id);
    case 'prompts/get':
      return handlePromptsGet(id, params as unknown as any, toolkits);
    case 'prompts/list':
      return handlePromptsList(id, toolkits);
    case 'resources/list':
      return handleResourcesList(id, toolkits);
    case 'resources/read':
      return handleResourcesRead(id, params as MCPResourceReadParams, toolkits, { requestId: id });
    case 'resources/templates/list':
      return handleResourceTemplatesList(id, toolkits);
    case 'tools/call':
      return handleToolCall(request as any, toolkits);
    case 'tools/list':
      return handleToolsList(id, toolkits);

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
  }
}