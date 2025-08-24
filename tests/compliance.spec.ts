import { describe, it, expect, beforeEach } from 'vitest';
import { MCPComplianceValidator } from '../compliance/validator';

describe('MCP Compliance Validator', () => {
  let validator: MCPComplianceValidator;

  beforeEach(async () => {
    validator = new MCPComplianceValidator();
    // Give time for protobuf definitions to load
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Request Validation', () => {
    it('should validate valid JSON-RPC 2.0 request', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const result = validator.validateRequest(request);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject request with invalid jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        id: 1,
        method: 'initialize'
      };

      const result = validator.validateRequest(request);
      expect(result.passed).toBe(false);
      expect(result.errors).toContain('jsonrpc must be "2.0"');
    });

    it('should reject request without id field', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'initialize'
      };

      const result = validator.validateRequest(request);
      expect(result.passed).toBe(false);
      expect(result.errors).toContain('id field is required');
    });

    it('should reject request without method field', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1
      };

      const result = validator.validateRequest(request);
      expect(result.passed).toBe(false);
      expect(result.errors).toContain('method field is required and must be a string');
    });

    it('should warn about non-standard MCP methods', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'custom/method'
      };

      const result = validator.validateRequest(request);
      expect(result.passed).toBe(true);
      expect(result.warnings).toContain('Method "custom/method" is not a standard MCP method');
    });
  });

  describe('Response Validation', () => {
    it('should validate valid JSON-RPC 2.0 response with result', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          serverInfo: {
            name: 'test-server',
            version: '1.0.0'
          }
        }
      };

      const result = validator.validateResponse(response);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid JSON-RPC 2.0 response with error', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602,
          message: 'Invalid params'
        }
      };

      const result = validator.validateResponse(response);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject response with both result and error', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: {},
        error: { code: -1, message: 'test' }
      };

      const result = validator.validateResponse(response);
      expect(result.passed).toBe(false);
      expect(result.errors).toContain('Cannot have both result and error fields');
    });

    it('should reject response without result or error', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1
      };

      const result = validator.validateResponse(response);
      expect(result.passed).toBe(false);
      expect(result.errors).toContain('Either result or error field must be present');
    });
  });

  describe('Method-Specific Parameter Validation', () => {
    describe('initialize', () => {
      it('should validate valid initialize params', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject initialize without protocolVersion', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(false);
        expect(result.errors).toContain('protocolVersion is required and must be a string');
      });

      it('should reject initialize with invalid clientInfo', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: {
              name: 'test-client'
              // missing version
            }
          }
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(false);
        expect(result.errors).toContain('clientInfo.version is required and must be a string');
      });
    });

    describe('tools/call', () => {
      it('should validate valid tools/call params', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'test_tool',
            arguments: {
              param1: 'value1'
            }
          }
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject tools/call without name', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            arguments: { param1: 'value1' }
          }
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(false);
        expect(result.errors).toContain('name is required and must be a string');
      });
    });

    describe('resources/read', () => {
      it('should validate valid resources/read params', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/read',
          params: {
            uri: 'file:///path/to/resource'
          }
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject resources/read without uri', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/read',
          params: {}
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(false);
        expect(result.errors).toContain('uri is required and must be a string');
      });

      it('should reject resources/read with invalid uri format', () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/read',
          params: {
            uri: 'invalid-uri'
          }
        };

        const result = validator.validateRequest(request);
        expect(result.passed).toBe(false);
        expect(result.errors).toContain('uri must be a valid URI with scheme');
      });
    });
  });

  describe('Error Validation', () => {
    it('should validate valid error structure', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: { details: 'Additional error details' }
        }
      };

      const result = validator.validateResponse(response);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject error without code', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          message: 'Invalid params'
        }
      };

      const result = validator.validateResponse(response);
      expect(result.passed).toBe(false);
      expect(result.errors).toContain('error.code must be a number');
    });

    it('should reject error without message', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602
        }
      };

      const result = validator.validateResponse(response);
      expect(result.passed).toBe(false);
      expect(result.errors).toContain('error.message is required and must be a string');
    });
  });

  describe('Compliance Test Suite', () => {
    it('should run comprehensive compliance tests', () => {
      const results = validator.runComplianceTests();
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // All tests should have a result
      for (const result of results) {
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('warnings');
      }
    });

    it('should include JSON-RPC 2.0 basic structure test', () => {
      const results = validator.runComplianceTests();
      
      const basicStructureTest = results.find(r => 
        r.details?.expectedSchema && 
        typeof r.details.expectedSchema === 'object' &&
        'testName' in r.details.expectedSchema &&
        r.details.expectedSchema.testName === 'JSON-RPC 2.0 Basic Structure'
      );
      
      expect(basicStructureTest).toBeDefined();
    });

    it('should include MCP method validation test', () => {
      const results = validator.runComplianceTests();
      
      const methodValidationTest = results.find(r => 
        r.details?.expectedSchema && 
        typeof r.details.expectedSchema === 'object' &&
        'testName' in r.details.expectedSchema &&
        r.details.expectedSchema.testName === 'MCP Method Validation'
      );
      
      expect(methodValidationTest).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined inputs gracefully', () => {
      const nullResult = validator.validateRequest(null);
      expect(nullResult.passed).toBe(false);
      expect(nullResult.errors).toContain('Request must be a valid JSON object');

      const undefinedResult = validator.validateRequest(undefined);
      expect(undefinedResult.passed).toBe(false);
      expect(undefinedResult.errors).toContain('Request must be a valid JSON object');
    });

    it('should handle non-object inputs', () => {
      const stringResult = validator.validateRequest('not an object');
      expect(stringResult.passed).toBe(false);
      expect(stringResult.errors).toContain('Request must be a valid JSON object');

      const numberResult = validator.validateRequest(123);
      expect(numberResult.passed).toBe(false);
      expect(numberResult.errors).toContain('Request must be a valid JSON object');
    });

    it('should handle malformed JSON objects', () => {
      const malformedResult = validator.validateRequest({
        jsonrpc: '2.0',
        id: 'invalid-id-type', // should be number or string
        method: 123 // should be string
      });

      expect(malformedResult.passed).toBe(false);
      expect(malformedResult.errors).toContain('method field is required and must be a string');
    });
  });
});
