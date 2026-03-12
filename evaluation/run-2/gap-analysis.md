# Evaluation Run 2: Gap Analysis and Fix Instructions

**Date:** 2026-03-12
**Evaluation:** SpinybackedOrbWeaver v1.0.0 against commit-story-v2-eval
**Audience:** AI coding agent working on the spinybacked-orbweaver codebase

---

## Overview

Run-2 scored 74% on quality rules (20/27 pass, 2 partial, 5 fail) with all 4 gates passing. This document categorizes every finding, traces each to a root cause in the orb codebase and spec, and provides actionable fix instructions.

Findings fall into three categories:
1. **Bugs** — code contradicts the spec
2. **Spec gaps** — spec is silent or ambiguous on something that matters
3. **Rubric gaps** — the evaluation rubric needs updating

---

## Category 1: Bugs (Code Contradicts Spec)

### BUG-1: Mega-Bundle Instead of Individual Packages

**Rubric rules failed:** API-002, API-003, API-004
**Impact:** 3 quality rule failures (the entire API dimension)

**What happened:** The agent installed `@traceloop/node-server-sdk` (mega-bundle containing 30+ bundled LLM library copies) instead of individual packages like `@traceloop/instrumentation-anthropic`.

**What the spec says:** The spec v3.9 dependency strategy section says instrumentation packages should be individual packages. The Coordinator aggregates `librariesNeeded` from agents and writes the SDK init file deterministically. The agent reports `{ packageName, importName }` pairs.

**Where the bug is:** `src/agent/prompt.ts` lines 110-111. The system prompt's allowlist maps LLM libraries directly to `@traceloop/node-server-sdk` as a single mega-bundle:

```text
**OpenLLMetry (@traceloop/node-server-sdk):**
@anthropic-ai/sdk, openai, @langchain/*, ...
```

**Fix instruction:** Replace the mega-bundle reference in the prompt allowlist with individual package mappings. When the agent detects `@anthropic-ai/sdk` in imports, it should report `{ packageName: "@traceloop/instrumentation-anthropic", importName: "AnthropicInstrumentation" }`. When it detects `@langchain/*`, it should report `{ packageName: "@traceloop/instrumentation-langchain", importName: "LangChainInstrumentation" }`. Map each LLM library to its individual `@traceloop/instrumentation-*` package instead of the umbrella bundle.

---

### BUG-2: CJS `require()` in ESM Projects

**Rubric rules failed:** API-004 (contributes to)
**Impact:** SDK setup file would fail at runtime

**What happened:** `src/instrumentation.js` was generated with `const { NodeSDK } = require(...)` but the project uses `"type": "module"` in `package.json` (ESM).

**What the spec says:** All examples in the spec use ESM syntax (`import { NodeSDK } from '@opentelemetry/sdk-node'`). The spec targets ESM exclusively.

**Where the bug is:** `src/coordinator/sdk-init.ts` lines 27-29. The `isEsmFile()` function detects module system by checking the *existing file content* for `import`/`export` keywords. If the SDK init file is new or empty (no existing imports), it falls back to CJS. It never checks `package.json`'s `"type"` field.

**Fix instruction:** `updateSdkInitFile()` in `sdk-init.ts` should read `package.json` to determine the project's module system. If `"type": "module"` is set, always generate ESM imports regardless of the SDK init file's existing content. The file-content heuristic is a reasonable fallback when `package.json` doesn't declare a type, but `package.json` should be the primary signal.

---

### BUG-3: Elision and Null Output Bypass Retry Loop

**Rubric rules affected:** COV-002 (partial), COV-004 (partial) — 2 of 4 failed files were transient failures
**Impact:** Files that could succeed on retry are permanently failed

**What happened:** `summary-prompt.js` (elision detected) and `sensitive-filter.js` (null parsed output) both failed on the first attempt. Neither was retried, even though these are transient LLM failures.

**What the spec says:** The spec's validation section lists elision detection as a pre-validation check, and the fix loop should retry on validation failures. The spec says: "If any stage fails, the remaining stages are skipped and the error from the first failing stage is fed back to the agent." This implies errors should feed back into the loop, not exit it.

**Where the bug is:** `src/agent/instrument-file.ts` lines 190-208 and `src/fix-loop/instrument-with-retry.ts` lines 274-282. When `instrumentFile()` returns `success: false` for elision or null output, the retry loop in `executeRetryLoop()` immediately exits with `buildFailedResult()` instead of feeding the error back for a retry attempt.

**Fix instruction:** When `instrumentFile()` returns `success: false` with a recoverable failure reason (elision, null parsed output), the retry loop should treat these the same as validation-chain failures: feed the error message back to the agent for the next attempt. Only truly unrecoverable failures (token budget exceeded, file too large to read) should exit the loop immediately. The distinction: elision and null output are LLM behavioral failures that may not recur on retry; token budget exceeded is deterministic and will always recur.

---

### BUG-4: Tracer Name Inconsistency

**Rubric rules failed:** CDQ-008
**Impact:** 1 quality rule failure, fragments trace analysis

**What happened:** 5 files use `trace.getTracer('commit-story')` (hyphen), 5 use `trace.getTracer('commit_story')` (underscore).

**What the spec says:** The spec example shows `trace.getTracer('commit-story')` (hyphen, matching the package name). The spec also acknowledges this as a known gap from PRD #2 (CDQ-008): "Implementations should use a consistent tracer naming convention."

**Where the bug is:** `src/agent/prompt.ts` lines 43-45. The prompt says "Derive the service name from the schema namespace" without specifying derivation rules. The schema namespace is `commit_story` (underscore), the package name is `commit-story` (hyphen). The agent randomly picks one or the other across files.

**Fix instruction:** The prompt should specify the exact tracer name to use, not ask the agent to "derive" it. The Coordinator should resolve the tracer name once (from the schema namespace or package name — pick one convention) and pass it to the agent as a concrete string in the prompt. The agent should not be making this decision independently per file.

---

### BUG-5: Span Names Don't Reference Registry Operations

**Rubric rules failed:** SCH-001
**Impact:** 1 quality rule failure (Critical severity)

**What happened:** Span names follow a reasonable convention (`commit_story.context.collect`, `commit_story.git.get_commit_diff`) but don't match the operation names defined in the Weaver registry.

**What the spec says:** The spec says span names should be derived from the schema. The attribute/span creation priority is: (1) check OTel semantic conventions, (2) check existing Weaver schema, (3) create new under project namespace. The Weaver schema's `spans[].name` field defines canonical operation names.

**Where the bug is:** `src/agent/prompt.ts` lines 31-67. The schema is included in the prompt via a `<schema>` block, but the transformation rules don't instruct the agent to look up `spans[].name` for operation naming. The examples show generic function-name-based span names.

**Fix instruction:** The prompt's transformation rules should explicitly instruct: "When adding a span, first check the schema's span definitions for a matching operation name. Use the schema-defined span name if one exists. Only invent a new span name (following the `<namespace>.<category>.<operation>` convention) if no schema definition matches the function's purpose." The examples should demonstrate this lookup pattern.

---

## Category 2: Spec Gaps

### SPEC-GAP-1: No Module System Detection Strategy

The spec assumes ESM throughout but doesn't define how the Coordinator should detect the project's module system. The fix for BUG-2 needs a spec update defining the detection order: (1) `package.json` `"type"` field, (2) file extension (`.mjs` = ESM, `.cjs` = CJS), (3) file content heuristic as fallback.

### SPEC-GAP-2: No Guidance on `@opentelemetry/sdk-node` Placement

The spec says `@opentelemetry/api` is always a peerDependency, and instrumentation packages follow `dependencyStrategy`. But it doesn't explicitly address `@opentelemetry/sdk-node` — should it be in `dependencies`, `peerDependencies`, or `devDependencies`? For a distributable library (`dependencyStrategy: peerDependencies`), the SDK should be a peerDependency too — the deployer chooses the SDK version. The spec should state this explicitly.

### SPEC-GAP-3: Token Budget Strategy for Large Files

The spec defines `maxTokensPerFile: 80000` and `largeFileThresholdLines: 500` but doesn't address what happens when a file legitimately exceeds the budget. `journal-graph.js` is 93,966 tokens — 17% over budget. Options: (a) increase default, (b) allow per-file overrides, (c) implement file chunking, (d) accept that some files can't be instrumented. The spec should document the intended strategy.

### SPEC-GAP-4: Retry Classification Missing

The spec describes the fix loop and early-exit heuristics but doesn't classify which failure types are retryable vs. terminal. BUG-3 exists because elision and null output aren't classified. The spec should define:
- **Retryable:** elision, null parsed output, validation failures (NDS-003, lint, schema)
- **Terminal:** token budget exceeded, file unreadable, deterministic parse failures

---

## Category 3: Rubric Gaps

### RUBRIC-GAP-1: API-004 Needs SDK Setup File Carve-Out

API-004 ("No SDK-Internal Imports") flags `@opentelemetry/sdk-node` imports in any file. But the SDK setup file (`instrumentation.js`) is *supposed* to import SDK packages — that's its purpose. The rubric should exclude the configured `sdkInitFile` from API-004 evaluation. The real issue in run-2 was the *specific* packages (mega-bundle) and module system (CJS), not the existence of SDK imports in the setup file.

### RUBRIC-GAP-2: Coverage Partials Need Clearer Scoring

COV-002 and COV-004 scored "PARTIAL" because 4 files failed instrumentation entirely. The rubric doesn't define how to score partially-failed runs. Proposal: score coverage rules only against successfully instrumented files, then report the file failure rate separately. A file that wasn't instrumented at all isn't a coverage quality issue — it's an availability issue.

### RUBRIC-GAP-3: No Rule for Module System Correctness

No rubric rule catches "CJS require() in an ESM project." NDS-001 (syntax validation) catches `node --check` failures, but `require()` in an ESM `.js` file may pass syntax validation while failing at runtime. A new rule (e.g., NDS-006: "Generated code uses correct module system") would catch this.

---

## Issues to File on spinybacked-orbweaver

| Issue | Title | Category | Priority |
|-------|-------|----------|----------|
| [#61](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/61) | Agent installs mega-bundle instead of individual instrumentation packages | BUG-1 | High |
| [#62](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/62) | SDK init file uses CJS `require()` in ESM projects | BUG-2 | High |
| [#63](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/63) | Elision and null parsed output failures bypass retry loop | BUG-3 | High |
| [#64](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/64) | Tracer name inconsistent across files | BUG-4 | Medium |
| [#65](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/65) | Agent doesn't consult Weaver schema `spans[].name` for span naming | BUG-5 | Medium |
| [#66](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/66) | Spec: define module system detection strategy | SPEC-GAP-1 | Medium |
| [#67](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/67) | Spec: clarify `@opentelemetry/sdk-node` dependency placement for libraries | SPEC-GAP-2 | Medium |
| [#69](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/69) | Spec: define strategy for files exceeding token budget | SPEC-GAP-3 | Low |
| [#68](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/68) | Spec: classify retryable vs terminal failure types | SPEC-GAP-4 | Medium |

---

## Artifacts

- `evaluation/run-2/rubric-scores.md` — Full 31-rule scoring with per-rule evidence
- `evaluation/run-2/baseline-comparison.md` — Run-2 vs run-1 comparison
- `evaluation/run-2/run-summary.md` — Run execution summary with failure analysis
- `evaluation/run-2/instrumentation.diff` — Full diff of instrumented files
- `evaluation/run-2/sdk-setup.diff` — SDK init file and dependency changes
