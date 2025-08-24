import type { MCPResponse, MCPPROMPTSListResult } from '../../../types/server';
import type { MCPToolkit, MCPPromptDef } from '../../../types/toolkit';

export const handlePromptsList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[]
): MCPResponse => {
  const prompts = toolkits.flatMap((toolkit) =>
    (toolkit.prompts ?? []).map((prompt: MCPPromptDef<unknown, unknown>) => ({
      name: `${toolkit.namespace}_${prompt.name}`,
      title: prompt.title,
      description: prompt.description,
      arguments: prompt.arguments ?? []
    }))
  );

  const result: MCPPROMPTSListResult = { prompts };
  return { jsonrpc: '2.0', id, result };
};


