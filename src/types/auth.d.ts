import type { MCPRequest } from './server';

/**
 * Extended request type with headers for auth processing.
 * Used by HTTP auth middleware to access authorization headers.
 */
export type MCPRequestWithHeaders = MCPRequest & {
  headers?: Record<string, string>;
};

/**
 * Base auth middleware interface for transport-specific authentication.
 * 
 * @template TMiddleware - The type of middleware context returned after successful authentication
 */
export interface MCPAuthMiddleware<TMiddleware> {
  /** The transport type this middleware handles */
  type: 'http' | 'stdio';
}

/**
 * HTTP OAuth 2.1 middleware for HTTP transport authentication.
 * 
 * Implements OAuth 2.1 compliant token validation with resource indicators (RFC 8707).
 * Users provide their own token validator to integrate with their OAuth provider.
 * 
 * @template TMiddleware - The type of middleware context returned after successful authentication
 * 
 * @example
 * ```typescript
 * const httpAuth: MCPHTTPAuthMiddleware<UserContext> = {
 *   type: 'http',
 *   validateToken: async (token, resourceUri, request) => {
 *     // Validate token with your OAuth provider
 *     const user = await myOAuthProvider.validateToken(token, resourceUri);
 *     return user ? { user, permissions: user.permissions } : null;
 *   },
 *   requiredScopes: ['read', 'write'], // Optional: required scopes for this middleware
 *   onAuthError: (error) => {
 *     console.error('Auth error:', error.message);
 *   }
 * };
 * ```
 */
export interface MCPHTTPAuthMiddleware<TMiddleware> extends MCPAuthMiddleware<TMiddleware> {
  /** The transport type - always 'http' for this middleware */
  type: 'http';
  
  /**
   * Validates an OAuth 2.1 access token for the specified resource.
   * 
   * @param token - The Bearer token from the Authorization header
   * @param resourceUri - The resource URI being accessed (for audience validation)
   * @param request - The full MCP request with headers
   * @returns Promise resolving to middleware context or null if invalid
   */
  validateToken: (
    token: string, 
    resourceUri: string,
    request: MCPRequestWithHeaders
  ) => Promise<TMiddleware | null>;
  
  /**
   * Optional: Required scopes for this middleware.
   * If provided, tokens must include all these scopes to be valid.
   */
  requiredScopes?: string[];
  
  /**
   * Optional: Enhanced token validation with OAuth 2.1 security checks.
   * If provided, this will be used for comprehensive security validation.
   * Should return OAuth 2.1 token information for security analysis.
   */
  validateTokenWithSecurity?: (
    token: string
  ) => Promise<import('../lib/auth/oauth21').MCPOAuthTokenInfo | null>;
  
  /**
   * Optional callback for custom error handling.
   * Called when authentication fails with the error details.
   */
  onAuthError?: (error: Error & { statusCode: number }) => void;
}

/**
 * STDIO environment-based middleware for STDIO transport authentication.
 * 
 * Extracts credentials from environment variables for CLI/desktop client integration.
 * Users provide their own credential extractor to integrate with their auth system.
 * 
 * @template TMiddleware - The type of middleware context returned after successful authentication
 * 
 * @example
 * ```typescript
 * const stdioAuth: MCPSTDIOAuthMiddleware<UserContext> = {
 *   type: 'stdio',
 *   extractCredentials: async (env) => {
 *     const apiKey = env.MCP_API_KEY;
 *     const userId = env.MCP_USER_ID;
 *     
 *     if (apiKey && userId) {
 *       return { userId, apiKey, permissions: ['read', 'write'] };
 *     }
 *     return null;
 *   }
 * };
 * ```
 */
export interface MCPSTDIOAuthMiddleware<TMiddleware> extends MCPAuthMiddleware<TMiddleware> {
  /** The transport type - always 'stdio' for this middleware */
  type: 'stdio';
  
  /**
   * Extracts credentials from environment variables.
   * 
   * @param env - The Node.js process environment
   * @returns Promise resolving to middleware context or null if invalid
   */
  extractCredentials: (
    env: NodeJS.ProcessEnv
  ) => Promise<TMiddleware | null>;
}

/**
 * Result of successful authentication execution.
 * 
 * @template TMiddleware - The type of middleware context returned
 */
export interface MCPAuthResult<TMiddleware> {
  /** The authenticated middleware context */
  middleware: TMiddleware;
  /** The transport type that was used for authentication */
  transport: 'http' | 'stdio';
}

/**
 * Helper interface for extracting resource URIs from requests.
 * Used to determine the resource being accessed for audience validation.
 */
export interface MCPResourceUriExtractor {
  /**
   * Extracts the resource URI from an MCP request.
   * 
   * @param request - The MCP request with headers
   * @returns The resource URI string
   */
  extractUri(request: MCPRequestWithHeaders): string;
}

// Re-export auth error and codes from lib implementation
export { MCPAuthError, MCP_AUTH_ERROR_CODES } from '../lib/auth/errors';
