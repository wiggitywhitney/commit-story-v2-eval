# Run Summary — Run-19

**Date**: 2026-05-25
**Started**: 2026-05-25T11:11:17.913Z
**Duration**: 1h 30m 47.2s
**Branch**: spiny-orb/instrument-1779707477914
**Spiny-orb build**: 1.0.0 (SHA 36201a5, main branch)
**Target repo**: commit-story-v2 main
**PR**: https://github.com/wiggitywhitney/commit-story-v2/pull/71

---

## Results

| Metric | Value |
|--------|-------|
| Files processed | 30 |
| Committed | 10 |
| Failed | 0 |
| Partial | 3 |
| Correct skips | 17 |
| Skipped | 0 |
| Input tokens | 250.8K |
| Output tokens | 360.6K (644.2K cached) |
| Total cost | ~$8.60 |
| Live-check | OK (523 spans, 4170 advisory findings) |
| Push | AUTO ✅ — issue #867 retry fix confirmed working |
| PR created | YES — #71 (auto) |

---

## Committed Files (10)

| # | File | Spans | Attempts | Cost | Notes |
|---|------|-------|----------|------|-------|
| 1 | collectors/git-collector.js | 2 | 3 | $0.71 | getCommitData + getPreviousCommitTime |
| 2 | generators/journal-graph.js | 4 | 2 | $0.68 | 3rd consecutive run success |
| 3 | generators/summary-graph.js | 6 | 1 | $0.58 | **P1 RESOLVED ✅** (RUN18-1) |
| 4 | integrators/context-integrator.js | 1 | 1 | $0.28 | |
| 5 | mcp/server.js | 1 | 1 | $0.04 | |
| 6 | utils/journal-paths.js | 1 | 1 | $0.20 | |
| 7 | managers/journal-manager.js | 2 | 1 | $0.45 | SCH-002 persists (quotes_count) |
| 8 | commands/summarize.js | 3 | 3 | $1.40 | |
| 9 | utils/summary-detector.js | 9 | 1 | $0.36 | |
| 10 | src/index.js | 1 | 1 | $0.41 | **P1 RESOLVED ✅** (RUN18-1) |

**Total spans (committed)**: 30

---

## Partial Files (3)

| File | Spans | Attempts | Cost | Failure |
|------|-------|----------|------|---------|
| collectors/claude-collector.js | 1 | 3 | $0.56 | NDS-003: `allMessages.sort(...)` split at deeper indentation inside span callback — new PRD #875 pattern |
| managers/summary-manager.js | 6 | 2 | $1.81 | NDS-003: `generateAndSaveDailySummary` (return object literal), `generateAndSaveWeeklySummary` (`formatted,`), `generateAndSaveMonthlySummary` (`basePath`) — multi-line expressions reformatted at deeper indentation |
| managers/auto-summarize.js | 2 | 3 | $1.12 | NDS-003: `triggerAutoSummaries` — spread array expression `[...result.failed, ...]` reformatted at deeper indentation |

All three partial failures share the same root cause as claude-collector.js: lines near Prettier's 80-char boundary that fit at original indentation but are reformatted inside `startActiveSpan` callback. Same class targeted by PRD #875 (AST comparison). normalize-both-sides (PRD #845) did not resolve this class.

**Note**: summary-manager.js is a regression from run-18, where all 9 spans committed. In run-18, file-level instrumentation succeeded for generateAndSave*; in run-19, function-level fallback ran and those 3 functions failed NDS-003.

---

## P1 Finding Results (RUN18-1)

| File | Run-18 | Run-19 | Resolution |
|------|--------|--------|------------|
| generators/summary-graph.js | FAILED (NDS-003, 6 span wrappers) | ✅ SUCCESS (6 spans) | PRD #845 fixed this pattern |
| src/index.js | FAILED (NDS-003, multi-line imports) | ✅ SUCCESS (1 span) | PRD #845 fixed this pattern |
| mcp/tools/context-capture-tool.js | FAILED (NDS-003, server.tool callback) | ✅ SUCCESS (0 spans, sync wrapper) | Pre-scan correctly identified registerContextCaptureTool as synchronous — inner async callback not an exported function |
| mcp/tools/reflection-tool.js | FAILED (NDS-003, server.tool callback) | ✅ SUCCESS (0 spans, sync wrapper) | Same as context-capture-tool.js |

All 4 files that were blocked in run-18 now process without failure. context-capture-tool.js and reflection-tool.js commit 0 spans (correct per RST-001 — the only exported function is synchronous).

---

## Correct Skips (17)

All sync-only, constant-export, or pure-template files:

1. generators/prompts/guidelines/accessibility.js
2. generators/prompts/guidelines/anti-hallucination.js
3. generators/prompts/guidelines/index.js
4. generators/prompts/sections/daily-summary-prompt.js
5. generators/prompts/sections/dialogue-prompt.js
6. generators/prompts/sections/monthly-summary-prompt.js
7. generators/prompts/sections/summary-prompt.js
8. generators/prompts/sections/technical-decisions-prompt.js
9. generators/prompts/sections/weekly-summary-prompt.js
10. integrators/filters/message-filter.js
11. integrators/filters/sensitive-filter.js
12. integrators/filters/token-filter.js
13. mcp/tools/context-capture-tool.js (0 spans — synchronous wrapper)
14. mcp/tools/reflection-tool.js (0 spans — synchronous wrapper)
15. traceloop-init.js
16. utils/commit-analyzer.js
17. utils/config.js

---

## Run-18 → Run-19 Comparison

| Metric | Run-18 | Run-19 | Delta |
|--------|--------|--------|-------|
| Committed | 11 | 10 | -1 (summary-manager regression) |
| Failed | 4 | 0 | **-4** ✅ |
| Partial | 0 | 3 | +3 (new NDS-003 class) |
| Total spans (committed) | 36 | 30 | -6 |
| Cost | $9.16 | ~$8.60 | -$0.56 |
| Duration | 103 min | 91 min | -12 min |
| Push/PR | MANUAL (#70) | **AUTO (#71)** ✅ | Issue #867 fix working |
| summary-graph.js | FAILED | ✅ SUCCESS (6 spans) | RUN18-1 resolved |
| index.js | FAILED | ✅ SUCCESS (1 span) | RUN18-1 resolved |
| context-capture-tool.js | FAILED | SUCCESS (0 spans, sync) | RUN18-1 resolved (correct skip) |
| reflection-tool.js | FAILED | SUCCESS (0 spans, sync) | RUN18-1 resolved (correct skip) |
| summary-manager.js spans | 9 | 6 | Regression: generateAndSave* failed NDS-003 |
| journal-graph.js | SUCCESS (4 spans) | SUCCESS (4 spans) | 3rd consecutive ✅ |
| journal-manager.js SCH-002 | N/A (new) | **RECURS** | RUN18-2 unresolved |

---

## Notable Observations

1. **RUN18-1 fully resolved** — All 4 previously-blocked files process without failure. summary-graph.js (6 spans, 1 attempt) is the clearest confirmation that PRD #845 normalize-both-sides fixed the complex nested-callback offset pattern. index.js (1 span, 1 attempt) also commits cleanly for the first time.

2. **context-capture-tool.js and reflection-tool.js now 0-span correct skips** — Previous runs were failing NDS-003 on attempts to instrument the async callback inside `server.tool()`. The pre-scan now correctly identifies `registerContextCaptureTool` and `registerReflectionTool` as synchronous exported functions — the inner async handler is not separately exported, so COV-001 doesn't apply. This is correct behavior per RST-001.

3. **New NDS-003 false-positive class: indentation-driven Prettier reformatting** — Three files (claude-collector.js, summary-manager.js, auto-summarize.js) hit NDS-003 on lines near Prettier's 80-char print width that reformat differently at the deeper indentation of a `startActiveSpan` callback body. This is the exact class PRD #875 (AST comparison) is designed to fix. normalize-both-sides (PRD #845) handles the case where a function is *not* instrumented (same indentation), but cannot handle the case where it *is* instrumented (indentation increases).

4. **summary-manager.js regression** — Dropped from 9 spans (run-18) to 6 spans (run-19). In run-18, file-level instrumentation succeeded for the 3 `generateAndSave*` orchestrators. In run-19, the function-level fallback ran instead and those 3 functions failed NDS-003 on multi-line expression reformatting. Net effect: the primary COV-001 entry points for daily/weekly/monthly generation are not instrumented.

5. **journal-graph.js: 3 consecutive successes** — Run-17 failure was confirmed a one-off. The 65% thinking budget cap is sufficient for this file.

6. **RUN18-2 persists (SCH-002 on journal-manager.js)** — `discoverReflections` uses `commit_story.journal.quotes_count` again, with the agent reasoning that "reflections being developer-written content" aligns with the schema description for quotes. The description says "AI-extracted journal quotes" — a different operation class. Explicit negative guidance or a new schema attribute is still required.

7. **Auto-push confirmed working** — Issue #867 retry fix confirmed. No "push again" intervention needed. This is the first fully-automatic push and PR in the series.

8. **Live-check: 523 spans** — Down from 575 in run-18, reflecting the 4-file partial set (generateAndSave* functions missing their spans).

9. **summary-detector.js: 9 spans** — Highest single-file span count in the run, instrumenting all 9 async filesystem-scanning functions across daily/weekly/monthly detection paths.
