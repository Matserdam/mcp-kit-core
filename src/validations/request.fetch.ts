import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const allowedMethods = ['initialize', 'tools/list', 'tools/call'] as const;
export type AllowedFetchMethod = typeof allowedMethods[number];

const zRpcRequest = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.enum(allowedMethods),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  params: z.unknown().optional(),
});

export type FetchRpcRequest = z.infer<typeof zRpcRequest>;

export interface ParsedFetchRpc {
  id: string | number | null;
  method: AllowedFetchMethod;
  params?: unknown;
}

export function parseFetchRpc(input: unknown): ParsedFetchRpc | { id: null; error: { code: number; message: string } } {
  const parsed = zRpcRequest.safeParse(input);
  if (!parsed.success) {
    return { id: null, error: { code: -32600, message: 'Invalid Request' } };
  }
  const { id: maybeId, method, params } = parsed.data;
  const generatedId: string = typeof (globalThis as any)?.crypto?.randomUUID === 'function' ? (globalThis as any).crypto.randomUUID() : randomUUID();
  const id = maybeId === undefined ? generatedId : maybeId;
  return { id, method, params };
}


