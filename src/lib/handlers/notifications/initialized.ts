import type { MCPResponse } from "../../../types/server.d.ts";

export const handleNotificationInitialized = (id: string | number | null): MCPResponse => {
  return { jsonrpc: "2.0", id, result: { ok: true } };
};
