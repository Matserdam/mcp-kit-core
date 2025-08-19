import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src';

describe('SSE public surface', () => {
  it('handleSSE returns a ReadableStream and accepts options', async () => {
    const server = new MCPServer({ toolkits: [] });
    const stream = await server.httpSSE(new Request('http://localhost/events'), { heartbeatIntervalMs: 1000, idleTimeoutMs: 0, retryMs: 5000 });
    expect(stream).toBeInstanceOf(ReadableStream);
  });
});


