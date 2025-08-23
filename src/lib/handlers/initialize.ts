import type { InitializeResult, MCPResponse } from '../../types/server';

export function handleInitialize(id: string | number | null, params: unknown): MCPResponse {
  const requestedProtocol = (params as unknown as { protocolVersion?: unknown })?.protocolVersion;
  const protocolVersion = typeof requestedProtocol === 'string' && requestedProtocol.length > 0
    ? requestedProtocol
    : '2025-06-18';

  const result: InitializeResult = {
    protocolVersion,
    serverInfo: { name: 'mcp-kit', version: '0.0.1' },
    capabilities: { tools: { listChanged: true }, prompts: { listChanged: false }, resources: { listChanged: false } },
  };

  return { jsonrpc: '2.0', id, result };
}


