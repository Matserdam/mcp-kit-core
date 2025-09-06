/**
 * Authentication error class with proper HTTP status codes.
 *
 * Follows MCP specification requirements for auth error handling.
 *
 * @example
 * ```typescript
 * throw new MCPAuthError('Invalid token', 401);
 * throw new MCPAuthError('Insufficient permissions', 403);
 * ```
 */
export class MCPAuthError extends Error {
  /**
   * Creates a new authentication error.
   *
   * @param message - Error message
   * @param statusCode - HTTP status code (default: 401)
   */
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "MCPAuthError";
  }
}

/**
 * Authentication error codes per MCP specification.
 *
 * These codes align with OAuth 2.1 and MCP authorization requirements.
 */
export const MCP_AUTH_ERROR_CODES = {
  /** Authorization required or token invalid */
  UNAUTHORIZED: 401,
  /** Invalid scopes or insufficient permissions */
  FORBIDDEN: 403,
  /** Malformed authorization request */
  BAD_REQUEST: 400,
} as const;
