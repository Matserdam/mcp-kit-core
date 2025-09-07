import { describe, expect, it } from "vitest";
import { MCPServer } from "../src/index";
import { z } from "zod";

describe("MCPServer", () => {
  it("constructs with minimal options", () => {
    const server = new MCPServer({ toolkits: [] });
    expect(server).toBeInstanceOf(MCPServer);
  });

  it("non-POST returns 405", async () => {
    const server = new MCPServer({ toolkits: [] });
    const res = await server.fetch(new Request("http://localhost", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("initialize returns capabilities", async () => {
    const server = new MCPServer({ toolkits: [] });
    const res = await server.fetch(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    const response = json as {
      result: {
        capabilities: {
          tools: { listChanged: boolean };
          prompts: { listChanged: boolean };
          resources: { listChanged: boolean };
        };
      };
    };
    expect(response.result?.capabilities?.tools).toStrictEqual({ listChanged: true });
    expect(response.result?.capabilities?.prompts).toStrictEqual({ listChanged: false });
    expect(response.result?.capabilities?.resources).toStrictEqual({ listChanged: false });
  });

  it("tools/list returns tool metadata with namespace", async () => {
    const server = new MCPServer({
      toolkits: [
        {
          namespace: "weather",
          tools: [
            {
              name: "get",
              description: "Get weather",
              run: () => ({ tempC: 20 }),
            },
          ],
        },
      ],
    });
    const res = await server.fetch(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "a", method: "tools/list" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    const response = json as { result: { tools: Array<{ name: string }> } };
    const names = (response.result?.tools ?? []).map((t) => t.name);
    expect(names).toContain("weather_get");
  });

  it("tools/call invokes a namespaced tool", async () => {
    const server = new MCPServer({
      toolkits: [
        {
          namespace: "weather",
          tools: [
            {
              name: "get",
              description: "Get weather",
              input: { zod: z.object({ city: z.string() }) },
              run: (input: { city: string }) => ({ content: [{ type: "text", text: input.city }] }),
            },
          ],
        },
      ],
    });
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "weather_get", arguments: { city: "Paris" } },
      }),
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    const response = json as { result: { content: Array<{ text: string }> } };
    expect(response.result?.content?.[0]?.text).toBe("Paris");
  });

  it("initialize uses ours strategy by default", async () => {
    const server = new MCPServer({ toolkits: [] });
    const res = await server.fetch(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 11,
          method: "initialize",
          params: { protocolVersion: "1999-01-01" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { result: { protocolVersion: string } };
    expect(typeof data.result.protocolVersion).toBe("string");
    expect(data.result.protocolVersion).toBe("2025-06-18");
  });

  it("initialize mirrors when protocolVersionStrategy=mirror", async () => {
    const server = new MCPServer({ toolkits: [], protocolVersionStrategy: "mirror" });
    const reqBody = {
      jsonrpc: "2.0",
      id: 12,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    };
    const res = await server.fetch(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { result: { protocolVersion: string } };
    expect(data.result.protocolVersion).toBe("1999-01-01");
  });
});
