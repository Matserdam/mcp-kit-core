import type { MCPResponse, MCPPingResult } from '../../types/server';

export function handlePing(id: string | number | null): MCPResponse {
  const result: MCPPingResult = {};
  return { jsonrpc: '2.0', id, result };
}


