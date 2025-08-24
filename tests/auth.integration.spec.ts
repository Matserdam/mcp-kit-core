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

describe('Authentication Integration Tests', () => {
  let publicToolkit: MCPToolkit<unknown, unknown>;
  let privateToolkit: MCPToolkit<unknown, { user: string }>;
  let toolkits: MCPToolkit<unknown, unknown>[];

  beforeEach(() => {
    publicToolkit = createPublicToolkit('public');
    privateToolkit = createPrivateToolkit('private');
    toolkits = [publicToolkit, privateToolkit];
  });

  describe('Tools List Authentication', () => {
    it('should include public toolkit tools when no auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should include public toolkit tools
      expect(toolNames).toContain('public_public-tool');
      // Should include canonical tools
      expect(toolNames).toContain('search');
      expect(toolNames).toContain('fetch');
      // Should NOT include private toolkit tools
      expect(toolNames).not.toContain('private_private-tool');
    });

    it('should include private toolkit tools when valid auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should include both public and private toolkit tools
      expect(toolNames).toContain('public_public-tool');
      expect(toolNames).toContain('private_private-tool');
      // Should include canonical tools
      expect(toolNames).toContain('search');
      expect(toolNames).toContain('fetch');
    });

    it('should exclude private toolkit tools when invalid auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer invalid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should include public toolkit tools
      expect(toolNames).toContain('public_public-tool');
      // Should NOT include private toolkit tools
      expect(toolNames).not.toContain('private_private-tool');
    });
  });

  describe('Tool Call Authentication', () => {
    it('should allow access to public toolkit tool without auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'tools/call', 
        params: { name: 'public_public-tool', arguments: {} } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { content: Array<{ text: string }> } }).result;
      expect(result.content[0].text).toBe('public tool result');
    });

    it('should deny access to private toolkit tool without auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'tools/call', 
        params: { name: 'private_private-tool', arguments: {} } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(true);
      const error = (response as MCPResponse & { error: { code: number; message: string } }).error;
      expect(error.code).toBe(-32001);
      expect(error.message).toBe('Authorization header required');
    });

    it('should allow access to private toolkit tool with valid auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'tools/call', 
        params: { name: 'private_private-tool', arguments: {} } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { content: Array<{ text: string }> } }).result;
      expect(result.content[0].text).toBe('private tool result');
    });
  });

  describe('Resources List Authentication', () => {
    it('should include public toolkit resources when no auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'resources/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { resources: Array<{ uri: string }> } }).result;
      const resourceUris = result.resources.map(r => r.uri);
      
      // Should include public toolkit resources
      expect(resourceUris).toContain('public://resource');
      // Should NOT include private toolkit resources
      expect(resourceUris).not.toContain('private://resource');
    });

    it('should include private toolkit resources when valid auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'resources/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { resources: Array<{ uri: string }> } }).result;
      const resourceUris = result.resources.map(r => r.uri);
      
      // Should include both public and private toolkit resources
      expect(resourceUris).toContain('public://resource');
      expect(resourceUris).toContain('private://resource');
    });
  });

  describe('Resources Read Authentication', () => {
    it('should allow access to public toolkit resource without auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'resources/read', 
        params: { uri: 'public://resource' } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { contents: Array<{ text: string }> } }).result;
      expect(result.contents[0].text).toBe('public resource content');
    });

    it('should deny access to private toolkit resource without auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'resources/read', 
        params: { uri: 'private://resource' } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(true);
      const error = (response as MCPResponse & { error: { code: number; message: string } }).error;
      expect(error.code).toBe(-32001);
      expect(error.message).toBe('Authorization header required');
    });

    it('should allow access to private toolkit resource with valid auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'resources/read', 
        params: { uri: 'private://resource' } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { contents: Array<{ text: string }> } }).result;
      expect(result.contents[0].text).toBe('private resource content');
    });
  });

  describe('Resource Templates List Authentication', () => {
    it('should include public toolkit templates when no auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'resources/templates/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { resourceTemplates: Array<{ name: string }> } }).result;
      const templateNames = result.resourceTemplates.map(t => t.name);
      
      // Should include public toolkit templates
      expect(templateNames).toContain('public-template');
      // Should NOT include private toolkit templates
      expect(templateNames).not.toContain('private-template');
    });

    it('should include private toolkit templates when valid auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'resources/templates/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { resourceTemplates: Array<{ name: string }> } }).result;
      const templateNames = result.resourceTemplates.map(t => t.name);
      
      // Should include both public and private toolkit templates
      expect(templateNames).toContain('public-template');
      expect(templateNames).toContain('private-template');
    });
  });

  describe('Prompts List Authentication', () => {
    it('should include public toolkit prompts when no auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'prompts/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { prompts: Array<{ name: string }> } }).result;
      const promptNames = result.prompts.map(p => p.name);
      
      // Should include public toolkit prompts
      expect(promptNames).toContain('public_public-prompt');
      // Should NOT include private toolkit prompts
      expect(promptNames).not.toContain('private_private-prompt');
    });

    it('should include private toolkit prompts when valid auth provided', async () => {
      const request: MCPRequest = { id: 1, method: 'prompts/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { prompts: Array<{ name: string }> } }).result;
      const promptNames = result.prompts.map(p => p.name);
      
      // Should include both public and private toolkit prompts
      expect(promptNames).toContain('public_public-prompt');
      expect(promptNames).toContain('private_private-prompt');
    });
  });

  describe('Prompts Get Authentication', () => {
    it('should allow access to public toolkit prompt without auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'prompts/get', 
        params: { name: 'public_public-prompt' } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { messages: Array<{ content: Array<{ text: string }> }> } }).result;
      expect(result.messages[0].content[0].text).toBe('public prompt message');
    });

    it('should deny access to private toolkit prompt without auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'prompts/get', 
        params: { name: 'private_private-prompt' } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(true);
      const error = (response as MCPResponse & { error: { code: number; message: string } }).error;
      expect(error.code).toBe(-32001);
      expect(error.message).toBe('Authorization header required');
    });

    it('should allow access to private toolkit prompt with valid auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'prompts/get', 
        params: { name: 'private_private-prompt' } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { messages: Array<{ content: Array<{ text: string }> }> } }).result;
      expect(result.messages[0].content[0].text).toBe('private prompt message');
    });
  });

  describe('Canonical Tools Authentication', () => {
    it('should filter search results based on toolkit auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'tools/call', 
        params: { name: 'search', arguments: { query: 'resource' } } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { content: Array<{ text: string }> } }).result;
      const searchText = result.content[0].text;
      
      // Should include public resources
      expect(searchText).toContain('public://resource');
      // Should NOT include private resources
      expect(searchText).not.toContain('private://resource');
    });

    it('should include private resources in search when auth provided', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'tools/call', 
        params: { name: 'search', arguments: { query: 'resource' } } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { content: Array<{ text: string }> } }).result;
      const searchText = result.content[0].text;
      
      // Should include both public and private resources
      expect(searchText).toContain('public://resource');
      expect(searchText).toContain('private://resource');
    });

    it('should filter fetch results based on toolkit auth', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'tools/call', 
        params: { name: 'fetch', arguments: { id: 'test', uri: 'private://resource' } } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { content: Array<unknown> } }).result;
      
      // Should return empty content when private resource is not accessible
      expect(result.content).toHaveLength(0);
    });

    it('should allow fetch of private resource when auth provided', async () => {
      const request: MCPRequest = { 
        id: 1, 
        method: 'tools/call', 
        params: { name: 'fetch', arguments: { id: 'test', uri: 'private://resource' } } 
      } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'Bearer valid-token' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(false);
      const result = (response as MCPResponse & { result: { content: Array<{ resource: { text: string } }> } }).result;
      
      // Should return the private resource content
      expect(result.content[0].resource.text).toBe('private resource content');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malformed authorization headers gracefully', async () => {
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({ authorization: 'InvalidFormat' }) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should only include public tools
      expect(toolNames).toContain('public_public-tool');
      expect(toolNames).not.toContain('private_private-tool');
    });

    it('should handle missing authorization header gracefully', async () => {
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, toolkits, { 
        httpRequest: createMockRequest({}) 
      });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should only include public tools
      expect(toolNames).toContain('public_public-tool');
      expect(toolNames).not.toContain('private_private-tool');
    });

    it('should handle toolkit without auth middleware', async () => {
      const noAuthToolkit: MCPToolkit<unknown, unknown> = {
        namespace: 'noauth',
        tools: [{
          name: 'noauth-tool',
          description: 'A tool without auth',
          run: () => ({ content: [{ type: 'text', text: 'noauth tool result' }] }),
        } as MCPTool<unknown, unknown>],
      };
      
      const allToolkits = [publicToolkit, privateToolkit, noAuthToolkit];
      const request: MCPRequest = { id: 1, method: 'tools/list' } as MCPRequest;
      const response = await handleRPC(request, allToolkits, { httpRequest: createMockRequest() });
      
      expect(response.jsonrpc).toBe('2.0');
      const result = (response as MCPResponse & { result: { tools: Array<{ name: string }> } }).result;
      const toolNames = result.tools.map(t => t.name);
      
      // Should include both public and no-auth toolkit tools
      expect(toolNames).toContain('public_public-tool');
      expect(toolNames).toContain('noauth_noauth-tool');
      // Should NOT include private toolkit tools
      expect(toolNames).not.toContain('private_private-tool');
    });
  });
});
