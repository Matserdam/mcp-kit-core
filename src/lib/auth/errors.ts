// Auth error class with proper HTTP status codes
export class MCPAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'MCPAuthError';
  }
}

// Auth error codes per MCP specification
export const MCP_AUTH_ERROR_CODES = {
  UNAUTHORIZED: 401,    // Authorization required or token invalid
  FORBIDDEN: 403,       // Invalid scopes or insufficient permissions
  BAD_REQUEST: 400      // Malformed authorization request
} as const;
