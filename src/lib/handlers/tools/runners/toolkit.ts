import type { MCPResponse, MCPToolsCallParams } from '../../../../types/server';
import type { MCPToolkit, MCPTool } from '../../../../types/toolkit';

export const runToolkitTool = async (
  id: string | number | null,
  params: MCPToolsCallParams,
  toolkits: MCPToolkit[]
): Promise<MCPResponse> => {
  const normalizedName = params.name;

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
    const zodSchema = tool.input.zod;
    if (zodSchema) {
      const validation = zodSchema.safeParse(params.arguments);
      if (!validation.success) {
        return { jsonrpc: '2.0', id, error: { code: -32602, message: validation.error.message } };
      }
    }
  }

  try {
    const toolResult = await tool.run(
      params.arguments,
      toolkit.createContext?.({ requestId: id }) ?? {}
    );
    return { jsonrpc: '2.0', id, result: toolResult };
  } catch (err: unknown) {
    const anyErr = err as { code?: unknown; message?: unknown; data?: unknown };
    const code = typeof anyErr?.code === 'number' ? anyErr.code : -32000;
    const message = typeof anyErr?.message === 'string' ? anyErr.message : 'Tool execution error';
    const data = anyErr?.data ?? undefined;
    return { jsonrpc: '2.0', id, error: { code, message, data } };
  }
};


