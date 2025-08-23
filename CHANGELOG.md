# Changelog

## Unreleased

- Breaking: Tools listed/called as `namespace_tool` (underscore), not `namespace.tool`.
- Core: `initialize` echoes requested `protocolVersion` (if provided).
- Core: Prompts minimal support: `prompts/list`, `prompts/get`.
- Core: Resources full MVP implemented per 2025-06-18 spec:
  - Handlers under `src/lib/handlers/resources/`: `list`, `read`, `templates.list`, each returns full MCPResponse.
  - `resources/list` aggregates toolkit providers; omits `nextCursor` when not paginating.
  - `resources/read` resolves concrete providers first, then templates; errors: `-32602` invalid params, `-32002` not found.
  - `resources/templates/list` lists template descriptors from toolkits.
  - Server-owned `uriTemplate` matching with `{var}` and `{*rest}` placeholders; passes extracted params on `context.params` to template `read`.
- Types: Added `ResourceProtocol`, `ResourceUri`, `MCPResourceTemplatesListResult` and refined resource types.
- Toolkit Types: Added `resources`, `resourceTemplates`, and prefixed init types `MCPResourceProviderInit`, `MCPResourceTemplateProviderInit`.
- DX Factories: `createMCPResourceProvider`, `createMCPResourceTemplateProvider` exported from public API.
- Docs: README Resources section expanded with `uriTemplate` placeholders and factory examples.
- Tests: Coverage for provider mapping, read via provider and template, error cases, and templates list; factories used in tests.

## 0.0.0 - 2025-08-18

### Added
- Initial repository setup for `@mcp-kit/core`

[Unreleased]: https://example.com/compare/v0.0.0...HEAD
