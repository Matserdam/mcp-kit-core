import { describe, expect, it } from "vitest";
import { MCPServer } from "../src";

describe("STDIO public surface", () => {
  it("startStdio returns a controller with stop and notify", async () => {
    const server = new MCPServer({ toolkits: [] });
    const ctl = await server.startStdio({ framing: "ndjson" });
    expect(ctl.isRunning).toBe(true);
    expect(typeof ctl.notify).toBe("function");
    await ctl.stop();
    expect(ctl.isRunning).toBe(false);
  });
});
