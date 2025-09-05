import type { MCPServerOptions } from '../types/server';
import type { MCPStdioOptions, MCPStdioController } from '../types/stdio';
import type { MCPToolkit } from '../types/toolkit';
import type { MCPDiscoveryConfig } from '../types/auth';
import { StdioController } from './stdio';
import { parseFetchRpc } from '../validations/request.fetch';
import { handleRPC } from './rpc';
import { responseJson } from './response/json';
import { responseSSEOnce } from './response/sse';
import { MCPDiscoveryHandler, createDiscoveryResponse } from './auth/discovery';
import { defaultCORSHandler, discoveryCORSHandler } from './handlers/cors';

export class MCPServer {
  private readonly toolkits: MCPToolkit<unknown, unknown>[];
  private readonly discoveryHandler?: MCPDiscoveryHandler;
  private readonly options: MCPServerOptions;

  constructor(options: MCPServerOptions) {
    this.toolkits = options.toolkits;
    this.options = options;
    
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
    // Validate authorization server configuration
    if (!config.authorizationServer.issuer || config.authorizationServer.issuer.trim() === '') {
      throw new Error('Invalid discovery configuration: Authorization server issuer is required');
    }
    
    if (!config.authorizationServer.authorizationEndpoint) {
      throw new Error('Invalid discovery configuration: Authorization server authorization endpoint is required');
    }
    
    if (!config.authorizationServer.tokenEndpoint) {
      throw new Error('Invalid discovery configuration: Authorization server token endpoint is required');
    }

    // Validate protected resource configuration
    if (!config.protectedResource.resourceUri) {
      throw new Error('Invalid discovery configuration: Protected resource URI is required');
    }
    
    if (!config.protectedResource.authorizationServers || config.protectedResource.authorizationServers.length === 0) {
      throw new Error('Invalid discovery configuration: At least one authorization server is required');
    }
    
    for (const server of config.protectedResource.authorizationServers) {
      if (!server.issuer || server.issuer.trim() === '') {
        throw new Error('Invalid discovery configuration: Authorization server issuer is required');
      }
    }
  }

  fetch = async (request: Request): Promise<Response> => {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);

    // Handle CORS preflight requests first
    const corsResponse = defaultCORSHandler.handlePreflight(request);
    if (corsResponse) {
      return corsResponse;
    }

    // Handle discovery endpoints
    if (this.discoveryHandler && this.options.discovery?.enableDiscoveryEndpoints !== false) {
      if (url.pathname === '/.well-known/oauth-authorization-server') {
        if (method === 'GET') {
          const metadata = await this.discoveryHandler.getAuthorizationServerMetadata();
          const response = createDiscoveryResponse(metadata);
          return discoveryCORSHandler.addCORSHeaders(response, request);
        }
        return new Response('Method Not Allowed', { status: 405 });
      }
      
      if (url.pathname === '/.well-known/oauth-protected-resource') {
        if (method === 'GET') {
          const metadata = await this.discoveryHandler.getProtectedResourceMetadata();
          const response = createDiscoveryResponse(metadata);
          return discoveryCORSHandler.addCORSHeaders(response, request);
        }
        return new Response('Method Not Allowed', { status: 405 });
      }
    }

    if (method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let rpc: unknown;
    try {
      rpc = await request.json();
    } catch {
      const errorResponse = responseJson({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
      return defaultCORSHandler.addCORSHeaders(errorResponse, request);
    }
    
    // Accept negotiation
    const accept = request.headers.get('accept') ?? '*/*';
    const wantsEventStream = /(^|,|\s)text\/event-stream(\s*;|\s|$)/i.test(accept);
    const wantsJson = /(^|,|\s)application\/json(\s*;|\s|$)/i.test(accept) || accept.includes('*/*');

    // If client sent a JSON-RPC response payload (not a request), ack with 202
    const isClientResponse = rpc && typeof rpc === 'object' && (rpc as Record<string, unknown>).jsonrpc === '2.0' && !('method' in rpc) && (('result' in rpc) || ('error' in rpc));
    if (isClientResponse) {
      const response = new Response(null, { status: 202 });
      return defaultCORSHandler.addCORSHeaders(response, request);
    }
    
    const parsed = parseFetchRpc(rpc);
    if ("error" in parsed) {
      const errorResponse = responseJson({ jsonrpc: '2.0', id: parsed.id, error: parsed.error }, { status: 400 });
      return defaultCORSHandler.addCORSHeaders(errorResponse, request);
    }
    
    // Notification (no id provided by client payload)
    const isNotification = rpc && typeof rpc === 'object' && (rpc as Record<string, unknown>).jsonrpc === '2.0' && typeof (rpc as Record<string, unknown>).method === 'string' && !('id' in rpc);
    if (isNotification) {
      void handleRPC(parsed, this.toolkits);
      const response = new Response(null, { status: 202 });
      return defaultCORSHandler.addCORSHeaders(response, request);
    }

    const response = await handleRPC(parsed, this.toolkits, {
      httpRequest: request,
      discovery: this.options.discovery
    });
    
    let finalResponse: Response;
    if (wantsEventStream && !wantsJson) {
      finalResponse = responseSSEOnce(response);
    } else if (wantsEventStream && wantsJson) {
      // Prefer SSE when explicitly requested alongside JSON
      finalResponse = responseSSEOnce(response);
    } else {
      finalResponse = responseJson(response);
    }
    
    // Handle auth errors with proper HTTP status and headers
    if (this.discoveryHandler && 'error' in response && response.error?.code === -32001) {
      const wwwAuthHeader = this.discoveryHandler.createWWWAuthenticateHeader(request.url);
      const enhancedErrorResponse = this.discoveryHandler.createDiscoveryErrorResponse(
        response.id,
        request.url,
        'invalid_token',
        response.error.message
      );
      const errorResponse = responseJson(enhancedErrorResponse, { 
        status: 401,
        headers: {
          'WWW-Authenticate': wwwAuthHeader
        }
      });
      return defaultCORSHandler.addCORSHeaders(errorResponse, request);
    }
    
    return defaultCORSHandler.addCORSHeaders(finalResponse, request);
  };

  public stdio(): void {
    // Placeholder for stdio transport
  }

  public httpStreamable(req: unknown): Promise<{ status: number; headers: Headers; body: ReadableStream<Uint8Array> }>{
    void req;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('Not Implemented'));
        controller.close();
      },
    });
    return Promise.resolve({ status: 501, headers: new Headers({ 'content-type': 'text/plain' }), body: stream });
  }

  public startStdio = (options?: MCPStdioOptions): MCPStdioController => {
    const controller = new StdioController(this.toolkits, options);
    controller.start();
    return controller;
  }
}


