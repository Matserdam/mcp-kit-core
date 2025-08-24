/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { describe, it, expect } from 'vitest';
import { runSearch } from '../src/lib/handlers/tools/runners/search';
import { runFetch } from '../src/lib/handlers/tools/runners/fetch';
import type { MCPToolkit, MCPResourceProvider } from '../src/types/toolkit';
import type { MCPToolsCallParams, MCPToolCallResult, ResourceUri, ContentResource } from '../src/types/server';

// Type guard to check if result is a tool call result
const isToolCallResult = (result: unknown): result is MCPToolCallResult => {
  return result !== null && 
         typeof result === 'object' && 
         'content' in result && 
         'structuredContent' in result;
};

// Helper function to safely access structuredContent
const getStructuredContent = (result: { result?: unknown }) => {
  if (result.result && isToolCallResult(result.result)) {
    return result.result.structuredContent;
  }
  return undefined;
};

// Mock toolkits for testing
const createMockToolkit = (overrides: Partial<MCPToolkit<unknown, unknown>> = {}): MCPToolkit<unknown, unknown> => ({
  namespace: 'test',
  ...overrides
});

const createMockResource = (uri: string, name: string, title?: string, description?: string): MCPResourceProvider<Record<string, unknown>> => ({
  uri: uri as `${string}://${string}`,
  name,
  title,
  description,
  mimeType: 'text/plain',
  read: () => Promise.resolve({ 
    contents: [{ 
      uri: uri as `${string}://${string}`,
      text: 'test content', 
      name: 'test',
      mimeType: 'text/plain'
    }] 
  })
});

// Mock template creation (unused but kept for future tests)
// const createMockTemplate = (uriTemplate: string, name: string, title?: string, description?: string) => ({
//   descriptor: {
//     uriTemplate,
//     name,
//     title,
//     description,
//     mimeType: 'text/plain'
//   },
//   read: async () => ({ contents: [{ text: 'test content', name: 'test' }] })
// });

describe('Mutation Tests - Search Runner', () => {
  describe('Input Validation Edge Cases', () => {
    it('should handle missing query parameter', async () => {
      const params: MCPToolsCallParams = { name: 'search', arguments: {} };
      const result = await runSearch('test-id', params, []);
      expect(result.error?.code).toBe(-32602);
      expect(result.error?.message).toContain('expected { query: string }');
    });

    it('should handle empty string query', async () => {
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: '' } };
      const result = await runSearch('test-id', params, []);
      expect(result.error?.code).toBe(-32602);
      expect(result.error?.message).toContain('expected { query: string }');
    });

    it('should handle non-string query', async () => {
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 123 } };
      const result = await runSearch('test-id', params, []);
      expect(result.error?.code).toBe(-32602);
      expect(result.error?.message).toContain('expected { query: string }');
    });
  });

  describe('topK Parameter Edge Cases', () => {
    it('should handle negative topK', async () => {
      const toolkit = createMockToolkit({
        resources: [createMockResource('test://resource1', 'Test Resource 1')]
      });
      
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test', topK: -5 } };
      const result = await runSearch('test-id', params, [toolkit]);
      
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.structuredContent).toBeDefined();
      expect(toolCallResult.structuredContent?.results).toHaveLength(1);
    });

    it('should handle zero topK', async () => {
      const toolkit = createMockToolkit({
        resources: [createMockResource('test://resource1', 'Test Resource 1')]
      });
      
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test', topK: 0 } };
      const result = await runSearch('test-id', params, [toolkit]);
      
      expect(getStructuredContent(result)?.results).toHaveLength(1);
    });

    it('should handle fractional topK', async () => {
      const toolkit = createMockToolkit({
        resources: [createMockResource('test://resource1', 'Test Resource 1')]
      });
      
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test', topK: 3.7 } };
      const result = await runSearch('test-id', params, [toolkit]);
      
      expect(getStructuredContent(result)?.results).toHaveLength(1);
    });
  });

  describe('Site Parameter Edge Cases', () => {
    it('should handle empty site string', async () => {
      const toolkit = createMockToolkit({
        resources: [createMockResource('https://example.com/resource', 'Test Resource')]
      });
      
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test', site: '' } };
      const result = await runSearch('test-id', params, [toolkit]);
      
      expect(getStructuredContent(result)?.results).toHaveLength(1);
    });

    it('should handle non-string site', async () => {
      const toolkit = createMockToolkit({
        resources: [createMockResource('https://example.com/resource', 'Test Resource')]
      });
      
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test', site: 123 } };
      const result = await runSearch('test-id', params, [toolkit]);
      
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.structuredContent).toBeDefined();
      expect(toolCallResult.structuredContent?.results).toHaveLength(1);
    });
  });

  describe('URL Parsing Edge Cases', () => {
    it('should handle invalid URLs gracefully', async () => {
      const toolkit = createMockToolkit({
        resources: [createMockResource('invalid://url', 'Test Resource')]
      });
      
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test' } };
      const result = await runSearch('test-id', params, [toolkit]);
      
      // Invalid URLs are handled gracefully - the resource should still be found
      expect(getStructuredContent(result)?.results).toHaveLength(1);
    });
  });

  describe('Empty Toolkit Edge Cases', () => {
    it('should handle empty toolkits array', async () => {
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test' } };
      const result = await runSearch('test-id', params, []);
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.structuredContent).toBeDefined();
      expect(toolCallResult.structuredContent?.results).toHaveLength(0);
      expect(toolCallResult.structuredContent?.templates).toHaveLength(0);
    });

    it('should handle toolkit with no resources or templates', async () => {
      const toolkit = createMockToolkit();
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'test' } };
      const result = await runSearch('test-id', params, [toolkit]);
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.structuredContent).toBeDefined();
      expect(toolCallResult.structuredContent?.results).toHaveLength(0);
      expect(toolCallResult.structuredContent?.templates).toHaveLength(0);
    });
  });

  describe('Case Sensitivity Edge Cases', () => {
    it('should handle case-insensitive search', async () => {
      const toolkit = createMockToolkit({
        resources: [createMockResource('test://resource', 'UPPERCASE RESOURCE')]
      });
      
      const params: MCPToolsCallParams = { name: 'search', arguments: { query: 'uppercase' } };
      const result = await runSearch('test-id', params, [toolkit]);
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.structuredContent).toBeDefined();
      expect(toolCallResult.structuredContent?.results).toHaveLength(1);
    });
  });
});

describe('Mutation Tests - Fetch Runner', () => {
  describe('Input Validation Edge Cases', () => {
    it('should handle missing id parameter', async () => {
      const params: MCPToolsCallParams = { name: 'fetch', arguments: {} };
      const result = await runFetch('test-id', params, []);
      expect(result.error?.code).toBe(-32602);
      expect(result.error?.message).toContain('expected { id: string, uri?: string }');
    });

    it('should handle empty id string', async () => {
      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: '' } };
      const result = await runFetch('test-id', params, []);
      expect(result.error?.code).toBe(-32602);
      expect(result.error?.message).toContain('expected { id: string, uri?: string }');
    });

    it('should handle non-string id', async () => {
      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 123 } };
      const result = await runFetch('test-id', params, []);
      expect(result.error?.code).toBe(-32602);
      expect(result.error?.message).toContain('expected { id: string, uri?: string }');
    });
  });

  describe('URI Resolution Edge Cases', () => {
    it('should handle id as http URL without explicit uri', async () => {
      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'https://example.com/resource' } };
      const result = await runFetch('test-id', params, []);
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(0);
    });

    it('should handle non-http id without uri', async () => {
      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-resource' } };
      const result = await runFetch('test-id', params, []);
      expect(result.error?.code).toBe(-32602);
      expect(result.error?.message).toContain('provide a resolvable uri');
    });
  });

  describe('Provider Resolution Edge Cases', () => {
    it('should handle provider read throwing error', async () => {
      const mockProvider = {
        uri: 'test://resource' as `${string}://${string}`,
        name: 'Test Resource',
        mimeType: 'text/plain',
        read: async () => { 
          await new Promise<void>((resolve) => resolve());
          throw new Error('Provider error'); 
        }
      };

      const toolkit = createMockToolkit({
        resources: [mockProvider]
      });

      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'test://resource' } };
      const result = await runFetch('test-id', params, [toolkit]);

      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(1);
      expect(toolCallResult.content[0].type).toBe('resource_link');
    });

    it('should handle provider returning empty contents', async () => {
      const mockProvider = {
        uri: 'test://resource' as `${string}://${string}`,
        name: 'Test Resource',
        mimeType: 'text/plain',
        read: async () => { 
          await new Promise<void>((resolve) => resolve());
          return { contents: [] }; 
        }
      };

      const toolkit = createMockToolkit({
        resources: [mockProvider]
      });

      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'test://resource' } };
      const result = await runFetch('test-id', params, [toolkit]);

      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(1);
      expect(toolCallResult.content[0].type).toBe('resource_link');
    });
  });

  describe('Template Resolution Edge Cases', () => {
    it('should handle template read throwing error', async () => {
      const mockTemplate = {
        descriptor: {
          uriTemplate: 'test://{id}/resource',
          name: 'Test Template',
          title: 'Test Template',
          description: 'Test template',
          mimeType: 'text/plain'
        },
        read: async () => { 
          await new Promise<void>((resolve) => resolve());
          throw new Error('Template error'); 
        }
      };

      const toolkit = createMockToolkit({
        resourceTemplates: [mockTemplate]
      });

      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'test://123/resource' } };
      const result = await runFetch('test-id', params, [toolkit]);

      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(0);
    });

    it('should handle template returning empty contents', async () => {
      const mockTemplate = {
        descriptor: {
          uriTemplate: 'test://{id}/resource',
          name: 'Test Template',
          title: 'Test Template',
          description: 'Test template',
          mimeType: 'text/plain'
        },
        read: async () => { 
          await new Promise<void>((resolve) => resolve());
          return { contents: [] }; 
        }
      };

      const toolkit = createMockToolkit({
        resourceTemplates: [mockTemplate]
      });

      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'test://123/resource' } };
      const result = await runFetch('test-id', params, [toolkit]);

      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(0);
    });
  });

  describe('Content Type Edge Cases', () => {
    it('should handle text content', async () => {
      const mockProvider = {
        uri: 'test://resource' as `${string}://${string}`,
        name: 'Test Resource',
        mimeType: 'text/plain',
        read: async () => { 
          await new Promise<void>((resolve) => resolve());
          return { 
            contents: [{ uri: 'test://resource' as ResourceUri, text: 'test content', name: 'test', mimeType: 'text/plain' }] 
          };
        }
      };

      const toolkit = createMockToolkit({
        resources: [mockProvider]
      });

      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'test://resource' } };
      const result = await runFetch('test-id', params, [toolkit]);

      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(1);
      expect(toolCallResult.content[0].type).toBe('resource');
      const resourceContent = toolCallResult.content[0] as ContentResource;
      expect('text' in resourceContent.resource && resourceContent.resource.text).toBe('test content');
    });

    it('should handle blob content', async () => {
      const mockProvider = {
        uri: 'test://resource' as `${string}://${string}`,
        name: 'Test Resource',
        mimeType: 'application/octet-stream',
        read: async () => { 
          await new Promise<void>((resolve) => resolve());
          return { 
            contents: [{ uri: 'test://resource' as ResourceUri, blob: btoa(String.fromCharCode(...Array.from(new Uint8Array([1, 2, 3])))), name: 'test', mimeType: 'application/octet-stream' }] 
          };
        }
      };

      const toolkit = createMockToolkit({
        resources: [mockProvider]
      });

      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'test://resource' } };
      const result = await runFetch('test-id', params, [toolkit]);

      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(1);
      expect(toolCallResult.content[0].type).toBe('resource');
      const resourceContent = toolCallResult.content[0] as ContentResource;
      expect('blob' in resourceContent.resource && resourceContent.resource.blob).toBe('AQID');
    });
  });

  describe('Empty Toolkit Edge Cases', () => {
    it('should handle empty toolkits array', async () => {
      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'https://example.com/resource' } };
      const result = await runFetch('test-id', params, []);
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(0);
    });

    it('should handle toolkit with no resources or templates', async () => {
      const toolkit = createMockToolkit();
      const params: MCPToolsCallParams = { name: 'fetch', arguments: { id: 'test-id', uri: 'https://example.com/resource' } };
      const result = await runFetch('test-id', params, [toolkit]);
      const toolCallResult = result.result as MCPToolCallResult;
      expect(toolCallResult).toBeDefined();
      expect(toolCallResult.content).toBeDefined();
      expect(toolCallResult.content).toHaveLength(0);
    });
  });
});
