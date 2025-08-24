export { MCPServer } from './lib/index';

export type * from './types/toolkit';
export type * from './types/server';
export type * from './types/config';
export type * from './types/stdio';
export type * from './types/pokemon';
export type * from './types/search';
export type * from './types/auth';
export { MCPAuthError, MCP_AUTH_ERROR_CODES } from './lib/auth';

export { createMCPResourceProvider, createMCPResourceTemplateProvider } from './lib/factories/resources';
// Export core auth functionality (excluding discovery for faster cold start)
export * from './lib/auth/executor';
export * from './lib/auth/middleware';
export * from './lib/auth/errors';

// Export discovery features separately (can be imported on-demand)
export * from './lib/auth/discovery';

