// Public SSE types for MCPServer.httpSSE

export interface MCPSSERuntimeOptions {
  /** Emit a heartbeat on this interval (ms). Use 0/undefined to disable. */
  heartbeatIntervalMs?: number;
  /** Close the stream if no user events are produced for this many ms. */
  idleTimeoutMs?: number;
  /** Suggest reconnection delay to clients via `retry:`. */
  retryMs?: number;
  /** If provided, used to generate `id:` for events when not explicitly set. */
  eventIdGenerator?: () => string;
  /** When true, heartbeats are sent as comments (":heartbeat") instead of data frames. */
  commentHeartbeat?: boolean;
}

/** Single SSE event frame payload. `data` may be multi-line; each line will be framed as `data:` */
export type MCPSSERawEvent = {
  event?: string;
  id?: string;
  retry?: number;
  data: string | string[];
};

/**
 * Minimal helper contract for framing events.
 *
 * Framing rules:
 * - If `event` is set, emit an `event:` line.
 * - If `id` is set, emit an `id:` line.
 * - If `retry` is set, emit a `retry:` line.
 * - `data` can be a string or string array. If multi-line, split by `\n` and emit one `data:` line per line.
 * - Always terminate a frame with a blank line (`\n\n`).
 * - Heartbeat MAY be rendered as a comment line beginning with `:` OR as `data: ping`, followed by `\n\n`.
 */
export interface MCPSSERenderer {
  /** Convert a raw event into SSE-framed bytes ending with "\n\n". */
  render(event: MCPSSERawEvent): Uint8Array;
  /** Render a heartbeat (comment or data, based on options). */
  renderHeartbeat(): Uint8Array;
}


