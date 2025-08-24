import type { MCPRequest, MCPResponse } from '../types/server';
import type { MCPStdioOptions, MCPStdioController } from '../types/stdio';
import { handleRPC } from './rpc';
import type { MCPToolkit } from '../types/toolkit';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * StdioController implements a newline-delimited JSON (NDJSON) stdio transport.
 * - Reads JSON-RPC requests from the input stream line-by-line.
 * - Writes JSON-RPC responses and notifications to the output stream.
 * - Uses an internal write queue to respect backpressure.
 */
export class StdioController implements MCPStdioController {
  private running = false;
  private reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  private writeQueue: Uint8Array[] = [];
  private writing = false;
  private signalHandlersInstalled = false;

  /**
   * Create a new stdio controller.
   * @param toolkits Registered toolkits for handling tool calls
   * @param options Stdio runtime options (input/output streams, framing)
   */
  constructor(
    private readonly toolkits: MCPToolkit[],
    private readonly options: MCPStdioOptions = {}
  ) { }

  /** Whether the stdio loop is running. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Start the reader and writer loops. Safe to call multiple times. */
  start = async (): Promise<void> => {
    if (this.running) return;

    const input = this.options.input ?? process.stdin;
    const output = this.options.output ?? process.stdout;

    // Convert Node streams to Web streams when needed.
    // We detect Web ReadableStream by the presence of getReader().
    const inputStream: ReadableStream<Uint8Array> = (input as any)?.getReader
      ? (input as unknown as ReadableStream<Uint8Array>)
      : new ReadableStream<Uint8Array>({
        // Bridge NodeJS.ReadStream → Web ReadableStream
        start(controller) {
          const nodeIn = input as NodeJS.ReadStream;
          nodeIn.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          nodeIn.on('end', () => {
            try { controller.close(); } catch { /* ignore double close */ }
          });
          nodeIn.on('error', (err: unknown) => controller.error(err));
        },
      });

    // Detect Web WritableStream by the presence of getWriter().
    const outputStream: WritableStream<Uint8Array> = (output as any)?.getWriter
      ? (output as unknown as WritableStream<Uint8Array>)
      : new WritableStream<Uint8Array>({
        // Bridge Web WritableStream → NodeJS.WriteStream
        write(chunk) {
          const nodeOut = output as NodeJS.WriteStream;
          nodeOut.write(Buffer.from(chunk));
        },
      });

    this.reader = inputStream.getReader();
    this.writer = outputStream.getWriter();
    this.running = true;

    // Optional signal handlers for graceful shutdown (Node/Bun)
    if (this.options.enableSignalHandlers !== false && typeof process !== 'undefined' && process.on) {
      if (!this.signalHandlersInstalled) {
        const stop = () => { void this.stop(); };
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
        this.signalHandlersInstalled = true;
      }
    }

    // Start reader loop (no await to avoid blocking)
    void this.readLoop();
  }

  /** Stop the loops and close streams. Idempotent. */
  stop = async(): Promise<void> => {
    this.running = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // noop
      }
      this.reader = undefined;
    }
    if (this.writer) {
      try {
        await this.writer.close();
      } catch {
        // noop
      }
      this.writer = undefined;
    }
  }

  /** Queue a JSON-RPC notification to the output. Returns false if not running. */
  notify = (method: string, params?: Record<string, unknown>): boolean => {
    if (!this.running || !this.writer) return false;

    // We serialize a JSON-RPC notification envelope on the wire (id = null, method, params).
    // The transport layer treats this like a request for framing purposes.
    const notification = {
      jsonrpc: '2.0',
      id: null,
      method,
      params,
    } as const;

    void this.queueWrite(textEncoder.encode(JSON.stringify(notification) + '\n'));
    return true;
  }

  /**
   * Reader loop that accumulates bytes and parses NDJSON lines robustly.
   * Handles cases where a single JSON object spans multiple chunks.
   */
  private readLoop = async (): Promise<void> => {
    if (!this.reader) return;

    let bufferedText = '';
    try {
      while (this.running) {
        const { done, value } = await this.reader.read();
        if (done) break;
        if (!value) continue;

        // Stream-decoding avoids breaking in the middle of multi-byte code points
        bufferedText += textDecoder.decode(value, { stream: true });
        let newlineIndex: number;
        // Process complete lines; keep the last partial line in buffer
        while ((newlineIndex = bufferedText.indexOf('\n')) !== -1) {
          const line = bufferedText.slice(0, newlineIndex);
          bufferedText = bufferedText.slice(newlineIndex + 1);
          if (!line.trim()) continue;

          try {
            const request = JSON.parse(line) as MCPRequest;
            const response = await handleRPC(request, this.toolkits);
            void this.queueWrite(textEncoder.encode(JSON.stringify(response) + '\n'));
          } catch {
            const errorResponse: MCPResponse = {
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: 'Parse error' },
            };
            void this.queueWrite(textEncoder.encode(JSON.stringify(errorResponse) + '\n'));
          }
        }
      }

      // Flush any trailing line without newline (best effort)
      if (bufferedText.trim().length > 0) {
        try {
          const request = JSON.parse(bufferedText) as MCPRequest;
          const response = await handleRPC(request, this.toolkits);
          void this.queueWrite(textEncoder.encode(JSON.stringify(response) + '\n'));
        } catch {
          const errorResponse: MCPResponse = {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' },
          };
                      void this.queueWrite(textEncoder.encode(JSON.stringify(errorResponse) + '\n'));
        }
      }
    } catch {
      // Reader error - stop the loop
      this.running = false;
    }
  }

  /** Enqueue data to be written, starting the writer loop if idle. */
  private queueWrite = async (data: Uint8Array): Promise<void> => {
    if (!this.writer) return;

    this.writeQueue.push(data);
    if (!this.writing) {
      await this.writeLoop();
    }
  }

  /** Write loop that respects backpressure by awaiting writer.write(). */
  private writeLoop = async (): Promise<void> => {
    if (!this.writer || this.writing) return;

    this.writing = true;
    try {
      while (this.writeQueue.length > 0 && this.running) {
        const data = this.writeQueue.shift()!;
        await this.writer.write(data);
      }
    } finally {
      this.writing = false;
    }
  }
}
