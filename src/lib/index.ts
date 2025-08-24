import type { MCPServerOptions } from '../types/server';
import type { MCPStdioOptions, MCPStdioController } from '../types/stdio';
import { StdioController } from './stdio';
import { parseFetchRpc } from '../validations/request.fetch';
import { handleRPC } from './rpc';
import { responseJson } from './response/json';
import { responseSSEOnce } from './response/sse';
import { MCPDiscoveryHandler, createDiscoveryResponse, createDiscoveryError } from './auth/discovery';

export class MCPServer {
  private readonly options: MCPServerOptions;
  private discoveryHandler?: MCPDiscoveryHandler;

  public constructor(options: MCPServerOptions) {
    this.options = options;
    
    // Initialize discovery handler if configuration is provided
    if (options.discovery) {
      this.discoveryHandler = new MCPDiscoveryHandler(options.discovery);
      
      // Validate discovery configuration
      const validation = this.discoveryHandler.validateConfiguration();
      if (!validation.valid) {
        throw new Error(`Invalid discovery configuration: ${validation.errors.join(', ')}`);
      }
    }
  }

  // public readonly handleRPC = async (parsed: MCPRequest): Promise<MCPResponse> => {
  //   const { id, method, params } = parsed;
  //   switch (method) {
  //     case 'initialize': {
  //       const result: InitializeResult = {
  //         protocolVersion: '2025-06-18',
  //         serverInfo: { name: 'mcp-kit', version: '0.0.1' },
  //         capabilities: { tools: { listChanged: true } },
  //       };
  //       return { jsonrpc: '2.0', id: id!, result };
  //     }
  //     case 'tools/list': {
  //       const tools = this.options.toolkits.flatMap((tk: MCPToolkit) =>
  //         (tk.tools ?? []).map((tool: MCPTool) => {
  //           const fullName = `${tk.namespace}.${tool.name}`;
  //           const inputSchema = getValidSchema(tool.input);
  //           const outputSchema = getValidSchema(tool.output);
  //           return { name: fullName, description: tool.description ?? '', inputSchema, outputSchema };
  //         }),
  //       );
  //       const result: MCPToolsListResult = { tools };
  //       return { jsonrpc: '2.0', id: id!, result };
  //     }
  //     case 'tools/call': {
  //       const name = typeof (params as any)?.name === 'string' ? (params as any).name : undefined;
  //       const input = (params as any)?.params ?? (params as any)?.input ?? undefined;
  //       if (!name || !name.includes('.')) {
  //         return { jsonrpc: '2.0', id: id!, error: { code: -32602, message: 'Invalid params: expected params.name as "namespace.tool"' } };
  //       }
  //       const [namespace, toolName] = name.split('.', 2);
  //       const toolkit = this.options.toolkits.find((tk: MCPToolkit) => tk.namespace === namespace);
  //       if (!toolkit) return { jsonrpc: '2.0', id: id!, error: { code: -32601, message: `Toolkit not found: ${namespace}` } };
  //       const tool = (toolkit.tools ?? []).find((t: MCPTool) => t.name === toolName);
  //       if (!tool) return { jsonrpc: '2.0', id: id!, error: { code: -32601, message: `Tool not found: ${name}` } };
  //       try {
  //         const init = { requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  //         const context = typeof toolkit.createContext === 'function' ? await toolkit.createContext(init) : undefined;
  //         const toolResult = await (tool as any).run(input, context);
  //         const result: MCPToolCallResult = (!toolResult || typeof toolResult !== 'object' || !Array.isArray((toolResult as any).content))
  //           ? { content: [{ type: 'text', text: JSON.stringify(toolResult) }] }
  //           : toolResult as MCPToolCallResult;
  //         return { jsonrpc: '2.0', id: id!, result };
  //       } catch (err: any) {
  //         return { jsonrpc: '2.0', id: id!, error: { code: -32000, message: 'Tool execution error', data: { message: String(err?.message ?? err) } } };
  //       }
  //     }
  //     default: {
  //       return { jsonrpc: '2.0', id: id!, error: { code: -32601, message: 'Method not found' } };
  //     }
  //   }
  // };

  public readonly fetch = async (request: Request): Promise<Response> => {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);

    const json = (data: unknown, init?: ResponseInit) => responseJson(data, init);

    // Handle discovery endpoints
    if (this.discoveryHandler && this.options.discovery?.enableDiscoveryEndpoints !== false) {
      // Handle CORS preflight for discovery endpoints
      if (method === 'OPTIONS' && url.pathname.startsWith('/.well-known/')) {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      // Handle authorization server discovery endpoint (RFC 8414)
      if (method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
        try {
          const metadata = await this.discoveryHandler.getAuthorizationServerMetadata();
          return createDiscoveryResponse(metadata);
        } catch (error) {
          return createDiscoveryError({
            error: 'server_error',
            error_description: 'Failed to generate authorization server metadata'
          });
        }
      }

      // Handle protected resource discovery endpoint (RFC 9728)
      if (method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource') {
        try {
          const metadata = await this.discoveryHandler.getProtectedResourceMetadata();
          return createDiscoveryResponse(metadata);
        } catch (error) {
          return createDiscoveryError({
            error: 'server_error',
            error_description: 'Failed to generate protected resource metadata'
          });
        }
      }

      // Return 405 for non-GET requests to discovery endpoints
      if (url.pathname.startsWith('/.well-known/')) {
        return new Response('Method Not Allowed', { status: 405 });
      }
    }

    if (method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let rpc: unknown;
    try {
      rpc = await request.json();
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
    }
    
    // Accept negotiation
    const accept = request.headers.get('accept') ?? '*/*';
    const wantsEventStream = /(^|,|\s)text\/event-stream(\s*;|\s|$)/i.test(accept);
    const wantsJson = /(^|,|\s)application\/json(\s*;|\s|$)/i.test(accept) || accept.includes('*/*');

    // If client sent a JSON-RPC response payload (not a request), ack with 202
    const isClientResponse = rpc && typeof rpc === 'object' && (rpc as Record<string, unknown>).jsonrpc === '2.0' && !('method' in rpc) && (('result' in rpc) || ('error' in rpc));
    if (isClientResponse) {
      return new Response(null, { status: 202 });
    }
    const parsed = parseFetchRpc(rpc);
    if ("error" in parsed) {
      return json({ jsonrpc: '2.0', id: parsed.id, error: parsed.error }, { status: 400 });
    }
    
    // Notification (no id provided by client payload)
    const isNotification = rpc && typeof rpc === 'object' && (rpc as Record<string, unknown>).jsonrpc === '2.0' && typeof (rpc as Record<string, unknown>).method === 'string' && !('id' in rpc);
    if (isNotification) {
      void handleRPC(parsed, this.options.toolkits);
      return new Response(null, { status: 202 });
    }

    const response = await handleRPC(parsed, this.options.toolkits, { httpRequest: request });
    if (wantsEventStream && !wantsJson) {
      return responseSSEOnce(response);
    }
    if (wantsEventStream && wantsJson) {
      // Prefer SSE when explicitly requested alongside JSON
      return responseSSEOnce(response);
    }
    return json(response);
  }

  public stdio(): void {
    // Placeholder for stdio transport
  }

  public httpStreamable(req: unknown): Promise<{ status: number; headers: Headers; body: ReadableStream<Uint8Array> }>{
    void req;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('Not Implemented'));
        controller.close();
      },
    });
    return Promise.resolve({ status: 501, headers: new Headers({ 'content-type': 'text/plain' }), body: stream });
  }

  public startStdio = (options?: MCPStdioOptions): MCPStdioController => {
    const controller = new StdioController(this.options.toolkits, options);
    controller.start();
    return controller;
  }
}


