// Edge/Deno entry point - excludes stdio transport for compatibility
export { MCPServer } from './lib/index.edge.ts';

export type * from './types/toolkit.d.ts';
export type * from './types/server.d.ts';
export type * from './types/config.d.ts';
export type * from './types/search.d.ts';
export type * from './types/auth.d.ts';
export type { EventSink } from './types/observability.d.ts';
export { MCPAuthError, MCP_AUTH_ERROR_CODES } from './lib/auth/index.ts';
export { ConsoleEventSink, NoopEventSink, InMemoryEventSink } from './lib/observability/event-sink.ts';

export { createMCPResourceProvider, createMCPResourceTemplateProvider } from './lib/factories/resources.ts';
// Export core auth functionality (excluding discovery for faster cold start)
export * from './lib/auth/executor.ts';
export * from './lib/auth/middleware.ts';
export * from './lib/auth/errors.ts';

// Export discovery features separately (can be imported on-demand)
export * from './lib/auth/discovery.ts';

// Note: stdio transport is not available in edge/Deno builds
// Use MCPServer.fetch() for HTTP-based MCP handling
