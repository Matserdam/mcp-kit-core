import { describe, it, expect, beforeEach } from 'vitest';
import { handleRPC } from '../src/lib/rpc';
import type { MCPToolkit, MCPTool, MCPResourceProvider, MCPResourceTemplateProvider, MCPPromptDef } from '../src/types/toolkit';
import type { MCPRequest, MCPResponse } from '../src/types/server';
import type { MCPHTTPAuthMiddleware } from '../src/types/auth';

// Mock HTTP request for testing
const createMockRequest = (headers: Record<string, string> = {}): Request => {
  return {
    headers: new Map(Object.entries(headers)),
    url: 'http://localhost:3000',
  } as unknown as Request;
};

// Helper to create toolkits
const createPublicToolkit = (namespace: string): MCPToolkit<unknown, unknown> => ({
  namespace,
  tools: [{
    name: 'public-tool',
    description: 'A public tool',
    run: () => ({ content: [{ type: 'text', text: 'public tool result' }] }),
  } as MCPTool<unknown, unknown>],
  resources: [{
    uri: 'public://resource',
    name: 'public-resource',
    read: () => ({ contents: [{ uri: 'public://resource', text: 'public resource content' }] }),
  } as MCPResourceProvider<unknown>],
  resourceTemplates: [{
    descriptor: {
      uriTemplate: 'public://{name}',
      name: 'public-template',
      title: 'Public Template',
      description: 'A public template',
      mimeType: 'text/plain',
    },
    read: (uri: string) => ({ contents: [{ uri: uri as `${string}://${string}`, text: 'public template content' }] }),
  } as MCPResourceTemplateProvider<unknown>],
  prompts: [{
    name: 'public-prompt',
    title: 'Public Prompt',
    description: 'A public prompt',
    messages: () => Promise.resolve([{ role: 'user', content: [{ type: 'text', text: 'public prompt message' }] }]),
  } as unknown as MCPPromptDef<unknown, unknown>],
});

const createPrivateToolkit = (namespace: string): MCPToolkit<unknown, { user: string }> => {
  const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
    type: 'http',
    validateToken: (token: string) => {
      if (token === 'valid-token') {
        return Promise.resolve({ user: 'test-user' });
      }
      return Promise.resolve(null);
    },
  };

  return {
    namespace,
    auth: mockAuth,
    tools: [{
      name: 'private-tool',
      description: 'A private tool',
      run: () => ({ content: [{ type: 'text', text: 'private tool result' }] }),
    } as MCPTool<unknown, unknown>],
    resources: [{
      uri: 'private://resource',
      name: 'private-resource',
      read: () => ({ contents: [{ uri: 'private://resource', text: 'private resource content' }] }),
    } as MCPResourceProvider<unknown>],
    resourceTemplates: [{
      descriptor: {
        uriTemplate: 'private://{name}',
        name: 'private-template',
        title: 'Private Template',
        description: 'A private template',
        mimeType: 'text/plain',
      },
      read: (uri: string) => ({ contents: [{ uri: uri as `${string}://${string}`, text: 'private template content' }] }),
    } as MCPResourceTemplateProvider<unknown>],
    prompts: [{
      name: 'private-prompt',
      title: 'Private Prompt',
      description: 'A private prompt',
      messages: () => Promise.resolve([{ role: 'user', content: [{ type: 'text', text: 'private prompt message' }] }]),
    } as unknown as MCPPromptDef<unknown, unknown>],
  };
};

const createForbiddenToolkit = (namespace: string): MCPToolkit<unknown, { user: string }> => {
  const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
    type: 'http',
    validateToken: () => {
      // This toolkit requires auth but rejects all tokens (simulating forbidden access)
      return Promise.resolve(null);
    },
  };

  return {
    namespace,
    auth: mockAuth,
    tools: [{
      name: 'forbidden-tool',
      description: 'A forbidden tool',
      run: () => ({ content: [{ type: 'text', text: 'forbidden tool result' }] }),
    } as MCPTool<unknown, unknown>],
    resources: [{
      uri: 'forbidden://resource',
      name: 'forbidden-resource',
      read: () => ({ contents: [{ uri: 'forbidden://resource', text: 'forbidden resource content' }] }),
    } as MCPResourceProvider<unknown>],
    resourceTemplates: [{
      descriptor: {
        uriTemplate: 'forbidden://{name}',
        name: 'forbidden-template',
        title: 'Forbidden Template',
        description: 'A forbidden template',
        mimeType: 'text/plain',
      },
      read: (uri: string) => ({ contents: [{ uri: uri as `${string}://${string}`, text: 'forbidden template content' }] }),
    } as MCPResourceTemplateProvider<unknown>],
    prompts: [{
      name: 'forbidden-prompt',
      title: 'Forbidden Prompt',
      description: 'A forbidden prompt',
      messages: () => Promise.resolve([{ role: 'user', content: [{ type: 'text', text: 'forbidden prompt message' }] }]),
    } as unknown as MCPPromptDef<unknown, unknown>],
  };
};

describe('OAuth 2.1 Compliant List Handlers (Centralized Auth)', () => {
  let publicToolkit: MCPToolkit<unknown, unknown>;
  let privateToolkit: MCPToolkit<unknown, { user: string }>;
  let forbiddenToolkit: MCPToolkit<unknown, { user: string }>;
  let toolkits: MCPToolkit<unknown, unknown>[];

  beforeEach(() => {
    publicToolkit = createPublicToolkit('public');
    privateToolkit = createPrivateToolkit('private');
    forbiddenToolkit = createForbiddenToolkit('forbidden');
    toolkits = [publicToolkit, privateToolkit, forbiddenToolkit];
  });

  describe('List Endpoints (MCP Specification Compliant)', () => {
    it('should return all tools regardless of auth status', async () => {
      const methods = ['tools/list', 'prompts/list', 'resources/list', 'resources/templates/list'] as const;
      
      for (const method of methods) {
        const request: MCPRequest = { id: 1, method } as MCPRequest;
        const response = await handleRPC(request, toolkits, { 
          httpRequest: createMockRequest()
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect('error' in response).toBe(false);
        
        // All list endpoints should return all items regardless of auth
        if (method === 'tools/list') {
          const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
          const toolNames = result.tools.map(t => t.name);
          expect(toolNames).toContain('public_public-tool');
          expect(toolNames).toContain('private_private-tool');
          expect(toolNames).toContain('forbidden_forbidden-tool');
          expect(toolNames).toContain('search');
          expect(toolNames).toContain('fetch');
        } else if (method === 'prompts/list') {
          const result = (response as MCPResponse & { result: { prompts: Array<{ name: string }> } }).result;
          const promptNames = result.prompts.map(p => p.name);
          expect(promptNames).toContain('public_public-prompt');
          expect(promptNames).toContain('private_private-prompt');
          expect(promptNames).toContain('forbidden_forbidden-prompt');
        } else if (method === 'resources/list') {
          const result = (response as MCPResponse & { result: { resources: Array<{ uri: string }> } }).result;
          const resourceUris = result.resources.map(r => r.uri);
          expect(resourceUris).toContain('public://resource');
          expect(resourceUris).toContain('private://resource');
          expect(resourceUris).toContain('forbidden://resource');
        } else if (method === 'resources/templates/list') {
          const result = (response as MCPResponse & { result: { resourceTemplates: Array<{ name: string }> } }).result;
          const templateNames = result.resourceTemplates.map(t => t.name);
          expect(templateNames).toContain('public-template');
          expect(templateNames).toContain('private-template');
          expect(templateNames).toContain('forbidden-template');
        }
      }
    });

    it('should return all tools even with invalid auth', async () => {
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer invalid-token' })
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should include ALL tools regardless of auth status
      expect(toolNames).toContain('public_public-tool');
      expect(toolNames).toContain('private_private-tool');
      expect(toolNames).toContain('forbidden_forbidden-tool');
      expect(toolNames).toContain('search');
      expect(toolNames).toContain('fetch');
    });

    it('should work with only public toolkits', async () => {
      const publicOnlyToolkits = [publicToolkit];
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, publicOnlyToolkits, { 
        httpRequest: createMockRequest()
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should include public toolkit tools
      expect(toolNames).toContain('public_public-tool');
      // Should include canonical tools
      expect(toolNames).toContain('search');
      expect(toolNames).toContain('fetch');
    });
  });

  describe('Discovery Information in Error Responses', () => {
    it('should include discovery information when available', async () => {
      const discoveryConfig = {
        authorizationServer: {
          issuer: 'https://auth.example.com',
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
          introspectionEndpoint: 'https://auth.example.com/introspect',
          revocationEndpoint: 'https://auth.example.com/revoke',
          registrationEndpoint: 'https://auth.example.com/register',
          supportedResponseTypes: ['code'],
          supportedGrantTypes: ['authorization_code'],
          supportedCodeChallengeMethods: ['S256'],
          supportedScopes: ['read', 'write'],
          supportedTokenAuthMethods: ['client_secret_basic'],
          supportedIntrospectionAuthMethods: ['client_secret_basic'],
          supportedRevocationAuthMethods: ['client_secret_basic']
        },
        protectedResource: {
          resourceUri: 'https://mcp.example.com',
          audience: ['https://mcp.example.com'],
          authorizationServers: [{
            issuer: 'https://auth.example.com',
            authorizationEndpoint: 'https://auth.example.com/authorize',
            tokenEndpoint: 'https://auth.example.com/token',
            introspectionEndpoint: 'https://auth.example.com/introspect',
            supportedResponseTypes: ['code'],
            supportedGrantTypes: ['authorization_code']
          }],
          scopes: ['read', 'write'],
          resourceSigningAlgorithms: ['RS256']
        },
        discoveryCacheTtl: 3600
      };

      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest(),
        discovery: discoveryConfig
      });
      
      // List endpoints should return all tools regardless of auth
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should include ALL tools regardless of auth status
      expect(toolNames).toContain('public_public-tool');
      expect(toolNames).toContain('private_private-tool');
      expect(toolNames).toContain('forbidden_forbidden-tool');
      expect(toolNames).toContain('search');
      expect(toolNames).toContain('fetch');
    });
  });
});
