import type { ZodTypeAny } from 'zod';

export type MCPJSONSchema = Record<string, unknown>;
export type MCPSchemaDef = { zod: ZodTypeAny } | { jsonSchema: MCPJSONSchema };

export interface MCPToolkitInit {
    requestId: string;
}

export interface MCPTool<TContext = unknown, TInput = unknown, TResult = unknown> {
    name: string;
    description?: string;
    input?: MCPSchemaDef;
    output?: MCPSchemaDef;
    run(input: TInput, context: TContext): Promise<TResult> | TResult;
}

export type MCPToolRunner<TContext = unknown> = (
    input: unknown,
    context: TContext
) => Promise<unknown>;

export type MCPToolMiddleware<TContext = unknown> = (
    next: MCPToolRunner<TContext>,
    info: { toolkit: MCPToolkit<TContext>; tool: MCPTool<TContext, unknown> }
) => MCPToolRunner<TContext>;

export interface MCPToolkitMiddleware<TContext = unknown> {
    tools?: Array<MCPToolMiddleware<TContext>>;
}

export interface MCPToolkit<TContext = unknown> {
    namespace: string;
    description?: string;
    middleware?: MCPToolkitMiddleware<TContext>;
    tools?: Array<MCPTool<TContext, unknown>>;
    createContext?(init: MCPToolkitInit): Promise<TContext> | TContext;
}


