import { MCPJSONSchema, MCPToolkit } from "./toolkit";
import type { MCPDiscoveryConfig } from "./auth";

export interface MCPServerOptions {
  toolkits: Array<MCPToolkit<unknown, unknown>>;
  logger?: Logger;
  config?: Partial<Config>;
  discovery?: MCPDiscoveryConfig;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: MCPToolCallResult | MCPToolsListResult | InitializeResult | MCPPROMPTSListResult | MCPPROMPTSGetResult | MCPResourcesListResult | MCPResourceReadResult | MCPResourceTemplatesListResult | MCPNotificationAckResult | MCPPingResult;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type MCPToolsCallParams = {
  name: `${string}_${string}` | string;
  params?: unknown;
  arguments?: Record<string, unknown>;
}

// Method-specific params (loose unions to preserve backward compatibility)
export type MCPPromptGetParams = { name: string; arguments?: Record<string, unknown> } | Record<string, unknown>;
export type ResourceProtocol = `${string}://`;
export type ResourceUri = `${ResourceProtocol}${string}`;
export type MCPResourceReadParams = { uri: ResourceUri } | Record<string, unknown>;

export type MCPRequest = {
  id: string | number | null;
  method: 'initialize' | 'notifications/initialized' | 'tools/list' | 'prompts/list' | 'resources/list' | 'resources/templates/list' | 'ping';
  params?: Record<string, unknown> | undefined;
  error?: Record<string, unknown>;
} | {
  id: string | number | null;
  method: 'tools/call';
  params?: MCPToolsCallParams;
  errror?: Record<string, unknown>;
} | {
  id: string | number | null;
  method: 'prompts/get';
  params: MCPPromptGetParams;
  errror?: Record<string, unknown>;
} | {
  id: string | number | null;
  method: 'resources/read';
  params: MCPResourceReadParams;
  errror?: Record<string, unknown>;
};

export type InitializeResult = {
  protocolVersion: string;

  capabilities: {
    logging?: Record<string, unknown>;
    prompts?: {
      listChanged?: boolean;
    };
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    tools?: {
      listChanged?: boolean;
    };
    // Allow forward-compat / unknown capabilities
    [key: string]: unknown;
  };

  serverInfo: {
    name: string;
    version: string;
  };

  instructions?: string;
};


export type MCPToolCallResult = {
  content: ContentItem[],
  structuredContent?: Record<string, any>,
}

export type MCPToolsListResult = {
  tools: {
    name: string;
    description: string;
    inputSchema?: MCPJSONSchema;
    outputSchema?: MCPJSONSchema;
  }[]
}

// Prompts list result per MCP spec
export type MCPPROMPTSListResult = {
  prompts: {
    name: string;
    title?: string;
    description?: string;
    arguments?: Array<{ name: string; description?: string; required?: boolean }>;
  }[]
}

export type MCPPROMPTMessage = {
  role: 'user' | 'assistant' | 'system';
  content: { type: 'text'; text: string };
}

export type MCPPROMPTSGetResult = {
  description?: string;
  messages: MCPPROMPTMessage[];
}

// Resources list result per MCP spec
export type MCPResourcesListResult = {
  resources: Array<{
    uri: ResourceUri;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
    size?: number;
  }>;
  nextCursor?: string;
}

// Core content item variants the MCP clients expect
export type ContentText = {
  type: 'text'
  text: string
}

export type ContentImage = {
  type: 'image'
  /** Base64-encoded bytes */
  data: string
  /** e.g. "image/png", "image/jpeg" */
  mimeType: string
  annotations?: {
    audience?: string[]
    priority?: number
  }
}

export type ContentAudio = {
  type: 'audio'
  /** Base64-encoded bytes */
  data: string
  /** e.g. "audio/mpeg", "audio/wav" */
  mimeType: string
}


/**
 * A link to an external artifact the client can open/download.
 * Use this when you want to show a single, simple link (no data in-band).
 */
export type ContentResourceLink = {
  type: 'resource_link'
  name: string
  uri: string // e.g. https://..., file://..., etc.
}

/**
 * An in-band resource payload. Use this when you want to include the resource itself
 * or reference it with richer metadata. One of "uri" | "text" | "blob" should be provided.
 */
export type ContentResource = {
  type: 'resource'
  resource:
  | { uri: string; name?: string; mimeType?: string }
  | { text: string; name?: string; mimeType?: string }
  | { blob: string; mimeType: string; name?: string } // blob is base64
}

// Union of all supported content types
export type ContentItem = ContentText
  | ContentImage
  | ContentAudio
  | ContentResourceLink
  | ContentResource;

// Tool call response shape: { content: ContentItem[] }


// Resource content entries for resources/read
export type MCPResourceContent = {
  uri: ResourceUri
  name?: string
  title?: string
  description?: string
  mimeType?: string
  size?: number
  text?: string
  blob?: string // base64
}

// Result for resources/read calls per MCP spec
export type MCPResourceReadResult = {
  contents: MCPResourceContent[]
}

// Templates list result per MCP spec
export type MCPResourceTemplatesListResult = {
  resourceTemplates: Array<{
    uriTemplate: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
  }>;
}

// Notification acknowledgement result
export type MCPNotificationAckResult = { ok: true };

// Ping result: empty object per MCP spec
export type MCPPingResult = Record<string, never>;
