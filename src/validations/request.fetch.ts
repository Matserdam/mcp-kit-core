import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { MCPRequest, MCPToolsCallParams } from '../types/server';

const allowedMethods = ['initialize', 'notifications/initialized', 'tools/list', 'tools/call', 'prompts/list', 'prompts/get', 'resources/list', 'resources/read', 'resources/templates/list', 'ping'] as const;
export type AllowedFetchMethod = typeof allowedMethods[number];

const zCommonParams = z.object({
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
}).passthrough();

const zPromptGetParams = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).optional(),
}).passthrough();

const zResourceReadParams = z.object({
  uri: z.string(),
}).passthrough();

const zRpcRequest = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.enum(allowedMethods),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  params: z.union([
    zCommonParams,
    zPromptGetParams,
    zResourceReadParams,
    z.record(z.unknown()),
  ]).optional(),
});

export type FetchRpcRequest = z.infer<typeof zRpcRequest>;

export type  ParsedFetchRpc = MCPRequest;

export function parseFetchRpc(input: unknown): MCPRequest {
  const parsed = zRpcRequest.safeParse(input);
  if (!parsed.success) {
    const inputObj = input as Record<string, unknown>;
    return { id: inputObj?.id ?? null, method: inputObj?.method as string ?? 'unknown', params: {}, error: { code: -32600, message: parsed.error.message } };
  }
  const { id: maybeId, method, params } = parsed.data;
  const globalThisObj = globalThis as Record<string, unknown>;
  const generatedId: string = typeof globalThisObj?.crypto === 'object' && globalThisObj.crypto && typeof (globalThisObj.crypto as Record<string, unknown>)?.randomUUID === 'function' ? (globalThisObj.crypto as Record<string, unknown>).randomUUID() as string : randomUUID();
  const id = maybeId === undefined ? generatedId : maybeId;

  if (method === 'tools/call') {
    return { id, method, params: params as MCPToolsCallParams };
  }

  return { id, method, params: params as Record<string, unknown> };
}


