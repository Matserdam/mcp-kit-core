import type { ZodTypeAny } from 'zod';
import type { MCPToolCallResult } from './server';

export type MCPJSONSchema = {
  $id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: {
    [key: string]: JSONSchema;
  };
  required?: string[];
  enum?: any[];
  items?: JSONSchema | JSONSchema[];
  additionalProperties?: boolean | JSONSchema;
  pattern?: string;
  format?: string;
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  // ... include other keywords as needed per JSON Schema Draft (e.g. "allOf", "anyOf", "not", etc.)
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
};
export type MCPSchemaDef = { zod?: ZodTypeAny, jsonSchema?: MCPJSONSchema };

export interface MCPToolkitInit {
    requestId?: string | number | null;
}

export interface MCPTool<TContext = unknown, TInput = unknown> {
    name: string;
    description?: string;
    input?: MCPSchemaDef;
    output?: MCPSchemaDef;
    run(input: TInput, context: TContext): Promise<MCPToolCallResult> | MCPToolCallResult;
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



