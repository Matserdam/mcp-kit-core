// STDIO transport types

export type MCPStdioFraming = 'ndjson' | 'length-prefixed';

export interface MCPStdioOptions {
  /** Defaults to process.stdin when running under Node/Bun. */
  input?: NodeJS.ReadStream | ReadableStream<Uint8Array>;
  /** Defaults to process.stdout when running under Node/Bun. */
  output?: NodeJS.WriteStream | WritableStream<Uint8Array>;
  /** Message framing strategy. Default: 'ndjson'. */
  framing?: MCPStdioFraming;
}

export interface MCPStdioController {
  /** Whether the stdio loop is actively running. */
  readonly isRunning: boolean;
  /** Stop the stdio loop and cleanup resources. */
  stop(): Promise<void>;
  /**
   * Send a JSON-RPC notification to the connected client.
   * Returns false if not running.
   */
  notify(method: string, params?: Record<string, unknown>): boolean;
}


