import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { MCPRequest, MCPToolsCallParams } from '../types/server';

const allowedMethods = ['initialize', 'notifications/initialized', 'tools/list', 'tools/call', 'prompts/list', 'resources/list'] as const;
export type AllowedFetchMethod = typeof allowedMethods[number];

const zRpcRequest = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.enum(allowedMethods),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  params: z.object({
    name: z.string().optional(),
    arguments: z.record(z.unknown()).optional(),
    protocolVersion: z.string().optional(),
    capabilities: z.object({
      sampling: z.record(z.unknown()).optional(),
      elicitation: z.record(z.unknown()).optional(),
      roots: z.record(z.unknown()).optional()
    }).optional(),
    clientInfo: z.object({
      name: z.string(),
      version: z.string(),
    }).optional(),
  }).optional(),
});

export type FetchRpcRequest = z.infer<typeof zRpcRequest>;

export type  ParsedFetchRpc = MCPRequest;

export function parseFetchRpc(input: unknown): MCPRequest {
  const parsed = zRpcRequest.safeParse(input);
  if (!parsed.success) {
  console.log("parsing rpc failed", parsed.error);
    return { id: (input as any)?.id ?? null, method: (input as any)?.method ?? 'unknown', params: {}, error: { code: -32600, message: parsed.error.message } };
  }
  console.log("parsing rpc success", parsed.data);
  const { id: maybeId, method, params } = parsed.data;
  const generatedId: string = typeof (globalThis as any)?.crypto?.randomUUID === 'function' ? (globalThis as any).crypto.randomUUID() : randomUUID();
  const id = maybeId === undefined ? generatedId : maybeId;

  if (method === 'tools/call') {
    return { id, method, params: params as MCPToolsCallParams };
  }

  return { id, method, params: params as Record<string, unknown> };
}


