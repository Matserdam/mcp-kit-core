/*
  STDIO performance harness
  - Spins up an in-memory stdio server using TransformStreams
  - Issues N JSON-RPC requests with configurable concurrency
  - Measures latency distribution and throughput
  Run: bun tests/load/stdio-perf.ts
  Env:
    N=1000 C=64 WARMUP=50 OUT=tests/load/reports/stdio-<ts>.json bun tests/load/stdio-perf.ts
*/

import { MCPServer, type MCPTool, type MCPToolCallResult } from '../../src/index';
import z from 'zod';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

type JsonRpcRequest = { jsonrpc: '2.0'; id: number; method: string; params?: unknown };

const textEncoder = new TextEncoder();

// Simple demo toolkit (matches README pattern)
const calcTool: MCPTool<unknown, { a: number; b: number }> = {
  name: 'calculate',
  description: 'Calculate the sum of two numbers, divided by a random number',
  input: { zod: z.object({ a: z.number().min(0), b: z.number().min(0) }) },
  run({ a, b }) {
    const result: MCPToolCallResult = {
      content: [{ type: 'text', text: (a + b / Math.max(Math.random(), 1e-6)).toString() }],
    };
    return result;
  },
};

const server = new MCPServer({
  toolkits: [
    { namespace: 'demo', tools: [calcTool] },
  ],
});

// In-memory duplex wiring: client <-> server via TransformStreams
const clientToServer = new TransformStream<Uint8Array>();
const serverToClient = new TransformStream<Uint8Array>();

const controller = server.startStdio({
  input: clientToServer.readable,
  output: serverToClient.writable,
});

const writer = clientToServer.writable.getWriter();
const textReader = serverToClient.readable.pipeThrough(new TextDecoderStream()).getReader();

const TOTAL = Number(process.env.N ?? 1000);
const CONCURRENCY = Number(process.env.C ?? 64);
const WARMUP = Number(process.env.WARMUP ?? 50);

let nextId = 1;
const sentAt = new Map<number, number>();
const latencies: number[] = [];

let buffered = '';
const readLoop = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await textReader.read();
    if (done) break;
    if (!value) continue;
    buffered += value;
    let idx: number;
    while ((idx = buffered.indexOf('\n')) !== -1) {
      const line = buffered.slice(0, idx);
      buffered = buffered.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as { id: number | null };
        if (typeof msg.id === 'number' && sentAt.has(msg.id)) {
          const started = sentAt.get(msg.id)!;
          sentAt.delete(msg.id);
          const delta = performance.now() - started;
          latencies.push(delta);
        }
      } catch {
        // ignore parse errors in harness
      }
    }
  }
};

const send = async (req: JsonRpcRequest) => {
  const line = JSON.stringify(req) + '\n';
  await writer.write(textEncoder.encode(line));
};

const buildCall = (id: number): JsonRpcRequest => ({
  jsonrpc: '2.0',
  id,
  method: 'tools/call',
  params: { name: 'demo.calculate', arguments: { a: Math.floor(Math.random() * 10), b: Math.floor(Math.random() * 10) + 1 } },
});

const main = async () => {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const id = nextId++;
    sentAt.set(id, performance.now());
    await send(buildCall(id));
  }

  // Drain warmup responses
  await new Promise((r) => setTimeout(r, 200));
  sentAt.clear();
  latencies.length = 0;

  const start = performance.now();
  let inflight = 0;
  let issued = 0;

  // Kick off reader
  const readerPromise = readLoop();

  const pump = async () => {
    while (issued < TOTAL && inflight < CONCURRENCY) {
      const id = nextId++;
      sentAt.set(id, performance.now());
      inflight++;
      issued++;
      await send(buildCall(id));
    }
  };

  // Periodically top-up pipeline until all issued
  while (issued < TOTAL) {
    await pump();
    await new Promise((r) => setTimeout(r, 0));
    // Adjust inflight by checking responses observed so far
    inflight = sentAt.size;
  }

  // Wait for all responses
  while (sentAt.size > 0) {
    await new Promise((r) => setTimeout(r, 5));
  }

  // Give reader a chance to finish
  await new Promise((r) => setTimeout(r, 20));
  await (controller as { stop: () => Promise<void> }).stop();
  await readerPromise;

  const end = performance.now();
  const durationMs = end - start;
  const throughput = (TOTAL / durationMs) * 1000;
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / Math.max(sorted.length, 1);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  const report = {
    totalRequests: TOTAL,
    concurrency: CONCURRENCY,
    durationMs,
    throughputRps: throughput,
    latencyMs: { avg, p50, p95, p99, max },
  };

  const outDir = path.join(process.cwd(), 'tests', 'load', 'reports');
  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = process.env.OUT || path.join(outDir, `stdio-summary-${ts}.json`);
  await (Bun as { write: (path: string, data: string) => Promise<void> }).write(outPath, JSON.stringify(report, null, 2));

  // Also print a short summary
  // console.log(`[stdio-perf] total=${TOTAL} concurrency=${CONCURRENCY} durationMs=${durationMs.toFixed(2)} throughputRps=${throughput.toFixed(2)}`);
  // console.log(`[stdio-perf] lat ms avg=${avg.toFixed(2)} p50=${p50.toFixed(2)} p95=${p95.toFixed(2)} p99=${p99.toFixed(2)} max=${max.toFixed(2)}`);
};

main().catch(() => {
  // console.error(err);
  process.exit(1);
});


