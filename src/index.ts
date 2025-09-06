export { MCPServer } from "./lib/index.ts";

export type * from "./types/toolkit.d.ts";
export type * from "./types/server.d.ts";
export type * from "./types/config.d.ts";
export type * from "./types/stdio.d.ts";
// Note: example-specific types must not leak into core
export type * from "./types/search.d.ts";
export type * from "./types/auth.d.ts";
export type { EventSink } from "./types/observability.d.ts";
export { MCP_AUTH_ERROR_CODES, MCPAuthError } from "./lib/auth/index.ts";
export {
  ConsoleEventSink,
  InMemoryEventSink,
  NoopEventSink,
} from "./lib/observability/event-sink.ts";

export {
  createMCPResourceProvider,
  createMCPResourceTemplateProvider,
} from "./lib/factories/resources.ts";
// Export core auth functionality (excluding discovery for faster cold start)
export * from "./lib/auth/executor.ts";
export * from "./lib/auth/middleware.ts";
export * from "./lib/auth/errors.ts";

// Export discovery features separately (can be imported on-demand)
export * from "./lib/auth/discovery.ts";
