import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src/index';

describe('MCPServer', () => {
  it('constructs with minimal options', () => {
    const server = new MCPServer({ toolkits: [] });
    expect(server).toBeInstanceOf(MCPServer);
  });

  it('fetch returns 501 Not Implemented by default', async () => {
    const server = new MCPServer({ toolkits: [] });
    const res = await server.fetch(new Request('http://localhost'));
    expect(res.status).toBe(501);
  });
});


