## 0.0.1 (2025-09-06)

Initial JSR-ready release for `@mcp-kit/core`.

Highlights:
- JSR export uses edge-only entry `src/index.edge.ts` (Node-free public API)
- All relative imports use explicit `.ts`/`.d.ts` extensions for Deno/JSR
- Removed NodeJS types from edge-exposed types (env, stdio streams)
- Added explicit public API types to satisfy JSR slow-type checks
- Fixed zod-to-json-schema import for correct callable usage
- Cleaned package for JSR: publish only `src/`, exclude `dist/`

Epics: EPIC-015-jsr-publishing


