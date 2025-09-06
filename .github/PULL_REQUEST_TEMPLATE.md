## PR Checklist

- [ ] Security: No sensitive logging; auth and OAuth changes reviewed
- [ ] Size budgets: `npm run build` + `node scripts/check-budgets.mjs` pass locally
- [ ] Cold start: Budget check passes (import `dist/index.js`)
- [ ] Lint & Types: `npm run lint` and `npm run check:types` pass
- [ ] RPC ordering: `node scripts/check-rpc-order.mjs` passes
- [ ] Tests: `npm test` pass locally
- [ ] Docs: README/docs updated if API, behavior, or budgets changed

### Summary

Describe what changed and why. Link to related issues/docs.

### Screenshots/Logs (if relevant)

### Notes for Reviewers

# Pull Request

## 📋 Checklist

### 🚀 **Before submitting**

- [ ] **Tests**: All tests pass (`bun run test`)
- [ ] **Linting**: No lint errors (`bun run lint`)
- [ ] **Build**: Project builds successfully (`bun run build`)
- [ ] **Size Budgets**: Within limits (dist ≤ 600KB, largest file ≤ 200KB, cold-start ≤ 25ms)
- [ ] **Console Usage**: No `console.*` in core library (`src/lib/**`)

### 🔒 **Security & Quality**

- [ ] **Dependencies**: No new high-risk dependencies added
- [ ] **SBOM**: SBOM generation works (if applicable)
- [ ] **Type Safety**: No `as any` type assertions added
- [ ] **Error Handling**: Proper error handling implemented
- [ ] **Input Validation**: All inputs validated with Zod schemas

### 📚 **Documentation**

- [ ] **README**: Updated if public API changed
- [ ] **Changelog**: Entry added for user-facing changes
- [ ] **Comments**: Complex logic documented
- [ ] **Examples**: Examples updated if API changed

### 🧪 **Testing**

- [ ] **Coverage**: New code has test coverage
- [ ] **Edge Cases**: Edge cases tested
- [ ] **Integration**: Integration tests pass
- [ ] **Performance**: No performance regressions

### 🔄 **Process**

- [ ] **Branch**: Created from `main` or `develop`
- [ ] **Commits**: Clear, descriptive commit messages
- [ ] **Scope**: Single logical change per PR
- [ ] **Review**: Self-review completed

---

## 📝 **Description**

<!-- Describe your changes here -->

## 🎯 **Type of Change**

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 💥 Breaking change
- [ ] 📚 Documentation update
- [ ] 🔧 Refactoring
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix
- [ ] 🧪 Test update

## 🔗 **Related Issues**

<!-- Link to related issues, e.g., "Closes #123" -->

## 📊 **Testing**

<!-- Describe how you tested your changes -->

## 📸 **Screenshots** (if applicable)

<!-- Add screenshots for UI changes -->

## ✅ **Checklist Verification**

<!-- The following will be verified by reviewers -->

### **Automated Checks**

- [ ] ✅ CI pipeline passes
- [ ] ✅ Size budgets within limits
- [ ] ✅ No console.* usage in core
- [ ] ✅ All tests pass
- [ ] ✅ Linting passes

### **Manual Review**

- [ ] ✅ Code follows project conventions
- [ ] ✅ No security vulnerabilities introduced
- [ ] ✅ Documentation updated appropriately
- [ ] ✅ Performance impact assessed

---

## 🚨 **Breaking Changes**

<!-- List any breaking changes and migration steps -->

## 📈 **Performance Impact**

<!-- Describe any performance impact -->

## 🔍 **Additional Notes**

<!-- Any additional information for reviewers -->
