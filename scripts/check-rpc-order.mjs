#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rpcFile = path.join(process.cwd(), "src/lib/rpc.ts");
const src = fs.readFileSync(rpcFile, "utf8");

// Extract case labels inside the main switch(method)
const switchStart = src.indexOf("switch (method)");
if (switchStart === -1) {
  console.error("Could not find switch(method) in src/lib/rpc.ts");
  process.exit(1);
}
const switchBody = src.slice(switchStart);
const cases = Array.from(switchBody.matchAll(/case\s+'([^']+)'\s*:/g)).map((m) => m[1]);

// Ignore default case; ensure cases are alphabetically sorted
const sorted = [...cases].sort((a, b) => a.localeCompare(b));

let ok = true;
for (let i = 0; i < cases.length; i++) {
  if (cases[i] !== sorted[i]) {
    ok = false;
    break;
  }
}

if (!ok) {
  console.error("RPC methods are not alphabetically ordered in src/lib/rpc.ts");
  console.error("Found order:", cases.join(", "));
  console.error("Expected :", sorted.join(", "));
  process.exit(1);
}

console.log("RPC method cases are alphabetically ordered.");
