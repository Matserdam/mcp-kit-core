
import type { 
  MCPHTTPAuthMiddleware, 
  MCPSTDIOAuthMiddleware, 
  MCPAuthResult,
  MCPResourceUriExtractor,
  MCPRequestWithHeaders
} from '../../types/auth';
import { MCPAuthError, MCP_AUTH_ERROR_CODES } from './errors';
import { 
  extractBearerToken, 
  validateTokenWithSecurity,
  type MCPOAuthTokenInfo
} from './oauth21';
import { createAuthAuditLog } from './audit-logger';

// Default resource URI extractor
const defaultResourceUriExtractor: MCPResourceUriExtractor = {
  extractUri: (request: MCPRequestWithHeaders): string => {
    // Extract resource URI from request context or use default
    // This can be enhanced based on the specific resource being accessed
    const method = request.method;
    const params = request.params as Record<string, unknown>;
    
    // For resource operations, extract the URI
    if (method === 'resources/read' && params?.uri) {
      return String(params.uri);
    }
    
    // For tool calls, use the tool name as resource identifier
    if (method === 'tools/call' && params?.name) {
      return `tool:${String(params.name)}`;
    }
    
    // Default to the method name as resource identifier
    return `mcp:${method}`;
  }
};

// HTTP auth execution with OAuth 2.1 compliance
export async function executeHTTPAuth<TMiddleware>(
  request: MCPRequestWithHeaders,
  auth: MCPHTTPAuthMiddleware<TMiddleware>,
  resourceUriExtractor: MCPResourceUriExtractor = defaultResourceUriExtractor
): Promise<MCPAuthResult<TMiddleware>> {
  // Extract Bearer token using OAuth 2.1 compliant extraction
  const token = extractBearerToken(request);
  
  if (!token) {
    const error = new MCPAuthError('Authorization header required', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
    if (auth.onAuthError) {
      auth.onAuthError(error);
    }
    createAuthAuditLog('token_validation', { error: 'missing_authorization_header' }, request);
    throw error;
  }
  
  const resourceUri = resourceUriExtractor.extractUri(request);
  
  // Enhanced token validation with OAuth 2.1 security checks
  if (auth.validateTokenWithSecurity) {
    // Use enhanced validation if available
    const requiredScopes = auth.requiredScopes || [];
    
    // Create a wrapper that handles null returns
    const tokenValidator = async (token: string): Promise<MCPOAuthTokenInfo> => {
      const result = await auth.validateTokenWithSecurity!(token);
      if (!result) {
        throw new Error('Token validation returned null');
      }
      return result;
    };
    
    const validationResult = await validateTokenWithSecurity(
      token, 
      resourceUri, 
      requiredScopes,
      tokenValidator
    );
    
    if (!validationResult.isValid) {
      // Log security issues
      createAuthAuditLog('token_validation', { 
        securityIssues: validationResult.securityIssues,
        resourceUri 
      }, request);
      
      // Determine appropriate error response
      const criticalIssues = validationResult.securityIssues.filter(issue => issue.severity === 'critical');
      const highIssues = validationResult.securityIssues.filter(issue => issue.severity === 'high');
      
      if (criticalIssues.length > 0) {
        const error = new MCPAuthError('Invalid token', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
        if (auth.onAuthError) {
          auth.onAuthError(error);
        }
        throw error;
      } else if (highIssues.length > 0) {
        const error = new MCPAuthError('Token expired', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
        if (auth.onAuthError) {
          auth.onAuthError(error);
        }
        throw error;
      } else {
        const error = new MCPAuthError('Insufficient scope', MCP_AUTH_ERROR_CODES.FORBIDDEN);
        if (auth.onAuthError) {
          auth.onAuthError(error);
        }
        throw error;
      }
    }
    
    // Log successful validation
    createAuthAuditLog('auth_success', { 
      user: validationResult.user,
      scopes: validationResult.scopes,
      resourceUri 
    }, request);
  }
  
  // Validate token using user-provided validator
  const middleware = await auth.validateToken(token, resourceUri, request);
  if (!middleware) {
    const error = new MCPAuthError('Invalid or expired token', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
    if (auth.onAuthError) {
      auth.onAuthError(error);
    }
    createAuthAuditLog('token_validation', { error: 'token_validation_failed' }, request);
    throw error;
  }
  
  return {
    middleware,
    transport: 'http'
  };
}

// STDIO auth execution
export async function executeSTDIOAuth<TMiddleware>(
  env: NodeJS.ProcessEnv,
  auth: MCPSTDIOAuthMiddleware<TMiddleware>
): Promise<MCPAuthResult<TMiddleware>> {
  // Extract credentials using user-provided extractor
  const middleware = await auth.extractCredentials(env);
  if (!middleware) {
    const error = new MCPAuthError('Invalid credentials', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
    throw error;
  }
  
  return {
    middleware,
    transport: 'stdio'
  };
}

// Generic auth execution that determines transport type
export async function executeAuth<TMiddleware>(
  request: MCPRequestWithHeaders | null,
  env: NodeJS.ProcessEnv | null,
  auth: MCPHTTPAuthMiddleware<TMiddleware> | MCPSTDIOAuthMiddleware<TMiddleware>,
  resourceUriExtractor?: MCPResourceUriExtractor
): Promise<MCPAuthResult<TMiddleware>> {
  if (auth.type === 'http') {
    if (!request) {
      throw new MCPAuthError('HTTP request required for HTTP auth middleware', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
    }
    return executeHTTPAuth(request, auth, resourceUriExtractor);
  } else if (auth.type === 'stdio') {
    if (!env) {
      throw new MCPAuthError('Environment required for STDIO auth middleware', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
    }
    return executeSTDIOAuth(env, auth);
  } else {
    throw new MCPAuthError('Invalid auth middleware type', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
  }
}

// Auth validation helpers
export function validateAuthMiddleware<TMiddleware>(
  auth: unknown
): auth is MCPHTTPAuthMiddleware<TMiddleware> | MCPSTDIOAuthMiddleware<TMiddleware> {
  if (!auth || typeof auth !== 'object') {
    return false;
  }
  
  const authObj = auth as Record<string, unknown>;
  
  if (authObj.type !== 'http' && authObj.type !== 'stdio') {
    return false;
  }
  
  if (authObj.type === 'http') {
    return typeof authObj.validateToken === 'function';
  } else {
    return typeof authObj.extractCredentials === 'function';
  }
}

// Resource URI validation helper
export function validateResourceUri(uri: string): boolean {
  // Basic URI validation - can be enhanced based on specific requirements
  return typeof uri === 'string' && uri.length > 0;
}
