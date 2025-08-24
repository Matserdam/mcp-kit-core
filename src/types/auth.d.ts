import type { MCPRequest } from './server';

// Extended request type with headers for auth processing
export type MCPRequestWithHeaders = MCPRequest & {
  headers?: Record<string, string>;
};

// Base auth middleware interface
export interface MCPAuthMiddleware<TMiddleware> {
  type: 'http' | 'stdio';
}

// HTTP OAuth 2.1 middleware
export interface MCPHTTPAuthMiddleware<TMiddleware> extends MCPAuthMiddleware<TMiddleware> {
  type: 'http';
  
  // User provides their own OAuth 2.1 token validator
  validateToken: (
    token: string, 
    resourceUri: string,
    request: MCPRequestWithHeaders
  ) => Promise<TMiddleware | null>;
  
  // Optional: Custom error handling
  onAuthError?: (error: Error & { statusCode: number }) => void;
}

// STDIO environment-based middleware
export interface MCPSTDIOAuthMiddleware<TMiddleware> extends MCPAuthMiddleware<TMiddleware> {
  type: 'stdio';
  
  // User provides their own credential extractor
  extractCredentials: (
    env: NodeJS.ProcessEnv
  ) => Promise<TMiddleware | null>;
}

// Auth execution result
export interface MCPAuthResult<TMiddleware> {
  middleware: TMiddleware;
  transport: 'http' | 'stdio';
}

// Resource URI extraction helper
export interface MCPResourceUriExtractor {
  extractUri(request: MCPRequestWithHeaders): string;
}

// Re-export auth error and codes from lib implementation
export { MCPAuthError, MCP_AUTH_ERROR_CODES } from '../lib/auth/errors';
