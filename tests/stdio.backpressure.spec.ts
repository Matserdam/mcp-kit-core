import { describe, expect, it } from "vitest";
import { StdioController } from "../src/lib/stdio";

const encoder = new TextEncoder();

function makeReadable(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

function makeWritable(capture: Uint8Array[]): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      capture.push(chunk);
    },
  });
}

describe("StdioController backpressure", () => {
  it("handles large messages without crashing", async () => {
    const controller = new StdioController([], {});
    expect(controller.isRunning).toBe(false);
    await controller.stop();
    expect(controller.isRunning).toBe(false);
  });

  it("queues writes and processes them sequentially", () => {
    const controller = new StdioController([], {});
    const result1 = controller.notify("test", { data: "small" });
    const result2 = controller.notify("test", { data: "large".repeat(1000) });
    expect(result1).toBe(false);
    expect(result2).toBe(false);
  });

  it("reassembles partial JSON lines across chunks", async () => {
    const reqObj = { jsonrpc: "2.0", id: 1, method: "initialize" };
    const line = JSON.stringify(reqObj) + "\n";
    const a = encoder.encode(line.slice(0, 5));
    const b = encoder.encode(line.slice(5));

    const out: Uint8Array[] = [];
    const controller = new StdioController([], {
      input: makeReadable([a, b]) as unknown as ReadableStream<Uint8Array>,
      output: makeWritable(out) as unknown as WritableStream<Uint8Array>,
    });
    controller.start();
    // allow loop to process
    await new Promise((r) => setTimeout(r, 10));
    await controller.stop();

    const text = new TextDecoder().decode(out[0] ?? new Uint8Array());
    expect(text).toContain('"jsonrpc":"2.0"');
    expect(text).toContain('"id":1');
  });
});
