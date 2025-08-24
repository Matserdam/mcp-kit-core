/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
import { describe, it, expect, vi } from 'vitest';
import {
  validateResourceUri,
  validateTokenAudience,
  createOAuthErrorResponse,
  validateTokenWithSecurity,
  extractBearerToken,
  MCP_OAUTH_ERRORS,
  type MCPOAuthTokenInfo
} from '../src/lib/auth/oauth21';
import { createAuthAuditLog } from '../src/lib/auth/audit-logger';

describe('OAuth 2.1 Protocol Compliance', () => {
  describe('Resource Indicators (RFC 8707)', () => {
    it('should validate valid resource URIs', () => {
      const validUris = [
        'https://api.example.com/resource',
        'mcp://tools/weather',
        'file:///path/to/resource',
        'https://example.com/api/v1/users/123'
      ];

      validUris.forEach(uri => {
        const result = validateResourceUri(uri);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.canonicalUri).toBe(uri.toLowerCase().replace(/\/$/, ''));
      });
    });

    it('should reject invalid resource URIs', () => {
      const invalidUris = [
        { uri: '', expectedError: 'Resource URI cannot be empty' },
        { uri: 'not-a-uri', expectedError: 'Resource URI must include a scheme (e.g., https://, mcp://)' },
        { uri: 'https://example.com#fragment', expectedError: 'Resource URI must not contain fragment (#)' },
        { uri: 'https://example.com/path with spaces', expectedError: 'Resource URI must not contain spaces' }
      ];

      invalidUris.forEach(({ uri, expectedError }) => {
        const result = validateResourceUri(uri);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });

    it('should create canonical URIs', () => {
      const testCases = [
        { input: 'HTTPS://EXAMPLE.COM/RESOURCE', expected: 'https://example.com/resource' },
        { input: 'https://example.com/resource/', expected: 'https://example.com/resource' },
        { input: 'McP://Tools/Weather', expected: 'mcp://tools/weather' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = validateResourceUri(input);
        expect(result.canonicalUri).toBe(expected);
      });
    });
  });

  describe('Token Audience Validation', () => {
    const mockTokenValidator = (token: string): Promise<MCPOAuthTokenInfo> => {
      // Mock token validator that returns different audiences based on token
      if (token === 'valid-token') {
        return Promise.resolve({
          sub: 'user123',
          aud: ['https://api.example.com/resource', 'mcp://tools/weather'],
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: 'read write'
        });
      } else if (token === 'no-audience-token') {
        return Promise.resolve({
          sub: 'user123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: 'read write'
        });
      } else if (token === 'wrong-audience-token') {
        return Promise.resolve({
          sub: 'user123',
          aud: ['https://other-api.com/resource'],
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: 'read write'
        });
      }
      throw new Error('Invalid token');
    };

    it('should validate token audience correctly', async () => {
      const result = await validateTokenAudience(
        'valid-token',
        'https://api.example.com/resource',
        mockTokenValidator
      );
      expect(result).toBe(true);
    });

    it('should accept tokens without audience', async () => {
      const result = await validateTokenAudience(
        'no-audience-token',
        'https://api.example.com/resource',
        mockTokenValidator
      );
      expect(result).toBe(true);
    });

    it('should reject tokens with wrong audience', async () => {
      const result = await validateTokenAudience(
        'wrong-audience-token',
        'https://api.example.com/resource',
        mockTokenValidator
      );
      expect(result).toBe(false);
    });

    it('should handle token validation errors', async () => {
      const result = await validateTokenAudience(
        'invalid-token',
        'https://api.example.com/resource',
        mockTokenValidator
      );
      expect(result).toBe(false);
    });
  });

  describe('OAuth 2.1 Error Responses', () => {
    it('should create proper OAuth error responses', () => {
      const errorResponse = createOAuthErrorResponse('invalid_token', 'Custom error message');
      expect(errorResponse.status).toBe(401);
      
      // Headers is a Headers object, not a plain object
      expect(errorResponse.headers.get('Content-Type')).toBe('application/json');
      expect(errorResponse.headers.get('WWW-Authenticate')).toBe('Bearer error="invalid_token"');
    });

    it('should include all OAuth error codes', () => {
      const errorCodes = Object.keys(MCP_OAUTH_ERRORS);
      expect(errorCodes).toContain('invalid_request');
      expect(errorCodes).toContain('invalid_token');
      expect(errorCodes).toContain('insufficient_scope');
      expect(errorCodes).toContain('invalid_client');
      expect(errorCodes).toContain('unauthorized_client');
    });

    it('should return correct HTTP status codes', () => {
      expect(MCP_OAUTH_ERRORS.invalid_request.status).toBe(400);
      expect(MCP_OAUTH_ERRORS.invalid_token.status).toBe(401);
      expect(MCP_OAUTH_ERRORS.insufficient_scope.status).toBe(403);
    });
  });

  describe('Token Security Validation', () => {
    const mockTokenValidator = (token: string): Promise<MCPOAuthTokenInfo> => {
      if (token === 'expired-token') {
        return Promise.resolve({
          sub: 'user123',
          aud: ['https://api.example.com/resource'],
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          scope: 'read'
        });
      } else if (token === 'valid-token') {
        return Promise.resolve({
          sub: 'user123',
          aud: ['https://api.example.com/resource'],
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: 'read write'
        });
      } else if (token === 'insufficient-scope-token') {
        return Promise.resolve({
          sub: 'user123',
          aud: ['https://api.example.com/resource'],
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: 'read'
        });
      }
      throw new Error('Invalid token');
    };

    it('should detect expired tokens', async () => {
      const result = await validateTokenWithSecurity(
        'expired-token',
        'https://api.example.com/resource',
        ['read'],
        mockTokenValidator
      );

      expect(result.isValid).toBe(false);
      expect(result.securityIssues).toHaveLength(1);
      expect(result.securityIssues[0].type).toBe('expired_token');
      expect(result.securityIssues[0].severity).toBe('high');
    });

    it('should detect insufficient scopes', async () => {
      const result = await validateTokenWithSecurity(
        'insufficient-scope-token',
        'https://api.example.com/resource',
        ['read', 'write'],
        mockTokenValidator
      );

      expect(result.isValid).toBe(false);
      expect(result.securityIssues).toHaveLength(1);
      expect(result.securityIssues[0].type).toBe('insufficient_scope');
      expect(result.securityIssues[0].severity).toBe('medium');
    });

    it('should validate tokens with all checks passing', async () => {
      const result = await validateTokenWithSecurity(
        'valid-token',
        'https://api.example.com/resource',
        ['read'],
        mockTokenValidator
      );

      expect(result.isValid).toBe(true);
      expect(result.securityIssues).toHaveLength(0);
      expect(result.user?.id).toBe('user123');
      expect(result.scopes).toContain('read');
      expect(result.scopes).toContain('write');
    });

    it('should handle token validation errors', async () => {
      const result = await validateTokenWithSecurity(
        'invalid-token',
        'https://api.example.com/resource',
        ['read'],
        mockTokenValidator
      );

      expect(result.isValid).toBe(false);
      expect(result.securityIssues).toHaveLength(1);
      expect(result.securityIssues[0].type).toBe('invalid_token');
      expect(result.securityIssues[0].severity).toBe('critical');
    });
  });

  describe('Bearer Token Extraction', () => {
    it('should extract valid Bearer tokens', () => {
      const request = {
        id: 'test-1',
        method: 'tools/call' as const,
        params: { name: 'test' },
        headers: {
          authorization: 'Bearer valid-token-here'
        }
      };

      const token = extractBearerToken(request);
      expect(token).toBe('valid-token-here');
    });

    it('should handle case-insensitive header names', () => {
      const request = {
        id: 'test-2',
        method: 'tools/call' as const,
        params: { name: 'test' },
        headers: {
          Authorization: 'Bearer valid-token-here'
        }
      };

      const token = extractBearerToken(request);
      expect(token).toBe('valid-token-here');
    });

    it('should return null for missing authorization header', () => {
      const request = {
        id: 'test-3',
        method: 'tools/call' as const,
        params: { name: 'test' },
        headers: {}
      };

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });

    it('should return null for invalid Bearer format', () => {
      const request = {
        id: 'test-4',
        method: 'tools/call' as const,
        params: { name: 'test' },
        headers: {
          authorization: 'InvalidFormat token'
        }
      };

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });

    it('should return null for empty token', () => {
      const request = {
        id: 'test-5',
        method: 'tools/call' as const,
        params: { name: 'test' },
        headers: {
          authorization: 'Bearer '
        }
      };

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });
  });

  describe('Security Audit Logging', () => {
    it('should create audit log entries', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      const request = {
        id: 'audit-test-1',
        method: 'tools/call' as const,
        params: { name: 'test-tool' }
      };

      createAuthAuditLog('auth_success', { 
        user: { id: 'user123' },
        scopes: ['read', 'write']
      }, request);

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0];
      expect(logCall[0]).toBe('[AUTH_AUDIT]');
      
      const auditEntry = JSON.parse(logCall[1] as string) as {
        event: string;
        details: { user: { id: string } };
        requestInfo: { method: string };
      };
      expect(auditEntry.event).toBe('auth_success');
      expect(auditEntry.details.user.id).toBe('user123');
      expect(auditEntry.requestInfo.method).toBe('tools/call');
      
      consoleSpy.mockRestore();
    });

    it('should handle audit logging without request', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      createAuthAuditLog('token_validation', { 
        error: 'missing_authorization_header' 
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0];
      const auditEntry = JSON.parse(logCall[1] as string) as {
        event: string;
        requestInfo?: unknown;
      };
      expect(auditEntry.event).toBe('token_validation');
      expect(auditEntry.requestInfo).toBeUndefined();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete OAuth 2.1 validation flow', async () => {
      const mockTokenValidator = (token: string): Promise<MCPOAuthTokenInfo> => {
        if (token === 'integration-test-token') {
          return Promise.resolve({
            sub: 'user456',
            aud: ['https://api.example.com/resource'],
            exp: Math.floor(Date.now() / 1000) + 3600,
            scope: 'read write admin'
          });
        }
        throw new Error('Invalid token');
      };

      const request = {
        id: 'integration-test-1',
        method: 'resources/read' as const,
        params: { uri: 'https://api.example.com/resource' },
        headers: {
          authorization: 'Bearer integration-test-token'
        }
      };

      // Extract token
      const token = extractBearerToken(request);
      expect(token).toBe('integration-test-token');

      // Validate resource URI
      const resourceUri = 'https://api.example.com/resource';
      const resourceValidation = validateResourceUri(resourceUri);
      expect(resourceValidation.isValid).toBe(true);

      // Validate token with security
      const validationResult = await validateTokenWithSecurity(
        token!,
        resourceUri,
        ['read'],
        mockTokenValidator
      );

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.user?.id).toBe('user456');
      expect(validationResult.scopes).toContain('read');
      expect(validationResult.scopes).toContain('write');
      expect(validationResult.scopes).toContain('admin');
    });
  });
});
