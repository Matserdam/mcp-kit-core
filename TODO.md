# TODO List

## EPIC-012 (First Audit Response) - Additional Stories

### STORY-064: Implement Protobufs Conforming to MCP Specification
- **Priority**: Medium
- **Description**: Implement protobuf definitions conforming to the Model Context Protocol specification
- **Reference**: [MCP Specification v2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- **Tasks**:
  - [ ] Traverse all MCP specification pages to extract complete protocol definition
  - [ ] Create protobuf definitions for all message types
  - [ ] Implement protobuf serialization/deserialization
  - [ ] Add protobuf transport option alongside JSON-RPC
  - [ ] Update documentation to include protobuf usage
  - [ ] Add tests for protobuf transport
- **Acceptance Criteria**:
  - [ ] Protobuf definitions match MCP specification exactly
  - [ ] All existing functionality works with protobuf transport
  - [ ] Performance benchmarks show protobuf advantages
  - [ ] Documentation updated with protobuf examples

## Current Progress
- **STORY-055**: ✅ Size Budgets and CI Guardrails (COMPLETED)
- **STORY-056**: ✅ SBOM Generation and Dependency Risk Analysis (COMPLETED)  
- **STORY-057**: ✅ Console.log Cleanup (COMPLETED)
- **STORY-059**: ✅ PR Checklist and CI Enforcement (COMPLETED)
- **STORY-061**: 🔄 RPC Switch Case Ordering (PARTIALLY COMPLETED)
- **STORY-058**: ❌ ADRs for Handlers/Ping Routing (PENDING)
- **STORY-060**: ❌ Mutation Tests for Tool Runners (PENDING)
- **STORY-062**: ❌ API Reference and Architecture Diagram (PENDING)
- **STORY-063**: ❌ URI Schemes and Naming Conventions (PENDING)
- **STORY-064**: ❌ Implement Protobufs Conforming to MCP Specification (PENDING)
