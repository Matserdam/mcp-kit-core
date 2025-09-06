/**
 * Namespaced debug utility for MCP Kit using the official debug package
 * Replaces console usage with proper debug namespacing
 */

import debug from "debug";

/**
 * Create a namespaced debug logger with mcp-kit as the base namespace
 */
export function createDebugLogger(subNamespace: string) {
  return debug(`@mcp-kit/core:${subNamespace}`);
}

/**
 * Pre-configured debug loggers for common namespaces
 */
export const debugLoggers = {
  auth: createDebugLogger("auth"),
  server: createDebugLogger("server"),
  discovery: createDebugLogger("discovery"),
  audit: createDebugLogger("audit"),
  rpc: createDebugLogger("rpc"),
  stdio: createDebugLogger("stdio"),
};

// Export the main debug function for backward compatibility
export { debug };
