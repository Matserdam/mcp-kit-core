export interface MCPServerSettingsConfig {
  // Reserved for future server-level settings
  [key: string]: unknown;
}

export interface MCPConfig {
  server: MCPServerSettingsConfig;
}
