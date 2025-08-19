import type { MCPSSERenderer, MCPSSERawEvent } from '../types/sse';

const textEncoder = new TextEncoder();

export const createSseRenderer = (options?: { commentHeartbeat?: boolean }): MCPSSERenderer => {
  const render = (event: MCPSSERawEvent): Uint8Array => {
    const lines: string[] = [];
    if (event.event) lines.push(`event: ${event.event}\n`);
    if (event.id) lines.push(`id: ${event.id}\n`);
    if (typeof event.retry === 'number') lines.push(`retry: ${event.retry}\n`);
    const dataArray = Array.isArray(event.data) ? event.data : String(event.data).split('\n');
    for (const line of dataArray) {
      lines.push(`data: ${line}\n`);
    }
    lines.push('\n');
    return textEncoder.encode(lines.join(''));
  };

  const renderHeartbeat = (): Uint8Array => {
    if (options?.commentHeartbeat) {
      return textEncoder.encode(`:heartbeat\n\n`);
    }
    return textEncoder.encode(`data: ping\n\n`);
  };

  return { render, renderHeartbeat };
};


