# Baseline Comparison: Run-2 vs Run-1

**Date:** 2026-03-12
**Run-1:** telemetry-agent-spec-v3 (old implementation), 2026-02-24
**Run-2:** SpinybackedOrbWeaver v1.0.0, 2026-03-12

---

## Executive Summary

SpinybackedOrbWeaver eliminated all system-level failures that plagued run-1 while processing the full codebase (21 files vs 7). The quality pass rate dropped from 79% to 74%, but this is misleading — run-1 scored against 4 TypeScript files copied from another project, while run-2 scored against the actual 21-file JavaScript codebase. The real story is reliability: run-2 succeeded on first try with zero patches, while run-1 required 8 attempts, 3 manual patches, and $5.50+ in wasted API calls.

---

## Key Metrics Comparison

| Metric | Run-1 | Run-2 | Change |
|--------|-------|-------|--------|
| **Overall quality pass rate** | 79% (rubric) | 74% (20/27) | -5pp (but different scope) |
| **Gate checks** | 4/4 pass | 4/4 pass | Same |
| **Files in scope** | 7 | 21 | +14 (full codebase) |
| **Files instrumented** | 4 | 10 | +6 |
| **Files correctly skipped** | 3 | 7 | +4 |
| **Files failed** | 0 (after patches) | 4 | +4 (no patches applied) |
| **Spans added** | 7 | ~21 | +14 |
| **Manual patches required** | 3 | 0 | -3 (eliminated) |
| **Total attempts** | 8 | 1 | -7 |
| **First-try success** | No | Yes | Fixed |
| **Total cost** | ~$5.50–6.50 | Single run | Major reduction |
| **System-level failures** | Catastrophic (CLI unwired, validation broken) | None | Fixed |
| **Language match** | TypeScript (wrong) | JavaScript (correct) | Fixed |

---

## Dimension-Level Comparison

Run-1 dimension scores were estimated from the telemetry-agent-research evaluation report. Run-2 scores are from the full rubric scoring.

| Dimension | Run-1 | Run-2 | Trend |
|-----------|-------|-------|-------|
| Non-Destructiveness | 100% (2/2) | 100% (2/2) | Maintained |
| Coverage | ~67% | 67-100% (4/6 + 2 partial) | Comparable |
| Restraint | ~80% | 100% (5/5) | Improved |
| API-Only Dependency | ~33% | 0% (0/3) | Regressed |
| Schema Fidelity | ~33% | 75% (3/4) | Improved |
| Code Quality | ~86% | 86% (6/7) | Maintained |

### Key Dimension Analysis

**Restraint (improved to 100%)**: Run-1 had over-instrumentation concerns. Run-2 shows perfect restraint — no spans on utilities, accessors, thin wrappers, or internal functions. This is a significant improvement showing the agent has learned where NOT to instrument.

**Schema Fidelity (improved from ~33% to 75%)**: Run-1 largely ignored the Weaver schema. Run-2 correctly uses domain-specific attributes from the registry (e.g., `commit_story.git.commit_hash`, `commit_story.context.source`). The remaining failure (SCH-001) is span names not strictly matching registry operations, not attribute quality.

**API-Only Dependency (regressed from ~33% to 0%)**: This is the worst regression. Run-2 introduced a mega-bundle dependency (`@traceloop/node-server-sdk`), put `@opentelemetry/sdk-node` in production dependencies for a distributable package, and used CommonJS `require()` in an ESM project. Run-1 at least got some dependency declarations right.

---

## Failure Mode Comparison

### Run-1 Failures: System-Level (Catastrophic)

Run-1's failures were fundamental architecture problems:
- **CLI was unwired** — the command-line interface didn't actually connect to the instrumentation engine
- **Validation chain was broken** — validation rules existed but weren't executed
- **Silent failures** — errors were swallowed, no feedback to the user
- **Wrong language** — instrumented TypeScript files in a JavaScript project
- **"332 unit tests pass, nothing works"** — classic integration gap

These required 8 separate attempts and 3 manual patches before any useful output was produced.

### Run-2 Failures: Per-File (Recoverable)

Run-2's failures are localized, well-diagnosed, and individually fixable:

| Failure | Category | Fixable? |
|---------|----------|----------|
| Token budget exceeded (journal-graph.js) | Configuration limit | Yes — increase budget or chunk file |
| Elision detected (summary-prompt.js) | LLM transient | Yes — add to retry loop |
| Null parsed output (sensitive-filter.js) | LLM transient | Yes — add to retry loop |
| NDS-003 validation (journal-manager.js) | Agent behavior | Harder — agent consistently adds business logic |

**Retry loop gap**: 2 of 4 failures (elision, null output) are transient LLM failures that should be retried but aren't — they occur in `instrumentFile` before reaching the validation-chain retry loop. This is a bug in SpinybackedOrbWeaver's architecture, not a fundamental design problem.

---

## What Improved

1. **System reliability**: From catastrophic (8 attempts, nothing works) to single-run success. This was the primary goal of the SpinybackedOrbWeaver rewrite.

2. **Language detection**: Run-1 couldn't identify JavaScript and added TypeScript files. Run-2 correctly identifies and instruments JavaScript with ES module imports.

3. **Full codebase coverage**: Run-1 only processed 7 files (4 instrumented, 3 skipped). Run-2 processed all 21 files (10 instrumented, 7 correctly skipped, 4 failed).

4. **Zero manual patches**: Run-1 required 3 manual patches to produce usable output. Run-2 needed zero — the validation chain works and correctly rejects bad output.

5. **Schema awareness**: Run-2 uses domain-specific attributes from the Weaver registry. Run-1 largely ignored the schema.

6. **Restraint**: Run-2 shows perfect restraint (100%) — no over-instrumentation. Run-1 had instances of unnecessary spans.

7. **Error messages**: Run-2 failures have clear, actionable error messages (token budget, elision threshold, NDS-003 violation). Run-1 failures were silent.

## What Regressed

1. **API dependency model (0% vs ~33%)**: The mega-bundle (`@traceloop/node-server-sdk`) contradicts orb's own spec v3.8. SDK in production dependencies is wrong for a distributable package. CJS `require()` in an ESM project would fail at runtime.

2. **Tracer naming inconsistency (CDQ-008)**: 50/50 split between `'commit-story'` and `'commit_story'` across 10 files. This wasn't present in run-1 (fewer files, less opportunity for inconsistency).

3. **Span name registry alignment (SCH-001)**: Span names follow a good convention but don't strictly match Weaver registry operation definitions.

## What Stayed the Same

1. **Non-destructiveness (100%)**: Both runs preserved all existing behavior — no broken tests, no modified signatures, no business logic changes.

2. **Code quality patterns (~86%)**: Both runs used correct OTel patterns — `startActiveSpan` with `try/finally`, `recordException` + `setStatus`, proper async context management.

3. **Gate checks (4/4)**: Both runs passed all gate checks on the files that were successfully instrumented.

---

## Verdict

SpinybackedOrbWeaver is a fundamental improvement over the previous implementation. The "332 unit tests pass, nothing works" problem is solved. The tool works end-to-end on first try against a real codebase.

The quality pass rate comparison (79% → 74%) is not apples-to-apples — run-1 scored against 4 borrowed TypeScript files, run-2 against 21 real JavaScript files. A fairer comparison would note that run-1 needed 3 manual patches to even produce scoreable output, while run-2 needed zero.

The remaining issues (API dependency model, tracer naming, retry gaps) are specific, well-understood bugs — not architectural failures. They are all fixable in the agent's codebase without fundamental redesign. PRD #3 tracks the re-evaluation after these fixes.
