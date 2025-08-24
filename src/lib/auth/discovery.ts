import type { 
  MCPAuthorizationServerMetadata, 
  MCPProtectedResourceMetadata,
  MCPDiscoveryConfig,
  MCPDiscoveryError
} from '../../types/auth';

/**
 * Discovery handler for OAuth 2.1 server discovery and metadata endpoints.
 * 
 * Implements RFC 8414 (Authorization Server Discovery) and RFC 9728 (Protected Resource Metadata)
 * to enable clients to automatically discover authorization servers and obtain new tokens.
 * 
 * @example
 * ```typescript
 * const discoveryHandler = new MCPDiscoveryHandler(config);
 * 
 * // Get authorization server metadata
 * const authMetadata = await discoveryHandler.getAuthorizationServerMetadata();
 * 
 * // Get protected resource metadata
 * const resourceMetadata = await discoveryHandler.getProtectedResourceMetadata();
 * ```
 */
export class MCPDiscoveryHandler {
  private config: MCPDiscoveryConfig;
  private cache: Map<string, { data: unknown; expires: number }> = new Map();

  constructor(config: MCPDiscoveryConfig) {
    this.config = config;
  }

  /**
   * Validate discovery configuration
   */
  private validateConfig(config: MCPDiscoveryConfig): void {
    // Validate authorization server configuration
    if (!config.authorizationServer.issuer || config.authorizationServer.issuer.trim() === '') {
      throw new Error('Invalid discovery configuration: Authorization server issuer is required');
    }
    
    if (!config.authorizationServer.authorizationEndpoint) {
      throw new Error('Invalid discovery configuration: Authorization server authorization endpoint is required');
    }
    
    if (!config.authorizationServer.tokenEndpoint) {
      throw new Error('Invalid discovery configuration: Authorization server token endpoint is required');
    }

    // Validate protected resource configuration
    if (!config.protectedResource.resourceUri) {
      throw new Error('Invalid discovery configuration: Protected resource URI is required');
    }
    
    if (!config.protectedResource.authorizationServers || config.protectedResource.authorizationServers.length === 0) {
      throw new Error('Invalid discovery configuration: At least one authorization server is required');
    }
    
    for (const server of config.protectedResource.authorizationServers) {
      if (!server.issuer || server.issuer.trim() === '') {
        throw new Error('Invalid discovery configuration: Authorization server issuer is required');
      }
    }
  }

  /**
   * Get authorization server metadata per RFC 8414.
   * 
   * @returns Promise resolving to RFC 8414 compliant authorization server metadata
   */
  getAuthorizationServerMetadata(): Promise<MCPAuthorizationServerMetadata> {
    const cacheKey = 'auth_server_metadata';
    const cached = this.getCachedData<MCPAuthorizationServerMetadata>(cacheKey);
    if (cached) return Promise.resolve(cached);

    const metadata: MCPAuthorizationServerMetadata = {
      issuer: this.config.authorizationServer.issuer,
      authorization_endpoint: this.config.authorizationServer.authorizationEndpoint,
      token_endpoint: this.config.authorizationServer.tokenEndpoint,
      introspection_endpoint: this.config.authorizationServer.introspectionEndpoint,
      revocation_endpoint: this.config.authorizationServer.revocationEndpoint,
      registration_endpoint: this.config.authorizationServer.registrationEndpoint,
      response_types_supported: this.config.authorizationServer.supportedResponseTypes,
      grant_types_supported: this.config.authorizationServer.supportedGrantTypes,
      code_challenge_methods_supported: this.config.authorizationServer.supportedCodeChallengeMethods,
      scopes_supported: this.config.authorizationServer.supportedScopes,
      token_endpoint_auth_methods_supported: this.config.authorizationServer.supportedTokenAuthMethods,
      introspection_endpoint_auth_methods_supported: this.config.authorizationServer.supportedIntrospectionAuthMethods,
      revocation_endpoint_auth_methods_supported: this.config.authorizationServer.supportedRevocationAuthMethods
    };

    this.cacheData(cacheKey, metadata);
    return Promise.resolve(metadata);
  }

  /**
   * Get protected resource metadata per RFC 9728.
   * 
   * @returns Promise resolving to RFC 9728 compliant protected resource metadata
   */
  getProtectedResourceMetadata(): Promise<MCPProtectedResourceMetadata> {
    const cacheKey = 'protected_resource_metadata';
    const cached = this.getCachedData<MCPProtectedResourceMetadata>(cacheKey);
    if (cached) return Promise.resolve(cached);

    const metadata: MCPProtectedResourceMetadata = {
      resource_indicators_supported: true,
      authorization_servers: this.config.protectedResource.authorizationServers.map(server => ({
        issuer: server.issuer,
        authorization_endpoint: server.authorizationEndpoint,
        token_endpoint: server.tokenEndpoint,
        introspection_endpoint: server.introspectionEndpoint
      })),
      scopes_supported: this.config.protectedResource.scopes,
      resource_signing_alg_values_supported: this.config.protectedResource.resourceSigningAlgorithms
    };

    this.cacheData(cacheKey, metadata);
    return Promise.resolve(metadata);
  }

  /**
   * Create WWW-Authenticate header with discovery information.
   * 
   * @param requestUrl - The URL of the request that failed authentication
   * @returns WWW-Authenticate header value with discovery hints
   */
  createWWWAuthenticateHeader(requestUrl: string): string {
    const baseUrl = this.getBaseUrl(requestUrl);
    const authServer = this.config.authorizationServer;
    
    return `Bearer realm="mcp-server", ` +
           `authorization_uri="${authServer.authorizationEndpoint}", ` +
           `token_uri="${authServer.tokenEndpoint}", ` +
           `discovery_uri="${baseUrl}/.well-known/oauth-authorization-server"`;
  }

  /**
   * Create enhanced error response with discovery information.
   * 
   * @param requestId - The JSON-RPC request ID
   * @param requestUrl - The URL of the request that failed
   * @param error - The OAuth error code
   * @param description - Optional error description
   * @returns Enhanced error response with discovery hints
   */
  createDiscoveryErrorResponse(
    requestId: string | number | null,
    requestUrl: string,
    error: string = 'invalid_token',
    description?: string
  ): { jsonrpc: string; id: string | number | null; error: { code: number; message: string; data: unknown } } {
    const baseUrl = this.getBaseUrl(requestUrl);
    
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32001,
        message: 'Authentication required',
        data: {
          oauth_error: error,
          oauth_error_description: description,
          authorization_server: this.config.authorizationServer.issuer,
          resource_uri: requestUrl,
          discovery_endpoints: {
            authorization_server: `${baseUrl}/.well-known/oauth-authorization-server`,
            protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`
          }
        }
      }
    };
  }

  /**
   * Validate discovery configuration.
   * 
   * @returns Validation result with any errors
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const authServer = this.config.authorizationServer;
    const protectedResource = this.config.protectedResource;

    // Validate authorization server configuration
    if (!authServer.issuer) {
      errors.push('Authorization server issuer is required');
    }
    if (!authServer.authorizationEndpoint) {
      errors.push('Authorization server authorization endpoint is required');
    }
    if (!authServer.tokenEndpoint) {
      errors.push('Authorization server token endpoint is required');
    }
    if (!authServer.supportedResponseTypes?.length) {
      errors.push('Authorization server must support at least one response type');
    }
    if (!authServer.supportedGrantTypes?.length) {
      errors.push('Authorization server must support at least one grant type');
    }

    // Validate protected resource configuration
    if (!protectedResource.resourceUri) {
      errors.push('Protected resource URI is required');
    }
    if (!protectedResource.authorizationServers?.length) {
      errors.push('Protected resource must have at least one authorization server');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear discovery cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cached data if available and not expired.
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Cache data with TTL.
   */
  private cacheData<T>(key: string, data: T): void {
    const ttl = this.config.discoveryCacheTtl || 3600; // Default 1 hour
    const expires = Date.now() + (ttl * 1000);
    
    this.cache.set(key, { data, expires });
  }

  /**
   * Extract base URL from request URL.
   */
  private getBaseUrl(requestUrl: string): string {
    try {
      const url = new URL(requestUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      // Fallback for invalid URLs
      return 'https://mcp-server';
    }
  }
}

/**
 * Create discovery error response.
 * 
 * @param error - The discovery error
 * @returns Discovery error response
 */
export function createDiscoveryError(error: MCPDiscoveryError): Response {
  return new Response(JSON.stringify(error), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

/**
 * Create discovery metadata response with proper headers.
 * 
 * @param metadata - The discovery metadata
 * @returns Discovery metadata response
 */
export function createDiscoveryResponse(metadata: unknown): Response {
  return new Response(JSON.stringify(metadata, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
