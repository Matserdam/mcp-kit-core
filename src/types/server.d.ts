import { MCPJSONSchema, MCPToolkit } from "./toolkit.d.ts";
import type { MCPDiscoveryConfig } from "./auth.d.ts";
import type { EventSink } from "./observability.d.ts";

/**
 * Configuration options for {@link import("../lib/index.ts").MCPServer}.
 */
export interface MCPServerOptions {
  toolkits: MCPToolkit<unknown, unknown>[];
  discovery?: MCPDiscoveryConfig;
  /** Optional event sink for audit/observability. Defaults to no-op. */
  eventSink?: EventSink;
  /**
   * Strategy for the protocolVersion returned from initialize.
   * - "ours" (default): always return the server's canonical protocol version
   * - "mirror": mirror the client's requested protocolVersion when provided
   */
  protocolVersionStrategy?: "ours" | "mirror";
}

/**
 * Generic JSON-RPC response envelope used by the MCP server.
 */
export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?:
    | MCPToolCallResult
    | MCPToolsListResult
    | InitializeResult
    | MCPPROMPTSListResult
    | MCPPROMPTSGetResult
    | MCPResourcesListResult
    | MCPResourceReadResult
    | MCPResourceTemplatesListResult
    | MCPNotificationAckResult
    | MCPPingResult;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** Parameters for the `tools/call` method. */
export type MCPToolsCallParams = {
  name: `${string}_${string}` | string;
  params?: unknown;
  arguments?: Record<string, unknown>;
};

// Method-specific params (loose unions to preserve backward compatibility)
/** Parameters for the `prompts/get` method. */
export type MCPPromptGetParams =
  | { name: string; arguments?: Record<string, unknown> }
  | Record<string, unknown>;
/** URI protocol prefix, e.g. `file://`, `https://`. */
export type ResourceProtocol = `${string}://`;
/** Canonical resource URI string. */
export type ResourceUri = `${ResourceProtocol}${string}`;
/** Parameters for the `resources/read` method. */
export type MCPResourceReadParams = { uri: ResourceUri } | Record<string, unknown>;

/**
 * Union type of all JSON-RPC requests supported by the MCP server.
 */
export type MCPRequest = {
  id: string | number | null;
  method:
    | "initialize"
    | "notifications/initialized"
    | "tools/list"
    | "prompts/list"
    | "resources/list"
    | "resources/templates/list"
    | "ping";
  params?: Record<string, unknown> | undefined;
  error?: Record<string, unknown>;
} | {
  id: string | number | null;
  method: "tools/call";
  params?: MCPToolsCallParams;
  errror?: Record<string, unknown>;
} | {
  id: string | number | null;
  method: "prompts/get";
  params: MCPPromptGetParams;
  errror?: Record<string, unknown>;
} | {
  id: string | number | null;
  method: "resources/read";
  params: MCPResourceReadParams;
  errror?: Record<string, unknown>;
};

/** Result payload for the `initialize` method. */
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

/** Result payload for the `tools/call` method. */
export type MCPToolCallResult = {
  content: ContentItem[];
  structuredContent?: Record<string, unknown>;
};

/** Result payload for the `tools/list` method. */
export type MCPToolsListResult = {
  tools: {
    name: string;
    description: string;
    inputSchema?: MCPJSONSchema;
    outputSchema?: MCPJSONSchema;
  }[];
};

// Prompts list result per MCP spec
/** Result payload for the `prompts/list` method. */
export type MCPPROMPTSListResult = {
  prompts: {
    name: string;
    title?: string;
    description?: string;
    arguments?: Array<{ name: string; description?: string; required?: boolean }>;
  }[];
};

/** Single message entry used in `prompts/get` results. */
export type MCPPROMPTMessage = {
  role: "user" | "assistant" | "system";
  content: { type: "text"; text: string };
};

/** Result payload for the `prompts/get` method. */
export type MCPPROMPTSGetResult = {
  description?: string;
  messages: MCPPROMPTMessage[];
};

// Resources list result per MCP spec
/** Result payload for the `resources/list` method. */
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
};

// Core content item variants the MCP clients expect
/** Text content item variant. */
export type ContentText = {
  type: "text";
  text: string;
};

/** Image content item variant with base64-encoded data. */
export type ContentImage = {
  type: "image";
  /** Base64-encoded bytes */
  data: string;
  /** e.g. "image/png", "image/jpeg" */
  mimeType: string;
  annotations?: {
    audience?: string[];
    priority?: number;
  };
};

/** Audio content item variant with base64-encoded data. */
export type ContentAudio = {
  type: "audio";
  /** Base64-encoded bytes */
  data: string;
  /** e.g. "audio/mpeg", "audio/wav" */
  mimeType: string;
};

/**
 * A link to an external artifact the client can open/download.
 * Use this when you want to show a single, simple link (no data in-band).
 */
/** Link-only content item to an external resource. */
export type ContentResourceLink = {
  type: "resource_link";
  name: string;
  uri: string; // e.g. https://..., file://..., etc.
};

/**
 * An in-band resource payload. Use this when you want to include the resource itself
 * or reference it with richer metadata. One of "uri" | "text" | "blob" should be provided.
 */
/** In-band resource payload content item. */
export type ContentResource = {
  type: "resource";
  resource:
    | { uri: string; name?: string; mimeType?: string }
    | { text: string; name?: string; mimeType?: string }
    | { blob: string; mimeType: string; name?: string }; // blob is base64
};

// Union of all supported content types
/** Union of all supported content item variants. */
export type ContentItem =
  | ContentText
  | ContentImage
  | ContentAudio
  | ContentResourceLink
  | ContentResource;

// Tool call response shape: { content: ContentItem[] }

// Resource content entries for resources/read
/** Entry used in `resources/read` results. */
export type MCPResourceContent = {
  uri: ResourceUri;
  name?: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  text?: string;
  blob?: string; // base64
};

// Result for resources/read calls per MCP spec
/** Result payload for the `resources/read` method. */
export type MCPResourceReadResult = {
  contents: MCPResourceContent[];
};

// Templates list result per MCP spec
/** Result payload for the `resources/templates/list` method. */
export type MCPResourceTemplatesListResult = {
  resourceTemplates: Array<{
    uriTemplate: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
  }>;
};

/** Notification acknowledgement result. */
export type MCPNotificationAckResult = { ok: true };

/** Ping result: empty object per MCP spec. */
export type MCPPingResult = Record<string, never>;
