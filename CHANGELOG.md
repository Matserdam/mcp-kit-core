# Changelog

## Unreleased

- Breaking: Tool names now use underscore delimiter `namespace_tool` instead of dot `namespace.tool`.
  - Reason: Improve compatibility with clients that restrict dots in tool name regexes.
  - Note: Server currently enforces underscores for tool calls; legacy dot-form is not supported.
- Core: `initialize` now echoes client's `protocolVersion` if provided (spec alignment).
- Core: Implemented MCP Prompts and Resources minimal handlers:
  - `prompts/list` and `prompts/get` (namespaced as `namespace_prompt`)
  - `resources/list` and `resources/read` (returns empty `contents` array for now)
- Core: Canonical tools are auto-listed when not provided by any toolkit:
  - `search` (input requires `{ query: string }`, returns empty results as `{ type: 'text' }` for now)
  - `fetch` (input `{ id: string, uri?: string }`, returns a `{ type: 'resource_link' }` pointing to the resolved URI)
  - Note: Canonical tool calls are accepted as plain names `search` and `fetch` (no namespacing).
- Types: Removed `video` from content union; supported types include `text`, `image`, `audio`, `resource_link`, and `resource`.
- Examples/Docs: Updated EPIC-006 stories and examples to reflect prompts/resources and canonical tools.
- Tests: Added basic tests for prompts (`prompts/list`, `prompts/get`) and resources (`resources/list`, `resources/read`).

## 0.0.0 - 2025-08-18

### Added
- Initial repository setup for `@mcp-kit/core`

[Unreleased]: https://example.com/compare/v0.0.0...HEAD
