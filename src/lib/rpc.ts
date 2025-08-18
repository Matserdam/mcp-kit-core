import { MCPRequest, MCPResponse, MCPToolsCallParams } from "../types/server";
import { MCPTool, MCPToolkit } from "../types/toolkit";
import { getValidSchema } from "../utils";

export const handleRPC = async (request: MCPRequest, toolkits: MCPToolkit[]): Promise<MCPResponse> => {
  const { id, method, params } = request;
  switch (method) {
    case 'initialize':
      return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', serverInfo: { name: 'mcp-kit', version: '0.0.1' }, capabilities: { tools: { listChanged: true } } } };
    case 'tools/list':
      return {
        jsonrpc: '2.0', id, result: {
          tools: toolkits.flatMap((tk: MCPToolkit) => {
            return {
              tools: (tk.tools ?? [])
                .map((tool: MCPTool) =>
                ({
                  name: `${tk.namespace}.${tool.name}`,
                  description: tool.description ?? '',
                  inputSchema: getValidSchema(tool.input),
                  outputSchema: getValidSchema(tool.output)
                }))
            }
          }).flatMap((t) => t.tools)
        }
      };
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

  const [namespace, toolName] = params.name.split('.');
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
  return { jsonrpc: '2.0', id, result };
}