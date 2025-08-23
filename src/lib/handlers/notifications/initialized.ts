import type { MCPResponse } from '../../../types/server';

export const handleNotificationInitialized = (id: string | number | null): MCPResponse => {
  return { jsonrpc: '2.0', id, result: { ok: true } };
};


