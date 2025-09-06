import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS, 10) : 10,
  duration: __ENV.DURATION || "30s",
  thresholds: {
    "checks": ["rate>0.99"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";

const tInitJson = new Trend("rpc_initialize_json_ms");
const tListJson = new Trend("rpc_tools_list_json_ms");
const tCallJson = new Trend("rpc_tools_call_json_ms");
const tInitSse = new Trend("rpc_initialize_sse_ms");
const errRate = new Rate("rpc_errors");

function makeId(suffix) {
  return `${__VU}-${__ITER}-${Date.now()}-${suffix}`;
}

export default function () {
  const sleepMs = __ENV.SLEEP_MS ? parseInt(__ENV.SLEEP_MS, 10) : 0;
  // initialize (JSON)
  {
    const id = makeId("init");
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method: "initialize" });
    const res = http.post(baseUrl, payload, {
      headers: { "content-type": "application/json", "accept": "application/json" },
      timeout: "60s",
    });
    tInitJson.add(res.timings.duration);
    const ok = check(res, {
      "init json status 200": (r) => r.status === 200,
      "init json body has jsonrpc": (r) => (r.json("jsonrpc") || "") === "2.0",
    });
    if (!ok) errRate.add(1);
  }

  // tools/list (JSON)
  {
    const id = makeId("list");
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list" });
    const res = http.post(baseUrl, payload, {
      headers: { "content-type": "application/json", "accept": "application/json" },
      timeout: "60s",
    });
    tListJson.add(res.timings.duration);
    const ok = check(res, {
      "list json status 200": (r) => r.status === 200,
      "list json body has jsonrpc": (r) => (r.json("jsonrpc") || "") === "2.0",
    });
    if (!ok) errRate.add(1);
  }

  // tools/call (JSON)
  {
    const id = makeId("call");
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name: "demo.calculate",
        arguments: { a: Math.floor(Math.random() * 10), b: Math.floor(Math.random() * 10) + 1 },
      },
    });
    const res = http.post(baseUrl, payload, {
      headers: { "content-type": "application/json", "accept": "application/json" },
      timeout: "60s",
    });
    tCallJson.add(res.timings.duration);
    const ok = check(res, {
      "call json status 200": (r) => r.status === 200,
      "call json body has jsonrpc": (r) => (r.json("jsonrpc") || "") === "2.0",
    });
    if (!ok) errRate.add(1);
  }

  // initialize (SSE single frame)
  {
    const id = makeId("init-sse");
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method: "initialize" });
    const res = http.post(baseUrl, payload, {
      headers: { "content-type": "application/json", "accept": "text/event-stream" },
      timeout: "60s",
    });
    tInitSse.add(res.timings.duration);
    const ok = check(res, {
      "init sse status 200": (r) => r.status === 200,
      "init sse content-type": (r) =>
        String(r.headers["Content-Type"] || "").includes("text/event-stream"),
      "init sse body has data frame": (r) => String(r.body || "").startsWith("data: "),
    });
    if (!ok) errRate.add(1);
  }

  if (sleepMs > 0) {
    sleep(sleepMs / 1000);
  }
}

// Write summary files under tests/load/reports
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.4/index.js";
export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `tests/load/reports/k6-summary-${ts}`;
  return {
    [`${base}.json`]: JSON.stringify(data, null, 2),
    [`${base}.txt`]: textSummary(data, { indent: "  ", enableColors: false }),
  };
}
