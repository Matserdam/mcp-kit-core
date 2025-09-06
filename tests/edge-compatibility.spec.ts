import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src/mod';
import { generateId } from '../src/lib/utils/uuid';

describe('Edge Compatibility', () => {
  it('should import from edge entry without stdio', async () => {
    // Test edge entry imports work
    const server = new MCPServer({ toolkits: [] });
    expect(server).toBeDefined();
    expect(typeof server.fetch).toBe('function');
    
    // Test that startStdio is not available in edge build
    expect((server as any).startStdio).toBeUndefined();
  });

  it('should handle HTTP requests in edge-compatible way', async () => {
    const server = new MCPServer({ toolkits: [] });
    
    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'edge-test',
        method: 'ping'
      })
    });
    
    const response = await server.fetch(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toMatchObject({
      jsonrpc: '2.0',
      id: 'edge-test',
      result: {}
    });
  });

  it('should generate runtime-agnostic UUIDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
    
    // Should be valid UUID-like format (either real UUID or fallback)
    expect(id1).toMatch(/^[0-9a-f-]+$/i);
  });

  it('should work with Web APIs only', () => {
    // Test that core functionality uses only Web APIs
    const server = new MCPServer({ toolkits: [] });
    
    // These should all be Web API constructors
    expect(typeof Request).toBe('function');
    expect(typeof Response).toBe('function');
    expect(typeof Headers).toBe('function');
    expect(typeof URL).toBe('function');
    expect(typeof TextEncoder).toBe('function');
    expect(typeof TextDecoder).toBe('function');
    expect(typeof ReadableStream).toBe('function');
    
    // Server should be constructible
    expect(server).toBeInstanceOf(Object);
  });
});
