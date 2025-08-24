
import type { 
  MCPHTTPAuthMiddleware, 
  MCPSTDIOAuthMiddleware, 
  MCPAuthResult,
  MCPResourceUriExtractor,
  MCPRequestWithHeaders
} from '../../types/auth';
import { MCPAuthError, MCP_AUTH_ERROR_CODES } from './errors';

/**
 * Execute HTTP OAuth 2.1 authentication middleware.
 * 
 * Validates Bearer tokens according to OAuth 2.1 specification with resource indicators.
 * Supports audience validation, scope checking, and security analysis.
 * 
 * @param request - The MCP request with headers
 * @param auth - HTTP auth middleware configuration
 * @param resourceUriExtractor - Extractor for resource URIs
 * @returns Promise resolving to auth result or throws AuthError
 * 
 * @example
 * ```typescript
 * const result = await executeHTTPAuth(request, httpAuth, resourceUriExtractor);
 * console.log('Authenticated user:', result.middleware.user);
 * ```
 */
export async function executeHTTPAuth<TAuth>(
  request: MCPRequestWithHeaders | null,
  auth: MCPHTTPAuthMiddleware<TAuth>,
  resourceUriExtractor: MCPResourceUriExtractor
): Promise<MCPAuthResult<TAuth>> {
  if (!request) {
    throw new MCPAuthError('HTTP request required for HTTP auth middleware', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
  }

  const authHeader = request.headers?.authorization;
  if (!authHeader) {
    throw new MCPAuthError('Authorization header required', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new MCPAuthError('Invalid authorization header format', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const resourceUri = resourceUriExtractor.extractUri(request);

  try {
    // Enhanced security validation if available
    if (auth.validateTokenWithSecurity) {
      const securityResult = await auth.validateTokenWithSecurity(token);
      if (!securityResult) {
        throw new MCPAuthError('Token security validation failed', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
      }

      // Validate required scopes if specified
      if (auth.requiredScopes && auth.requiredScopes.length > 0) {
        const tokenScopes = securityResult.scope?.split(' ') || [];
        const missingScopes = auth.requiredScopes.filter(scope => !tokenScopes.includes(scope));
        
        if (missingScopes.length > 0) {
          throw new MCPAuthError(
            `Insufficient scope. Required: ${auth.requiredScopes.join(', ')}. Provided: ${tokenScopes.join(', ')}`,
            MCP_AUTH_ERROR_CODES.FORBIDDEN
          );
        }
      }

      // Validate audience if specified
      if (securityResult.aud && securityResult.aud.length > 0) {
        const resourceUriParts = resourceUri.split(':');
        const resourceDomain = resourceUriParts.length > 1 ? resourceUriParts[1] : resourceUri;
        
        if (!securityResult.aud.includes(resourceDomain) && !securityResult.aud.includes(resourceUri)) {
          throw new MCPAuthError(
            `Invalid audience. Required: ${securityResult.aud.join(', ')}. Resource: ${resourceUri}`,
            MCP_AUTH_ERROR_CODES.FORBIDDEN
          );
        }
      }
    }

    // Main token validation
    const authContext = await auth.validateToken(token, resourceUri, request);
    if (!authContext) {
      throw new MCPAuthError('Invalid or expired token', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
    }

    return {
      middleware: authContext,
      transport: 'http'
    };

  } catch (error) {
    if (error instanceof MCPAuthError) {
      throw error;
    }

    // Call custom error handler if provided
    if (auth.onAuthError) {
      const authError = new MCPAuthError(
        error instanceof Error ? error.message : 'Authentication failed',
        MCP_AUTH_ERROR_CODES.UNAUTHORIZED
      );
      auth.onAuthError(authError);
    }

    throw new MCPAuthError(
      error instanceof Error ? error.message : 'Authentication failed',
      MCP_AUTH_ERROR_CODES.UNAUTHORIZED
    );
  }
}

/**
 * Execute STDIO environment-based authentication middleware.
 * 
 * Extracts credentials from environment variables for CLI/desktop client integration.
 * Supports API keys, user IDs, and custom credential patterns.
 * 
 * @param env - The Node.js process environment
 * @param auth - STDIO auth middleware configuration
 * @returns Promise resolving to auth result or throws AuthError
 * 
 * @example
 * ```typescript
 * const result = await executeSTDIOAuth(process.env, stdioAuth);
 * console.log('Authenticated user:', result.middleware.userId);
 * ```
 */
export async function executeSTDIOAuth<TAuth>(
  env: NodeJS.ProcessEnv | null,
  auth: MCPSTDIOAuthMiddleware<TAuth>
): Promise<MCPAuthResult<TAuth>> {
  if (!env) {
    throw new MCPAuthError('Environment required for STDIO auth middleware', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
  }

  try {
    const authContext = await auth.extractCredentials(env);
    if (!authContext) {
      throw new MCPAuthError('Invalid credentials', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
    }

    return {
      middleware: authContext,
      transport: 'stdio'
    };

  } catch (error) {
    if (error instanceof MCPAuthError) {
      throw error;
    }

    throw new MCPAuthError(
      error instanceof Error ? error.message : 'Authentication failed',
      MCP_AUTH_ERROR_CODES.UNAUTHORIZED
    );
  }
}

/**
 * Execute transport-appropriate authentication middleware.
 * 
 * Automatically selects HTTP or STDIO auth based on middleware type.
 * Provides unified interface for both transport types.
 * 
 * @param request - The MCP request (for HTTP auth)
 * @param env - The Node.js process environment (for STDIO auth)
 * @param auth - Auth middleware configuration
 * @param resourceUriExtractor - Extractor for resource URIs (for HTTP auth)
 * @returns Promise resolving to auth result or throws AuthError
 */
export async function executeAuth<TAuth>(
  request: MCPRequestWithHeaders | null,
  env: NodeJS.ProcessEnv | null,
  auth: MCPHTTPAuthMiddleware<TAuth> | MCPSTDIOAuthMiddleware<TAuth>,
  resourceUriExtractor: MCPResourceUriExtractor
): Promise<MCPAuthResult<TAuth>> {
  switch (auth.type) {
    case 'http':
      if (!request) {
        throw new MCPAuthError('HTTP request required for HTTP auth middleware', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
      }
      return executeHTTPAuth(request, auth, resourceUriExtractor);

    case 'stdio':
      if (!env) {
        throw new MCPAuthError('Environment required for STDIO auth middleware', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
      }
      return executeSTDIOAuth(env, auth);

    default:
      throw new MCPAuthError('Invalid auth middleware type', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
  }
}

/**
 * Validate auth middleware configuration.
 * 
 * Ensures middleware has required properties and correct type.
 * Used for runtime validation of auth middleware configuration.
 * 
 * @param auth - Auth middleware to validate
 * @returns True if valid, false otherwise
 */
export function validateAuthMiddleware<TAuth>(
  auth: unknown
): auth is MCPHTTPAuthMiddleware<TAuth> | MCPSTDIOAuthMiddleware<TAuth> {
  if (!auth || typeof auth !== 'object') {
    return false;
  }

  const authObj = auth as Record<string, unknown>;

  // Check for required type property
  if (authObj.type !== 'http' && authObj.type !== 'stdio') {
    return false;
  }

  // Validate HTTP auth middleware
  if (authObj.type === 'http') {
    return typeof authObj.validateToken === 'function';
  }

  // Validate STDIO auth middleware
  if (authObj.type === 'stdio') {
    return typeof authObj.extractCredentials === 'function';
  }

  return false;
}
