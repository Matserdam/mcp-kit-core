# Changelog

## Unreleased

- Breaking: Tool names now use underscore delimiter `namespace_tool` instead of dot `namespace.tool`.
  - Reason: Improve compatibility with clients (e.g., Claude) that restrict dots in tool name regexes.
  - Server accepts legacy dot-form for calls, but lists tools with underscores.
# Changelog

All notable changes to this project will be documented in this file.

This project adheres to Semantic Versioning and uses Conventional Commits.

## [Unreleased]

### Added
- MCPServer skeleton with handlers: `fetch`, `stdio`, `httpStreamable`
- TypeScript strict config, tsup build, ESLint/Prettier, Vitest test runner
- Docs: roles aligned to TypeScript MCP server, project overview, commit conventions
- Epic EPIC-001 with stories for scaffolding, conventions, abstract schema, and API design
 - EPIC-004 (stdio transport):
   - STORY-018: stdio types and controller API
   - STORY-019: stdio reader/writer loops with backpressure and NDJSON reassembly
   - STORY-020: JSON-RPC routing via `handleRPC`, notifications, error mapping
   - STORY-021: graceful shutdown (EOF/SIGINT/SIGTERM) and error handling

## 0.0.0 - 2025-08-18

### Added
- Initial repository setup for `@mcp-kit/core`

[Unreleased]: https://example.com/compare/v0.0.0...HEAD
