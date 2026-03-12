# Evaluation Run 2: SpinybackedOrbWeaver v1.0.0

**Date:** 2026-03-12
**Tool:** `orb instrument src/ --no-pr --verbose -y`
**Branch:** `orb/instrument-1773326732807`
**Codebase:** commit-story-v2-eval (21 JavaScript files)

## Results

**Overall: 17/21 succeeded (81%), 4 failed**

### Instrumented Files (10 files, ~21 spans)

| File | Spans | Commit |
|------|-------|--------|
| `src/collectors/claude-collector.js` | 1 | fe525fa |
| `src/collectors/git-collector.js` | 2 | b724f42 |
| `src/index.js` | 1 | 8fa31bb |
| `src/integrators/context-integrator.js` | 1 | 9b03273 |
| `src/integrators/filters/message-filter.js` | 2 | 561e68e |
| `src/integrators/filters/token-filter.js` | 3 | d83323e |
| `src/mcp/server.js` | 1 | aaa2a89 |
| `src/mcp/tools/context-capture-tool.js` | 2 | 5aa406d |
| `src/mcp/tools/reflection-tool.js` | 2 | 336e81a |
| `src/utils/commit-analyzer.js` | 3 | da58705 |

### Correctly Skipped Files (7 files, 0 spans each)

| File | Reason |
|------|--------|
| `src/generators/prompts/guidelines/accessibility.js` | Pure data/config export |
| `src/generators/prompts/guidelines/anti-hallucination.js` | Pure data/config export |
| `src/generators/prompts/guidelines/index.js` | Re-export module |
| `src/generators/prompts/sections/dialogue-prompt.js` | Pure data/config export |
| `src/generators/prompts/sections/technical-decisions-prompt.js` | Pure data/config export |
| `src/utils/config.js` | Configuration module |
| `src/utils/journal-paths.js` | Pure utility, path construction |

### Failed Files (4 files)

| File | Failure Mode | Details |
|------|-------------|---------|
| `src/generators/journal-graph.js` | Token budget exceeded | 93,966 tokens vs 80,000 budget. Largest file in codebase. |
| `src/generators/prompts/sections/summary-prompt.js` | Elision detected | Output was 70% of input (97 vs 138 lines, threshold 80%). LLM truncated content. |
| `src/integrators/filters/sensitive-filter.js` | Null parsed_output | LLM returned no structured output. |
| `src/managers/journal-manager.js` | NDS-003 validation | Agent added business logic (`if (commit.hash) {`). Validation correctly rejected. |

### SDK Setup

Commit `5c74eba` added:
- Updated `src/instrumentation.js` with instrumentation registrations
- Added OTel dependencies to `package.json`

## Failure Analysis

### Token Budget (journal-graph.js)
The main orchestration file is too large for the 80,000 token budget. This is a legitimate limitation — the file plus schema context exceeds what fits in a single LLM call. Potential fix: increase budget or split file processing.

### Elision Detection (summary-prompt.js)
The LLM truncated content when generating output. The elision check correctly caught this — a 0-span file was being corrupted. This is a safety feature working as intended. However, elision detection happens inside `instrumentFile` (not the validation chain), so the retry loop does NOT retry this. This is a bug — transient elision could succeed on retry.

### Null Parsed Output (sensitive-filter.js)
The LLM failed to return structured output. This is a transient LLM failure — a retry would likely succeed. Same retry gap as elision: `instrumentFile` returns `success: false`, which bails without retrying.

### NDS-003 Validation (journal-manager.js)
The agent added non-instrumentation code (`if (commit.hash) {`). The NDS-003 validation rule correctly caught and rejected this. Unlike the above two, NDS-003 IS in the validation chain, so the retry loop DID fire — all 3 attempts (1 initial + 2 retries per `maxFixAttempts: 2` default) failed. The agent consistently misunderstands this file.

### Retry Gap Summary

| Failure | In Retry Loop? | Retried? | Bug? |
|---------|---------------|----------|------|
| Token budget | N/A (deterministic) | N/A | No — legitimate limit |
| Elision | No (instrumentFile) | No | **Yes** — should retry |
| Null output | No (instrumentFile) | No | **Yes** — should retry |
| NDS-003 | Yes (validation chain) | Yes (3 attempts) | No — retry worked, agent still failed |

## Quality Issues in Instrumented Code

### Tracer Naming Inconsistency
5 files use `trace.getTracer('commit-story')`, 5 use `trace.getTracer('commit_story')`:

| Tracer Name | Files |
|-------------|-------|
| `'commit-story'` | claude-collector, git-collector, index, mcp/server, commit-analyzer |
| `'commit_story'` | context-integrator, message-filter, token-filter, context-capture-tool, reflection-tool |

This should be consistent across all files. The package name is `commit-story` (hyphen).

### Mega-Bundle Dependency
`instrumentation.js` was updated to use `@traceloop/node-server-sdk` (mega-bundle) instead of individual packages like `@traceloop/instrumentation-langchain`. Spec v3.8 explicitly says: "the agent does NOT use that mega-bundle — it installs individual instrumentation packages." This contradicts the spec.

### SDK Setup Uses CommonJS in ESM Project
`instrumentation.js` uses `require()` (CommonJS) but the project uses ES modules (`"type": "module"` in package.json, all source files use `import`). This would fail at runtime.

## Comparison with Run-1

| Metric | Run-1 | Run-2 |
|--------|-------|-------|
| Files processed | 7 | 21 |
| First-try success rate | ~50% (required 8 attempts, ~$5.50) | 81% (single run) |
| Files instrumented | 4 | 10 |
| Files correctly skipped | 3 | 7 |
| Failures | System-level (CLI unwired, validation broken) | Per-file (token budget, LLM transient) |
| Manual patches needed | 3 | 0 |
| Total cost | ~$5.50–6.50 across 8 attempts | TBD (single run) |
| Retry gap bugs | N/A (validation chain broken) | 2 (elision + null output not retried) |
| Quality issues | N/A | 3 (tracer naming, mega-bundle, CJS in ESM) |

## Key Improvement: No System-Level Failures
Run-1 had catastrophic failures: CLI was unwired, validation chain was broken, "332 unit tests pass, nothing works." Run-2 had zero system-level failures. All 4 failures were per-file issues with clear failure modes and error messages. The tool works end-to-end.

## Artifacts

- `orb-output.log` — Raw CLI output
- `instrumentation.diff` — Full diff of all instrumented source files
- `sdk-setup.diff` — OTel SDK initialization and dependency changes
