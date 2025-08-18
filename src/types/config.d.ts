export interface MCPHttpServerConfig {
  enable: true;
  port: number;
}

export interface MCPStdioServerConfig {
  enable: true;
}

export interface MCPServerSettingsConfig {
  host?: string;
  fetch?: MCPHttpServerConfig;
  sse?: MCPHttpServerConfig;
  streamable?: MCPHttpServerConfig;
  stdio?: MCPStdioServerConfig;
}

export interface MCPConfig {
  server: MCPServerSettingsConfig;
}


