## 0.0.3 (2025-01-27)

### Added

- Provenance-backed JSR publishing via GitHub Actions (`.github/workflows/publish.yml`)

### Changed

- Bumped version to 0.0.3 for JSR publish
- Clarified JSR package metadata to be managed in Settings (description, runtimes)

## 0.0.2 (2025-01-27)

### Fixed

- **Build & Compilation Issues**:
  - Fixed syntax error in `tsup.config.ts` (removed stray `Headers,`)
  - Fixed TypeScript compilation errors in `stdio.ts` and `utils.ts`
  - Fixed `process.env` type mismatch by filtering undefined values
  - Fixed import paths for Deno compatibility

- **Code Quality & Linting**:
  - Fixed all ESLint errors (67 → 0): empty catch blocks, `any` types, case declarations
  - Fixed 22 Deno lint issues: async/await, unused variables, type safety
  - Applied Deno formatting to all 89 files
  - Improved type safety by replacing `any` with `unknown`

- **CI/CD Pipeline**:
  - Fixed bundle size check with dynamic budgets (25ms local, 60ms CI)
  - Converted compliance script from Bun to Node.js for CI compatibility
  - Fixed console usage with proper ESLint disable comments
  - Removed generated files from repository (compliance-report.json)

### Added

- **Multi-Runtime Testing**:
  - Added Node.js 22.x to test matrix (now tests 18.x, 20.x, 22.x)
  - Added comprehensive Bun compatibility testing
  - Added Deno compatibility testing (type check, format, lint)
  - Total: 5 runtime environments tested

- **Development Experience**:
  - Added `tsx` dependency for TypeScript execution in Node.js
  - Added dynamic bundle size budgets for different environments
  - Improved error handling and type safety across codebase

### Changed

- **Project Structure**:
  - Removed redundant `src/index.edge.ts` (use `src/mod.ts` for Deno/JSR)
  - Updated package.json exports to use `dist/mod.js` for edge environments
  - Renamed CI workflow from `ci.yml` to `testing.yml`
  - Cleaned up CI workflow (removed unnecessary cd commands and examples)

### Internal

- **Testing & Quality**:
  - All 235 tests passing across all runtime environments
  - 100% compliance with MCP protocol specifications
  - Zero ESLint and Deno lint errors
  - Comprehensive multi-runtime compatibility (Node.js, Deno, Bun)
  - Bundle size within budgets (449KB total, <60ms cold-start in CI)

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
