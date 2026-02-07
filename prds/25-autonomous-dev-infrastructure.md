# PRD #25: Testing & Autonomous Development Infrastructure

## Problem Statement

Development with Claude Code currently has no automated safety net. There are no tests, no CI, and no guardrails to catch mistakes — whether Claude is supervised or autonomous. This is a blocker for PRD #26 (Telemetry Agent Workflow Experiment), which requires testing infrastructure as a prerequisite for both the PRD-driven and autonomous approaches.

This PRD also applies **globally** — the testing practices, CLAUDE.md rules, and guardrails established here should work across any project Whitney develops with Claude Code, not just commit-story-v2.

## Solution Overview

Two phases:

1. **Research Phase** — Investigate best practices for AI-assisted development guardrails: testing strategies (unit, integration, end-to-end), Claude Code hooks, CLAUDE.md testing rules, GitHub Actions patterns, and sandboxing/isolation for autonomous runs. Use findings to refine the implementation milestones.

2. **Implementation Phase** — Build the testing infrastructure and guardrails informed by research. End-to-end tests are the priority (no mocks, stubs, or workarounds). Set up CLAUDE.md rules that enforce testing on every feature and every milestone.

## User Stories

- As a developer using Claude Code, I want end-to-end tests that prove features actually work, not mocks that prove nothing
- As a developer, I want CLAUDE.md rules that enforce testing so Claude adds tests to every feature and milestone automatically
- As a developer, I want guardrails that work across all my projects, not just this repo
- As a developer running `--dangerously-skip-permissions`, I want automated tests as my primary safety net
- As a developer, I want CI that catches regressions before code reaches main

## Success Criteria

- [ ] Research phase complete with documented findings and recommendations
- [ ] End-to-end test suite exists and runs via `npm test`
- [ ] Tests use real integrations, not mocks/stubs/workarounds
- [ ] Global CLAUDE.md updated with testing rules (every feature gets tests, every milestone gets tests)
- [ ] Claude Code hooks prevent commits with failing tests
- [ ] GitHub Actions workflow validates PRs
- [ ] Claude Code can complete a bounded feature task without human intervention and tests confirm it works
- [ ] Guardrails documented in a way that's portable to other projects

## Milestones

### Milestone 1: Research Phase
**Status**: Not Started

Investigate best practices across these areas:

- [ ] **Testing strategies for AI-generated code** — What testing approaches work best when Claude is writing the code? End-to-end vs integration vs unit. What level of testing actually catches AI mistakes?
- [ ] **Claude Code hooks and settings** — What hooks exist? What patterns do people use? Review reference implementations (e.g., everything-claude-code, the testing CLAUDE.md Whitney has access to)
- [ ] **CLAUDE.md testing rules** — What rules effectively get Claude to write good tests? What rules backfire? How do you enforce "no mocks" without Claude finding workarounds?
- [ ] **GitHub Actions for AI workflows** — What CI patterns work for repos where AI writes most of the code?
- [ ] **Sandboxing and isolation** — For `--dangerously-skip-permissions` runs, what isolation options exist? VMs, containers, restricted directories, file access rules?
- [ ] **Document findings** in `docs/research/` with recommendations for implementation phase

**Done when**: Research document exists with clear recommendations that inform the remaining milestones. Milestones 2-6 may be revised based on findings.

---

### Milestone 2: Testing Infrastructure
**Status**: Not Started (may be revised after research)

- [ ] Add test framework (Vitest recommended, confirm in research)
- [ ] Configure for end-to-end tests, not unit test defaults
- [ ] Add `npm test` and `npm run test:coverage` scripts
- [ ] Write initial end-to-end tests for existing functionality
- [ ] Verify tests catch real failures, not just structural correctness

---

### Milestone 3: CLAUDE.md Testing Rules (Global)
**Status**: Not Started (may be revised after research)

- [ ] Update global `~/.claude/CLAUDE.md` with testing enforcement rules
- [ ] Rules must cover: tests for every new feature, tests for every completed milestone
- [ ] Rules must explicitly ban mocks, stubs, and workarounds — end-to-end only
- [ ] Rules should be project-agnostic (work in any repo)
- [ ] Update project-level `.claude/CLAUDE.md` with repo-specific testing details

---

### Milestone 4: Claude Code Hooks
**Status**: Not Started (may be revised after research)

- [ ] Configure hooks in `.claude/settings.json`
- [ ] Pre-commit hook: run test suite, block commit on failure
- [ ] Post-edit hooks: run relevant checks after file changes
- [ ] Validate hooks work in both interactive and autonomous modes

---

### Milestone 5: CI/CD Pipeline
**Status**: Not Started (may be revised after research)

- [ ] Create GitHub Actions workflow for PRs
- [ ] Run tests, linting, build verification
- [ ] Block merge on failure
- [ ] Keep workflow fast (under 5 minutes)

Note: This absorbs the scope of PRD #23 (CI/CD Pipeline). PRD #23 should be closed as superseded when this milestone is implemented.

---

### Milestone 6: Validation
**Status**: Not Started

- [ ] Run Claude Code on a bounded task with all guardrails active
- [ ] Verify: tests catch real bugs, hooks block bad commits, CI catches regressions
- [ ] Verify guardrails work with `--dangerously-skip-permissions`
- [ ] Document the full guardrail setup as a portable template for other projects

## Out of Scope

- Specialized agents (TDD guide, code reviewer, build error resolver) — consider for future PRD
- TypeScript migration — evaluate during research, implement only if findings support it
- Language-specific patterns (Django, Go, etc.)

## Dependencies

- None (this is foundational infrastructure)
- PRD #26 depends on this PRD being complete

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| End-to-end tests are slow | Medium | Optimize test setup; parallelize; accept some slowness as the cost of real validation |
| "No mocks" is too rigid for some cases | Low | Research phase will identify where real integrations aren't feasible; document exceptions |
| Research phase takes too long | Medium | Time-box to 1-2 sessions; findings don't need to be exhaustive, just actionable |
| Hooks slow down development | Medium | Keep hook scripts fast; parallelize where possible |
| Guardrails don't transfer to other projects | Low | Design for portability from the start; test in a second repo |

## References

- [everything-claude-code](https://github.com/affaan-m/everything-claude-code) — Hook patterns, TDD workflows, agent examples
- Whitney's reference testing CLAUDE.md (to be reviewed during research)
- PRD #23 (CI/CD Pipeline) — absorbed into Milestone 5

## Progress Log

*This section will be updated as milestones are completed.*

| Date | Milestone | Notes |
|------|-----------|-------|
| | | |
