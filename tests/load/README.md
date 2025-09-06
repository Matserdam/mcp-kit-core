### Load tests (fetch & stdio)

- Scripts live here per story 25. Reports are written under `tests/load/reports/`.

### HTTP (k6)

1. Start the sample HTTP server (uses the `demo.calculate` tool):

```bash
cd examples/mcp-simple-bun-fetch
bun index.ts
```

2. In another terminal, run the k6 script against `http://localhost:3000`:

```bash
# Install k6 from https://k6.io/ if you don't have it
BASE_URL=http://localhost:3000 VUS=20 DURATION=30s k6 run tests/load/k6-http-rpc.js
```

- The script exercises `initialize`, `tools/list`, `tools/call` (JSON) and `initialize` over SSE.
- A JSON and text summary will be written to `tests/load/reports/` automatically.

#### Variants and scenarios

- Call-only constant VUs:

```bash
./tests/load/scripts/run-http-call-constant-vus.sh http://localhost:3000 200 30s
```

- Call-only constant arrival rate:

```bash
./tests/load/scripts/run-http-call-constant-arrival.sh http://localhost:3000 1000 30s 400 2000
```

- Full RPC mix (JSON+SSE) with optional sleep between iterations:

```bash
SLEEP_MS=0 BASE_URL=http://localhost:3000 VUS=50 DURATION=60s k6 run tests/load/k6-http-rpc.js
```

### STDIO perf harness (Bun)

Run the in-memory stdio benchmark with configurable request count and concurrency:

```bash
N=2000 C=128 WARMUP=100 bun tests/load/stdio-perf.ts
```

- Output JSON summary is written under `tests/load/reports/stdio-summary-<timestamp>.json`.
- Override output path with `OUT=...`.

### Notes

- For HTTP, you can also explore other tools like autocannon/wrk if desired, but k6 is the primary.
- Ensure your environment uses Bun for Bun-run scripts.
