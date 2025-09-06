import type { MCPRequest } from '../../types/server';
import type { MCPToolkit } from '../../types/toolkit';
import type { 
  MCPHTTPAuthMiddleware, 
  MCPSTDIOAuthMiddleware, 
  MCPAuthResult,
  MCPResourceUriExtractor,
  MCPRequestWithHeaders
} from '../../types/auth';
import { MCPAuthError, MCP_AUTH_ERROR_CODES } from './errors';
import { executeAuth, validateAuthMiddleware } from './executor';

/**
 * Auth middleware manager for handling authentication across multiple toolkits.
 * 
 * Provides centralized auth execution, validation, and context creation for MCP servers.
 * Supports both HTTP OAuth 2.1 and STDIO environment-based authentication patterns.
 * 
 * @example
 * ```typescript
 * const authManager = new MCPAuthMiddlewareManager();
 * 
 * // Execute auth for a toolkit
 * const result = await authManager.executeToolkitAuth(toolkit, request, env);
 * 
 * // Create auth context for request processing
 * const context = await createAuthContext(request, env, toolkits, authManager);
 * ```
 */
export class MCPAuthMiddlewareManager {
  private resourceUriExtractor: MCPResourceUriExtractor;

  constructor(resourceUriExtractor?: MCPResourceUriExtractor) {
    this.resourceUriExtractor = resourceUriExtractor || {
      extractUri: (request: MCPRequestWithHeaders): string => {
        const method = request.method;
        const params = request.params as Record<string, unknown>;
        
        if (method === 'resources/read' && params?.uri) {
          return String(params.uri);
        }
        
        if (method === 'tools/call' && params?.name) {
          return `tool:${String(params.name)}`;
        }
        
        return `mcp:${method}`;
      }
    };
  }

  // Execute auth for a specific toolkit
  async executeToolkitAuth<TAuth>(
    toolkit: MCPToolkit<unknown, TAuth>,
    request: MCPRequest | null,
    env: NodeJS.ProcessEnv | null,
    eventSink?: import('../../types/observability').EventSink
  ): Promise<MCPAuthResult<TAuth> | null> {
    if (!toolkit.auth) {
      return null; // No auth required
    }

    if (!validateAuthMiddleware<TAuth>(toolkit.auth)) {
      throw new MCPAuthError('Invalid auth middleware configuration', MCP_AUTH_ERROR_CODES.BAD_REQUEST);
    }

    try { eventSink?.toolkitAuthStart?.({ toolkit: toolkit.namespace }); } catch {}
    
    try {
      const result = await executeAuth(request as MCPRequestWithHeaders | null, env, toolkit.auth, this.resourceUriExtractor);
      try { eventSink?.toolkitAuthSuccess?.({ toolkit: toolkit.namespace }); } catch {}
      return result;
    } catch (error) {
      const reason = error instanceof MCPAuthError ? error.message : 'Authentication failed';
      try { eventSink?.toolkitAuthFail?.({ toolkit: toolkit.namespace, reason }); } catch {}
      throw error;
    }
  }

  // Execute auth for multiple toolkits and return the first valid result
  async executeToolkitsAuth(
    toolkits: MCPToolkit<unknown, unknown>[],
    request: MCPRequest | null,
    env: NodeJS.ProcessEnv | null
  ): Promise<MCPAuthResult<unknown> | null> {
    for (const toolkit of toolkits) {
      try {
        const result = await this.executeToolkitAuth(toolkit, request, env);
        if (result) {
          return result;
        }
      } catch (error) {
        // Continue to next toolkit if auth fails
        if (error instanceof MCPAuthError) {
          continue;
        }
        throw error;
      }
    }

    return null; // No auth middleware found or all failed
  }

  // Check if any toolkit requires auth
  requiresAuth(toolkits: MCPToolkit<unknown, unknown>[]): boolean {
    return toolkits.some(toolkit => 'auth' in toolkit && toolkit.auth !== undefined);
  }

  // Get auth middleware for a specific toolkit
  getAuthMiddleware<TAuth>(
    toolkit: MCPToolkit<unknown, TAuth>
  ): MCPHTTPAuthMiddleware<TAuth> | MCPSTDIOAuthMiddleware<TAuth> | null {
    if (!toolkit.auth || !validateAuthMiddleware<TAuth>(toolkit.auth)) {
      return null;
    }

    return toolkit.auth;
  }

  // Validate auth configuration across all toolkits
  validateAuthConfiguration(toolkits: MCPToolkit<unknown, unknown>[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const toolkit of toolkits) {
      if (toolkit.auth && !validateAuthMiddleware(toolkit.auth)) {
        errors.push(`Invalid auth middleware for toolkit: ${toolkit.namespace}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Set custom resource URI extractor
  setResourceUriExtractor(extractor: MCPResourceUriExtractor): void {
    this.resourceUriExtractor = extractor;
  }
}

// Default auth middleware manager instance
export const defaultAuthMiddlewareManager = new MCPAuthMiddlewareManager();

// Auth context for request processing
export interface MCPAuthContext<TAuth> {
  middleware: TAuth | null;
  transport: 'http' | 'stdio' | null;
  toolkit: string | null;
  authenticated: boolean;
}

// Create auth context from request and toolkits
export async function createAuthContext(
  request: MCPRequest | null,
  env: NodeJS.ProcessEnv | null,
  toolkits: MCPToolkit<unknown, unknown>[],
  authManager: MCPAuthMiddlewareManager = defaultAuthMiddlewareManager
): Promise<MCPAuthContext<unknown>> {
  if (!authManager.requiresAuth(toolkits)) {
    return {
      middleware: null,
      transport: null,
      toolkit: null,
      authenticated: true // No auth required
    };
  }

  try {
    const authResult = await authManager.executeToolkitsAuth(toolkits, request, env);
    
    if (authResult) {
      return {
        middleware: authResult.middleware,
        transport: authResult.transport,
        toolkit: null, // Could be enhanced to track which toolkit provided auth
        authenticated: true
      };
    } else {
      return {
        middleware: null,
        transport: null,
        toolkit: null,
        authenticated: false
      };
    }
  } catch (error) {
    if (error instanceof MCPAuthError) {
      return {
        middleware: null,
        transport: null,
        toolkit: null,
        authenticated: false
      };
    }
    throw error;
  }
}
