#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const DIST_DIR_URL = new URL("../dist/", import.meta.url);
const DIST_DIR = fileURLToPath(DIST_DIR_URL);

const KB = 1024;
const DIST_TOTAL_KB_BUDGET = 600;
const LARGEST_FILE_KB_BUDGET = 200;
const COLD_START_MS_BUDGET = process.env.CI ? 60 : 25; // 60ms for CI, 25ms for local

function walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  let totalBytes = 0;
  let largestJsBytes = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const { total, largestJs } = walkDir(full);
      totalBytes += total;
      if (largestJs > largestJsBytes) largestJsBytes = largestJs;
    } else if (entry.isFile()) {
      const { size } = statSync(full);
      totalBytes += size;
      if (full.endsWith(".js") && size > largestJsBytes) largestJsBytes = size;
    }
  }
  return { total: totalBytes, largestJs: largestJsBytes };
}

async function check() {
  let failures = [];

  // 1) Ensure build exists
  try {
    statSync(path.join(DIST_DIR, "index.js"));
  } catch {
    console.error("dist/index.js not found. Run npm run build first.");
    process.exit(1);
  }

  // 2) Compute sizes
  const { total, largestJs } = walkDir(DIST_DIR);
  const totalKb = Math.ceil(total / KB);
  const largestKb = Math.ceil(largestJs / KB);
  if (totalKb > DIST_TOTAL_KB_BUDGET) {
    failures.push(`dist size ${totalKb}KB > ${DIST_TOTAL_KB_BUDGET}KB`);
  }
  if (largestKb > LARGEST_FILE_KB_BUDGET) {
    failures.push(`largest file ${largestKb}KB > ${LARGEST_FILE_KB_BUDGET}KB`);
  }

  // 3) Cold start import time
  const start = performance.now();
  await import(pathToFileURL(path.join(DIST_DIR, "index.js")).href);
  const end = performance.now();
  const coldMs = end - start;
  if (coldMs > COLD_START_MS_BUDGET) {
    failures.push(`cold-start ${coldMs.toFixed(3)}ms > ${COLD_START_MS_BUDGET}ms`);
  }

  console.log(
    `dist total: ${totalKb}KB, largest: ${largestKb}KB, cold-start: ${coldMs.toFixed(3)}ms`,
  );

  if (failures.length) {
    console.error("Budget failures:\n- " + failures.join("\n- "));
    process.exit(1);
  }
}

check().catch((err) => {
  console.error("Budget check error:", err);
  process.exit(1);
});
