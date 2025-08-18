import type { MCPConfig, MCPServerPortsConfig, MCPServerSettingsConfig } from './types/config';

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : undefined;
}

export function loadMCPConfig(overrides?: Partial<MCPConfig>): MCPConfig {
  const envPorts: MCPServerPortsConfig = {
    host: process.env.MCP_HOST,
    fetch: parsePort(process.env.MCP_FETCH_PORT),
    sse: parsePort(process.env.MCP_SSE_PORT),
    streamable: parsePort(process.env.MCP_STREAMABLE_PORT),
  };

  const base: MCPServerSettingsConfig = {
    transports: {
      fetch: false,
      sse: false,
      stdio: false,
      streamable: false,
    },
    ports: envPorts,
  };

  const merged: MCPConfig = {
    server: {
      transports: {
        ...base.transports,
        ...(overrides?.server?.transports ?? {}),
      },
      ports: {
        ...base.ports,
        ...(overrides?.server?.ports ?? {}),
      },
    },
  };

  // Validate: if an HTTP transport is enabled, a port must be provided
  const { transports, ports } = merged.server;
  if (transports.fetch && !ports?.fetch) {
    throw new Error('MCP_FETCH_PORT must be set when fetch transport is enabled');
  }
  if (transports.sse && !ports?.sse) {
    throw new Error('MCP_SSE_PORT must be set when sse transport is enabled');
  }
  if (transports.streamable && !ports?.streamable) {
    throw new Error('MCP_STREAMABLE_PORT must be set when streamable transport is enabled');
  }

  return merged;
}


