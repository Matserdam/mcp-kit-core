import type { MCPResponse, MCPResourceReadParams, MCPResourceReadResult, MCPRequest } from '../../../types/server.d.ts';
import type { MCPToolkit, MCPResourceProvider, MCPResourceTemplateProvider } from '../../../types/toolkit.d.ts';
import type { ResourceUri } from '../../../types/server.d.ts';
import type { MCPRPCContext } from '../../rpc.ts';
import type { MCPRequestWithHeaders } from '../../../types/auth.d.ts';
import { defaultAuthMiddlewareManager } from '../../auth/middleware.ts';
import { MCPAuthError } from '../../auth/errors.ts';
import { uriMatchesTemplate } from './util.ts';

// Helper function to convert HTTP request to MCPRequestWithHeaders
function createMCPRequestWithHeaders(
  mcpRequest: MCPRequest, 
  httpRequest?: Request
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
    headers
  };
}

const createContext = async (toolkit: MCPToolkit<unknown, unknown>, contextInit: { requestId?: string | number | null }): Promise<Record<string, unknown>> => {
  const contextResult = toolkit.createContext?.(contextInit) ?? {};
  return contextResult instanceof Promise ? await contextResult : contextResult;
};

// Helper function to authenticate toolkit
async function authenticateToolkit(
  toolkit: MCPToolkit<unknown, unknown>,
  id: string | number | null,
  params: MCPResourceReadParams,
  rpcContext?: MCPRPCContext
): Promise<void> {
  if (toolkit.auth) {
    try {
      const mcpRequestWithHeaders = createMCPRequestWithHeaders(
        { id, method: 'resources/read', params } as MCPRequest,
        rpcContext?.httpRequest
      );
      
      const authResult = await defaultAuthMiddlewareManager.executeToolkitAuth(
        toolkit, 
        mcpRequestWithHeaders, 
        rpcContext?.env || null,
        rpcContext?.eventSink
      );
      if (!authResult) {
        throw new MCPAuthError('Authentication required', 401);
      }
    } catch (error) {
      if (error instanceof MCPAuthError) {
        throw error;
      }
      throw new MCPAuthError('Authentication failed', 401);
    }
  }
}

export const handleResourcesRead = async (
  id: string | number | null,
  params: MCPResourceReadParams,
  toolkits: MCPToolkit<unknown, unknown>[],
  contextInit: { requestId?: string | number | null },
  rpcContext?: MCPRPCContext
): Promise<MCPResponse> => {
  const uri: string | undefined = (params as { uri?: string }).uri;
  const sink = rpcContext?.eventSink;
  
  try { sink?.resourceReadStart?.({ id, uri }); } catch {}
  
  if (!uri) {
    const errorResp = { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected uri' } } as MCPResponse;
    try { sink?.resourceReadFail?.({ id, uri, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
    return errorResp;
  }

  const providers: Array<MCPResourceProvider<unknown>> = toolkits.flatMap((tk) => tk.resources ?? []);
  const provider: MCPResourceProvider<unknown> | undefined = providers.find((p) => p.uri === uri);
  if (provider) {
    const tk = toolkits.find((t) => (t.resources ?? []).includes(provider));
    if (!tk) {
      const errorResp = { jsonrpc: '2.0', id, error: { code: -32002, message: 'Resource provider not found' } } as MCPResponse;
      try { sink?.resourceReadFail?.({ id, uri, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
      return errorResp;
    }
    
    // Authenticate the toolkit that provides this resource
    try {
      await authenticateToolkit(tk, id, params, rpcContext);
    } catch (error) {
      if (error instanceof MCPAuthError) {
        const errorResp = { jsonrpc: '2.0', id, error: { code: -32001, message: error.message } } as MCPResponse;
        try { sink?.resourceReadFail?.({ id, uri, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
        return errorResp;
      }
      throw error;
    }
    
    const context = await createContext(tk, contextInit);
    const resultPromise = provider.read(context);
    const result: MCPResourceReadResult = resultPromise instanceof Promise ? await resultPromise : resultPromise;
    try { sink?.resourceReadSuccess?.({ id, uri }); } catch {}
    return { jsonrpc: '2.0', id, result };
  }

  const templates: Array<MCPResourceTemplateProvider<unknown>> = toolkits.flatMap((tk) => tk.resourceTemplates ?? []);
  for (const tpl of templates) {
    const { ok, params: pathParams } = uriMatchesTemplate(uri, tpl.descriptor.uriTemplate);
    if (!ok) continue;
    const tk = toolkits.find((t) => (t.resourceTemplates ?? []).includes(tpl));
    if (!tk) {
      continue;
    }
    
    // Authenticate the toolkit that provides this resource template
    try {
      await authenticateToolkit(tk, id, params, rpcContext);
    } catch (error) {
      if (error instanceof MCPAuthError) {
        const errorResp = { jsonrpc: '2.0', id, error: { code: -32001, message: error.message } } as MCPResponse;
        try { sink?.resourceReadFail?.({ id, uri, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
        return errorResp;
      }
      throw error;
    }
    
    const context = await createContext(tk, contextInit);
    const mergedContext = Object.assign({}, context, { params: pathParams });
    const resultPromise = tpl.read(uri as ResourceUri, mergedContext);
    const result: MCPResourceReadResult = resultPromise instanceof Promise ? await resultPromise : resultPromise;
    try { sink?.resourceReadSuccess?.({ id, uri }); } catch {}
    return { jsonrpc: '2.0', id, result };
  }

  const errorResp = { jsonrpc: '2.0', id, error: { code: -32002, message: 'Resource not found' } } as MCPResponse;
  try { sink?.resourceReadFail?.({ id, uri, code: errorResp.error!.code, message: errorResp.error!.message }); } catch {}
  return errorResp;
};


