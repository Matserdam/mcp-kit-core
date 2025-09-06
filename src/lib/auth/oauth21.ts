import type { MCPRequestWithHeaders } from "../../types/auth.d.ts";

/**
 * OAuth 2.1 Token Information interface
 */
export interface MCPOAuthTokenInfo {
  /** Subject (user ID) */
  sub?: string;
  /** Audience (resource URIs) */
  aud?: string[];
  /** Expiration time (Unix timestamp) */
  exp?: number;
  /** Issued at time (Unix timestamp) */
  iat?: number;
  /** Scopes */
  scope?: string;
  /** Client ID */
  client_id?: string;
  /** Username */
  username?: string;
  /** Token type */
  token_type?: string;
}

/**
 * Resource URI validation result per RFC 8707
 */
export interface MCPResourceValidation {
  resourceUri: string;
  canonicalUri: string;
  isValid: boolean;
  errors: string[];
}

/**
 * OAuth 2.1 error response interface
 */
export interface MCPOAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
  status_code: number;
}

/**
 * Token validation result with security analysis
 */
export interface MCPTokenValidationResult {
  isValid: boolean;
  user?: MCPUser;
  scopes?: string[];
  audience?: string[];
  expiresAt?: Date;
  securityIssues: MCPSecurityIssue[];
}

/**
 * User information
 */
export interface MCPUser {
  id: string;
  email?: string;
  name?: string;
  permissions?: string[];
}

/**
 * Security issue classification
 */
export interface MCPSecurityIssue {
  type:
    | "token_theft"
    | "audience_mismatch"
    | "expired_token"
    | "insufficient_scope"
    | "invalid_token";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  details?: Record<string, unknown>;
}

/**
 * OAuth 2.1 error codes and their HTTP status codes
 */
export const MCP_OAUTH_ERRORS = {
  invalid_request: {
    status: 400,
    description:
      "The request is missing a required parameter, includes an unsupported parameter value, or is otherwise malformed",
  },
  invalid_token: {
    status: 401,
    description:
      "The access token provided is expired, revoked, malformed, or invalid for other reasons",
  },
  insufficient_scope: {
    status: 403,
    description: "The request requires higher privileges than provided by the access token",
  },
  invalid_client: {
    status: 401,
    description: "Client authentication failed",
  },
  unauthorized_client: {
    status: 403,
    description: "The authenticated client is not authorized to use this authorization grant type",
  },
} as const;

/**
 * Validates resource URIs according to RFC 8707 Resource Indicators
 */
export function validateResourceUri(uri: string): MCPResourceValidation {
  const errors: string[] = [];

  // Must be a string
  if (typeof uri !== "string") {
    errors.push("Resource URI must be a string");
    return {
      resourceUri: String(uri),
      canonicalUri: "",
      isValid: false,
      errors,
    };
  }

  // Must not be empty
  if (uri.length === 0) {
    errors.push("Resource URI cannot be empty");
    return {
      resourceUri: uri,
      canonicalUri: "",
      isValid: false,
      errors,
    };
  }

  // Must have scheme
  if (!uri.includes("://")) {
    errors.push("Resource URI must include a scheme (e.g., https://, mcp://)");
  }

  // Must not contain fragment
  if (uri.includes("#")) {
    errors.push("Resource URI must not contain fragment (#)");
  }

  // Must not contain spaces
  if (uri.includes(" ")) {
    errors.push("Resource URI must not contain spaces");
  }

  // Canonical form (lowercase scheme and host, remove trailing slash)
  const canonicalUri = uri.toLowerCase().replace(/\/$/, "");

  return {
    resourceUri: uri,
    canonicalUri,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates token audience against expected resource URI
 */
export async function validateTokenAudience(
  token: string,
  expectedResourceUri: string,
  validateToken: (token: string) => Promise<MCPOAuthTokenInfo>,
): Promise<boolean> {
  try {
    const tokenInfo = await validateToken(token);

    // If no audience in token, consider it valid (some tokens don't use audience)
    if (!tokenInfo.aud || tokenInfo.aud.length === 0) {
      return true;
    }

    // Validate expected resource URI
    const expectedValidation = validateResourceUri(expectedResourceUri);
    if (!expectedValidation.isValid) {
      return false;
    }

    const canonicalExpected = expectedValidation.canonicalUri;

    // Check if any token audience matches the expected resource
    return tokenInfo.aud.some((audience) => {
      const audienceValidation = validateResourceUri(audience);
      if (!audienceValidation.isValid) {
        return false;
      }
      return audienceValidation.canonicalUri === canonicalExpected;
    });
  } catch (_error) {
    // If token validation fails, audience validation also fails
    return false;
  }
}

/**
 * Creates OAuth 2.1 compliant error response
 */
export function createOAuthErrorResponse(
  error: keyof typeof MCP_OAUTH_ERRORS,
  description?: string,
  errorUri?: string,
): Response {
  const oauthError = MCP_OAUTH_ERRORS[error];
  const errorResponse: MCPOAuthError = {
    error,
    error_description: description || oauthError.description,
    error_uri: errorUri,
    status_code: oauthError.status,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add WWW-Authenticate header for 401 errors
  if (oauthError.status === 401) {
    headers["WWW-Authenticate"] = `Bearer error="${error}"`;
  }

  return new Response(JSON.stringify(errorResponse), {
    status: oauthError.status,
    headers,
  });
}

/**
 * Validates token with comprehensive security checks
 */
export async function validateTokenWithSecurity(
  token: string,
  resourceUri: string,
  requiredScopes: string[],
  validateToken: (token: string) => Promise<MCPOAuthTokenInfo>,
): Promise<MCPTokenValidationResult> {
  const securityIssues: MCPSecurityIssue[] = [];

  try {
    const tokenInfo = await validateToken(token);

    // Check token expiration
    if (tokenInfo.exp) {
      const expirationDate = new Date(tokenInfo.exp * 1000);
      if (expirationDate < new Date()) {
        securityIssues.push({
          type: "expired_token",
          severity: "high",
          description: "Token has expired",
          details: { expiresAt: expirationDate },
        });
      }
    }

    // Check audience binding
    const hasValidAudience = await validateTokenAudience(token, resourceUri, validateToken);
    if (!hasValidAudience) {
      securityIssues.push({
        type: "audience_mismatch",
        severity: "critical",
        description: "Token audience does not match resource URI",
        details: {
          expectedResource: resourceUri,
          tokenAudiences: tokenInfo.aud,
        },
      });
    }

    // Check required scopes
    if (requiredScopes.length > 0) {
      const tokenScopes = tokenInfo.scope?.split(" ") || [];
      const missingScopes = requiredScopes.filter((scope) => !tokenScopes.includes(scope));
      if (missingScopes.length > 0) {
        securityIssues.push({
          type: "insufficient_scope",
          severity: "medium",
          description: `Missing required scopes: ${missingScopes.join(", ")}`,
          details: {
            required: requiredScopes,
            provided: tokenScopes,
            missing: missingScopes,
          },
        });
      }
    }

    // Create user object if subject is available
    const user: MCPUser | undefined = tokenInfo.sub
      ? {
        id: tokenInfo.sub,
        email: tokenInfo.username,
        name: tokenInfo.username,
      }
      : undefined;

    return {
      isValid: securityIssues.length === 0,
      user,
      scopes: tokenInfo.scope?.split(" ") || [],
      audience: tokenInfo.aud,
      expiresAt: tokenInfo.exp ? new Date(tokenInfo.exp * 1000) : undefined,
      securityIssues,
    };
  } catch (_error) {
    securityIssues.push({
      type: "invalid_token",
      severity: "critical",
      description: "Token validation failed",
      details: { error: _error instanceof Error ? _error.message : String(_error) },
    });

    return {
      isValid: false,
      securityIssues,
    };
  }
}

/**
 * Extracts Bearer token from Authorization header
 */
export function extractBearerToken(request: MCPRequestWithHeaders): string | null {
  const headers = request.headers;
  const authHeader = headers?.authorization || headers?.Authorization;

  if (!authHeader) {
    return null;
  }

  // Validate Bearer token format
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Basic token validation
  if (token.length === 0) {
    return null;
  }

  return token;
}
