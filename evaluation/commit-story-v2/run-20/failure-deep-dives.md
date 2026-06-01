# Failure Deep-Dives — Run-20

**Run-20 result**: 12 committed, 1 failed, 0 partial, 17 correct skips.

One new file-level failure: `src/mcp/server.js` — clean in run-19, failed in run-20 with NDS-003 oscillation. Root cause is a spiny-orb bug in `stripOtelNodes` introduced by PRD #885. Run-level observations on attempt distribution follow.

---

## File-Level Failures

### src/mcp/server.js — NDS-003 oscillation (3 attempts, 0 spans)

**Status**: FAILED. Was clean in run-19 (1 span, 1 attempt).

#### What happened

The agent produced a structurally correct `main()` instrumentation — `startActiveSpan` wrapper with `commit_story.mcp.start` span name, one attribute, try/catch/finally lifecycle — and preserved all original lines verbatim. Despite correct code, NDS-003 fired with 21 duplicate violations across all 3 attempts at the same line numbers: lines 1, 3–20, 37, 39. Oscillation detection triggered on attempt 3 and the file was failed.

#### Agent behavior

Attempt 1 generated correct instrumentation. On seeing the NDS-003 failures, the agent in attempt 2 diagnosed a JSON serialization issue with `\n` escapes corrupting the JSDoc. Attempt 3 tried to be explicit about preserving the shebang and comment block. All three attempts produced identical violations because the bug is structural — independent of what the agent generates.

#### Root cause: `stripOtelNodes` loses file-level leading trivia

PRD #885 (NDS-003 multiLine flag normalization, merged between run-19 and run-20) introduced a two-step comparison pipeline:

1. `strippedCode = stripOtelNodes(instrumentedCode)` — strip all OTel additions
2. `normalizeMultiLineFlags(originalCode)` and `normalizeMultiLineFlags(strippedCode)` — reset multiLine AST flags before Prettier
3. Prettier-normalize both sides
4. Diff the two normalized results — any remaining differences are NDS-003 violations

The bug is in step 1. `stripOtelNodes` uses ts-morph to remove the OTel import declaration. In the instrumented file, the agent placed the OTel import **before** all original imports:

```javascript
import { trace, SpanStatusCode } from '@opentelemetry/api';  ← inserted first
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
...
```

In the TypeScript/ts-morph AST, **the shebang (`#!/usr/bin/env node`) and the file-level JSDoc block (`/** Commit Story MCP Server ... */`) are stored as leading trivia of the first statement in the file**. In the instrumented file, the first statement is the OTel import. When ts-morph removes the OTel import node, the leading trivia — shebang and file-level JSDoc — goes with it.

The stripped code therefore starts directly with `import { McpServer }` — no shebang, no file-level JSDoc:

```text
Stripped line 1: import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
Stripped line 2: import { StdioServerTransport } from ...
... (42 lines total, no shebang, no "Commit Story MCP Server" JSDoc)
```

Confirmed by running `stripOtelNodes` on the run-20 debug dump directly:
- `shebang present: false`
- `"/**" count in stripped: 2` vs `3` in original
- The file-level JSDoc `/**` and its 18 non-blank content lines (lines 3–20) are absent

After Prettier normalization:
- `normalizedOriginal` contains: shebang (line 1), file-level JSDoc (lines 3–20), createServer JSDoc (with its own `/**` and `*/`), main JSDoc
- `normalizedStripped` contains: createServer JSDoc, main JSDoc — missing the file-level block entirely

The frequency-based forward check then finds 21 "missing" lines:

| Line(s) | Content | Why missing |
|---------|---------|-------------|
| 1 | `#!/usr/bin/env node` | Shebang dropped with OTel import trivia |
| 3–20 | JSDoc content lines (`* Commit Story MCP Server`, `* Provides tools...`, etc.) | File-level JSDoc dropped entirely |
| 37 | `/**` | Original has 3× `/**` (file + createServer + main); stripped has 2×; second occurrence flagged |
| 39 | `*/` | Same frequency mismatch — stripped is short by one `*/` |

Total: 1 + 18 + 1 + 1 = **21 violations** ✓

#### Why run-19 was clean

Run-19 used a pre-PRD-#885 spiny-orb build that called `checkNonInstrumentationDiff(Prettier(original), Prettier(instrumented))` — comparing original against the **full instrumented file** (not the stripped version). Both sides had the shebang and file-level JSDoc. The `INSTRUMENTATION_PATTERNS` regex filtered out the new OTel lines from the diff. No trivia loss occurred.

PRD #885's strip-first approach is correct in principle (necessary to eliminate false positives from Prettier's different formatting of wrapped vs unwrapped code), but it introduced this trivia-loss regression.

#### Actionable fix for spiny-orb

**Location**: `src/languages/javascript/rules/nds003-ast-stripper.ts`, `removeOtelImports` (phase 6).

**Fix**: When removing an OTel import that is the first statement in the file, check if it carries file-level leading trivia beyond simple whitespace (shebang, file-level JSDoc). If so, transfer that trivia to the next statement before removal, or prepend it to the returned `getFullText()` output.

A simpler alternative: after `stripOtelNodes` returns, compare the first non-blank line of the original against the first non-blank line of the stripped result. If the stripped result is missing the shebang or file-level comment block, prepend the original file's leading trivia section.

This bug affects any file that:
1. Has a shebang or file-level block comment before its imports, AND
2. Gets an OTel import inserted as the first statement by the agent

Files with only ABOUTME line comments (`// ABOUTME: ...`) at the top are likely unaffected (ts-morph handles line comment trivia differently from block/JSDoc trivia).

#### Classification

This is a **spiny-orb false positive** — the agent's instrumented code was correct. NDS-003 should pass for this file. The failure is not a reflection of agent quality.

---

## Run-Level Observations

### Attempt Distribution — High Multi-Attempt Rate

Run-20 had 6 of 13 processed files (including the failed one) require 3 attempts:

| Attempts | Files |
|----------|-------|
| 1 | journal-paths.js, summary-manager.js, summary-detector.js, auto-summarize.js |
| 2 | journal-graph.js, summary-graph.js, summarize.js |
| 3 | claude-collector.js, git-collector.js, context-integrator.js, journal-manager.js, src/index.js, mcp/server.js (failed) |

5 files committed at 3 attempts vs 1 in run-19. The increase is partly explained by the changed spiny-orb build (post-PRD-#897 prompt generality cleanup): generalizing prompts may have reduced first-attempt pass rates.

Notable regressions from run-19:
- `context-integrator.js`: 1 attempt → 3 attempts (+2)
- `journal-manager.js`: 1 attempt → 3 attempts (+2)
- `src/index.js`: 1 attempt → 3 attempts (+2)

These will be examined in per-file evaluation for underlying causes.

### summary-manager.js — P1 Regression Resolved (9 spans, 1 attempt)

`summary-manager.js` committed all 9 spans on the first attempt — `generateAndSaveDailySummary`, `generateAndSaveWeeklySummary`, `generateAndSaveMonthlySummary` all present. This reverses the run-19 regression where PRD #885 was still pending. PRD #885 multiLine flag normalization confirmed effective on the orchestrator functions' return-object-literal patterns.

### auto-summarize.js and claude-collector.js — P1 Resolutions

Both files that were partial in run-19 (NDS-003 at reassembly) committed cleanly in run-20 with 3 and 1 spans respectively. PRD #885 fix confirmed across all three previously blocked files.

### journal-manager.js SCH-002 Watch — Potentially Resolved

Run-20 `journal-manager.js` used `commit_story.journal.entries_count` instead of `commit_story.journal.quotes_count` in `discoverReflections`. This breaks the three-consecutive-run watch for RUN18-2. Whether `entries_count` is semantically correct (vs `quotes_count` being a misfit) will be assessed in per-file evaluation.
