import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Scenarios are controlled via env SELECTED_SCENARIO, default to constant VUs
const scenarios = {
  constant_vus: {
    executor: "constant-vus",
    vus: __ENV.VUS ? parseInt(__ENV.VUS, 10) : 50,
    duration: __ENV.DURATION || "30s",
  },
  constant_arrival: {
    executor: "constant-arrival-rate",
    rate: __ENV.RATE ? parseInt(__ENV.RATE, 10) : 1000,
    timeUnit: "1s",
    duration: __ENV.DURATION || "30s",
    preAllocatedVUs: __ENV.VUS ? parseInt(__ENV.VUS, 10) : 200,
    maxVUs: __ENV.MAX_VUS ? parseInt(__ENV.MAX_VUS, 10) : 1000,
  },
};

const selected = scenarios[String(__ENV.SELECTED_SCENARIO || "constant_vus")] ??
  scenarios.constant_vus;

export const options = { scenarios: { main: selected }, thresholds: { checks: ["rate>0.99"] } };

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
const tCallJson = new Trend("rpc_tools_call_json_ms");
const errRate = new Rate("rpc_errors");

function makeId() {
  return `${__VU}-${__ITER}-${Date.now()}-call`;
}

export default function () {
  const sleepMs = __ENV.SLEEP_MS ? parseInt(__ENV.SLEEP_MS, 10) : 0;
  const id = makeId();
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
    headers: { "content-type": "application/json", accept: "application/json" },
    timeout: "60s",
  });
  tCallJson.add(res.timings.duration);
  const ok = check(res, {
    "call json status 200": (r) => r.status === 200,
    "call json is jsonrpc": (r) => (r.json("jsonrpc") || "") === "2.0",
  });
  if (!ok) errRate.add(1);
  if (sleepMs > 0) sleep(sleepMs / 1000);
}
