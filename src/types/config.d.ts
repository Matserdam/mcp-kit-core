export interface MCPFetchHandlerConfig {
  enable: true;
}

export interface MCPServerSettingsConfig {
  fetch?: MCPFetchHandlerConfig;
}

export interface MCPConfig {
  server: MCPServerSettingsConfig;
}


