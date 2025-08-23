import type { MCPResponse } from '../../../types/server';
import type { MCPToolkit, MCPPromptDef } from '../../../types/toolkit';

export const handlePromptsList = (id: string | number | null, toolkits: MCPToolkit[]): MCPResponse => {
  return {
    jsonrpc: '2.0', id, result: {
      prompts: toolkits.flatMap((tk: MCPToolkit) => (tk.prompts ?? []).map((p: MCPPromptDef) => ({
        name: `${tk.namespace}_${p.name}`,
        title: p.title ?? p.name,
        description: p.description ?? '',
        arguments: p.arguments ?? [],
      })))
    }
  };
};


