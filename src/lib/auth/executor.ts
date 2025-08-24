
import type { 
  MCPHTTPAuthMiddleware, 
  MCPSTDIOAuthMiddleware, 
  MCPAuthResult,
  MCPResourceUriExtractor,
  MCPRequestWithHeaders
} from '../../types/auth';
import { MCPAuthError, MCP_AUTH_ERROR_CODES } from './errors';

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

// HTTP auth execution
export async function executeHTTPAuth<TMiddleware>(
  request: MCPRequestWithHeaders,
  auth: MCPHTTPAuthMiddleware<TMiddleware>,
  resourceUriExtractor: MCPResourceUriExtractor = defaultResourceUriExtractor
): Promise<MCPAuthResult<TMiddleware>> {
  // Extract authorization header
  const headers = request.headers;
  const authHeader = headers?.authorization || headers?.Authorization;
  
  if (!authHeader) {
    const error = new MCPAuthError('Authorization header required', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
    if (auth.onAuthError) {
      auth.onAuthError(error);
    }
    throw error;
  }
  
  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    const error = new MCPAuthError('Invalid authorization header format', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
    if (auth.onAuthError) {
      auth.onAuthError(error);
    }
    throw error;
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const resourceUri = resourceUriExtractor.extractUri(request);
  
  // Validate token using user-provided validator
  const middleware = await auth.validateToken(token, resourceUri, request);
  if (!middleware) {
    const error = new MCPAuthError('Invalid or expired token', MCP_AUTH_ERROR_CODES.UNAUTHORIZED);
    if (auth.onAuthError) {
      auth.onAuthError(error);
    }
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
