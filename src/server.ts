import type { MCPConfig } from './types/config';
import { MCPServer } from './index';

export interface RunningServersHandle {
  close(): Promise<void>;
}

export async function startServersFromConfig(core: MCPServer, config: MCPConfig): Promise<RunningServersHandle> {
  const closers: Array<() => Promise<void>> = [];

  if (config.server.stdio?.enable) {
    core.stdio();
    closers.push(async () => {
      // stdio is process-bound; nothing to close for now
    });
  }

  // Placeholder: other transports will be added later

  return {
    async close() {
      for (const close of closers) {
        await close();
      }
    },
  };
}


