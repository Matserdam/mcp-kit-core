# Changelog

## Unreleased

### Authentication & Authorization
- **Toolkit-Based Authentication**: Complete redesign of authentication system for production-ready security
  - **Architectural Improvement**: Moved from inefficient global authentication to per-toolkit authentication
  - **Transport-Specific Auth**: HTTP Bearer token and STDIO credential authentication middleware
  - **Context Propagation**: HTTP request context passed through RPC handlers for proper auth validation
  - **Graceful Degradation**: List endpoints filter inaccessible toolkits instead of failing entire requests
  - **OAuth 2.1 Compliance**: Full OAuth 2.1 protocol compliance with proper error handling
  - **Type Safety**: Strong TypeScript typing throughout authentication system
  - **Comprehensive Testing**: 50+ tests covering all authentication scenarios and edge cases
  - **Security**: Proper error handling, no information leakage, secure token validation
  - **Documentation**: Complete authentication integration guide with examples

### Authentication & Security
- **OAuth 2.1 Compliance**: Complete OAuth 2.1 protocol compliance implementation with comprehensive testing
  - Fixed TypeScript errors in `oauth21.compliance.spec.ts` for proper type safety
  - Implemented Resource Indicators (RFC 8707) with URI validation and canonicalization
  - Added token audience validation with proper security binding
  - Enhanced security audit logging with comprehensive event tracking
  - Added Bearer token extraction with case-insensitive header handling
  - Integrated OAuth 2.1 error responses with proper HTTP status codes
  - All 22 compliance tests passing for production-ready OAuth 2.1 support
  - Updated documentation with compliance testing guide and certification requirements

### Code Quality & Type Safety
- **Type Safety**: Enforced `createContext` must return `Record<string, unknown>` in type definitions
- **Lint Cleanup**: Fixed all 293 lint errors throughout core library, tests, and examples
- **Type System**: Eliminated problematic `as any` type assertions in favor of proper typing
- **Context Handling**: Centralized context creation logic with proper Promise handling
- **Code Standards**: Removed unnecessary type casts and improved async/await patterns
- **Mutation Testing**: Added comprehensive mutation tests for `runSearch` and `runFetch` tool runners with 25 edge case scenarios
- **Documentation**: Added comprehensive custom URI schemes documentation with naming conventions and implementation guidelines
- **Protocol Compliance**: Implemented comprehensive MCP protocol compliance testing with protobuf validation
  - Added protobuf definitions matching the complete MCP specification
  - Created `MCPComplianceValidator` for request/response validation with detailed error reporting
  - Integrated compliance checks into CI pipeline with automated reporting
  - Achieved 100% protocol compliance with comprehensive test coverage

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

- Core: Ping/Heartbeat support per MCP 2025-06-18:
  - JSON-RPC method `ping` returns empty `{}` result; not a tool
  - Implemented in handlers: `src/lib/handlers/ping.ts` and delegated by RPC
  - HTTP: supported for JSON and SSE; stdio: NDJSON line
  - Types: `MCPPingResult` added; fetch validator allows `ping`
  - Docs: README and examples include ping usage

## 0.0.0 - 2025-08-18

### Added
- Initial repository setup for `@mcp-kit/core`

[Unreleased]: https://example.com/compare/v0.0.0...HEAD
