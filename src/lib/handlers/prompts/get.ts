import type { MCPPROMPTSGetResult, MCPRequest, MCPResponse } from "../../../types/server.d.ts";
import type { MCPToolkit } from "../../../types/toolkit.d.ts";
import type { MCPRPCContext } from "../../rpc.ts";
import type { MCPRequestWithHeaders } from "../../../types/auth.d.ts";
import { defaultAuthMiddlewareManager } from "../../auth/middleware.ts";
import { MCPAuthError } from "../../auth/errors.ts";

// Helper function to convert HTTP request to MCPRequestWithHeaders
function createMCPRequestWithHeaders(
  mcpRequest: MCPRequest,
  httpRequest?: Request,
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
    headers,
  };
}

// Helper function to authenticate toolkit
async function authenticateToolkit(
  toolkit: MCPToolkit<unknown, unknown>,
  request: MCPRequest,
  rpcContext?: MCPRPCContext,
): Promise<void> {
  if (toolkit.auth) {
    try {
      const mcpRequestWithHeaders = createMCPRequestWithHeaders(
        request,
        rpcContext?.httpRequest,
      );

      const authResult = await defaultAuthMiddlewareManager.executeToolkitAuth(
        toolkit,
        mcpRequestWithHeaders,
        rpcContext?.env || null,
        rpcContext?.eventSink,
      );
      if (!authResult) {
        throw new MCPAuthError("Authentication required", 401);
      }
    } catch (error) {
      if (error instanceof MCPAuthError) {
        throw error;
      }
      throw new MCPAuthError("Authentication failed", 401);
    }
  }
}

export const handlePromptsGet = async (
  request: MCPRequest,
  toolkits: MCPToolkit<unknown, unknown>[],
  rpcContext?: MCPRPCContext,
): Promise<MCPResponse> => {
  const { id, params } = request;
  const sink = rpcContext?.eventSink;
  const name = (params as unknown as { name?: unknown })?.name as string | undefined;

  try {
    sink?.promptsGetStart?.({ id, name });
  } catch { /* ignore sink errors */ }

  if (!name) {
    const errorResp = {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "Invalid params: expected name" },
    } as MCPResponse;
    try {
      sink?.promptsGetFail?.({
        id,
        name,
        code: errorResp.error!.code,
        message: errorResp.error!.message,
      });
    } catch { /* ignore sink errors */ }
    return errorResp;
  }
  const [ns, promptName] = name.includes("_") ? name.split("_", 2) : [undefined, undefined];
  if (!ns || !promptName) {
    const errorResp = {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "Invalid name: expected namespace_prompt" },
    } as MCPResponse;
    try {
      sink?.promptsGetFail?.({
        id,
        name,
        code: errorResp.error!.code,
        message: errorResp.error!.message,
      });
    } catch { /* ignore sink errors */ }
    return errorResp;
  }
  const tk = toolkits.find((t) => t.namespace === ns);
  if (!tk) {
    const errorResp = {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Toolkit not found" },
    } as MCPResponse;
    try {
      sink?.promptsGetFail?.({
        id,
        name,
        code: errorResp.error!.code,
        message: errorResp.error!.message,
      });
    } catch { /* ignore sink errors */ }
    return errorResp;
  }

  // Authenticate the toolkit that provides this prompt
  try {
    await authenticateToolkit(tk, request, rpcContext);
  } catch (error) {
    if (error instanceof MCPAuthError) {
      const errorResp = {
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: error.message },
      } as MCPResponse;
      try {
        sink?.promptsGetFail?.({
          id,
          name,
          code: errorResp.error!.code,
          message: errorResp.error!.message,
        });
      } catch { /* ignore sink errors */ }
      return errorResp;
    }
    throw error;
  }

  const prompt = tk.prompts?.find((p) => p.name === promptName);
  if (!prompt) {
    const errorResp = {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Prompt not found" },
    } as MCPResponse;
    try {
      sink?.promptsGetFail?.({
        id,
        name,
        code: errorResp.error!.code,
        message: errorResp.error!.message,
      });
    } catch { /* ignore sink errors */ }
    return errorResp;
  }

  const messages = await prompt.messages(
    (params as unknown as { arguments?: Record<string, unknown> })?.arguments,
    tk?.createContext?.({ requestId: id }) ?? {} as unknown,
  );
  const result: MCPPROMPTSGetResult = {
    description: prompt.description ?? "",
    messages,
  };
  try {
    sink?.promptsGetSuccess?.({ id, name });
  } catch { /* ignore sink errors */ }
  return { jsonrpc: "2.0", id, result };
};
