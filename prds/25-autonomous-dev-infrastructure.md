# PRD #25: Testing & Autonomous Development Infrastructure

## Problem Statement

Running Claude Code in skip-permissions mode without babysitting requires testing infrastructure and safety guardrails that don't exist yet. There are no tests, no CI, no permission controls, and no verification workflow across any of Whitney's repos.

This PRD is **cross-project** — the testing practices, safety config, shared skills, and guardrails established here should work across any project developed with Claude Code, not just commit-story-v2. Project-specific test suites are out of scope (those become per-project PRDs created as a deliverable of this PRD).

## Solution Overview

A layered approach informed by research into four reference implementations (Viktor Farcic's dot-ai, Michael Forrester's claude-dotfiles and Brain Spec, Affaan Mustafa's everything-claude-code, and TACHES' get-shit-done):

- **Layer 0**: Global safety net in `~/.claude/settings.json` — deny lists and permission allowlists that apply to all repos immediately
- **Layer 0.5**: Tiered deterministic hooks — PreToolUse hooks on git commit (quick+lint), git push (full verification), and PR creation (pre-pr with expanded security). These are the primary enforcement mechanism, running scripts directly with no AI involvement
- **Layer 1**: Shared claude config repo — reusable testing infrastructure (decision guide, `/verify` skill, CLAUDE.md templates, permission profiles, testing rules) that can be applied to any project
- **Layer 2** (out of scope, per-project): Apply the framework to each active repo via separate PRDs

## Research

Research is complete. See `docs/research/testing-infrastructure-research.md` for detailed findings from all four reference implementations, comparative analysis, and the strategy decision.

## User Stories

- As a developer using Claude Code, I want a deny list that prevents Claude from reading secrets or running destructive commands across all my repos
- As a developer, I want a curated permission allowlist so I can run skip-permissions mode with confidence
- As a developer, I want a shared `/verify` skill that checks build, tests, and lint before any PR
- As a developer, I want CLAUDE.md templates so each new repo starts with testing rules baked in
- As a developer, I want a decision guide that tells me what testing approach fits what kind of project
- As a developer, I want reusable testing rules (Always/Never patterns) that load into every Claude Code session
- As a developer, I want "apply testing framework" PRDs created in all my active repos so there's a clear path forward for each project

## Success Criteria

- [x] Global deny list and permission allowlist configured and validated in `~/.claude/settings.json`
- [x] Shared claude config repo exists with testing infrastructure
- [x] Tiered deterministic hooks enforce verification at commit, push, and PR creation
- [x] Decision guide documents testing strategies for different project types
- [x] `/verify` skill works for Node.js/TypeScript projects
- [x] Testing design guidance (what/how to test) integrated into the decision guide and testing rules — enforceable rules are in hooks
- [x] CLAUDE.md template(s) provide project config and decision guide references (enforcement is via hooks, not CLAUDE.md rules)
- [ ] "Apply testing framework" PRDs exist in all active repos (commit-story-v2, cluster-whisperer, telemetry agent)

## Milestones

### Milestone 1: Research Phase
**Status**: Complete

Investigated testing infrastructure approaches across four reference implementations. Documented findings in `docs/research/testing-infrastructure-research.md` covering testing philosophy, quality gates, permission models, CI/CD, hooks, and shared config strategies.

Key findings:
- Testing enforcement works best through layered redundancy (rules + agents + hooks + CI)
- Both Viktor and Michael prioritize integration tests over unit tests for AI-generated code
- A universal deny list is the single highest-impact safety measure
- Permission profiles should be tiered (conservative for exploration, autonomous for trusted plans)
- Shared config across repos can be done via git submodule, npm package, or install script

**Done**: Research document exists with comparative analysis and strategy recommendation.

---

### Milestone 2: Global Safety Net (Layer 0)
**Status**: Complete

Configure `~/.claude/settings.json` with:

- [x] **Universal deny list** — 27 deny rules blocking sensitive file reads (`.env`, `*.pem`, `*.key`, `~/.ssh/**`, `~/.aws/**`, `~/.docker/**`, `**/credentials*`, `**/secrets/**`, `**/.npmrc`, `id_rsa*`, `id_ed25519*`) and destructive commands (`sudo`, `rm -rf /`, `rm -rf ~*`, `chmod 777`, `> /dev/*`, pipe-to-shell)
- [x] **Permission allowlist** — 50 allow rules (all git ops including push, all npm except publish, `gh *`, `rm`, `node`, `ls`, `vals`, `weaver`, CodeRabbit MCP tools, `WebFetch`, `WebSearch`, etc.) + 5 ask rules for shared-state/irreversible operations (`git merge`, `git rebase`, `gh pr merge`, `npm publish`, Google Calendar delete). Hybrid autonomous profile — no profile-switching system built (YAGNI; project-level `.claude/settings.json` handles per-repo overrides if needed). `git push` moved from ask to allow — the PreToolUse commit hook serves as the pre-push safety net instead.
- [x] **Validate** — Confirmed deny list blocks sensitive files, allowlist permits normal workflow, ask rules prompt for shared-state ops. Found 3 non-functional deny patterns (see progress log).

**Done when**: `~/.claude/settings.json` is configured and validated. Claude Code sessions across all repos respect the deny list and permissions.

---

### Milestone 3: Shared Claude Config Repo (Layer 1)
**Status**: Complete

Repo created at [wiggitywhitney/claude-config](https://github.com/wiggitywhitney/claude-config). All work tracked in that repo's PRD #1, which is complete and archived.

- [x] **`/verify` skill** — 5-phase verification loop (build → type check → lint → security → tests). Skill + deterministic scripts architecture. Three modes: quick, full, pre-pr. Tested in commit-story-v2. The skill is for ad-hoc interactive use; hooks handle enforcement.
- [x] **Tiered PreToolUse hooks** — Three deterministic hooks running scripts directly (no skill invocation): commit (quick+lint: build, type check, lint), push (full: build, type check, lint, security, tests), PR creation (pre-pr: full + expanded security). All purely deterministic — this is the primary enforcement mechanism.
- [x] **PostToolUse hook on `Write|Edit`** — Checks markdown files for bare code blocks. Replaces CLAUDE.md style rule with deterministic enforcement (zero context cost, 100% compliance).
- [x] **Testing decision guide** — Maps project types to testing strategies, includes design guidance on what/how to test (Milestone 2 in claude-config PRD #1). Hooks enforce *that* tests pass; the guide helps decide *what* to test.
- [x] **Testing rules** — Always/Never patterns for testing. Complete alongside decision guide (Milestone 2 in claude-config PRD #1).
- [x] **CLAUDE.md template(s)** — General and Node.js/TypeScript templates (`templates/`), authoring guide (`guides/claude-md-guide.md`), per-language rule files in `rules/languages/` (TypeScript, JavaScript, Shell, Python placeholder, Go). Applied to 5 repos. Enforcement is via hooks, not CLAUDE.md rules. (Milestone 3 in claude-config PRD #1)
- [x] **Permission profiles** — Guide with tier-down pattern from autonomous baseline (`guides/permission-profiles.md`). Decision 20 in claude-config PRD #1.
- [x] **Commit message hook** — `check-commit-message.sh` blocks AI/Claude/Co-Authored-By references in commits (Milestone 3 in claude-config PRD #1, Decision 17)
- [x] **Dotfile override hooks** — `.skip-branching`, `.skip-coderabbit` checks in existing hooks (Decision 16)
- [x] **Test tier enforcement hooks** — Warn (not block) when unit/integration/e2e test tiers are missing. Respects `.skip-e2e` and `.skip-integration` dotfiles (Milestone 4 in claude-config PRD #1, Decision 18)
- [x] **README** — Covers all deliverables with validated examples (Milestone 5 in claude-config PRD #1)

**Done when**: Repo exists with all components, and the `/verify` skill has been tested in at least one real project. ✅

---

### Milestone 4: Apply-Framework PRDs in Active Repos
**Status**: In Progress

Create "apply testing framework" PRDs in each active repo:

- [x] **commit-story-v2** (PRD #33) — PRD created. Wire up shared config, write end-to-end tests for existing functionality, set up CI pipeline, decide LLM testing strategy.
- [ ] **cluster-whisperer** — Wire up shared config, plan integration test strategy for K8s/vector DB interaction, set up CI
- [ ] **Telemetry agent** — Wire up shared config, test script-orchestrated workflows, verify instrumentation output

Each PRD should reference the shared config repo and the testing decision guide for project-specific strategy.

**Done when**: PRDs exist in all active repos with clear milestones for applying the testing framework.

---

### Milestone 5: Validation
**Status**: Not Started

- [ ] Run Claude Code with skip-permissions on a bounded task in commit-story-v2 with all guardrails active
- [ ] Verify: deny list blocks sensitive file access, permissions allow normal workflow, tiered hooks catch real issues at commit/push/PR boundaries
- [ ] Document any gaps or adjustments needed
- [ ] Update shared config repo with lessons learned

**Done when**: Skip-permissions workflow has been validated in practice and any gaps have been addressed.

## Out of Scope

- **Project-specific test suites** — Writing actual tests for commit-story-v2, cluster-whisperer, or the telemetry agent. Those are separate PRDs (Milestone 4 deliverables).
- **Specialized agents** (TDD guide, code reviewer, security reviewer) — Consider for future PRD based on need
- **CI/CD pipeline setup** — Per-project concern, handled in apply-framework PRDs
- **Comprehensive PostToolUse hooks** (auto-linting, auto-type-checking after edits) — One targeted PostToolUse hook (markdown codeblock checker) is in scope; a broader hooks framework is not
- **Continuous learning / instinct systems** — Interesting (from Affaan and Michael's repos) but not needed now

## Dependencies

- None (this is foundational infrastructure)
- PRD #26 and other apply-framework PRDs depend on this PRD being complete
- PRD #23 (CI/CD Pipeline) is absorbed into the per-project apply-framework PRDs

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shared config repo becomes over-engineered | High | Start minimal — decision guide, one verify skill, one template. Add complexity only when needed. |
| Deny list is too restrictive for some workflows | Medium | Start conservative, loosen based on real experience. Document exceptions. |
| Testing decision guide becomes stale | Low | Keep it short and principles-based rather than prescriptive. Update when adding new project types. |
| `/verify` skill doesn't generalize across projects | Medium | Design for Node.js/TypeScript first (covers all current projects). Generalize later if needed. |
| Research analysis paralysis | Medium | Research is complete. Implementation decisions should be quick — start with the simplest version and iterate. |

## References

- `docs/research/testing-infrastructure-research.md` — Full research with findings from all four reference implementations
- [vfarcic/dot-ai](https://github.com/vfarcic/dot-ai) — Integration-first testing, CLAUDE.md mandatory checklist, permission allowlisting
- [peopleforrester/claude-dotfiles](https://github.com/peopleforrester/claude-dotfiles) — 8-step verify loop, permission profiles, testing rules, hooks
- [peopleforrester/Brain_spec_skills_claude](https://github.com/peopleforrester/Brain_spec_skills_claude) — Spec-driven development, radical simplification
- [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) — Layered testing enforcement, eval harness, 33-combination CI matrix
- [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done) — Goal-backward verification, skip-permissions with post-verification
- PRD #23 (CI/CD Pipeline) — Absorbed into per-project apply-framework PRDs

## Progress Log

| Date | Milestone | Notes |
|------|-----------|-------|
| 2026-02-10 | Milestone 1: Research | Complete. Researched 4 reference implementations, documented in testing-infrastructure-research.md. Strategy: layered approach (safety net → shared config → per-project application). |
| 2026-02-10 | Milestone 2: Global Safety Net | In progress. Configured `~/.claude/settings.json` with 27 deny rules, 33 allow rules, 4 ask rules. Hybrid autonomous profile. Decided against profile-switching templates (YAGNI). Live validation pending next session. |
| 2026-02-10 | Milestone 2: Validation | Complete. Live-tested all deny, allow, and ask rules. **Working**: all sensitive file read denials (.env, *.pem, *.key, ~/.ssh, ~/.aws, ~/.docker, credentials, secrets, .npmrc); destructive command denials (sudo, rm -rf /, rm -rf ~*, chmod 777); all allowlisted commands (git, npm, node, gh, ls, etc.); ask rules (git push, git merge). **Gaps found**: 3 deny patterns non-functional due to glob matching limitations with shell operators — `curl * \| bash*`, `> /dev/*`, and `wget * \| sh*` are not matched by Claude Code's permission glob engine. Low practical risk: Claude's built-in safety refuses destructive actions as a secondary layer, and `sudo` being blocked prevents most real damage. |
| 2026-02-11 | Milestone 2: Permission updates | Promoted PRD-workflow commands to global: `git pull`, CodeRabbit MCP tools (4), `WebFetch`, `WebSearch` to allow. Added `gh pr merge` to ask. Moved `git push` from ask to allow (PreToolUse commit hook serves as safety net). |
| 2026-02-11 | Milestone 3: claude-config repo | Created [wiggitywhitney/claude-config](https://github.com/wiggitywhitney/claude-config). Bootstrapped with PRD skills, CLAUDE.md, CodeRabbit MCP, vals. PRD #1 created to track Layer 1 deliverables. |
| 2026-02-11 | Milestone 3: /verify skill + hooks | Complete. `/verify` skill with 5-phase verification, 3 modes (quick/full/pre-pr), skill + deterministic scripts architecture. PreToolUse hook on `git commit` blocks unverified commits. PostToolUse hook on `Write\|Edit` checks markdown codeblocks (replaced CLAUDE.md style rule). Hooks installed globally in `~/.claude/settings.json`. Tested in commit-story-v2. |
| 2026-02-11 | CLAUDE.md optimization | Removed code block style guidelines section — now enforced by PostToolUse hook. Reduces context window usage. |
| 2026-02-14 | Milestone 3: Tiered hooks | Evolved from single commit hook to three tiered PreToolUse hooks: commit (quick+lint), push (full), PR (pre-pr). All purely deterministic — scripts only, no skill invocation. Hooks are now the primary enforcement mechanism; `/verify` skill is ad-hoc only. See claude-config Decisions 10-12. |
| 2026-02-17 | PRD revision | Updated Milestone 3, success criteria, and Milestone 5 to reflect hooks-first reality. Testing rules merged into decision guide scope (enforceable rules are in hooks). CLAUDE.md templates scoped down (enforcement via hooks, not rules). |
| 2026-02-18 | Milestone 3: Decision guide + testing rules complete | Synced with claude-config PRD #1. Milestone 2 (decision guide + testing rules) complete. Milestone 3 (CLAUDE.md templates + profiles) in progress — global CLAUDE.md audit done, per-repo audits and templates pending. New deliverables: commit message hook (Decision 17), dotfile overrides (Decision 16), per-language rules (Decision 13). Also marked PRD #33 as created in Milestone 4. |
| 2026-02-21 | Milestone 3: Complete | claude-config PRD #1 is fully complete and archived. All deliverables done: CLAUDE.md templates (general + Node.js/TypeScript), per-language rules (TS, JS, Shell, Python, Go), permission profiles guide, commit message hook, dotfile overrides, test tier enforcement hooks, README with validated examples. PRD #8 (Go verification) also completed, extending hooks to Go projects. |
| | | |
