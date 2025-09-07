import type { MCPServerOptions } from "../types/server.d.ts";
import type { EventSink } from "../types/observability.d.ts";
import { NoopEventSink } from "./observability/event-sink.ts";
import type { MCPStdioController, MCPStdioOptions } from "../types/stdio.d.ts";
import type { MCPToolkit } from "../types/toolkit.d.ts";
import type { MCPDiscoveryConfig } from "../types/auth.d.ts";
import { createDiscoveryResponse, MCPDiscoveryHandler } from "./auth/discovery.ts";
import { handleFetchRequest, validateDiscoveryConfig } from "./server/helpers.ts";

export class MCPServer {
  private readonly toolkits: MCPToolkit<unknown, unknown>[];
  private readonly discoveryHandler?: MCPDiscoveryHandler;
  private readonly options: MCPServerOptions;
  private readonly eventSink: EventSink;

  /**
   * Create a new MCP server instance for Node/Bun environments.
   *
   * @param options - Server configuration including toolkits and discovery
   */
  constructor(options: MCPServerOptions) {
    this.toolkits = options.toolkits;
    this.options = options;
    this.eventSink = options.eventSink ?? new NoopEventSink();

    if (options.discovery) {
      // Validate discovery configuration
      this.validateDiscoveryConfig(options.discovery);
      this.discoveryHandler = new MCPDiscoveryHandler(options.discovery);
    }
  }

  /**
   * Validate discovery configuration
   */
  private validateDiscoveryConfig(config: MCPDiscoveryConfig): void {
    validateDiscoveryConfig(config);
  }

  /**
   * Handle a Fetch request and return a JSON-RPC response.
   *
   * Also serves OAuth 2.1 discovery endpoints when enabled via options.
   *
   * @param request - The incoming HTTP request
   * @returns A Response containing JSON or a streaming event response
   */
  fetch = async (request: Request): Promise<Response> => {
    const resolveDiscovery = async (url: URL): Promise<Response | null> => {
      if (!this.discoveryHandler || this.options.discovery?.enableDiscoveryEndpoints === false) {
        return null;
      }
      if (url.pathname === "/.well-known/oauth-authorization-server") {
        const metadata = await this.discoveryHandler.getAuthorizationServerMetadata();
        return createDiscoveryResponse(metadata);
      }
      if (url.pathname === "/.well-known/oauth-protected-resource") {
        const metadata = await this.discoveryHandler.getProtectedResourceMetadata();
        return createDiscoveryResponse(metadata);
      }
      return null;
    };
    return await handleFetchRequest({
      request,
      toolkits: this.toolkits,
      discovery: this.options.discovery,
      eventSink: this.eventSink,
      resolveDiscovery,
      discoveryHandler: this.discoveryHandler,
    });
  };

  /**
   * Experimental: return a streamable HTTP response for server-sent events.
   * Currently returns 501; reserved for future multi-event streaming.
   */
  public httpStreamable(
    req: unknown,
  ): Promise<{ status: number; headers: Headers; body: ReadableStream<Uint8Array> }> {
    void req;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("Not Implemented"));
        controller.close();
      },
    });
    return Promise.resolve({
      status: 501,
      headers: new Headers({ "content-type": "text/plain" }),
      body: stream,
    });
  }

  /**
   * Start the STDIO transport loop in Node/Bun.
   *
   * Loads the Node-specific implementation dynamically to avoid bundling
   * into edge builds.
   */
  public startStdio = async (options?: MCPStdioOptions): Promise<MCPStdioController> => {
    // Dynamic import to avoid pulling Node-specific code into edge builds
    const { StdioController } = await import("./stdio.ts");
    const controller = new StdioController(this.toolkits, options);
    controller.start();
    return controller;
  };
}
