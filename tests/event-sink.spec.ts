import { describe, it, expect } from 'vitest';
import { MCPServer, InMemoryEventSink } from '../src/index';

describe('Event Sink', () => {
  it('should emit RPC events for tools/list', async () => {
    const eventSink = new InMemoryEventSink();
    const server = new MCPServer({
      toolkits: [],
      eventSink
    });

    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list'
      })
    });

    const response = await server.fetch(request);
    expect(response.status).toBe(200);

    const events = eventSink.getEvents();
    expect(events.length).toBeGreaterThan(0);

    // Should have RPC received event
    const rpcReceived = eventSink.getEvents('rpc.received');
    expect(rpcReceived).toHaveLength(1);
    expect(rpcReceived[0].payload).toEqual({ id: 'test-1', method: 'tools/list' });

    // Should have tools list start event
    const toolsListStart = eventSink.getEvents('tools.list.start');
    expect(toolsListStart).toHaveLength(1);
    expect(toolsListStart[0].payload).toEqual({ id: 'test-1' });

    // Should have tools list success event
    const toolsListSuccess = eventSink.getEvents('tools.list.success');
    expect(toolsListSuccess).toHaveLength(1);
    expect(toolsListSuccess[0].payload).toMatchObject({ id: 'test-1', count: expect.any(Number) });

    // Should have RPC succeeded event
    const rpcSucceeded = eventSink.getEvents('rpc.succeeded');
    expect(rpcSucceeded).toHaveLength(1);
    expect(rpcSucceeded[0].payload).toEqual({ id: 'test-1', method: 'tools/list' });
  });

  it('should emit RPC events for valid method', async () => {
    const eventSink = new InMemoryEventSink();
    const server = new MCPServer({
      toolkits: [],
      eventSink
    });

    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-2',
        method: 'ping'
      })
    });

    const response = await server.fetch(request);
    expect(response.status).toBe(200);

    // Should have RPC received event
    const rpcReceived = eventSink.getEvents('rpc.received');
    expect(rpcReceived).toHaveLength(1);
    expect(rpcReceived[0].payload).toEqual({ id: 'test-2', method: 'ping' });

    // Should have RPC succeeded event (ping always succeeds)
    const rpcSucceeded = eventSink.getEvents('rpc.succeeded');
    expect(rpcSucceeded).toHaveLength(1);
    expect(rpcSucceeded[0].payload).toEqual({ id: 'test-2', method: 'ping' });
  });

  it('should not emit events when no event sink is configured', async () => {
    const server = new MCPServer({
      toolkits: []
      // No eventSink configured - should use NoopEventSink
    });

    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-3',
        method: 'tools/list'
      })
    });

    const response = await server.fetch(request);
    expect(response.status).toBe(200);

    // Should work without errors (no-op sink)
    const responseData = await response.json();
    expect(responseData).toMatchObject({
      jsonrpc: '2.0',
      id: 'test-3',
      result: expect.any(Object)
    });
  });
});
