# Run-3 Actionable Fix Output

**To:** SpinybackedOrbWeaver maintainer / AI coding agent
**From:** Evaluation run-3 of commit-story-v2-eval (21 JavaScript files)
**Date:** 2026-03-13
**Run score:** 73% quality (19/26 rules pass), 4/4 gates pass
**Stale build:** Run-3 evaluated old `dist/` — fixes #61, #64, #65 were in source but never compiled. 3 of 7 failures are expected repeats.

---

## How to Read This Document

Each finding states **what's wrong**, **evidence** (file, line, span), and **desired outcome**. Findings are grouped by priority:

1. **Stale build repeats** — already fixed in source, need rebuild verification in run-4
2. **New regression** — the agent made something worse than pre-instrumentation state
3. **Genuine new findings** — real issues discovered for the first time
4. **Schema design issue** — not an agent bug; requires schema-level decision
5. **Failed files** — 4 files the agent could not instrument at all

Orb issue references (e.g., "Orb Issue #4") point to `evaluation/run-3/orb-issues-to-file.md`.

---

## 1. Stale Build Repeats (3 failures — verify with fresh build)

These failures have fixes merged to `src/` in spinybacked-orbweaver but `dist/` was never rebuilt. Run-4 must rebuild before evaluating.

### API-003: Vendor mega-bundle added as peerDependency

**What's wrong:** The agent added `@traceloop/node-server-sdk` (the Traceloop mega-bundle) as an optional peerDependency. The spec explicitly prohibits mega-bundles — individual `@opentelemetry/instrumentation-*` packages or targeted packages like `@traceloop/instrumentation-langchain` should be used instead.

**Evidence:** `package.json` — `"@traceloop/node-server-sdk": "^0.22.8"` in peerDependencies.

**Desired outcome:** The agent should never add `@traceloop/node-server-sdk`. When auto-instrumentation is needed, use the specific package for the framework detected (e.g., `@traceloop/instrumentation-langchain` for LangChain).

**Fix reference:** spinybacked-orbweaver #61 (merged to source, not compiled).

### SCH-001: 4+ inconsistent span naming patterns

**What's wrong:** 18 spans across 11 files use at least 4 distinct naming conventions: `commit_story.snake_case` (6), `git.camelCase` (3), bare `camelCase` (6), `journal_snake_case` (2), `mcp.dotted` (1). Inconsistent naming fragments trace analysis across a project.

**Evidence:**
- `commit_story.collect_chat_messages` (claude-collector.js) vs `git.runCommand` (git-collector.js) vs `getAllGuidelines` (guidelines/index.js) vs `journal_capture_context` (context-capture-tool.js)

**Desired outcome:** A single, consistent span naming convention project-wide. When the Weaver schema defines operation names, use them. When it doesn't, apply a deterministic convention derived from the project namespace (e.g., `commit_story.<operation_snake_case>`).

**Fix reference:** spinybacked-orbweaver #65 (merged to source, not compiled).

### CDQ-008: Two tracer naming conventions

**What's wrong:** 7 files use tracer name `commit_story` (underscore) and 4 files use `commit-story` (hyphen). One project should have one tracer name.

**Evidence:**
- `commit_story`: claude-collector, guidelines/index, index, message-filter, token-filter, reflection-tool, commit-analyzer
- `commit-story`: git-collector, mcp/server, context-capture-tool, journal-paths

**Desired outcome:** All files in a project use the same tracer name string, derived deterministically from the project name.

**Fix reference:** spinybacked-orbweaver #64 (merged to source, not compiled).

---

## 2. New Regression (1 failure)

### API-002: Agent made `@opentelemetry/api` an optional peerDependency

**What's wrong:** The pre-instrumentation `package.json` correctly declared `@opentelemetry/api` as a **required** peerDependency. The agent added `peerDependenciesMeta` marking it optional:

```json
"peerDependenciesMeta": {
  "@opentelemetry/api": { "optional": true }
}
```

All 11 instrumented source files have unconditional `import { trace, SpanStatusCode } from '@opentelemetry/api'`. If the peer isn't installed, every file crashes on import. The agent regressed a correct configuration.

**Evidence:** `package.json` — `peerDependenciesMeta` section.

**Desired outcome:** The agent must not mark `@opentelemetry/api` as optional when source files unconditionally import from it. If `@opentelemetry/api` is already declared as a required peerDependency before the agent runs, the agent should leave it as-is. If no OTel dependency exists yet, the agent should add it as a required peerDependency for library packages and a regular dependency for applications.

**Orb issue:** New — not yet filed. This is a different bug from run-2's API-002 (which was about `@opentelemetry/sdk-node` in production deps). The agent has a systemic issue with peerDependency declarations — each run produces a different misconfiguration.

---

## 3. Genuine New Findings (2 failures)

### SCH-002: 2 ad-hoc attribute keys not in Weaver registry

**What's wrong:** The agent invented 2 attribute keys that don't exist in the Weaver schema registry. While the data captured is useful, unregistered attributes reduce schema fidelity and make telemetry harder to query consistently.

**Evidence:**
- `src/collectors/git-collector.js:24` — `commit_story.git.subcommand` (records the git subcommand like "log", "diff", "show")
- `src/utils/commit-analyzer.js:94` — `commit_story.commit.parent_count` (records parent count for merge commit detection)

15/17 attribute keys match the registry (88%). These 2 are the exceptions.

**Desired outcome (two options):**
1. **Add to schema:** If these attributes are genuinely useful, add `commit_story.git.subcommand` and `commit_story.commit.parent_count` to the Weaver registry so the agent is using registered keys.
2. **Use existing keys:** If the registry already has semantically equivalent attributes, the agent should map to those instead of inventing new ones.

The agent should never invent attribute keys when the schema has a suitable match. When no match exists and the data is valuable, the agent should flag it for schema review rather than silently creating ad-hoc keys.

### CDQ-003: 2 spans missing `recordException` in commit-analyzer.js

**What's wrong:** Two catch blocks in commit-analyzer.js use only `span.setStatus({ code: SpanStatusCode.ERROR })` without `span.recordException(error)`. The error object is lost — telemetry shows an error occurred but not what the error was.

**Evidence:**
- `src/utils/commit-analyzer.js:42` — `getChangedFiles`: catch block has no error variable (`catch {` not `catch (error) {`)
- `src/utils/commit-analyzer.js:92` — `isMergeCommit`: same pattern

**Root cause:** The original code uses `catch {` (catch-without-variable). The agent correctly preserved this for NDS-005 (don't modify error handling). But changing `catch {` to `catch (error) {` is semantically identical in JavaScript — it doesn't change behavior, it just binds the error object to a variable.

**Desired outcome:** The agent should recognize that `catch {` → `catch (error) {` is a safe, behavior-preserving transformation that enables `recordException`. This is not a business logic change — it's equivalent to the re-indentation the agent already does when wrapping code in `startActiveSpan` callbacks.

**Orb issue:** Relates to Orb Issue #4 (NDS-003 should allow instrumentation-motivated refactors). The `catch {}` → `catch (error) {}` case is the simplest example of a safe refactor that NDS-003 currently blocks.

---

## 4. Schema Design Issue (1 failure)

### CDQ-007: PII attribute `commit_story.commit.author` records person name

**What's wrong:** Two files set `commit_story.commit.author` to a git author's real name. This is PII in telemetry data, which CDQ-007 flags regardless of whether the schema defines it.

**Evidence:**
- `src/collectors/git-collector.js:166` — `span.setAttribute('commit_story.commit.author', metadata.author)`
- `src/utils/commit-analyzer.js:159` — `span.setAttribute('commit_story.commit.author', author)`

**Important context:** `commit_story.commit.author` is defined in the Weaver registry. The agent correctly followed the schema. The issue is in the schema, not the agent.

**Desired outcome (schema-level decision, not an agent fix):**
1. **Hash or anonymize:** Change the schema to store a hashed or anonymized author identifier instead of the raw name.
2. **PII annotation:** Add a `sensitivity: pii` annotation to the registry entry so that OTel exporters can redact or hash at the collection boundary.
3. **Accept the risk:** If the telemetry system is internal-only and PII in traces is acceptable, document this as an explicit decision and mark CDQ-007 as N/A for this attribute.

---

## 5. Failed Files (4 files — 0 instrumentation)

These 4 files failed across both run-2 and run-3. Three are persistent failures; the fourth (journal-graph.js) failed differently each time.

### journal-graph.js — Oscillation (500+ lines, LangChain/LangGraph)

**What's wrong:** The agent cannot produce valid instrumentation for this file. In run-2 it exceeded the token budget (~94K tokens). In run-3, even with a 150K token budget, it oscillated — producing repeated validation failures without converging on a valid result.

**Evidence:** Run-3 supplemental log — "Oscillation detected during fresh regeneration: Duplicate errors detected across consecutive attempts" after 469 seconds and all 3 attempts exhausted.

**Root cause:** This file is ~500 lines with complex LangGraph state machine definitions. It's too large and complex for single-shot instrumentation. Additionally, this file uses `@langchain/langgraph` which has auto-instrumentation via `@traceloop/instrumentation-langchain` — manual spans may not even be the right approach.

**Desired outcome:** This file gets at least partial instrumentation. Options:
- Function-level instrumentation (Orb Issue #9): instrument individual functions rather than the whole file
- Auto-instrumentation deferral: if the file's primary operations are LangChain/LangGraph calls, defer to `@traceloop/instrumentation-langchain` and only add manual spans for operations that auto-instrumentation doesn't cover
- Improved oscillation diagnostics (Orb Issue #6): when oscillation occurs, report which specific validation rules triggered repeated failures

**Orb issues:** #6 (oscillation diagnostics), #9 (function-level instrumentation)

### sensitive-filter.js — Null parsed output (236 lines, 12 regex patterns)

**What's wrong:** The LLM returns no structured output on every attempt across two independent runs. This is a simple file — 12 regex patterns, 4 exported functions, no complex control flow. It should be easy to instrument.

**Evidence:** Run-3 main + supplemental — null parsed_output on all 3 attempts in both runs. No diagnostics about why the output was null.

**Root cause (theory):** The file contains complex regex patterns with backslashes and escaped brackets. When the LLM reproduces the file content inside a JSON string field, these characters may cause JSON parsing failures. Without diagnostics (Orb Issue #2), this theory cannot be confirmed.

**Desired outcome:** `orb instrument src/integrators/filters/sensitive-filter.js` succeeds. Step 1 is adding null-output diagnostics (stop_reason, output_tokens, raw output preview) to confirm the root cause.

**Orb issues:** #2 (null output diagnostics — includes this file as acceptance criterion)

### context-integrator.js — NDS-003 blocks necessary refactor

**What's wrong:** The agent wants to extract `previousCommitTime || new Date(...)` from inside an object literal into a `const windowStart` — a behavior-preserving change needed to set a span attribute on the computed value. NDS-003 flags this as a non-instrumentation change, the agent retries 3 times making the same change each time, and fails.

**Evidence:** Run-3 — 3 attempts, each with NDS-003 violation at line ~75 for `const windowStart` extraction.

**Root cause:** NDS-003 treats ALL non-instrumentation code changes as violations, even when the change is semantically necessary for correct instrumentation. The agent's persistence (same change across all 3 attempts) indicates genuine need, not a mistake.

**Desired outcome:** context-integrator.js gets instrumented successfully. The agent either: (a) recognizes "extract to const" as a safe refactor and allows it, (b) escalates to the user when the same NDS-003 violation repeats across all retry attempts, or (c) finds an alternative approach that doesn't require the extraction.

**Orb issue:** #4 (NDS-003 should allow instrumentation-motivated refactors)

### journal-manager.js — NDS-003 x5 + COV-003 x3

**What's wrong:** The agent heavily restructures this file across all attempts — 5 NDS-003 violations (business logic changes) and 3 COV-003 violations (incomplete error recording). The agent adds `if (commit.hash) {` guards and rearranges function internals.

**Evidence:** Run-3 — 3 attempts, each with 5+ NDS-003 violations. Worse than run-2 (which had fewer violations).

**Root cause:** The agent believes significant restructuring is needed to properly instrument this file. The sheer volume of violations (8 across two categories) suggests the file's structure is fundamentally challenging for the agent's instrumentation approach.

**Desired outcome:** journal-manager.js gets at least partial instrumentation. Function-level instrumentation (Orb Issue #9) may help — instrument individual functions that don't require restructuring, skip the ones that do.

**Orb issues:** #4 (NDS-003 refactors), #9 (function-level instrumentation)

---

## 6. Process Issues (not quality rule failures)

These don't affect the quality score but impacted run-3's effectiveness.

### PR artifact lost — git push authentication failure

The agent processed all 21 files (~35 minutes, real API costs), created commits on a local branch, then failed at push:

```text
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed
```

The PR summary (per-file table, span counts, agent notes) was generated in the agent's session and never saved locally.

**Desired outcome:** Two changes:
1. Validate git push credentials BEFORE processing files (Orb Issue #12). If credentials are invalid, fail immediately.
2. Save PR summary to a local file before attempting push (Orb Issue #13). Even if push fails, the summary is preserved.

### Token budget is post-hoc — spends tokens then discards result

The `maxTokensPerFile` check runs AFTER the LLM call. In run-3, commit-analyzer.js spent 88K tokens and got nothing back at the 80K default. The supplemental run with 150K budget rescued it.

**Desired outcome:** Either pre-flight estimate whether a file will exceed budget and skip it before spending tokens, or show the result even when over budget (with a warning) instead of discarding paid-for work.

**Orb issue:** #1 (token budget is post-hoc)

### Null parsed output has no diagnostics

When the LLM returns output that doesn't match the Zod schema, the error message says only "null parsed_output" with no information about what the LLM actually returned, why it stopped, or what validation failed.

**Desired outcome:** Enhanced logging: stop_reason, output_tokens, raw output preview (first 500 chars), Zod validation error details.

**Orb issue:** #2 (null parsed output diagnostics)

---

## 7. Run-2 Rubric Gap Assessment

Run-2 identified 3 rubric gaps. Here's the assessment after run-3:

### Gap 1: API-004 needs SDK setup file carve-out — RESOLVED (process)

**Run-2 finding:** API-004 (no SDK-internal imports in source) was failing because the SDK init file (`src/instrumentation.js`) contained CJS `require()` of SDK packages. The rubric didn't distinguish the SDK setup file from application source files.

**Run-3 status:** API-004 **passes**. The pre-run preparation placed a correct ESM `instrumentation.js` on main before the agent ran, and the agent left it untouched.

**Rubric update recommendation:** Still add the carve-out. The current pass is because the setup file was already correct — if the agent had to create or modify it, API-004 could fail again. The rubric should explicitly state: "API-001 and API-004 evaluate application source files only. The SDK setup file (configured as `sdkInitFile` in orb.yaml, typically `src/instrumentation.js` or `src/instrumentation.ts`) is expected to import SDK packages and is exempt from these rules."

### Gap 2: Coverage partials need clearer scoring — RESOLVED (methodology)

**Run-2 finding:** COV-002 and COV-004 were scored "partial" because files that failed instrumentation entirely reduced the overall coverage denominator.

**Run-3 status:** **Resolved through methodology.** Run-3 evaluates coverage rules only against successfully instrumented files. Files that failed instrumentation are evaluated separately under "Failed Files." This gives a cleaner signal: coverage rules measure the quality of what the agent produced, not what it couldn't produce.

**Rubric update recommendation:** Add scoring guidance: "Coverage rules (COV-001 through COV-006) are evaluated against instrumented files only. Files that failed instrumentation are assessed separately in the failure analysis. A file that was never instrumented cannot fail a coverage rule — it's a coverage gap for the run, not a coverage rule violation."

### Gap 3: No rule for module system correctness — OPEN

**Run-2 finding:** CJS `require()` in an ESM project passes `node --check` but fails at runtime. There's no rubric rule for module system correctness.

**Run-3 status:** Did not surface in run-3 because the pre-run placed a correct ESM setup file. But the gap remains — if the agent writes CJS in an ESM project (or vice versa), no rule catches it. NDS-001 (`node --check`) passes syntactically even when the module system is wrong.

**Rubric update recommendation:** Add a new rule, e.g., **NDS-006: Module system consistency.** "Instrumentation code must use the same module system as the target project. ESM projects (`"type": "module"` in package.json or `.mjs` extensions) must receive ESM imports/exports. CJS projects must receive `require()`/`module.exports`. Mixed module systems that pass syntax checks but fail at runtime are a gate-level failure."

**Scope:** Gate check (like NDS-001). A module system mismatch makes the instrumentation unusable even though it compiles.

---

## Summary: What Run-4 Should Verify

### Must verify (stale build fixes)
- [ ] API-003 resolved — no mega-bundle after fresh build
- [ ] SCH-001 resolved — consistent span naming after fresh build
- [ ] CDQ-008 resolved — consistent tracer naming after fresh build

### Must fix (new issues)
- [ ] API-002 — agent should not mark `@opentelemetry/api` as optional
- [ ] CDQ-003 — agent should recognize `catch {}` → `catch (error) {}` as safe
- [ ] SCH-002 — either add 2 attributes to schema or map to existing keys

### Must decide (schema-level)
- [ ] CDQ-007 — PII handling for `commit_story.commit.author`

### Must improve (failed files)
- [ ] journal-graph.js — function-level instrumentation or auto-instrumentation deferral
- [ ] sensitive-filter.js — null output diagnostics first, then fix
- [ ] context-integrator.js — NDS-003 refactor allowance or escalation
- [ ] journal-manager.js — function-level instrumentation

### Must improve (process)
- [ ] Pre-run: rebuild orb (`npm run prepare`) and verify build timestamp
- [ ] Pre-run: validate git push credentials before processing files
- [ ] Post-run: save PR summary locally before attempting push
- [ ] Token budget: pre-flight estimation or allow over-budget results

### Rubric updates
- [ ] API-004: Add SDK setup file carve-out
- [ ] Coverage: Add scoring guidance for instrumented-files-only evaluation
- [ ] NDS-006: Add module system consistency gate check
