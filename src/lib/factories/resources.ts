import type {
  MCPResourceProvider,
  MCPResourceProviderInit,
  MCPResourceTemplateProvider,
  MCPResourceTemplateProviderInit,
} from "../../types/toolkit.d.ts";

/**
 * Create a simple read-only resource provider.
 *
 * Use this to expose a single resource via `resources/read`.
 */
export function createMCPResourceProvider<TContext = unknown>(
  init: MCPResourceProviderInit<TContext>,
): MCPResourceProvider<TContext> {
  return {
    uri: init.uri,
    name: init.name,
    title: init.title,
    description: init.description,
    mimeType: init.mimeType,
    size: init.size,
    read: init.read,
  };
}

/**
 * Create a resource template provider.
 *
 * Use this to expose resources by URI template (dynamic resources).
 */
export function createMCPResourceTemplateProvider<TContext = unknown>(
  init: MCPResourceTemplateProviderInit<TContext>,
): MCPResourceTemplateProvider<TContext> {
  return {
    descriptor: init.descriptor,
    read: init.read,
  };
}
