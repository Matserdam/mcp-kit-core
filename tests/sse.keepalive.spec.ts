import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src';

const takeN = async (rs: ReadableStream<Uint8Array>, n: number) => {
  const reader = rs.getReader();
  const chunks: Uint8Array[] = [];
  while (chunks.length < n) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return chunks.map((c) => new TextDecoder().decode(c)).join('');
};

describe('MCPServer.httpSSE keepalive and timeout', () => {
  it('emits heartbeats on interval', async () => {
    const server = new MCPServer({ toolkits: [] });
    const stream = await server.httpSSE({}, { heartbeatIntervalMs: 5, commentHeartbeat: true, idleTimeoutMs: 0 });
    const text = await takeN(stream, 3); // initial hello + 2 heartbeats
    expect(text).toContain('event: message\n');
    expect(text).toContain(':heartbeat\n\n');
  });

  it('closes on idle timeout', async () => {
    const server = new MCPServer({ toolkits: [] });
    const stream = await server.httpSSE({}, { idleTimeoutMs: 5 });
    // Consume all output; should end quickly
    const reader = stream.getReader();
    let closed = false;
    while (true) {
      const { done } = await reader.read();
      if (done) { closed = true; break; }
    }
    expect(closed).toBe(true);
  });
});


