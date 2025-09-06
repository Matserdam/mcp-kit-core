import type { MCPDiscoveryConfig } from '../../types/auth.d.ts';
import type { EventSink } from '../../types/observability.d.ts';
import { defaultCORSHandler, discoveryCORSHandler } from '../handlers/cors.ts';
import { parseFetchRpc } from '../../validations/request.fetch.ts';
import { handleRPC } from '../rpc.ts';
import { responseJson } from '../response/json.ts';
import { responseSSEOnce } from '../response/sse.ts';
import type { MCPDiscoveryHandler } from '../auth/discovery.ts';

export function validateDiscoveryConfig(config: MCPDiscoveryConfig): void {
  if (!config.authorizationServer.issuer || config.authorizationServer.issuer.trim() === '') {
    throw new Error('Invalid discovery configuration: Authorization server issuer is required');
  }
  if (!config.authorizationServer.authorizationEndpoint) {
    throw new Error('Invalid discovery configuration: Authorization server authorization endpoint is required');
  }
  if (!config.authorizationServer.tokenEndpoint) {
    throw new Error('Invalid discovery configuration: Authorization server token endpoint is required');
  }
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

export async function handleFetchRequest(opts: {
  request: Request;
  toolkits: Array<unknown>;
  discovery?: MCPDiscoveryConfig;
  eventSink?: EventSink;
  resolveDiscovery: (url: URL) => Promise<Response | null>;
  discoveryHandler?: MCPDiscoveryHandler;
}): Promise<Response> {
  const { request, toolkits, discovery, eventSink, resolveDiscovery, discoveryHandler } = opts;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  const isDiscoveryPath = (p: string): boolean =>
    p === '/.well-known/oauth-authorization-server' || p === '/.well-known/oauth-protected-resource';

  const corsResponse = defaultCORSHandler.handlePreflight(request);
  if (corsResponse) return corsResponse;

  const maybeDiscovery = method === 'GET' ? await resolveDiscovery(url) : null;
  if (maybeDiscovery) return discoveryCORSHandler.addCORSHeaders(maybeDiscovery, request);

  // For discovery endpoints, any non-GET method must return 405
  if (isDiscoveryPath(url.pathname) && method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let rpc: unknown;
  try {
    rpc = await request.json();
  } catch {
    const errorResponse = responseJson({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
    return defaultCORSHandler.addCORSHeaders(errorResponse, request);
  }

  const accept = request.headers.get('accept') ?? '*/*';
  const wantsEventStream = /(^|,|\s)text\/event-stream(\s*;|\s|$)/i.test(accept);
  const wantsJson = /(^|,|\s)application\/json(\s*;|\s|$)/i.test(accept) || accept.includes('*/*');

  // Acknowledge client responses (not requests) with 202 before parsing
  const isClientResponse = rpc && typeof rpc === 'object' && (rpc as Record<string, unknown>).jsonrpc === '2.0' && !('method' in rpc) && (("result" in (rpc as any)) || ("error" in (rpc as any)));
  if (isClientResponse) {
    const response = new Response(null, { status: 202 });
    return defaultCORSHandler.addCORSHeaders(response, request);
  }

  // Parse and validate request now
  const parsed = parseFetchRpc(rpc);
  if ("error" in parsed) {
    const errorResponse = responseJson({ jsonrpc: '2.0', id: parsed.id, error: parsed.error }, { status: 400 });
    return defaultCORSHandler.addCORSHeaders(errorResponse, request);
  }

  // Acknowledge notifications immediately with 202 (but after parsing)
  const isNotification = rpc && typeof rpc === 'object' && (rpc as Record<string, unknown>).jsonrpc === '2.0' && typeof (rpc as Record<string, unknown>).method === 'string' && !('id' in rpc);
  if (isNotification) {
    void handleRPC(parsed as any, toolkits as any);
    const response = new Response(null, { status: 202 });
    return defaultCORSHandler.addCORSHeaders(response, request);
  }

  const response = await handleRPC(parsed as any, toolkits as any, {
    httpRequest: request,
    discovery,
    eventSink
  });

  if (discoveryHandler && 'error' in (response as any) && (response as any).error?.code === -32001) {
    const wwwAuthHeader = discoveryHandler.createWWWAuthenticateHeader(request.url);
    const enhancedErrorResponse = discoveryHandler.createDiscoveryErrorResponse(
      (response as any).id,
      request.url,
      'invalid_token',
      (response as any).error.message
    );
    const errResp = responseJson(enhancedErrorResponse, {
      status: 401,
      headers: { 'WWW-Authenticate': wwwAuthHeader }
    });
    return defaultCORSHandler.addCORSHeaders(errResp, request);
  }

  let finalResponse: Response;
  if (wantsEventStream && !wantsJson) {
    finalResponse = responseSSEOnce(response);
  } else if (wantsEventStream && wantsJson) {
    finalResponse = responseSSEOnce(response);
  } else {
    finalResponse = responseJson(response);
  }

  // Emit rpc.succeeded event
  try { eventSink?.rpcSucceeded?.({ id: (response as any).id, method: (parsed as { method?: string }).method ?? 'unknown' }); } catch {}

  return defaultCORSHandler.addCORSHeaders(finalResponse, request);
}


