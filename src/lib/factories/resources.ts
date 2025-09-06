import type {
  MCPResourceProvider,
  MCPResourceProviderInit,
  MCPResourceTemplateProvider,
  MCPResourceTemplateProviderInit,
} from "../../types/toolkit.d.ts";

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

export function createMCPResourceTemplateProvider<TContext = unknown>(
  init: MCPResourceTemplateProviderInit<TContext>,
): MCPResourceTemplateProvider<TContext> {
  return {
    descriptor: init.descriptor,
    read: init.read,
  };
}
