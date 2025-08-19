import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src';

const readAll = async (rs: ReadableStream<Uint8Array>) => {
  const reader = rs.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => new Uint8Array([...acc, ...c]), new Uint8Array());
  return new TextDecoder().decode(total);
};

describe('MCPServer.httpSSE', () => {
  it('returns a framed hello message', async () => {
    const server = new MCPServer({ toolkits: [] });
    const stream = await server.httpSSE({}, { retryMs: 1000 });
    const text = await readAll(stream);
    expect(text).toContain('event: message\n');
    expect(text).toContain('data: ready\n');
    expect(text).toContain('\n\n');
  });
});


