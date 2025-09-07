import { describe, expect, it } from "vitest";
import { MCPPromptDef, MCPServer } from "../src/index.ts";
import z from "zod";

const jsonrpc = async (server: MCPServer, body: Record<string, unknown>) => {
  const res = await server.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const txt = await res.text();
  return JSON.parse(txt) as Record<string, unknown>;
};

describe("MCP prompts", () => {
  it("prompts/list returns toolkit prompts with namespaced names", async () => {
    const server = new MCPServer({
      toolkits: [
        {
          namespace: "pokemon",
          prompts: [
            {
              name: "appearance",
              title: "Pokémon appearance",
              description: "appearance prompt",
              input: { zod: z.object({ name: z.string() }) },
              messages: (
                input: { name: string },
              ) => [{
                role: "user",
                content: { type: "text", text: `What is the appearance of ${input.name}?` },
              }],
            },
          ],
        },
      ],
    });

    const resp = await jsonrpc(server, { jsonrpc: "2.0", id: 1, method: "prompts/list" });
    const response = resp as {
      result: { prompts: Array<{ name: string; title: string; arguments: unknown[] }> };
    };
    expect(Array.isArray(response.result.prompts)).toBe(true);
    const prompts = response.result.prompts;
    const p = prompts.find((x) => x.name === "pokemon_appearance");
    expect(p).toBeTruthy();
    expect(typeof p?.title).toBe("string");
    expect(Array.isArray(p?.arguments)).toBe(true);
  });

  it("prompts/get returns a prompt with messages array per protocol", async () => {
    const prompt: MCPPromptDef = {
      name: "appearance",
      title: "Pokémon appearance",
      description: "appearance prompt",
      arguments: [{ name: "name", description: "name of the pokemon", required: true }],
      messages: (
        input: { name: string },
      ) => [{
        role: "user",
        content: { type: "text", text: `What is the appearance of ${input.name}?` },
      }],
    };

    const server = new MCPServer({
      toolkits: [
        {
          namespace: "pokemon",
          prompts: [
            prompt,
          ],
        },
      ],
    });

    const resp = await jsonrpc(server, {
      jsonrpc: "2.0",
      id: 2,
      method: "prompts/get",
      params: { name: "pokemon_appearance", arguments: { name: "pikachu" } },
    });
    const response = resp as { result: { messages: unknown[] } };
    // Protocol expects prompt.messages to be an array (even if empty)
    expect(Array.isArray(response.result.messages)).toBe(true);
  });
});
