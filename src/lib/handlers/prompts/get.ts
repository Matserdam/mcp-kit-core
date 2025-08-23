import type { MCPResponse, MCPPROMPTSGetResult, MCPPromptGetParams } from '../../../types/server';
import type { MCPToolkit, MCPPromptDef } from '../../../types/toolkit';

export const handlePromptsGet = async (
  id: string | number | null,
  params: MCPPromptGetParams,
  toolkits: MCPToolkit[]
): Promise<MCPResponse> => {
  const name = (params as unknown as { name?: unknown })?.name as string | undefined;
  if (!name) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: expected name' } };
  const [ns, promptName] = name.includes('_') ? name.split('_', 2) : [undefined, undefined];
  if (!ns || !promptName) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid name: expected namespace_prompt' } };
  const tk = toolkits.find((t) => t.namespace === ns);
  const prompt = tk?.prompts?.find((p) => p.name === promptName);
  if (!prompt) return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Prompt not found' } };

  const messages = await prompt.messages((params as unknown as { arguments?: Record<string, unknown> })?.arguments, tk?.createContext?.({ requestId: id }) ?? {} as unknown);
  const result: MCPPROMPTSGetResult = {
    description: prompt.description ?? '',
    messages
  };
  return { jsonrpc: '2.0', id, result };
};


