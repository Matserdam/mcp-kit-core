/**
 * CORS handler for managing Cross-Origin Resource Sharing
 */
export class CORSHandler {
  private readonly allowedOrigins: string[];
  private readonly allowedMethods: string[];
  private readonly allowedHeaders: string[];
  private readonly allowCredentials: boolean;

  constructor(options: {
    allowedOrigins?: string[];
    allowedMethods?: string[];
    allowedHeaders?: string[];
    allowCredentials?: boolean;
  } = {}) {
    this.allowedOrigins = options.allowedOrigins || ["*"];
    this.allowedMethods = options.allowedMethods || ["GET", "POST", "OPTIONS"];
    this.allowedHeaders = options.allowedHeaders || ["Content-Type", "Authorization", "Accept"];
    this.allowCredentials = options.allowCredentials || false;
  }

  /**
   * Handle CORS preflight request
   */
  handlePreflight(request: Request): Response | null {
    const method = request.method.toUpperCase();

    // Only handle OPTIONS requests
    if (method !== "OPTIONS") {
      return null;
    }

    const origin = request.headers.get("origin");
    const requestMethod = request.headers.get("access-control-request-method");
    const requestHeaders = request.headers.get("access-control-request-headers");

    // Check if this is a CORS preflight request
    if (!requestMethod) {
      return null;
    }

    const headers = new Headers();

    // Set CORS headers
    this.setCORSHeaders(headers, origin);

    // Add preflight-specific headers
    if (requestMethod) {
      headers.set("Access-Control-Allow-Methods", this.allowedMethods.join(", "));
    }

    if (requestHeaders) {
      headers.set("Access-Control-Allow-Headers", this.allowedHeaders.join(", "));
    }

    // Set max age for preflight caching
    headers.set("Access-Control-Max-Age", "86400"); // 24 hours

    return new Response(null, {
      status: 200,
      headers,
    });
  }

  /**
   * Add CORS headers to a response
   */
  addCORSHeaders(response: Response, request: Request): Response {
    const origin = request.headers.get("origin");
    const headers = new Headers(response.headers);

    this.setCORSHeaders(headers, origin);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Set CORS headers on a Headers object
   */
  private setCORSHeaders(headers: Headers, origin: string | null): void {
    // Handle origin
    if (this.allowedOrigins.includes("*")) {
      headers.set("Access-Control-Allow-Origin", "*");
    } else if (origin && this.allowedOrigins.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
    }

    // Handle credentials
    if (this.allowCredentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    // Set exposed headers if needed
    headers.set("Access-Control-Expose-Headers", "Content-Type, Authorization");
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;
    return this.allowedOrigins.includes("*") || this.allowedOrigins.includes(origin);
  }

  /**
   * Check if method is allowed
   */
  isMethodAllowed(method: string): boolean {
    return this.allowedMethods.includes(method.toUpperCase());
  }

  /**
   * Check if headers are allowed
   */
  areHeadersAllowed(headers: string[]): boolean {
    return headers.every((header) =>
      this.allowedHeaders.some((allowed) => allowed.toLowerCase() === header.toLowerCase())
    );
  }
}

/**
 * Default CORS handler with permissive settings for development
 */
export const defaultCORSHandler = new CORSHandler({
  allowedOrigins: ["*"],
  allowedMethods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  allowCredentials: false,
});

/**
 * Discovery CORS handler with relaxed allowed headers to support browser-based
 * discovery by tools (e.g., MCP Inspector) that may include Authorization/Accept
 * on cross-origin requests. Applies ONLY to well-known discovery endpoints.
 */
export const discoveryCORSHandler = new CORSHandler({
  allowedOrigins: ["*"],
  allowedMethods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  allowCredentials: false,
});
