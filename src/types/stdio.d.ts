// STDIO transport types

/** Message framing strategies supported by the STDIO transport. */
export type MCPStdioFraming = "ndjson" | "length-prefixed";

/** Options to configure the STDIO transport. */
export interface MCPStdioOptions {
  /** Readable stream - provide when running under non-Node runtimes too. */
  input?: ReadableStream<Uint8Array>;
  /** Writable stream - provide when running under non-Node runtimes too. */
  output?: WritableStream<Uint8Array>;
  /** Message framing strategy. Default: 'ndjson'. */
  framing?: MCPStdioFraming;
  /** When true (default), install SIGINT/SIGTERM handlers to stop stdio gracefully. */
  enableSignalHandlers?: boolean;
  /**
   * Strategy for the protocolVersion returned from initialize when using stdio transport.
   * - "ours" (default): always return the server's canonical protocol version
   * - "mirror": mirror the client's requested protocolVersion when provided
   */
  protocolVersionStrategy?: "ours" | "mirror";
}

/** Controller returned by the STDIO transport loop. */
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
