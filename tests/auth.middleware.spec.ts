import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuthContext,
  executeAuth,
  executeHTTPAuth,
  executeSTDIOAuth,
  MCPAuthError,
  MCPAuthMiddlewareManager,
  validateAuthMiddleware,
} from "../src/index";
import type {
  MCPHTTPAuthMiddleware,
  MCPRequest,
  MCPRequestWithHeaders,
  MCPResourceUriExtractor,
  MCPSTDIOAuthMiddleware,
} from "../src/index";
import type { MCPToolkit } from "../src/index";

describe("Auth Middleware", () => {
  let mockRequest: MCPRequest;
  let mockEnv: NodeJS.ProcessEnv;
  let mockResourceUriExtractor: MCPResourceUriExtractor;

  beforeEach(() => {
    mockRequest = {
      id: "1",
      method: "tools/call",
      params: { name: "test.tool", arguments: {} },
    } as MCPRequest;

    mockEnv = {
      MCP_API_KEY: "test-api-key",
      MCP_USER_ID: "test-user",
    };

    mockResourceUriExtractor = {
      extractUri: vi.fn().mockReturnValue("tool:test.tool"),
    };
  });

  describe("MCPAuthError", () => {
    it("should create auth error with default status code", () => {
      const error = new MCPAuthError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("MCPAuthError");
    });

    it("should create auth error with custom status code", () => {
      const error = new MCPAuthError("Forbidden", 403);
      expect(error.message).toBe("Forbidden");
      expect(error.statusCode).toBe(403);
    });
  });

  describe("HTTP Auth Middleware", () => {
    it("should execute HTTP auth with valid token", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn().mockResolvedValue({ user: "test-user" }),
      };

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "Bearer valid-token" },
      };

      const result = await executeHTTPAuth(request, mockAuth, mockResourceUriExtractor);

      expect(result.middleware).toEqual({ user: "test-user" });
      expect(result.transport).toBe("http");
      expect(mockAuth.validateToken).toHaveBeenCalledWith("valid-token", "tool:test.tool", request);
    });

    it("should throw error when authorization header is missing", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn(),
      };

      await expect(
        executeHTTPAuth(mockRequest as MCPRequestWithHeaders, mockAuth, mockResourceUriExtractor),
      )
        .rejects
        .toThrow(MCPAuthError);
    });

    it("should throw error when token format is invalid", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn(),
      };

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "InvalidFormat token" },
      };

      await expect(executeHTTPAuth(request, mockAuth, mockResourceUriExtractor))
        .rejects
        .toThrow(MCPAuthError);
    });

    it("should throw error when token validation fails", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn().mockResolvedValue(null),
      };

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "Bearer invalid-token" },
      };

      await expect(executeHTTPAuth(request, mockAuth, mockResourceUriExtractor))
        .rejects
        .toThrow(MCPAuthError);
    });

    it("should call onAuthError when provided", async () => {
      const onAuthError = vi.fn();
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn().mockRejectedValue(new Error("Network error")),
        onAuthError,
      };

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "Bearer invalid-token" },
      };

      await expect(executeHTTPAuth(request, mockAuth, mockResourceUriExtractor))
        .rejects
        .toThrow(MCPAuthError);

      expect(onAuthError).toHaveBeenCalled();
    });
  });

  describe("STDIO Auth Middleware", () => {
    it("should execute STDIO auth with valid credentials", async () => {
      const mockAuth: MCPSTDIOAuthMiddleware<{ user: string }> = {
        type: "stdio",
        extractCredentials: vi.fn().mockResolvedValue({ user: "test-user" }),
      };

      const result = await executeSTDIOAuth(mockEnv, mockAuth);

      expect(result.middleware).toEqual({ user: "test-user" });
      expect(result.transport).toBe("stdio");
      expect(mockAuth.extractCredentials).toHaveBeenCalledWith(mockEnv);
    });

    it("should throw error when credentials extraction fails", async () => {
      const mockAuth: MCPSTDIOAuthMiddleware<{ user: string }> = {
        type: "stdio",
        extractCredentials: vi.fn().mockResolvedValue(null),
      };

      await expect(executeSTDIOAuth(mockEnv, mockAuth))
        .rejects
        .toThrow(MCPAuthError);
    });
  });

  describe("Generic Auth Execution", () => {
    it("should execute HTTP auth when type is http", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn().mockResolvedValue({ user: "test-user" }),
      };

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "Bearer valid-token" },
      };

      const result = await executeAuth(request, mockEnv, mockAuth, mockResourceUriExtractor);

      expect(result.middleware).toEqual({ user: "test-user" });
      expect(result.transport).toBe("http");
    });

    it("should execute STDIO auth when type is stdio", async () => {
      const mockAuth: MCPSTDIOAuthMiddleware<{ user: string }> = {
        type: "stdio",
        extractCredentials: vi.fn().mockResolvedValue({ user: "test-user" }),
      };

      const result = await executeAuth(null, mockEnv, mockAuth, mockResourceUriExtractor);

      expect(result.middleware).toEqual({ user: "test-user" });
      expect(result.transport).toBe("stdio");
    });

    it("should throw error for invalid auth type", async () => {
      const mockAuth = {
        type: "invalid",
        validateToken: vi.fn(),
      } as unknown as MCPHTTPAuthMiddleware<unknown> | MCPSTDIOAuthMiddleware<unknown>;

      await expect(
        executeAuth(
          mockRequest as MCPRequestWithHeaders,
          mockEnv,
          mockAuth,
          mockResourceUriExtractor,
        ),
      )
        .rejects
        .toThrow(MCPAuthError);
    });
  });

  describe("Auth Middleware Validation", () => {
    it("should validate HTTP auth middleware", () => {
      const validAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn(),
      };

      expect(validateAuthMiddleware(validAuth)).toBe(true);
    });

    it("should validate STDIO auth middleware", () => {
      const validAuth: MCPSTDIOAuthMiddleware<{ user: string }> = {
        type: "stdio",
        extractCredentials: vi.fn(),
      };

      expect(validateAuthMiddleware(validAuth)).toBe(true);
    });

    it("should reject invalid auth middleware", () => {
      const invalidAuth = {
        type: "http",
        // Missing validateToken
      };

      expect(validateAuthMiddleware(invalidAuth)).toBe(false);
    });

    it("should reject null or undefined", () => {
      expect(validateAuthMiddleware(null)).toBe(false);
      expect(validateAuthMiddleware(undefined)).toBe(false);
    });
  });

  describe("Auth Middleware Manager", () => {
    let authManager: MCPAuthMiddlewareManager;

    beforeEach(() => {
      authManager = new MCPAuthMiddlewareManager();
    });

    it("should execute toolkit auth when auth middleware is present", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn().mockResolvedValue({ user: "test-user" }),
      };

      const toolkit: MCPToolkit<unknown, { user: string }> = {
        namespace: "test",
        auth: mockAuth,
      };

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "Bearer valid-token" },
      };

      const result = await authManager.executeToolkitAuth(toolkit, request, mockEnv);

      expect(result).not.toBeNull();
      expect(result!.middleware).toEqual({ user: "test-user" });
      expect(result!.transport).toBe("http");
    });

    it("should return null when toolkit has no auth middleware", async () => {
      const toolkit: MCPToolkit<unknown, unknown> = {
        namespace: "test",
        // No auth middleware
      };

      const result = await authManager.executeToolkitAuth(toolkit, mockRequest, mockEnv);

      expect(result).toBeNull();
    });

    it("should check if toolkits require auth", () => {
      const toolkit1: MCPToolkit<unknown, unknown> = { namespace: "test1" };
      const toolkit2: MCPToolkit<unknown, unknown> = {
        namespace: "test2",
        auth: {
          type: "http",
          validateToken: vi.fn(),
        } as MCPHTTPAuthMiddleware<unknown>,
      };

      expect(authManager.requiresAuth([toolkit1])).toBe(false);
      expect(authManager.requiresAuth([toolkit2])).toBe(true);
      expect(authManager.requiresAuth([toolkit1, toolkit2])).toBe(true);
    });

    it("should validate auth configuration", () => {
      const validToolkit: MCPToolkit<unknown, unknown> = {
        namespace: "test1",
        auth: {
          type: "http",
          validateToken: vi.fn(),
        } as MCPHTTPAuthMiddleware<unknown>,
      };

      const invalidToolkit: MCPToolkit<unknown, unknown> = {
        namespace: "test2",
        auth: {
          type: "http",
          // Missing validateToken
        } as unknown as MCPHTTPAuthMiddleware<unknown>,
      };

      const result = authManager.validateAuthConfiguration([validToolkit, invalidToolkit]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid auth middleware for toolkit: test2");
    });
  });

  describe("Auth Context Creation", () => {
    it("should create auth context when no auth is required", async () => {
      const toolkits: MCPToolkit<unknown, unknown>[] = [
        { namespace: "test1" },
        { namespace: "test2" },
      ];

      const context = await createAuthContext(mockRequest, mockEnv, toolkits);

      expect(context.authenticated).toBe(true);
      expect(context.middleware).toBeNull();
      expect(context.transport).toBeNull();
    });

    it("should create auth context when auth succeeds", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn().mockResolvedValue({ user: "test-user" }),
      };

      const toolkits: MCPToolkit<unknown, { user: string }>[] = [
        {
          namespace: "test",
          auth: mockAuth,
        },
      ];

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "Bearer valid-token" },
      };

      const context = await createAuthContext(request, mockEnv, toolkits);

      expect(context.authenticated).toBe(true);
      expect(context.middleware).toEqual({ user: "test-user" });
      expect(context.transport).toBe("http");
    });

    it("should create auth context when auth fails", async () => {
      const mockAuth: MCPHTTPAuthMiddleware<{ user: string }> = {
        type: "http",
        validateToken: vi.fn().mockResolvedValue(null),
      };

      const toolkits: MCPToolkit<unknown, { user: string }>[] = [
        {
          namespace: "test",
          auth: mockAuth,
        },
      ];

      const request: MCPRequestWithHeaders = {
        ...mockRequest,
        headers: { authorization: "Bearer invalid-token" },
      };

      const context = await createAuthContext(request, mockEnv, toolkits);

      expect(context.authenticated).toBe(false);
      expect(context.middleware).toBeNull();
      expect(context.transport).toBeNull();
    });
  });
});
