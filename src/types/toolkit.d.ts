import type { ZodTypeAny } from "zod";
import type { MCPResourceReadResult, MCPToolCallResult, ResourceUri } from "./server.d.ts";
import type { MCPHTTPAuthMiddleware, MCPSTDIOAuthMiddleware } from "./auth.d.ts";

/** Minimal JSON Schema shape for tool input/output definitions. */
export type MCPJSONSchema = {
  $id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: {
    [key: string]: MCPJSONSchema;
  };
  required?: string[];
  enum?: unknown[];
  items?: MCPJSONSchema | MCPJSONSchema[];
  additionalProperties?: boolean | MCPJSONSchema;
  pattern?: string;
  format?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  // ... include other keywords as needed per JSON Schema Draft (e.g. "allOf", "anyOf", "not", etc.)
  allOf?: MCPJSONSchema[];
  anyOf?: MCPJSONSchema[];
  oneOf?: MCPJSONSchema[];
  not?: MCPJSONSchema;
};
/** Wrapper allowing either Zod schema or plain JSON Schema. */
export type MCPSchemaDef = { zod?: ZodTypeAny; jsonSchema?: MCPJSONSchema };

/** Initialization options provided to toolkit `createContext`. */
export interface MCPToolkitInit {
  requestId?: string | number | null;
}

/**
 * A single callable tool within a toolkit.
 */
export interface MCPTool<TContext = unknown, TInput = unknown> {
  name: string;
  description?: string;
  input?: MCPSchemaDef;
  output?: MCPSchemaDef;
  run(input: TInput, context: TContext): Promise<MCPToolCallResult> | MCPToolCallResult;
}

/** Function signature used by tool middleware to wrap execution. */
export type MCPToolRunner<TContext = unknown> = (
  input: unknown,
  context: TContext,
) => Promise<unknown>;

/** Middleware factory for tools, used to add cross-cutting behaviors. */
export type MCPToolMiddleware<TContext = unknown> = (
  next: MCPToolRunner<TContext>,
  info: { toolkit: MCPToolkit<TContext, unknown>; tool: MCPTool<TContext, unknown> },
) => MCPToolRunner<TContext>;

/** Container for toolkit-level middleware. */
export interface MCPToolkitMiddleware<TContext = unknown> {
  tools?: Array<MCPToolMiddleware<TContext>>;
}

/** Prompt definition used by `prompts/list` and `prompts/get`. */
export interface MCPPromptDef<TContext = unknown, TInput = unknown> {
  name: string;
  title: string;
  description?: string;
  // Spec-style arguments metadata for prompts/list
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
  messages(input: TInput, context: TContext): Promise<MCPPromptCallMessagesResult>;
}

/** Resulting message array for prompt calls. */
export type MCPPromptCallMessagesResult = Array<MCPMessage>;

/** Simple text-only message used in prompts. */
export type MCPMessage = {
  role: "user" | "assistant" | "system";
  content: { type: "text"; text: string };
};

// Resource provider: single, read-only resource exposure (MVP)
/** Provider for a single, read-only resource. */
export interface MCPResourceProvider<TContext = unknown> {
  uri: ResourceUri;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  read(context: TContext): Promise<MCPResourceReadResult> | MCPResourceReadResult;
}

/** Initialization input used to create a resource provider. */
export type MCPResourceProviderInit<TContext = unknown> = {
  uri: ResourceUri;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  read: (context: TContext) => Promise<MCPResourceReadResult> | MCPResourceReadResult;
};

// Templates
/** String template for dynamic resource URIs. */
export type ResourceUriTemplate = string;
/** Describes a dynamic resource provided via a template. */
export type MCPResourceTemplateDescriptor = {
  uriTemplate: ResourceUriTemplate;
  name: string;
  title: string;
  description: string;
  mimeType: string;
};
/** Provider exposing dynamic resources resolved from a URI template. */
export interface MCPResourceTemplateProvider<TContext = unknown> {
  descriptor: MCPResourceTemplateDescriptor;
  read(uri: ResourceUri, context: TContext): Promise<MCPResourceReadResult> | MCPResourceReadResult;
}

/** Initialization input used to create a resource template provider. */
export type MCPResourceTemplateProviderInit<TContext = unknown> = {
  descriptor: MCPResourceTemplateDescriptor;
  read: (
    uri: ResourceUri,
    context: TContext,
  ) => Promise<MCPResourceReadResult> | MCPResourceReadResult;
};

/** Group of tools, prompts, resources, and optional auth middleware. */
export interface MCPToolkit<TContext, TAuth> {
  namespace: string;
  description?: string;
  tools?: Array<MCPTool<TContext, unknown>>;
  prompts?: Array<MCPPromptDef>;
  createContext?(init: MCPToolkitInit): Promise<Record<string, unknown>> | Record<string, unknown>;
  resources?: Array<MCPResourceProvider<TContext>>;
  resourceTemplates?: Array<MCPResourceTemplateProvider<TContext>>;

  // Transport-specific auth middleware
  auth?: MCPHTTPAuthMiddleware<TAuth> | MCPSTDIOAuthMiddleware<TAuth>;
}
