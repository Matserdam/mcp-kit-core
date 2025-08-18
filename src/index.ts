import type { MCPToolkit } from './types/toolkit';

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

  public fetch(request: Request): Promise<Response> {
    void request;
    return Promise.resolve(new Response('Not Implemented', { status: 501 }));
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


