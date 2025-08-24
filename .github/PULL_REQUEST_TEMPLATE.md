## PR Title

Use Conventional Commits: `<type>(<scope>): <summary>`

Examples:
- `feat(core): implement capability registration API`
- `docs(project): add @mcp-kit/core overview`

## Summary

Describe what this PR changes and why.

## Checklist

### Code Quality
- [ ] Title uses Conventional Commits format
- [ ] Scope is appropriate (core, transport, handler, config, sdk, docs, examples, release, test, build, ci, dx)
- [ ] `bun run build` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run check:types` passes
- [ ] No console.log statements in core library (src/lib/**)
- [ ] RPC method cases are alphabetically ordered

### Documentation
- [ ] README updated if needed
- [ ] API documentation updated if needed
- [ ] CHANGELOG.md updated for user-facing changes
- [ ] Examples updated if API changed

### Quality Gates
- [ ] Size budget check passes (≤ 600 KB dist size)
- [ ] Cold-start time check passes (≤ 25ms)
- [ ] SBOM generation succeeds
- [ ] No high-risk vulnerabilities introduced

### Process
- [ ] Self-review completed
- [ ] Code follows project conventions
- [ ] Tests cover new functionality
- [ ] Breaking changes documented

## Breaking Changes

- [ ] None
- If breaking, explain impact and add `BREAKING CHANGE:` in commit body

## Screenshots/Notes

Optional additional context.
