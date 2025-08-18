import type { MCPToolkit } from './types/toolkit';
import { parseFetchRpc } from './validations/request.fetch';

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface Config {
  concurrency?: number;
  timeouts?: { requestMs?: number };
  logging?: { level?: 'debug' | 'info' | 'warn' | 'error' };
}

export interface MCPServerOptions {
  toolkits: Array<MCPToolkit>;
  logger?: Logger;
  config?: Partial<Config>;
}

export class MCPServer {
  private readonly options: MCPServerOptions;

  public constructor(options: MCPServerOptions) {
    this.options = options;
  }

  public async fetch(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();

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
      // JSON-RPC: invalid JSON → parse error
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
    }
    const parsed = parseFetchRpc(rpc);
    if ('error' in parsed) {
      return json({ jsonrpc: '2.0', id: parsed.id, error: parsed.error }, { status: 400 });
    }
    const { id: responseId, method: rpcMethod, params } = parsed;

    const respondOk = (result: unknown) => json({ jsonrpc: '2.0', id: responseId, result });
    const respondErr = (code: number, message: string, data?: unknown, status = 400) =>
      json({ jsonrpc: '2.0', id: responseId, error: { code, message, data } }, { status });

    if (rpcMethod === 'initialize') {
      return respondOk({ protocol: 'mcp-kit', capabilities: { tools: true } });
    }

    if (rpcMethod === 'tools/list') {
      const tools = this.options.toolkits.flatMap((tk) =>
        (tk.tools ?? []).map((tool) => {
          const fullName = `${tk.namespace}.${tool.name}`;
          const inputSchema = 'jsonSchema' in (tool.input ?? {}) ? (tool.input as any).jsonSchema : undefined;
          const outputSchema = 'jsonSchema' in (tool.output ?? {}) ? (tool.output as any).jsonSchema : undefined;
          return { name: fullName, description: tool.description, inputSchema, outputSchema };
        }),
      );
      return respondOk({ tools });
    }

    if (rpcMethod === 'tools/call') {
      const name = typeof (params as any)?.name === 'string' ? (params as any).name : undefined;
      const input = (params as any)?.params ?? (params as any)?.input ?? undefined;
      if (!name || !name.includes('.')) {
        return respondErr(-32602, 'Invalid params: expected params.name as "namespace.tool"');
      }
      const [namespace, toolName] = name.split('.', 2);
      const toolkit = this.options.toolkits.find((tk) => tk.namespace === namespace);
      if (!toolkit) return respondErr(-32601, `Toolkit not found: ${namespace}`, undefined, 404);
      const tool = (toolkit.tools ?? []).find((t) => t.name === toolName);
      if (!tool) return respondErr(-32601, `Tool not found: ${name}`, undefined, 404);
      try {
        const init = { requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
        const context = typeof toolkit.createContext === 'function' ? await toolkit.createContext(init) : undefined;
        const result = await (tool as any).run(input, context);
        return respondOk(result);
      } catch (err: any) {
        return respondErr(-32000, 'Tool execution error', { message: String(err?.message ?? err) }, 500);
      }
    }

    return json({ jsonrpc: '2.0', id: responseId, error: { code: -32601, message: 'Method not found' } }, { status: 404 });
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

  public httpSSE(req: unknown): Promise<ReadableStream<Uint8Array>> {
    void req;
    const encoder = new TextEncoder();
    return Promise.resolve(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: message\n'));
        controller.enqueue(encoder.encode('data: not-implemented\n\n'));
        controller.close();
      },
    }));
  }
}

export type {
  MCPToolkit,
  MCPTool,
  MCPToolkitInit,
  MCPSchemaDef,
  MCPJSONSchema,
  MCPToolMiddleware,
  MCPToolkitMiddleware,
} from './types/toolkit';

export type { MCPConfig, MCPServerSettingsConfig } from './types/config';


