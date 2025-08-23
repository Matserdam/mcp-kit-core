import { MCPRequest, MCPResponse, MCPToolsCallParams, MCPToolCallResult, MCPResourceReadParams } from "../types/server";
import { MCPPromptDef, MCPTool, MCPToolkit } from "../types/toolkit";
import { getValidSchema } from "../utils";

// No helper needed; arguments are already provided in the correct shape

import { handleResourcesList } from './handlers/resources/list';
import { handleResourcesRead } from './handlers/resources/read';
import { handleResourceTemplatesList } from './handlers/resources/templates.list';

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
    case 'tools/list': {
      const listed = toolkits
        .flatMap((tk: MCPToolkit) => (tk.tools ?? []).map((tool: MCPTool) => ({
          name: `${tk.namespace}_${tool.name}`,
          description: tool.description ?? '',
          inputSchema: getValidSchema(tool.input),
          outputSchema: getValidSchema(tool.output),
        })));
      const seen = new Set<string>(listed.map(t => t.name));
      if (!seen.has('search')) {
        listed.push({
          name: 'search',
          description: 'Canonical search tool',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
          outputSchema: { type: 'object' },
        });
      }
      if (!seen.has('fetch')) {
        listed.push({
          name: 'fetch',
          description: 'Canonical fetch tool',
          inputSchema: { type: 'object', properties: { id: { type: 'string' }, uri: { type: 'string' } }, required: ['id'] },
          outputSchema: { type: 'object' },
        });
      }
      return { jsonrpc: '2.0', id, result: { tools: listed } };
    }
    case 'prompts/list':
      return {
        jsonrpc: '2.0', id, result: {
          prompts: toolkits.flatMap((tk: MCPToolkit) => (tk.prompts ?? []).map((p: MCPPromptDef) => ({
            name: `${tk.namespace}_${p.name}`,
            title: p.title ?? p.name,
            description: p.description ?? '',
            arguments: p.arguments ?? [],
          })))
        } as any
      };
    case 'prompts/get': {
      const name = (params as any)?.name as string | undefined;
      if (!name) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected name' } };
      const [ns, promptName] = name.includes('_') ? name.split('_', 2) : [undefined, undefined];
      if (!ns || !promptName) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid name: expected namespace_prompt' } };
      const tk = toolkits.find((t) => t.namespace === ns);
      const prompt = tk?.prompts?.find((p) => p.name === promptName);
      if (!prompt) return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Prompt not found' } };
      console.log({ prompt });
      const messages = await prompt.messages(params.arguments, tk?.createContext?.({ requestId: id }) ?? {});
      console.log({ messages, content: messages[0].content });
      const result: MCPResponse = {
        jsonrpc: '2.0', id, result: {
          description: prompt.description ?? '',
          messages
        }
      };
      console.log({ result });
      return result;
    }
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

const handleToolCall = async (request: MCPRequest & { params?: MCPToolsCallParams }, toolkits: MCPToolkit[]): Promise<MCPResponse> => {
  console.log(request);
  const { id, method, params } = request;

  if (!params) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Params missing' } };
  }

  // Handle canonical library tools without namespace
  const rawName: string = (params.name as string) ?? '';
  if (rawName === 'search') {
    const q = (params.arguments as any)?.query;
    console.log({ arguments: params.arguments });
    if (typeof q !== 'string' || q.length === 0) {
      return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected { query: string }' } };
    }
    const result = { content: [{ type: 'text', text: JSON.stringify({ results: [] }) }] } as MCPToolCallResult;
    return { jsonrpc: '2.0', id, result };
  }
  if (rawName === 'fetch') {
    const args: any = params.arguments ?? {};
    const resId: string | undefined = typeof args.id === 'string' ? args.id : undefined;
    const uriArg: string | undefined = typeof args.uri === 'string' ? args.uri : undefined;
    if (!resId || resId.length === 0) {
      return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected { id: string, uri?: string }' } };
    }
    const targetUri = uriArg && uriArg.length > 0
      ? uriArg
      : (resId.startsWith('http://') || resId.startsWith('https://'))
        ? resId
        : '';
    if (!targetUri) {
      return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: provide a resolvable uri or use id as a url' } };
    }
    const result = { content: [{ type: 'resource_link', name: resId, uri: targetUri }] } as MCPToolCallResult;
    return { jsonrpc: '2.0', id, result };
  }

  const normalizedName = rawName;

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