# PRD #23: CI/CD Pipeline

## Overview

**Problem**: This repository has no CI pipeline. PRs are merged based solely on CodeRabbit review without automated validation for tests, linting, or build correctness.

**Solution**: Implement a GitHub Actions workflow that validates PRs before merge, including test execution, linting, and build verification.

**Why This Matters**: As the codebase grows (especially with Phase 3 telemetry instrumentation), automated validation prevents regressions. CI catches issues before they reach main.

## Success Criteria

1. GitHub Actions workflow runs on all PRs to main
2. PRs cannot merge if tests fail
3. PRs cannot merge if linting fails
4. Build verification passes before merge
5. Workflow completes in under 5 minutes for typical PRs

## Dependencies

None - this PRD can be implemented independently.

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

### Milestone 4: Branch Protection Rules
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
- **Weaver schema validation**: Telemetry validation belongs in the Telemetry Agent (Phase 3), which needs to validate its own instrumentation against the schema anyway

## Technical Notes

### Workflow File Location

`.github/workflows/ci.yml`

## Open Questions

1. Should we add code coverage reporting?
   - **Tentative answer**: Not for initial implementation, can add later
2. What Node.js version(s) should we test against?
   - **Tentative answer**: Single version matching local development (v20 LTS)

## Decision Log

### 2026-02-03: Scope Reduction - Remove Weaver Validation
**Decision**: Remove Milestone 4 (Weaver Schema Validation) from CI/CD scope.

**Rationale**:
- Telemetry validation belongs in the Telemetry Agent (Phase 3), not CI/CD
- The agent needs to validate its own instrumentation anyway ("Is my instrumentation conformant to the schema?")
- This is more interesting for the KubeCon talk than automated CI checks
- CI/CD should focus on core value: tests, linting, build verification
- Time is limited before KubeCon EU (March 23, 2026) - prioritize the agent over infrastructure

**Impact**:
- Removed Milestone 4 (Weaver Schema Validation)
- Removed dependency on PRD #19
- Removed Weaver installation technical notes
- Simplified scope to 4 milestones instead of 5

## Progress Log

- **2026-02-03**: PRD created
- **2026-02-03**: Scope reduced - removed Weaver validation milestone per design decision (validation belongs in Telemetry Agent)
