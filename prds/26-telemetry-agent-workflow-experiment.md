# PRD #26: Telemetry Agent Workflow Experiment

**Status:** Draft
**Created:** 2026-02-06
**GitHub Issue:** [#26](https://github.com/wiggitywhitney/commit-story-v2/issues/26)

---

## Problem Statement

The Telemetry Agent spec (`docs/specs/telemetry-agent-spec-v2.md`) is comprehensive and ready for implementation. Two fundamentally different approaches exist for turning a spec into working software with AI:

1. **Viktor's PRD System** — Human-supervised, milestone-based, iterative development with review at each step
2. **Claude Code Autonomous Mode** (`--dangerously-skip-permissions`) — Claude works independently with testing and guardrails as the primary safety net

Without empirical comparison, the choice is arbitrary. This experiment runs both approaches on the same input and compares the results.

## Solution Overview

### Shared Starting Point

Use Claude Code to break the Telemetry Agent spec into chunks of work. Review and approve those chunks. The same approved chunks become the input for both sides of the experiment — the only variable is the execution method.

### Side A: Viktor's PRD System (Human-Supervised)

Feed the approved chunks into the PRD skill system. Each chunk becomes a PRD with milestones. Whitney babysits creation, reviews at each milestone, and steers as needed. This is the existing workflow used to build commit-story-v2.

### Side B: Claude Autonomous Mode

Feed the same approved chunks to Claude Code running with `--dangerously-skip-permissions`. Claude works independently with:
- End-to-end tests as the primary validation (from PRD #25)
- CLAUDE.md rules enforcing testing on every feature
- Access restrictions / sandboxing (approach TBD from PRD #25 research)

#### Autonomous Workflow (Phased)

1. **Spec Analysis** — Claude reads the full spec and produces a reflective analysis: what it understands, what's ambiguous, what assumptions it's making
2. **Chunk Breakdown** — Claude breaks the spec into chunks of work (these are reviewed and approved before proceeding)
3. **Planning per Chunk** — For each chunk, Claude creates a plan/todo list in a document. Whitney reviews.
4. **Implementation** — Claude implements with `--dangerously-skip-permissions`, with testing guardrails catching mistakes

## Repository Structure

```text
commit-story-v2/              # Contains the spec, remains the test subject
telemetry-agent-prd/          # Built with Viktor's PRD system (Claude skills)
telemetry-agent-auto/         # Built with Claude autonomous mode
```

Both agent repos are fully decoupled from commit-story-v2. The spec lives in commit-story-v2 and is copied to each repo when finalized.

## Technical Scope

### telemetry-agent-prd Setup
- New GitHub repo: `wiggitywhitney/telemetry-agent-prd`
- Copy `.claude/skills/prd-*` from commit-story-v2
- Copy finalized spec and approved chunks from commit-story-v2
- Create PRDs from the approved chunks
- Standard development with Claude Code + human review at each milestone

### telemetry-agent-auto Setup
- New GitHub repo: `wiggitywhitney/telemetry-agent-auto`
- Copy finalized spec and approved chunks from commit-story-v2
- Set up CLAUDE.md with testing rules and guardrails (from PRD #25)
- Set up testing infrastructure (from PRD #25)
- Configure access restrictions / sandboxing (approach from PRD #25 research)
- Run Claude with `--dangerously-skip-permissions`

### Shared Elements
- Same telemetry agent spec (source of truth)
- Same approved work chunks (identical input)
- Same target: commit-story-v2 as test subject for the built agent
- Same validation criteria: agent successfully instruments commit-story-v2

## Comparison Metrics

- **Developer experience** — Friction, flow, interruptions, cognitive load
- **Output quality** — Code clarity, correctness, test coverage
- **Workflow fit** — How well does it handle cross-cutting concerns, dependencies, ambiguity?
- **Time to completion** — For equivalent chunks
- **Human intervention** — How often did Whitney need to step in and correct?
- **Test results** — Do the end-to-end tests pass? What did they catch?

## Success Criteria

1. Spec broken into approved chunks that both sides can consume
2. Both repos created and initialized with their respective approaches
3. At least one major chunk completed in each repo
4. Clear comparison notes documenting experience and metrics for each
5. Decision made on which approach works better (or insights on when to use each)
6. Findings ready for KubeCon EU 2026 talk narrative

## Dependencies

- **PRD #25 (Testing & Autonomous Dev Infrastructure)** must be complete — provides testing framework, CLAUDE.md rules, hooks, CI, and sandboxing research
- **Telemetry Agent Spec v2** must be finalized before copying to repos

## Milestones

- [ ] **PRD #25 complete** — Testing infrastructure and guardrails ready
- [ ] **Spec finalized** — telemetry-agent-spec-v2.md reviewed and ready
- [ ] **Spec broken into chunks** — Claude Code analyzes spec and proposes work breakdown
- [ ] **Chunks approved** — Whitney reviews and approves the work breakdown
- [ ] **Repos created** — Both GitHub repos exist with basic structure
- [ ] **Side A initialized** — PRDs created from approved chunks
- [ ] **Side B initialized** — CLAUDE.md, testing, guardrails configured for autonomous mode
- [ ] **First chunk completed in each** — Same chunk, different execution
- [ ] **Comparison documented** — Notes on experience, metrics, quality
- [ ] **Decision made** — Which approach to continue with (or hybrid insights)

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Spec changes after copying | Keep spec in commit-story-v2 as source of truth; update both repos if needed |
| One approach clearly fails early | Kill the loser, continue with winner — this is a feature, not a bug |
| Autonomous mode produces unsafe code | End-to-end tests + sandboxing catch problems; that's the whole point of PRD #25 |
| Chunk breakdown doesn't map well to one approach | Both approaches consume the same chunks; if mapping is bad, that's a finding |
| `--dangerously-skip-permissions` does something destructive | Sandboxing/isolation from PRD #25 research; fresh repo with nothing to lose |

## Research Summary

### Viktor's PRD System
- Documentation-first, 5-10 milestones per PRD
- GitHub issues for tracking
- Familiar workflow (already used to build all of commit-story-v2)
- Human reviews at each milestone boundary

### Claude Autonomous Mode (`--dangerously-skip-permissions`)
- Claude runs all commands without permission prompts
- Speed advantage: no human approval bottleneck for routine operations
- Risk: can run any shell command, modify any file
- Guardrails come from tests, CLAUDE.md rules, and environment isolation
- Phased approach (analyze → plan → implement) provides review checkpoints

---

## Notes

This PRD lives in commit-story-v2 because that's where the spec lives. The experiment itself happens in the two new repos. This PRD tracks the meta-work of running the experiment, not the agent implementation itself.

The KubeCon talk narrative benefits from showing both approaches — the audience sees controlled vs autonomous AI development and understands the tradeoffs firsthand.
