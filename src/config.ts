import type { MCPConfig } from './types/config';

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : undefined;
}

export function loadMCPConfig(overrides?: Partial<MCPConfig>): MCPConfig {
  const host = process.env.MCP_HOST;
  const envFetch = parsePort(process.env.MCP_FETCH_PORT);
  const envSse = parsePort(process.env.MCP_SSE_PORT);
  const envStreamable = parsePort(process.env.MCP_STREAMABLE_PORT);

  const srv = overrides?.server ?? {};

  // Resolve stdio
  const stdio = srv.stdio?.enable ? ({ enable: true } as const) : undefined;

  // Resolve HTTP transports (enabled only if overrides specify enable: true)
  const fetch = srv.fetch?.enable
    ? { enable: true as const, port: srv.fetch.port ?? envFetch ?? (() => { throw new Error('MCP_FETCH_PORT must be set when fetch transport is enabled'); })() }
    : undefined;
  const sse = srv.sse?.enable
    ? { enable: true as const, port: srv.sse.port ?? envSse ?? (() => { throw new Error('MCP_SSE_PORT must be set when sse transport is enabled'); })() }
    : undefined;
  const streamable = srv.streamable?.enable
    ? { enable: true as const, port: srv.streamable.port ?? envStreamable ?? (() => { throw new Error('MCP_STREAMABLE_PORT must be set when streamable transport is enabled'); })() }
    : undefined;

  return {
    server: {
      host: srv.host ?? host,
      stdio,
      fetch,
      sse,
      streamable,
    },
  };
}


