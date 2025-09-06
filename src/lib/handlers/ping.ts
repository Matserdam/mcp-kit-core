import type { MCPResponse, MCPPingResult } from '../../types/server.d.ts';

export function handlePing(id: string | number | null): MCPResponse {
  const result: MCPPingResult = {};
  return { jsonrpc: '2.0', id, result };
}


