# Baseline Comparison — Run-19 vs Runs 2–18

---

## Cross-Run Quality Trend (Full History)

| Run | Date | Quality | Gates | Files | Spans | Cost | Push/PR | IS | Q×F |
|-----|------|---------|-------|-------|-------|------|---------|-----|-----|
| 2 | 2026-03-12 | 20/27 (74%) | 3/4 | 10 | — | — | NO | — | 7.4 |
| 3 | 2026-03-13 | 19/26 (73%) | 4/4 | 11 | — | — | NO | — | 8.0 |
| 4 | 2026-03-16 | 15/26 (58%) | 4/4 | 16 | — | $5.84 | NO | — | 9.2 |
| 5 | 2026-03-17 | 23/25 (92%) | 5/5 | 9 | 17 | $9.72 | NO | — | 8.3 |
| 6 | 2026-03-20 | 21/25 (84%) | 5/5 | 5 | 16 | $11.02 | NO | — | 4.2 |
| 7 | 2026-03-20 | 22/25 (88%) | 5/5 | 13 | 28 | $3.22 | NO | — | 11.4 |
| 8 | 2026-03-21 | 23/25 (92%) | 5/5 | 12 | 28 | $4.00 | NO | — | 11.0 |
| 9 | 2026-03-21 | **25/25 (100%)** | 5/5 | 12 | 26 | $3.97 | NO | — | 12.0 |
| 10 | 2026-03-23 | 23/25 (92%) | 5/5 | 12 | 28 | $4.36 | NO | — | 11.0 |
| 11 | 2026-03-30 | **25/25 (100%)** | 5/5 | 13 | 39 | $4.25 | YES (#60) | — | **13.0** |
| 12 | 2026-04-09 | 23/25 (92%) | 5/5 | 12+1p | 31 | $5.19 | YES (#61) | — | 11.0 |
| 13 | 2026-04-12 | **25/25 (100%)** | 5/5 | 7 | — | — | YES (#62) | — | 7.0 |
| 14 | 2026-04-15 | 22/25 (88%) | 5/5 | 12 | — | — | YES (#65) | — | 10.6 |
| 15 | 2026-05-03 | 24/25 (96%) | 5/5 | 14 | ~37 | $6.44 | YES (#66) | 70 | **13.4** |
| 16 | 2026-05-11 | 22/25 (88%) | 5/5 | 10+3p | ~24 | $12.29 | YES (#68) | 80 | 8.8 |
| 17 | 2026-05-12 | 22/25 (88%) | **4/5** | 10+1p | ~28 | $10.43 | YES (#69) | 90 | 8.8 |
| 18 | 2026-05-16 | 24/25 (96%) | 5/5 | 11 | 36 | $9.16 | YES (#70) | 90 | 10.6 |
| **19** | **2026-05-25** | **21/25 (84%)** | **5/5** | **10+3p** | **30** | **$8.83** | **YES (#71, AUTO)** | **80** | **8.4** |

---

## Dimension Trend (Runs 15–19)

| Dimension | Run-15 | Run-16 | Run-17 | Run-18 | **Run-19** |
|-----------|--------|--------|--------|--------|-----------|
| NDS | 2/2 | 2/2 | 2/2 | 2/2 | **2/2** |
| COV | 4/5 | 3/5 | 3/5 | 5/5 | **2/5** |
| RST | 4/4 | 4/4 | 4/4 | 4/4 | **4/4** |
| API | 3/3 | 3/3 | 3/3 | 3/3 | **3/3** |
| SCH | 4/4 | 4/4 | 3/4 | 3/4 | **3/4** |
| CDQ | 7/7 | 7/7 | 7/7 | 7/7 | **7/7** |
| **Total** | **24/25** | **22/25** | **22/25** | **24/25** | **21/25** |

---

## Notable Changes in Run-19

### P1 RUN18-1 Fully Resolved

PRD #845 (normalize-both-sides) confirmed effective. All 4 previously-blocked files now process without NDS-003 reconciler gap failures:
- **summary-graph.js**: ✅ SUCCESS (6 spans, 1 attempt) — hardest case; 6 nested span wrappers
- **index.js**: ✅ SUCCESS (1 span, 1 attempt) — multi-line import collapse now handled
- **context-capture-tool.js**: ✅ SUCCESS (0 spans) — pre-scan correctly identifies sync wrapper; inner async callback not exported, COV-001 doesn't apply
- **reflection-tool.js**: ✅ SUCCESS (0 spans) — same reasoning as context-capture-tool.js

### COV: 5/5 → 2/5 (Regression — Validator Gap)

COV regressed from its run-18 high of 5/5 to the lowest in the series (2/5). Three rule failures:

**COV-001 and COV-004** — New NDS-003 false-positive class hits the generateAndSave* orchestrators in summary-manager.js (3 functions) and triggerAutoSummaries in auto-summarize.js. These functions were successfully instrumented in run-18 via file-level instrumentation. In run-19, function-level fallback was applied and the NDS-003 validator rejected the output due to Prettier reformatting multi-line expressions at deeper indentation inside `startActiveSpan` callbacks.

This is a validator gap, not an agent quality failure. The agent's code was semantically correct in all 4 cases — PRD #875 (AST comparison) is the required fix.

**COV-005** — git-collector.js `getCommitData` attribute thinning: run-18 set 4 attributes; run-19 sets only `vcs.ref.head.revision`. Agent notes correctly identified `commit_story.commit.message` as the right attribute with `isRecording()` guard but the committed code omits it. This is an addressable agent quality issue, not a structural gap.

### New NDS-003 Class: Indentation-Driven Formatter Reformatting

Run-19 introduces a new class of NDS-003 false positives distinct from the reconciler offset gap fixed in PRD #845:

| File | Line that fails | Why it fails |
|------|----------------|-------------|
| claude-collector.js | `allMessages.sort((a, b) => ...)` | Method chain near 80-char boundary at deeper indentation |
| summary-manager.js × 3 | Return object literal, function call args | Multi-line expressions reformatted at deeper indentation |
| auto-summarize.js | `failed: [...spread array...]` | Spread array in multi-property object reformatted |

PRD #845's normalize-both-sides approach normalizes each side independently at its own indentation level. It cannot prevent reformatting that occurs because one side is at shallower indentation (original) and the other at deeper indentation (inside `startActiveSpan` callback). PRD #875 (AST comparison) addresses this class by comparing code structure, not text.

### Push: Manual → Fully Automatic (First Time)

Run-19 is the first run with both auto-push AND auto-PR creation. Issue #867 (retry on hook-created-commit) confirmed working. No manual intervention for the first time in 19 runs. This is a significant milestone for deployment reliability.

### IS: 90 → 80 (New SPA-002 Failure)

SPA-001 (>10 INTERNAL spans) continues as expected (22 spans; structural calibration mismatch). New this run: **SPA-002 orphan span** — span `b48fbc5f` references parent `30d70fca` which is absent from the trace. This is likely caused by the partial instrumentation: some functions that had spans in run-18 (generateAndSave* orchestrators) are absent in run-19, but the auto-instrumented LangChain spans still reference the context established by those missing orchestrators. The orphan span represents a context propagation gap created by the partial instrumentation.

### SCH-002: Third Consecutive Failure

journal-manager.js `discoverReflections` uses `commit_story.journal.quotes_count` for the third time (runs 17's summary-graph was a different file, but journal-manager.js specifically has now failed SCH-002 in runs 18 and 19). The agent's stated reasoning evolved across runs — run-18 said "aligns with reflections being developer-written content"; run-19 repeated the same rationalization. The schema definition clearly says "AI-extracted journal quotes" — no amount of reasoning changes this. An explicit negative directive in the prompt is needed.

---

## Records and Notable Milestones (Updated)

| Record | Value | Run |
|--------|-------|-----|
| Highest quality | 25/25 (100%) | Runs 9, 11, 13 |
| Highest Q×F | 13.4 | Run-15 |
| Most files committed | 14 | Run-15 |
| Most spans | 39 | Run-11 |
| Lowest cost | $3.22 | Run-7 |
| First push/PR | Run-11 | #60 |
| First IS score | Run-15 | 70/100 |
| Highest IS | 90/100 | Runs 17, 18 |
| Longest consecutive push streak | **9 (runs 11–19)** | — |
| **First fully automatic push+PR** | **Run-19** | **#71** |

---

## Trajectory Summary

Run-19 is a mixed story: significant structural progress (P1 fully resolved, first auto-push) combined with a quality regression driven by a newly discovered NDS-003 false-positive class. The 21/25 score is the lowest since run-16 and the Q×F of 8.4 returns to the plateau last seen in runs 16–17.

The COV regression from 5/5 to 2/5 is primarily a validator artifact (PRD #875 class), not an agent quality decline. If PRD #875 lands before run-20 and also addresses COV-005 attribute guidance for getCommitData, run-20 could reach 24/25 (96%) with ~14 files, pushing Q×F back toward run-15's record of 13.4.

The IS regression (90→80) from SPA-002 is also a side effect of partial instrumentation — resolving the NDS-003 false positives in run-20 should eliminate the orphan span by providing the missing parent spans.

The SCH-002 recurrence (journal-manager.js `quotes_count`) is the only dimension failure that requires a direct fix rather than a validator improvement. An explicit negative directive or a new schema attribute is needed before run-20.

**Run-19 push streak**: 9 consecutive successful pushes and PRs (runs 11–19). Run-19 is the first with fully automatic creation.
