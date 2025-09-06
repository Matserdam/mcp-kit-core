import type { MCPRequest, MCPResponse } from "../types/server.d.ts";
import type { EventSink } from "../types/observability.d.ts";
import type { MCPToolkit } from "../types/toolkit.d.ts";
import type { MCPDiscoveryConfig } from "../types/auth.d.ts";
import { handleInitialize } from "./handlers/initialize.ts";
import { handleToolsList } from "./handlers/tools/list.ts";
import { handleToolCall } from "./handlers/tools/call.ts";
import { handlePromptsList } from "./handlers/prompts/list.ts";
import { handlePromptsGet } from "./handlers/prompts/get.ts";
import { handleResourcesList } from "./handlers/resources/list.ts";
import { handleResourcesRead } from "./handlers/resources/read.ts";
import { handleResourceTemplatesList } from "./handlers/resources/templates.list.ts";
import { handlePing } from "./handlers/ping.ts";

export interface MCPRPCContext {
  httpRequest?: Request;
  env?: Record<string, string>;
  discovery?: MCPDiscoveryConfig;
  eventSink?: EventSink;
}

export async function handleRPC(
  request: MCPRequest,
  toolkits: MCPToolkit<unknown, unknown>[],
  context?: MCPRPCContext,
): Promise<MCPResponse> {
  const { id, method, params } = request;
  const sink = context?.eventSink;
  try {
    sink?.rpcReceived?.({ id, method });
  } catch { /* ignore sink errors */ }

  switch (method) {
    case "initialize":
      return handleInitialize(id, params);
    case "ping":
      return handlePing(id);
    case "prompts/get":
      return await handlePromptsGet(request, toolkits, context);
    case "prompts/list":
      return handlePromptsList(id, toolkits, sink);
    case "resources/list":
      return handleResourcesList(id, toolkits, sink);
    case "resources/read":
      return await handleResourcesRead(id, params, toolkits, { requestId: id }, context);
    case "resources/templates/list":
      return handleResourceTemplatesList(id, toolkits, sink);
    case "tools/call":
      return await handleToolCall(request, toolkits, context);
    case "tools/list":
      return handleToolsList(id, toolkits, sink);
    default: {
      const errorResp = {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: "Method not found",
        },
      } as MCPResponse;
      try {
        sink?.rpcFailed?.({
          id,
          method,
          code: errorResp.error!.code,
          message: errorResp.error!.message,
        });
      } catch { /* ignore sink errors */ }
      return errorResp;
    }
  }
}
