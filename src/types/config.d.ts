/** Placeholder for server-level configuration options. */
export interface MCPServerSettingsConfig {
  // Reserved for future server-level settings
  [key: string]: unknown;
}

/** Root configuration object used to initialize the server. */
export interface MCPConfig {
  server: MCPServerSettingsConfig;
}
