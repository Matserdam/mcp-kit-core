import type { MCPResponse } from "../../types/server.d.ts";

export function handleInitialize(
  id: string | number | null,
  params: unknown,
  strategy: "ours" | "mirror" = "ours",
): MCPResponse {
  const requestedProtocol = (params as { protocolVersion?: unknown })?.protocolVersion;
  const serverProtocol = "2025-06-18";
  const protocolVersion = strategy === "mirror" && typeof requestedProtocol === "string" && requestedProtocol.length > 0
    ? requestedProtocol
    : serverProtocol;

  const result = {
    protocolVersion,
    serverInfo: { name: "mcp-kit", version: "0.0.1" },
    capabilities: {
      tools: { listChanged: true },
      prompts: { listChanged: false },
      resources: { listChanged: false },
    },
  };

  return { jsonrpc: "2.0", id, result };
}
