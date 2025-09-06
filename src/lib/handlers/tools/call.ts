import type { MCPRequest, MCPResponse, MCPToolsCallParams } from '../../../types/server.d.ts';
import type { MCPToolkit } from '../../../types/toolkit.d.ts';
import type { MCPRPCContext } from '../../rpc.ts';
import { runToolkitTool } from './runners/toolkit.ts';
import { runSearch } from './runners/search.ts';
import { runFetch } from './runners/fetch.ts';
import { canonicalFetchInputSchema, canonicalSearchInputSchema } from './schemas.ts';

export const handleToolCall = async (
  request: MCPRequest,
  toolkits: MCPToolkit<unknown, unknown>[],
  context?: MCPRPCContext
): Promise<MCPResponse> => {
  const { id, params } = request;
  const sink = context?.eventSink;

  if (!params) {
    const errorResp = { jsonrpc: '2.0', id, error: { code: -32601, message: 'Params missing' } } as MCPResponse;
    try { sink?.toolCallFail?.({ id, name: 'unknown', code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
    return errorResp;
  }

  // Type guard to ensure this is a tools/call request
  if (request.method !== 'tools/call') {
    const errorResp = { jsonrpc: '2.0', id, error: { code: -32601, message: 'Invalid method for tools/call handler' } } as MCPResponse;
    try { sink?.toolCallFail?.({ id, name: 'unknown', code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
    return errorResp;
  }

  const toolName: string = (params as MCPToolsCallParams).name ?? '';
  try { sink?.toolCallStart?.({ id, name: toolName }); } catch {}

  try {
    let result: MCPResponse;
    
    switch (toolName) {
      case 'search':
        {
          const v = canonicalSearchInputSchema.safeParse((params as MCPToolsCallParams).arguments);
          if (!v.success) {
            const errorResp = { jsonrpc: '2.0', id, error: { code: -32602, message: v.error.message } } as MCPResponse;
            try { sink?.toolCallFail?.({ id, name: toolName, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
            return errorResp;
          }
        }
        result = await runSearch(id, params as MCPToolsCallParams, toolkits, context);
        break;
      case 'fetch':
        {
          const v = canonicalFetchInputSchema.safeParse((params as MCPToolsCallParams).arguments);
          if (!v.success) {
            const errorResp = { jsonrpc: '2.0', id, error: { code: -32602, message: v.error.message } } as MCPResponse;
            try { sink?.toolCallFail?.({ id, name: toolName, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
            return errorResp;
          }
        }
        result = await runFetch(id, params as MCPToolsCallParams, toolkits, context);
        break;
      default:
        result = await runToolkitTool(id, params as MCPToolsCallParams, toolkits, context);
        break;
    }

    if ('error' in result && result.error) {
      try { sink?.toolCallFail?.({ id, name: toolName, code: result.error.code, message: result.error.message }); } catch {}
    } else {
      try { sink?.toolCallSuccess?.({ id, name: toolName }); } catch {}
    }
    
    return result;
  } catch (error) {
    const errorResp = { jsonrpc: '2.0', id, error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error' } } as MCPResponse;
    try { sink?.toolCallFail?.({ id, name: toolName, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
    return errorResp;
  }
};


// toolkit runner moved to ./runners/toolkit


