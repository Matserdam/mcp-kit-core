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

- Core: Canonical tools added and always available via `tools/list`:
  - `search`: traverses toolkits' resources and templates; supports `query`, `site`, `topK`, `timeRange`.
  - `fetch`: resolves URIs provider-first, then via resource templates; returns in-band `resource` content when matched; otherwise returns empty `content`.
- Core: Handlers modularized under `src/lib/handlers/` and runners under `src/lib/handlers/tools/runners/`:
  - `tools/list`, `prompts/list`, `prompts/get`, `tools/call`, `notifications/initialized` moved to `lib/handlers`.
  - `tools/call` routes to `runSearch`, `runFetch`, or toolkit tools.
- Validation: Zod schemas for canonical `search`/`fetch` inputs and outputs; JSON Schemas surfaced in `tools/list`; inputs validated on call.
- Types:
  - `MCPSearchInput` extended with `timeRange`.
  - `MCPResourceTemplateDescriptor` requires `title`, `description`, `mimeType`.
  - `MCPNotificationAckResult = { ok: true }` added to server result union.
- Docs: Root `README.md` documents canonical `search`/`fetch`, provider-first resolution, and example usage.
- Cleanup: Removed `console.log` from core library; silent start error handling.
- Examples: Pokémon example reorganized into `tools/`, `resources/`, `templates/`, `prompts/`; custom schemes `pokefront://`, `pokeback://`, `pokecry://`; template/provider implementations with Zod; local tests for tools, resources, templates, prompts, and canonical tools.
- Tests: Added core tests for canonical tools (`canonical.tools.spec.ts`, `canonical.fetch.spec.ts`).

## 0.0.0 - 2025-08-18

### Added
- Initial repository setup for `@mcp-kit/core`

[Unreleased]: https://example.com/compare/v0.0.0...HEAD
