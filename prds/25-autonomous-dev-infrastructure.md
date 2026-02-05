# PRD #25: Autonomous Development Infrastructure

## Problem Statement

Development on Commit Story currently requires constant human supervision. Claude Code cannot be trusted to complete bounded tasks autonomously because there are no automated guard rails to catch mistakes. This slows development velocity and prevents effective "YOLO mode" workflows.

## Solution Overview

Add testing infrastructure, Claude Code hooks, and project rules that catch problems automatically. This creates a safety net of automated checks, enabling Claude to work autonomously with confidence that mistakes will be caught before they cause damage.

## User Stories

- As a developer using Claude Code, I want failing tests to block commits so that broken code never reaches the repository
- As a developer, I want type errors caught immediately after edits so that I don't propagate type issues through the codebase
- As a developer, I want linting to run automatically so that code style stays consistent without manual intervention
- As a developer, I want clear project rules so that Claude Code knows the standards and follows them

## Success Criteria

- [ ] Test suite exists and runs via `npm test`
- [ ] Test coverage is reported with minimum threshold enforcement
- [ ] Claude Code hooks prevent commits with failing tests
- [ ] Type checker runs automatically after code edits
- [ ] Linter/formatter runs automatically after code edits
- [ ] Claude Code can complete a bounded feature task without human intervention

## Technical Considerations

### Stack Context
- Node.js with ES modules
- TypeScript (to be added if not present)
- LangGraph for AI orchestration
- No existing test infrastructure

### Testing Framework Selection
- **Vitest** recommended: Fast, ESM-native, TypeScript support out of the box, Jest-compatible API
- Coverage via `@vitest/coverage-v8`
- 80% coverage threshold as starting target

### Claude Code Hooks Architecture
Hooks are configured in `.claude/settings.json` with these event types:
- `PostToolUse` on `Edit`: Run type checker and linter after file changes
- `PreToolUse` on `Bash` with `git commit`: Run test suite before allowing commits
- `Stop`: Check for code smells before Claude finishes

### Dependencies
- Requires TypeScript configuration (tsconfig.json)
- Requires ESLint configuration
- Requires Vitest configuration

## Milestones

### Milestone 1: TypeScript Configuration
- [ ] Add TypeScript as dev dependency
- [ ] Create tsconfig.json with strict settings
- [ ] Ensure existing code compiles without errors
- [ ] Add `npm run typecheck` script

### Milestone 2: Testing Infrastructure
- [ ] Add Vitest and coverage dependencies
- [ ] Create vitest.config.ts with coverage thresholds
- [ ] Add `npm test` and `npm run test:coverage` scripts
- [ ] Write initial tests for at least one existing module
- [ ] Verify coverage reporting works

### Milestone 3: Linting Setup
- [ ] Add ESLint with TypeScript support
- [ ] Configure rules appropriate for the codebase
- [ ] Add `npm run lint` and `npm run lint:fix` scripts
- [ ] Fix any existing lint errors

### Milestone 4: Claude Code Hooks
- [ ] Create `.claude/settings.json` with hook configuration
- [ ] PostToolUse hook: Run typecheck after Edit
- [ ] PostToolUse hook: Run lint after Edit
- [ ] PreToolUse hook: Run tests before git commit
- [ ] Test hooks work correctly in Claude Code sessions

### Milestone 5: Project Rules Update
- [ ] Update `.claude/CLAUDE.md` with testing requirements
- [ ] Document when to write tests (all new functions)
- [ ] Document code style expectations
- [ ] Document hook behavior so Claude understands the guard rails

### Milestone 6: Validation
- [ ] Verify full workflow: edit -> typecheck -> lint -> test -> commit
- [ ] Test that failing tests actually block commits
- [ ] Test that type errors surface immediately
- [ ] Complete a small feature task with autonomous Claude to validate

## Out of Scope

- Continuous learning/instinct system (defer until basics work)
- Language-specific patterns (Django, Go, etc.)
- Specialized agents (tdd-guide, code-reviewer, build-error-resolver) - consider for future PRD
- CI/CD pipeline integration (handled separately)

## Dependencies

- None (this is foundational infrastructure)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hooks slow down development | Medium | Keep hook scripts fast; parallelize where possible |
| False positives in lint rules | Low | Start with minimal rule set, expand gradually |
| Existing code fails type checks | Medium | Allow gradual strictness; fix issues as milestone 1 |
| Coverage threshold too aggressive | Low | Start at 80%, adjust based on codebase reality |

## Progress Log

*This section will be updated as milestones are completed.*

| Date | Milestone | Notes |
|------|-----------|-------|
| | | |
