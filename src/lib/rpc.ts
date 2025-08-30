import type { MCPRequest, MCPResponse } from '../types/server';
import type { MCPToolkit } from '../types/toolkit';
import type { MCPDiscoveryConfig } from '../types/auth';
import { handleInitialize } from './handlers/initialize';
import { handleToolsList } from './handlers/tools/list';
import { handleToolCall } from './handlers/tools/call';
import { handlePromptsList } from './handlers/prompts/list';
import { handlePromptsGet } from './handlers/prompts/get';
import { handleResourcesList } from './handlers/resources/list';
import { handleResourcesRead } from './handlers/resources/read';
import { handleResourceTemplatesList } from './handlers/resources/templates.list';
import { handlePing } from './handlers/ping';

export interface MCPRPCContext {
  httpRequest?: Request;
  env?: NodeJS.ProcessEnv;
  discovery?: MCPDiscoveryConfig;
}

export async function handleRPC(
  request: MCPRequest,
  toolkits: MCPToolkit<unknown, unknown>[],
  context?: MCPRPCContext
): Promise<MCPResponse> {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return handleInitialize(id, params);
    case 'ping':
      return handlePing(id);
    case 'prompts/get':
      return handlePromptsGet(request, toolkits, context);
    case 'prompts/list':
      return handlePromptsList(id, toolkits);
    case 'resources/list':
      return handleResourcesList(id, toolkits);
    case 'resources/read':
      return handleResourcesRead(id, params, toolkits, { requestId: id }, context);
    case 'resources/templates/list':
      return handleResourceTemplatesList(id, toolkits);
    case 'tools/call':
      return handleToolCall(request, toolkits, context);
    case 'tools/list':
      return handleToolsList(id, toolkits);
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      };
  }
}