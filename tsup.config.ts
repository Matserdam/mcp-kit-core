import { defineConfig } from "tsup";

export default defineConfig([
  // Node build (includes stdio)
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: false,
    target: "node18",
    minify: false,
    treeshake: true,
    outDir: "dist",
  },
  // Edge/Deno build (excludes stdio)
  {
    // Name the entry chunk explicitly so output is dist/index.edge.js
    entry: { "mod": "src/mod.ts" },
    format: ["esm"],
    dts: true,
    clean: false, // Don't clean since we're building multiple configs
    sourcemap: false,
    target: "es2022",
    platform: "neutral",
    minify: false,
    treeshake: true,
    outDir: "dist",
  },
]);
