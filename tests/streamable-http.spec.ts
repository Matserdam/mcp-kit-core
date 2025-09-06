import { describe, expect, it } from "vitest";
import { MCPServer } from "../src/index";

const makeReq = (body: unknown, headers?: Record<string, string>) =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });

describe("Streamable HTTP Accept handling", () => {
  it("returns JSON when Accept: application/json", async () => {
    const server = new MCPServer({ toolkits: [] });
    const req = makeReq({ jsonrpc: "2.0", id: 1, method: "initialize" }, {
      accept: "application/json",
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toMatch(/application\/json/);
    const json = await res.json() as Record<string, unknown>;
    const response = json as { jsonrpc: string };
    expect(response.jsonrpc).toBe("2.0");
  });

  it("returns SSE when Accept includes text/event-stream", async () => {
    const server = new MCPServer({ toolkits: [] });
    const req = makeReq({ jsonrpc: "2.0", id: 2, method: "initialize" }, {
      accept: "text/event-stream",
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toMatch(/text\/event-stream/);
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const chunk = await reader.read();
    expect(chunk.done).toBe(false);
    const text = new TextDecoder().decode(chunk.value);
    expect(text.startsWith("data: ")).toBe(true);
    // Close stream to avoid hanging tests
    await reader.cancel();
  });

  it("acknowledges notifications with 202", async () => {
    const server = new MCPServer({ toolkits: [] });
    const req = makeReq({ jsonrpc: "2.0", method: "initialize" }, { accept: "application/json" });
    const res = await server.fetch(req);
    expect(res.status).toBe(202);
  });

  it("handles ping with empty result over JSON", async () => {
    const server = new MCPServer({ toolkits: [] });
    const req = makeReq({ jsonrpc: "2.0", id: 3, method: "ping" }, { accept: "application/json" });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    const response = json as { result: Record<string, never> };
    expect(response.result).toEqual({});
  });

  it("handles ping with SSE response frame", async () => {
    const server = new MCPServer({ toolkits: [] });
    const req = makeReq({ jsonrpc: "2.0", id: 4, method: "ping" }, { accept: "text/event-stream" });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const chunk = await reader.read();
    expect(chunk.done).toBe(false);
    const text = new TextDecoder().decode(chunk.value);
    expect(text).toContain('"result":{}');
    await reader.cancel();
  });

  it("acknowledges client responses with 202", async () => {
    const server = new MCPServer({ toolkits: [] });
    const req = makeReq({ jsonrpc: "2.0", result: { ok: true } }, { accept: "application/json" });
    const res = await server.fetch(req);
    expect(res.status).toBe(202);
  });

  it("returns 400 JSON on parse error", async () => {
    const server = new MCPServer({ toolkits: [] });
    const bad = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const res = await server.fetch(bad);
    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    const response = json as { error: { code: number } };
    expect(response.error?.code).toBe(-32700);
  });
});
