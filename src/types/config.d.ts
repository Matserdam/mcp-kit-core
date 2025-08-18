export interface MCPServerTransportsConfig {
  fetch: boolean;
  sse: boolean;
  stdio: boolean;
  streamable: boolean;
}

export interface MCPServerPortsConfig {
  host?: string;
  fetch?: number;
  sse?: number;
  streamable?: number;
}

export interface MCPServerSettingsConfig {
  transports: MCPServerTransportsConfig;
  ports?: MCPServerPortsConfig;
}

export interface MCPConfig {
  server: MCPServerSettingsConfig;
}


