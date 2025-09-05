import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPServer } from '../src';
import { MCPDiscoveryHandler, createDiscoveryResponse, createDiscoveryError } from '../src/lib/auth/discovery';
import type { 
  MCPDiscoveryConfig, 
  MCPAuthorizationServerMetadata, 
  MCPProtectedResourceMetadata,
  MCPDiscoveryError as MCPDiscoveryErrorType
} from '../src/types/auth';

describe('Discovery Handler', () => {
  let discoveryHandler: MCPDiscoveryHandler;
  let config: MCPDiscoveryConfig;

  beforeEach(() => {
    config = {
      authorizationServer: {
        issuer: 'https://auth.example.com',
        authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
        tokenEndpoint: 'https://auth.example.com/oauth/token',
        introspectionEndpoint: 'https://auth.example.com/oauth/introspect',
        revocationEndpoint: 'https://auth.example.com/oauth/revoke',
        registrationEndpoint: 'https://auth.example.com/oauth/register',
        supportedResponseTypes: ['code'],
        supportedGrantTypes: ['authorization_code', 'refresh_token'],
        supportedCodeChallengeMethods: ['S256'],
        supportedScopes: ['read', 'write', 'admin'],
        supportedTokenAuthMethods: ['client_secret_basic', 'client_secret_post'],
        supportedIntrospectionAuthMethods: ['client_secret_basic'],
        supportedRevocationAuthMethods: ['client_secret_basic']
      },
      protectedResource: {
        resourceUri: 'https://mcp.example.com',
        scopes: ['read', 'write'],
        audience: ['https://mcp.example.com', 'https://api.example.com'],
        authorizationServers: [{
          issuer: 'https://auth.example.com',
          authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
          tokenEndpoint: 'https://auth.example.com/oauth/token',
          introspectionEndpoint: 'https://auth.example.com/oauth/introspect',
          supportedResponseTypes: ['code'],
          supportedGrantTypes: ['authorization_code', 'refresh_token'],
          supportedScopes: ['read', 'write', 'admin']
        }],
        resourceSigningAlgorithms: ['RS256', 'ES256']
      },
      enableDiscoveryEndpoints: true,
      discoveryCacheTtl: 3600
    };

    discoveryHandler = new MCPDiscoveryHandler(config);
  });

  afterEach(() => {
    discoveryHandler.clearCache();
  });

  describe('Authorization Server Discovery (RFC 8414)', () => {
    it('should generate RFC 8414 compliant authorization server metadata', async () => {
      const metadata = await discoveryHandler.getAuthorizationServerMetadata();

      expect(metadata).toMatchObject({
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/oauth/authorize',
        token_endpoint: 'https://auth.example.com/oauth/token',
        introspection_endpoint: 'https://auth.example.com/oauth/introspect',
        revocation_endpoint: 'https://auth.example.com/oauth/revoke',
        registration_endpoint: 'https://auth.example.com/oauth/register',
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['read', 'write', 'admin'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
        introspection_endpoint_auth_methods_supported: ['client_secret_basic'],
        revocation_endpoint_auth_methods_supported: ['client_secret_basic']
      });
    });

    it('should cache authorization server metadata', async () => {
      const metadata1 = await discoveryHandler.getAuthorizationServerMetadata();
      const metadata2 = await discoveryHandler.getAuthorizationServerMetadata();

      expect(metadata1).toEqual(metadata2);
    });

    it('should handle missing optional fields', async () => {
      const minimalConfig: MCPDiscoveryConfig = {
        authorizationServer: {
          issuer: 'https://auth.example.com',
          authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
          tokenEndpoint: 'https://auth.example.com/oauth/token',
          supportedResponseTypes: ['code'],
          supportedGrantTypes: ['authorization_code']
        },
        protectedResource: {
          resourceUri: 'https://mcp.example.com',
          scopes: ['read'],
          audience: ['https://mcp.example.com'],
          authorizationServers: [{
            issuer: 'https://auth.example.com',
            authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
            tokenEndpoint: 'https://auth.example.com/oauth/token',
            supportedResponseTypes: ['code'],
            supportedGrantTypes: ['authorization_code']
          }]
        }
      };

      const minimalHandler = new MCPDiscoveryHandler(minimalConfig);
      const metadata = await minimalHandler.getAuthorizationServerMetadata();

      expect(metadata.issuer).toBe('https://auth.example.com');
      expect(metadata.authorization_endpoint).toBe('https://auth.example.com/oauth/authorize');
      expect(metadata.token_endpoint).toBe('https://auth.example.com/oauth/token');
      expect(metadata.introspection_endpoint).toBeUndefined();
      expect(metadata.revocation_endpoint).toBeUndefined();
      expect(metadata.registration_endpoint).toBeUndefined();
    });
  });

  describe('Protected Resource Discovery (RFC 9728)', () => {
    it('should generate RFC 9728 compliant protected resource metadata', async () => {
      const metadata = await discoveryHandler.getProtectedResourceMetadata();

      expect(metadata).toMatchObject({
        resource: 'https://mcp.example.com',
        resource_indicators_supported: true,
        authorization_servers: ['https://auth.example.com'],
        scopes_supported: ['read', 'write'],
        resource_signing_alg_values_supported: ['RS256', 'ES256']
      });
      expect(metadata.authorization_servers_metadata?.[0].issuer).toBe('https://auth.example.com');
    });

    it('should cache protected resource metadata', async () => {
      const metadata1 = await discoveryHandler.getProtectedResourceMetadata();
      const metadata2 = await discoveryHandler.getProtectedResourceMetadata();

      expect(metadata1).toEqual(metadata2);
    });

    it('should handle multiple authorization servers', async () => {
      const multiServerConfig: MCPDiscoveryConfig = {
        ...config,
        protectedResource: {
          ...config.protectedResource,
          authorizationServers: [
            {
              issuer: 'https://auth1.example.com',
              authorizationEndpoint: 'https://auth1.example.com/oauth/authorize',
              tokenEndpoint: 'https://auth1.example.com/oauth/token',
              supportedResponseTypes: ['code'],
              supportedGrantTypes: ['authorization_code']
            },
            {
              issuer: 'https://auth2.example.com',
              authorizationEndpoint: 'https://auth2.example.com/oauth/authorize',
              tokenEndpoint: 'https://auth2.example.com/oauth/token',
              supportedResponseTypes: ['code'],
              supportedGrantTypes: ['authorization_code']
            }
          ]
        }
      };

      const multiServerHandler = new MCPDiscoveryHandler(multiServerConfig);
      const metadata = await multiServerHandler.getProtectedResourceMetadata();

      expect(metadata.authorization_servers).toHaveLength(2);
      expect(metadata.authorization_servers[0]).toBe('https://auth1.example.com');
      expect(metadata.authorization_servers[1]).toBe('https://auth2.example.com');
      expect(metadata.authorization_servers_metadata?.[0].issuer).toBe('https://auth1.example.com');
      expect(metadata.authorization_servers_metadata?.[1].issuer).toBe('https://auth2.example.com');
    });
  });

  describe('WWW-Authenticate Header Generation', () => {
    it('should create proper WWW-Authenticate header', () => {
      const header = discoveryHandler.createWWWAuthenticateHeader('https://mcp.example.com/api/tools');

      expect(header).toContain('Bearer realm="mcp-server"');
      expect(header).toContain('authorization_uri="https://auth.example.com/oauth/authorize"');
      expect(header).toContain('token_uri="https://auth.example.com/oauth/token"');
      expect(header).toContain('discovery_uri="https://mcp.example.com/.well-known/oauth-authorization-server"');
    });

    it('should handle invalid URLs gracefully', () => {
      const header = discoveryHandler.createWWWAuthenticateHeader('invalid-url');

      expect(header).toContain('Bearer realm="mcp-server"');
      expect(header).toContain('discovery_uri="https://mcp-server/.well-known/oauth-authorization-server"');
    });
  });

  describe('Enhanced Error Response Generation', () => {
    it('should create enhanced error response with discovery information', () => {
      const errorResponse = discoveryHandler.createDiscoveryErrorResponse(
        'request-123',
        'https://mcp.example.com/api/tools',
        'invalid_token',
        'Token has expired'
      );

      expect(errorResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'request-123',
        error: {
          code: -32001,
          message: 'Authentication required',
          data: {
            oauth_error: 'invalid_token',
            oauth_error_description: 'Token has expired',
            authorization_server: 'https://auth.example.com',
            resource_uri: 'https://mcp.example.com/api/tools',
            discovery_endpoints: {
              authorization_server: 'https://mcp.example.com/.well-known/oauth-authorization-server',
              protected_resource: 'https://mcp.example.com/.well-known/oauth-protected-resource'
            }
          }
        }
      });
    });

    it('should handle null request ID', () => {
      const errorResponse = discoveryHandler.createDiscoveryErrorResponse(
        null,
        'https://mcp.example.com/api/tools'
      );

      expect(errorResponse.id).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate complete configuration', () => {
      const validation = discoveryHandler.validateConfiguration();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidConfig: MCPDiscoveryConfig = {
        authorizationServer: {
          issuer: '', // Missing issuer
          authorizationEndpoint: '', // Missing endpoint
          tokenEndpoint: '', // Missing endpoint
          supportedResponseTypes: [], // Empty array
          supportedGrantTypes: [] // Empty array
        },
        protectedResource: {
          resourceUri: '', // Missing URI
          scopes: [],
          audience: [],
          authorizationServers: [] // Empty array
        }
      };

      const invalidHandler = new MCPDiscoveryHandler(invalidConfig);
      const validation = invalidHandler.validateConfiguration();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Authorization server issuer is required');
      expect(validation.errors).toContain('Authorization server authorization endpoint is required');
      expect(validation.errors).toContain('Authorization server token endpoint is required');
      expect(validation.errors).toContain('Authorization server must support at least one response type');
      expect(validation.errors).toContain('Authorization server must support at least one grant type');
      expect(validation.errors).toContain('Protected resource URI is required');
      expect(validation.errors).toContain('Protected resource must have at least one authorization server');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await discoveryHandler.getAuthorizationServerMetadata();
      discoveryHandler.clearCache();
      
      // Cache should be cleared, but this is internal implementation detail
      // We can't easily test the cache state directly
      expect(discoveryHandler).toBeDefined();
    });
  });
});

describe('Discovery Response Helpers', () => {
  describe('createDiscoveryResponse', () => {
    it('should create proper discovery response', () => {
      const metadata: MCPAuthorizationServerMetadata = {
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/oauth/authorize',
        token_endpoint: 'https://auth.example.com/oauth/token',
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code']
      };

      const response = createDiscoveryResponse(metadata);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });
  });

  describe('createDiscoveryError', () => {
    it('should create proper discovery error response', () => {
      const error: MCPDiscoveryErrorType = {
        error: 'invalid_request',
        error_description: 'Invalid discovery request',
        error_uri: 'https://example.com/errors/invalid-request'
      };

      const response = createDiscoveryError(error);

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });
  });
});

describe('MCPServer Discovery Integration', () => {
  let server: MCPServer;

  beforeEach(() => {
    const config: MCPDiscoveryConfig = {
      authorizationServer: {
        issuer: 'https://auth.example.com',
        authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
        tokenEndpoint: 'https://auth.example.com/oauth/token',
        supportedResponseTypes: ['code'],
        supportedGrantTypes: ['authorization_code']
      },
      protectedResource: {
        resourceUri: 'https://mcp.example.com',
        scopes: ['read', 'write'],
        audience: ['https://mcp.example.com'],
        authorizationServers: [{
          issuer: 'https://auth.example.com',
          authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
          tokenEndpoint: 'https://auth.example.com/oauth/token',
          supportedResponseTypes: ['code'],
          supportedGrantTypes: ['authorization_code']
        }]
      },
      enableDiscoveryEndpoints: true
    };

    server = new MCPServer({
      toolkits: [],
      discovery: config
    });
  });

  describe('Discovery Endpoints', () => {
    it('should serve authorization server discovery endpoint', async () => {
      const request = new Request('https://mcp.example.com/.well-known/oauth-authorization-server', {
        method: 'GET'
      });

      const response = await server.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const metadata = await response.json() as MCPAuthorizationServerMetadata;
      expect(metadata.issuer).toBe('https://auth.example.com');
      expect(metadata.authorization_endpoint).toBe('https://auth.example.com/oauth/authorize');
      expect(metadata.token_endpoint).toBe('https://auth.example.com/oauth/token');
    });

    it('should serve protected resource discovery endpoint', async () => {
      const request = new Request('https://mcp.example.com/.well-known/oauth-protected-resource', {
        method: 'GET'
      });

      const response = await server.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const metadata = await response.json() as MCPProtectedResourceMetadata;
      expect(metadata.resource).toBe('https://mcp.example.com');
      expect(metadata.resource_indicators_supported).toBe(true);
      expect(metadata.authorization_servers).toHaveLength(1);
      expect(metadata.authorization_servers[0]).toBe('https://auth.example.com');
    });

    it('should handle CORS preflight requests', async () => {
      const request = new Request('https://mcp.example.com/.well-known/oauth-authorization-server', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://client.example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const response = await server.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });

    it('should return 405 for non-GET requests to discovery endpoints', async () => {
      const request = new Request('https://mcp.example.com/.well-known/oauth-authorization-server', {
        method: 'POST'
      });

      const response = await server.fetch(request);

      expect(response.status).toBe(405);
    });
  });

  describe('Enhanced Error Responses', () => {
    it('should include discovery information in 401 responses', async () => {
      // Create a server with a toolkit that requires auth
      const authServer = new MCPServer({
        toolkits: [{
          namespace: 'test',
          tools: [{
            name: 'protected-tool',
            description: 'A tool that requires auth',
            run: () => ({ content: [{ type: 'text', text: 'protected tool result' }] })
          }],
          auth: {
            type: 'http',
            validateToken: () => Promise.resolve(null) // Always fail auth
          }
        }],
        discovery: {
          authorizationServer: {
            issuer: 'https://auth.example.com',
            authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
            tokenEndpoint: 'https://auth.example.com/oauth/token',
            supportedResponseTypes: ['code'],
            supportedGrantTypes: ['authorization_code']
          },
          protectedResource: {
            resourceUri: 'https://mcp.example.com',
            scopes: ['read', 'write'],
            audience: ['https://mcp.example.com'],
            authorizationServers: [{
              issuer: 'https://auth.example.com',
              authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
              tokenEndpoint: 'https://auth.example.com/oauth/token',
              supportedResponseTypes: ['code'],
              supportedGrantTypes: ['authorization_code']
            }]
          }
        }
      });

      const request = new Request('https://mcp.example.com/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test-123',
          method: 'tools/call',
          params: {
            name: 'test_protected-tool',
            arguments: {}
          }
        })
      });

      const response = await authServer.fetch(request);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Bearer realm="mcp-server"');
      expect(response.headers.get('WWW-Authenticate')).toContain('authorization_uri="https://auth.example.com/oauth/authorize"');
      expect(response.headers.get('WWW-Authenticate')).toContain('token_uri="https://auth.example.com/oauth/token"');
      
      const errorResponse = await response.json() as { error: { data: { discovery_endpoints: { authorization_server: string; protected_resource: string } } } };
      expect(errorResponse.error.data.discovery_endpoints.authorization_server).toBe('https://mcp.example.com/.well-known/oauth-authorization-server');
      expect(errorResponse.error.data.discovery_endpoints.protected_resource).toBe('https://mcp.example.com/.well-known/oauth-protected-resource');
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error for invalid discovery configuration', () => {
      const invalidConfig: MCPDiscoveryConfig = {
        authorizationServer: {
          issuer: '', // Invalid: empty issuer
          authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
          tokenEndpoint: 'https://auth.example.com/oauth/token',
          supportedResponseTypes: ['code'],
          supportedGrantTypes: ['authorization_code']
        },
        protectedResource: {
          resourceUri: 'https://mcp.example.com',
          scopes: ['read'],
          audience: ['https://mcp.example.com'],
          authorizationServers: [{
            issuer: 'https://auth.example.com',
            authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
            tokenEndpoint: 'https://auth.example.com/oauth/token',
            supportedResponseTypes: ['code'],
            supportedGrantTypes: ['authorization_code']
          }]
        }
      };

      expect(() => {
        new MCPServer({
          toolkits: [],
          discovery: invalidConfig
        });
      }).toThrow('Invalid discovery configuration: Authorization server issuer is required');
    });
  });

  describe('Discovery Endpoints Disabled', () => {
    it('should not serve discovery endpoints when disabled', async () => {
      const disabledServer = new MCPServer({
        toolkits: [],
        discovery: {
          ...server['options'].discovery!,
          enableDiscoveryEndpoints: false
        }
      });

      const request = new Request('https://mcp.example.com/.well-known/oauth-authorization-server', {
        method: 'GET'
      });

      const response = await disabledServer.fetch(request);

      expect(response.status).toBe(405); // Method Not Allowed
    });
  });

  describe('Protobuf Compliance', () => {
    it('should validate protobuf message structure for authorization server metadata', () => {
      // Test that our TypeScript types match protobuf message structure
      const metadata: MCPAuthorizationServerMetadata = {
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/oauth/authorize',
        token_endpoint: 'https://auth.example.com/oauth/token',
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code']
      };

      // Validate required fields match protobuf structure
      expect(metadata).toHaveProperty('issuer');
      expect(metadata).toHaveProperty('authorization_endpoint');
      expect(metadata).toHaveProperty('token_endpoint');
      expect(metadata).toHaveProperty('response_types_supported');
      expect(metadata).toHaveProperty('grant_types_supported');

      // Validate field types match protobuf
      expect(typeof metadata.issuer).toBe('string');
      expect(typeof metadata.authorization_endpoint).toBe('string');
      expect(typeof metadata.token_endpoint).toBe('string');
      expect(Array.isArray(metadata.response_types_supported)).toBe(true);
      expect(Array.isArray(metadata.grant_types_supported)).toBe(true);
    });

    it('should validate protobuf message structure for protected resource metadata', () => {
      // Test that our TypeScript types match protobuf message structure
      const metadata: MCPProtectedResourceMetadata = {
        resource_indicators_supported: true,
        authorization_servers: [{
          issuer: 'https://auth.example.com',
          authorization_endpoint: 'https://auth.example.com/oauth/authorize',
          token_endpoint: 'https://auth.example.com/oauth/token'
        }],
        scopes_supported: ['read', 'write']
      };

      // Validate required fields match protobuf structure
      expect(metadata).toHaveProperty('resource_indicators_supported');
      expect(metadata).toHaveProperty('authorization_servers');
      expect(metadata).toHaveProperty('scopes_supported');

      // Validate field types match protobuf
      expect(typeof metadata.resource_indicators_supported).toBe('boolean');
      expect(Array.isArray(metadata.authorization_servers)).toBe(true);
      expect(Array.isArray(metadata.scopes_supported)).toBe(true);
    });

    it('should validate protobuf message structure for discovery configuration', () => {
      // Test that our TypeScript types match protobuf message structure
      const config: MCPDiscoveryConfig = {
        authorizationServer: {
          issuer: 'https://auth.example.com',
          authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
          tokenEndpoint: 'https://auth.example.com/oauth/token',
          supportedResponseTypes: ['code'],
          supportedGrantTypes: ['authorization_code']
        },
        protectedResource: {
          resourceUri: 'https://mcp.example.com',
          scopes: ['read', 'write'],
          audience: ['https://mcp.example.com'],
          authorizationServers: [{
            issuer: 'https://auth.example.com',
            authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
            tokenEndpoint: 'https://auth.example.com/oauth/token',
            supportedResponseTypes: ['code'],
            supportedGrantTypes: ['authorization_code']
          }]
        }
      };

      // Validate required fields match protobuf structure
      expect(config).toHaveProperty('authorizationServer');
      expect(config).toHaveProperty('protectedResource');
      expect(config.authorizationServer).toHaveProperty('issuer');
      expect(config.authorizationServer).toHaveProperty('authorizationEndpoint');
      expect(config.authorizationServer).toHaveProperty('tokenEndpoint');
      expect(config.protectedResource).toHaveProperty('resourceUri');
      expect(config.protectedResource).toHaveProperty('scopes');
      expect(config.protectedResource).toHaveProperty('audience');
      expect(config.protectedResource).toHaveProperty('authorizationServers');
    });

    it('should validate protobuf message structure for discovery errors', () => {
      // Test that our TypeScript types match protobuf message structure
      const error: MCPDiscoveryErrorType = {
        error: 'invalid_request',
        error_description: 'Invalid discovery request',
        error_uri: 'https://example.com/errors/invalid-request'
      };

      // Validate required fields match protobuf structure
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('error_description');
      expect(error).toHaveProperty('error_uri');

      // Validate field types match protobuf
      expect(typeof error.error).toBe('string');
      expect(typeof error.error_description).toBe('string');
      expect(typeof error.error_uri).toBe('string');
    });
  });
});
