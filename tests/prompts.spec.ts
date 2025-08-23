import { describe, it, expect } from 'vitest';
import { MCPPromptDef, MCPServer } from '../src/index';
import z from 'zod';

const jsonrpc = async (server: MCPServer, body: any) => {
  const res = await server.fetch(new Request('http://localhost/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const txt = await res.text();
  return JSON.parse(txt);
};

describe('MCP prompts', () => {
  it('prompts/list returns toolkit prompts with namespaced names', async () => {
    const server = new MCPServer({
      toolkits: [
        {
          namespace: 'pokemon',
          prompts: [
            { name: 'appearance', title: 'Pokémon appearance', description: 'appearance prompt', input: { zod: z.object({ name: z.string() }) }, messages: async (input: { name: string }) => [{ role: 'user', content: { type: 'text', text: `What is the appearance of ${input.name}?` } }] },
          ],
        },
      ],
    });

    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 1, method: 'prompts/list' });
    expect(Array.isArray(resp?.result?.prompts)).toBe(true);
    const prompts = resp?.result?.prompts ?? [];
    const p = prompts.find((x: any) => x.name === 'pokemon_appearance');
    expect(p).toBeTruthy();
    expect(typeof p.title).toBe('string');
    expect(Array.isArray(p.arguments)).toBe(true);
  });

  it('prompts/get returns a prompt with messages array per protocol', async () => {
    const prompt: MCPPromptDef =
      { name: 'appearance', title: 'Pokémon appearance', description: 'appearance prompt', arguments: [{ name: 'name', description: 'name of the pokemon', required: true }], messages: async (input: { name: string }) => [{ role: 'user', content: { type: 'text', text: `What is the appearance of ${input.name}?` } }] };

    const server = new MCPServer({
      toolkits: [
        {
          namespace: 'pokemon',
          prompts: [
            prompt
          ],
        },
      ],
    });

    const resp = await jsonrpc(server, { jsonrpc: '2.0', id: 2, method: 'prompts/get', params: { name: 'pokemon_appearance', arguments: { name: 'pikachu' } } });
    // Protocol expects prompt.messages to be an array (even if empty)
    expect(Array.isArray(resp?.result?.messages)).toBe(true);
  });
});


