import { MCPRequest, MCPResponse, MCPToolsCallParams } from "../types/server";
import { MCPTool, MCPToolkit } from "../types/toolkit";
import { getValidSchema } from "../utils";

export const handleRPC = async (request: MCPRequest, toolkits: MCPToolkit[]): Promise<MCPResponse> => {
  const { id, method, params } = request;
  switch (method) {
    case 'initialize': {
      const requestedProtocol = (params as any)?.protocolVersion;
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
      return { jsonrpc: '2.0', id, result: { ok: true } as any };
    case 'tools/list':
      return {
        jsonrpc: '2.0', id, result: {
          tools: toolkits.flatMap((tk: MCPToolkit) => {
            return {
              tools: (tk.tools ?? [])
                .map((tool: MCPTool) =>
                ({
                  // Special-case: expose the canonical search tool as just "search"
                  name: (tk.namespace === 'search' && tool.name === 'search')
                    ? 'search'
                    // Use underscore to delimit namespace and tool name by default
                    : `${tk.namespace}_${tool.name}`,
                  description: tool.description ?? '',
                  inputSchema: getValidSchema(tool.input),
                  outputSchema: getValidSchema(tool.output)
                }))
            }
          }).flatMap((t) => t.tools)
        }
      };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } as any };
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } as any };
    case 'tools/call':
      return handleToolCall(request, toolkits);

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
  }
}

const handleToolCall = async (request: MCPRequest & { params?: MCPToolsCallParams }, toolkits: MCPToolkit[]) : Promise<MCPResponse> => { 
  console.log(request);
  const { id, method, params } = request;

  if (!params) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Params missing' } };
  }

  // Normalize special-case: canonical search tool can be invoked as 'search'
  const rawName: string = (params.name as string) ?? '';
  const normalizedName = rawName === 'search' ? 'search_search' : rawName;

  // Support new underscore delimiter and accept legacy dot as a fallback
  let namespace: string | undefined;
  let toolName: string | undefined;
  if (normalizedName.includes('_')) {
    const idx = normalizedName.indexOf('_');
    namespace = normalizedName.slice(0, idx);
    toolName = normalizedName.slice(idx + 1);
  }
  if (!namespace || !toolName) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected params.name as "namespace_tool"' } };
  }
  const toolkit = toolkits.find((tk: MCPToolkit) => tk.namespace === namespace);
  if (!toolkit) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Toolkit not found' } };
  }
  const tool = toolkit.tools?.find((t: MCPTool) => t.name === toolName);
  if (!tool) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Tool not found' } };
  }

  if (tool.input) {
    // validate zod schema
    const zodSchema = tool.input.zod;
    if (zodSchema) {
      const result = zodSchema.safeParse(params.arguments);
      if (!result.success) {
        return { jsonrpc: '2.0', id, error: { code: -32602, message: result.error.message } };
      }
    }
  }

  const result = await tool.run(params.arguments, toolkit.createContext?.({ requestId: id }) ?? {});
  try {
    const result = await tool.run(
      params.arguments,
      toolkit.createContext?.({ requestId: id }) ?? {}
    );
    return { jsonrpc: '2.0', id, result };
  } catch (err: any) {
    const code = typeof err?.code === 'number' ? err.code : -32000;
    const message = typeof err?.message === 'string' ? err.message : 'Tool execution error';
    const data = err?.data ?? undefined;
    return { jsonrpc: '2.0', id, error: { code, message, data } };
  }
}