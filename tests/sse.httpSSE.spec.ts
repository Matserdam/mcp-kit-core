import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src';

const readFirst = async (rs: ReadableStream<Uint8Array>) => {
  const reader = rs.getReader();
  const { value } = await reader.read();
  try { await reader.cancel(); } catch { /* noop */ }
  return new TextDecoder().decode(value ?? new Uint8Array());
};

describe('MCPServer.httpSSE', () => {
  it('returns a framed hello message', async () => {
    const server = new MCPServer({ toolkits: [] });
    // Pass a raw Request now that API expects it
    const stream = await server.httpSSE(new Request('http://localhost/events'), { retryMs: 1000 });
    const text = await readFirst(stream);
    expect(text).toContain('event: message\n');
    expect(text).toContain('data: ready\n');
    expect(text).toContain('\n\n');
  });
});


