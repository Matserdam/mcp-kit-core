import type { MCPResponse, MCPPROMPTSListResult } from '../../../types/server.d.ts';
import type { MCPToolkit, MCPPromptDef } from '../../../types/toolkit.d.ts';
import type { EventSink } from '../../../types/observability.d.ts';

export const handlePromptsList = (
  id: string | number | null,
  toolkits: MCPToolkit<unknown, unknown>[],
  eventSink?: EventSink
): MCPResponse => {
  try { eventSink?.promptsListStart?.({ id }); } catch {}
  
  const prompts = toolkits.flatMap((toolkit) =>
    (toolkit.prompts ?? []).map((prompt: MCPPromptDef<unknown, unknown>) => ({
      name: `${toolkit.namespace}_${prompt.name}`,
      title: prompt.title,
      description: prompt.description,
      arguments: prompt.arguments ?? []
    }))
  );

  const result: MCPPROMPTSListResult = { prompts };
  try { eventSink?.promptsListSuccess?.({ id, count: prompts.length }); } catch {}
  return { jsonrpc: '2.0', id, result };
};


