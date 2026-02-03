# PRD #23: CI/CD Pipeline

## Overview

**Problem**: This repository has no CI pipeline. PRs are merged based solely on CodeRabbit review without automated validation for tests, linting, build correctness, or Weaver schema validity.

**Solution**: Implement a GitHub Actions workflow that validates PRs before merge, including Weaver schema validation, test execution, linting, and build verification.

**Why This Matters**: As the codebase grows (especially with Phase 3 telemetry instrumentation), automated validation prevents regressions and ensures the Weaver schema stays valid. CI catches issues before they reach main.

## Success Criteria

1. GitHub Actions workflow runs on all PRs to main
2. PRs cannot merge if tests fail
3. PRs cannot merge if Weaver schema validation fails (when registry files change)
4. PRs cannot merge if linting fails
5. Build verification passes before merge
6. Workflow completes in under 5 minutes for typical PRs

## Dependencies

- **PRD #19** (Weaver Schema): Must be complete to validate the registry
- **Weaver CLI**: Must be installable in CI environment

## Milestones

### Milestone 1: Basic GitHub Actions Setup
**Status**: Not Started

**Steps**:
1. [ ] Create `.github/workflows/ci.yml`
2. [ ] Configure Node.js environment setup
3. [ ] Add dependency installation step
4. [ ] Add build verification step (`npm run build` or equivalent)
5. [ ] Verify workflow triggers on PRs to main

**Deliverable**: Working GitHub Actions workflow that runs on PRs

**Done when**: PRs trigger the workflow and show status checks

---

### Milestone 2: Test Execution
**Status**: Not Started

**Steps**:
1. [ ] Add test execution step to workflow
2. [ ] Configure test reporter for GitHub Actions (optional but nice)
3. [ ] Ensure test failures block PR merge

**Deliverable**: Tests run automatically on PRs

**Done when**: Test failures prevent PR merge

---

### Milestone 3: Linting and Formatting
**Status**: Not Started

**Steps**:
1. [ ] Add ESLint check to workflow (if not already configured)
2. [ ] Add Prettier check to workflow (if not already configured)
3. [ ] Configure lint/format commands in package.json if needed

**Deliverable**: Linting runs automatically on PRs

**Done when**: Lint failures prevent PR merge

---

### Milestone 4: Weaver Schema Validation
**Status**: Not Started

**Steps**:
1. [ ] Add Weaver CLI installation step to workflow
2. [ ] Add `weaver registry check` step (conditional on registry file changes)
3. [ ] Add `weaver registry generate` step to verify docs are fresh
   - Run generation to temp directory
   - Diff against committed `docs/telemetry/`
   - Fail if differences exist (forces developers to regenerate locally)
4. [ ] Configure path filter to only run on `telemetry/registry/**` changes
5. [ ] Ensure schema validation failures block PR merge

**Deliverable**: Weaver schema validated and docs freshness verified on PRs that modify registry

**Done when**: Invalid schema changes OR stale documentation prevent PR merge

---

### Milestone 5: Branch Protection Rules
**Status**: Not Started

**Steps**:
1. [ ] Enable branch protection on main
2. [ ] Require status checks to pass before merge
3. [ ] Require CodeRabbit review (existing process)
4. [ ] Document the new merge requirements

**Deliverable**: main branch protected with required checks

**Done when**: PRs cannot merge without passing CI and CodeRabbit review

---

## Non-Goals

- **Deployment automation**: This PRD is about validation, not deployment
- **Release management**: No automated versioning or publishing
- **Complex matrix testing**: Single Node.js version is sufficient for now
- **Performance benchmarks**: Not needed at this stage

## Technical Notes

### Weaver Installation in CI

Weaver can be installed via the shell installer:
```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/open-telemetry/weaver/releases/download/v0.21.2/weaver-installer.sh | sh
```

Or cached between runs using GitHub Actions cache.

### Conditional Schema Validation

Use path filters to only run Weaver validation when registry files change:
```yaml
- name: Validate Weaver Schema
  if: contains(github.event.pull_request.changed_files, 'telemetry/registry')
  run: weaver registry check -r ./telemetry/registry
```

### Workflow File Location

`.github/workflows/ci.yml`

## Open Questions

1. Should we add code coverage reporting?
   - **Tentative answer**: Not for initial implementation, can add later
2. Should we cache Weaver installation between runs?
   - **Tentative answer**: Yes, for faster CI runs
3. What Node.js version(s) should we test against?
   - **Tentative answer**: Single version matching local development (v20 LTS)

## Progress Log

- **2026-02-03**: PRD created
