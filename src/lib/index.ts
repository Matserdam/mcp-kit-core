import type { InitializeResult, MCPRequest, MCPResponse, MCPServerOptions, MCPToolCallResult, MCPToolsListResult } from '../types/server';
import type { MCPSSERenderer, MCPSSERuntimeOptions, MCPSSERawEvent } from '../types/sse';
import { createSseRenderer } from './sse';
import { MCPTool, MCPToolkit } from '../types/toolkit';
import { getValidSchema } from '../utils';
import { parseFetchRpc } from '../validations/request.fetch';
import { handleRPC } from './rpc';

export class MCPServer {
  private readonly options: MCPServerOptions;

  public constructor(options: MCPServerOptions) {
    this.options = options;
    this.options = this.options;
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

    console.log('fetch', method);

    const json = (data: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json' },
        ...init,
      });

    if (method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let rpc: any;
    try {
      rpc = await request.json();
    } catch {
      console.log('parse error');
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
    }
    console.log({ rpc });
    const parsed = parseFetchRpc(rpc);
    if ("error" in parsed) {
      console.log('parse error 2', rpc, parsed);
      return json({ jsonrpc: '2.0', id: parsed.id, error: parsed.error }, { status: 400 });
    }
    const response = await handleRPC(parsed, this.options.toolkits);
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

  public httpSSE(req: unknown, options?: MCPSSERuntimeOptions): Promise<ReadableStream<Uint8Array>> {
    void req;
    const renderer = createSseRenderer({ commentHeartbeat: options?.commentHeartbeat });
    const retry = typeof options?.retryMs === 'number' ? options?.retryMs : undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Initial hello message to verify framing
        const hello = renderer.render({ event: 'message', data: 'ready', retry });
        controller.enqueue(hello);
        controller.close();
      },
    });
    return Promise.resolve(stream);
  }
}


