# Actionable Fix Output — Run-19

Self-contained handoff from evaluation run-19 to the spiny-orb team.

**Run-19 result**: 21/25 (84%) canonical quality, 10 committed, 0 failed, 3 partial, $8.83 cost. Gates 5/5. IS 80/100. Q×F 8.4.

**Run-18 → Run-19 delta**: Quality -12pp (96% → 84%), COV -60pp (5/5 → 2/5), IS -10pp (90 → 80), push #71 (fully automatic — first in series). P1 RUN18-1 fully resolved (summary-graph.js, index.js now commit).

**Target repo**: commit-story-v2 (same as runs 9–19)
**Branch**: `spiny-orb/instrument-1779707477914`
**PR**: https://github.com/wiggitywhitney/commit-story-v2/pull/71
**spiny-orb version**: 1.0.0 (SHA 36201a5, main branch)

---

## §1. Run-19 Score Summary

| Dimension | Score | Run-18 | Delta |
|-----------|-------|--------|-------|
| NDS | 2/2 (100%) | 2/2 (100%) | — |
| COV | **2/5 (40%)** | 5/5 (100%) | **-60pp** |
| RST | 4/4 (100%) | 4/4 (100%) | — |
| API | 3/3 (100%) | 3/3 (100%) | — |
| SCH | 3/4 (75%) | 3/4 (75%) | — |
| CDQ | 7/7 (100%) | 7/7 (100%) | — |
| **Total** | **21/25 (84%)** | **24/25 (96%)** | **-12pp** |
| **Gates** | **5/5** | **5/5** | **—** |
| **Files** | **10+3p** | **11** | — |
| **Cost** | **$8.83** | **$9.16** | **-$0.33** |
| **IS** | **80/100** | **90/100** | **-10pp** |
| **Q×F** | **8.4** | **10.6** | **-2.2** |

---

## §2. Prior Findings Assessment

| # | Finding | Priority | Status in Run-19 |
|---|---------|----------|-----------------|
| RUN18-1 | NDS-003 reconciler gap (startActiveSpan in nested callbacks) | P1 | **FULLY RESOLVED** — all 4 blocked files now process; PRD #845 normalize-both-sides confirmed |
| RUN18-2 | SCH-002 journal-manager.js quotes_count mismatch | P2 | **PERSISTS** — second-consecutive recurrence; agent rationalization evolved but conclusion unchanged |
| RUN18-3 | Auto-push failure (pre-push hook creates commit mid-push) | P2 | **RESOLVED** — issue #867 retry logic confirmed; PR #71 created fully automatically |
| IS SPA-001 | INTERNAL span count structural | Structural | **STRUCTURAL** — 22 spans; calibration mismatch, not regression target |
| Advisory contradiction rate ~50% | RUN11-1 | Advisory | **INCREASED** to ~78% FP rate (structural SCH-001 FPs from 39 new extension spans) |

---

## §3. New Run-19 Findings

| # | Title | Priority | Category |
|---|-------|----------|----------|
| RUN19-1 | NDS-003 indentation-driven Prettier reformatting — 3 partial files | P1 | Validator / NDS-003 |
| RUN19-2 | git-collector.js COV-005 attribute thinning on getCommitData | P2 | Coverage |
| RUN19-3 | IS SPA-002 orphan span — partial instrumentation creates context gap | P2 | IS Scoring |

---

### RUN19-1: NDS-003 Indentation-Driven Formatter Reformatting — 3 Partial Files (P1)

**What happened**: claude-collector.js, summary-manager.js (3 functions), and auto-summarize.js (1 function) all hit NDS-003 on multi-line expressions that Prettier reformats differently when the code is at deeper indentation inside a `startActiveSpan` callback.

**Affected functions and patterns**:
| File | Function | Line | Pattern |
|------|----------|------|---------|
| claude-collector.js | collectChatMessages | `allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));` | Method chain near 80-char boundary |
| summary-manager.js | generateAndSaveDailySummary | `return { saved: false, reason: \`Summary already exists for ${dateStr}\` };` | Return object literal with template literal |
| summary-manager.js | generateAndSaveWeeklySummary | `formatted,` (function call argument) | Multi-line call argument |
| summary-manager.js | generateAndSaveMonthlySummary | `basePath` (function call argument) | Multi-line call argument |
| auto-summarize.js | triggerAutoSummaries | `failed: [...result.failed, ...weeklyResult.failed, ...monthlyResult.failed],` | Spread array in multi-property object |

**Root cause**: PRD #845's normalize-both-sides approach normalizes each file at its own indentation level. The original normalizes at shallower indentation (line fits on one line), the instrumented version normalizes at deeper indentation (line splits). They look different even though the code is semantically identical.

This is a structurally distinct class from the RUN17-1 reconciler offset gap (which PRD #845 fixed). PRD #845 addressed "startActiveSpan wrapping re-indents lines → reconciler miscounts offsets." RUN19-1 addresses "startActiveSpan wrapping re-indents lines → Prettier splits borderline lines → text comparison fails."

**Impact**: summary-manager.js regressed from 9 spans (run-18) to 6 spans. The 3 missing `generateAndSave*` orchestrators are the primary pipeline entry points for daily/weekly/monthly summary generation — their absence leaves the top of the pipeline dark. auto-summarize.js's missing `triggerAutoSummaries` leaves the sequencing orchestrator (daily→weekly→monthly pipeline) without observability.

**Required fix**: PRD #875 (AST comparison) — replaces NDS-003's text comparison with AST-level comparison, immune to indentation and line breaks. This also eliminates the accumulated reconciler debt (reconcileAgentSplitLines, reconcileIndentReformat, reconcilePartialArgument).

**New fixture candidates for PRD #875 M0 catalog**:
- `allMessages.sort()` method chain (claude-collector.js run-19)
- Return object literal with template literal (summary-manager.js generateAndSaveDailySummary)
- Multi-line function call argument (summary-manager.js generateAndSaveWeeklySummary, generateAndSaveMonthlySummary)
- Spread array in multi-property return object (auto-summarize.js triggerAutoSummaries)

**Connection to prior runs**: Run-18 had a similar issue with `allMessages.sort()` in claude-collector.js as PARTIAL. The summary-manager.js and auto-summarize.js cases are new in run-19, triggered by function-level fallback applying different indentation context than run-18's file-level instrumentation.

---

### RUN19-2: git-collector.js COV-005 Attribute Thinning on getCommitData (P2)

**What happened**: `getCommitData` span sets only `vcs.ref.head.revision` (the input parameter). Run-18 set 4 attributes on this span: `vcs.ref.head.revision`, `commit_story.commit.timestamp`, `commit_story.commit.author`, and `commit_story.commit.message`. Run-19 omits the last three.

**Agent reasoning**: Author/authorEmail correctly omitted (CDQ-007 PII). Timestamp and message were described in agent notes as appropriate with `isRecording()` guard, but the committed code omits both without that guard being used.

**Required fix**: Prompt guidance for `getCommitData` should explicitly require:
- `commit_story.commit.message` with `if (span.isRecording())` guard (non-trivial string construction)
- `commit_story.commit.timestamp` (already a safe non-nullable ISO string)
- `commit_story.git.is_merge` and `commit_story.git.parent_count` if those schema extensions are added (see below)

**Schema gap**: The agent notes identified 3 missing schema attributes on `getCommitData`:
- `commit_story.git.command` — which git subcommand was invoked (new string extension needed)
- `commit_story.git.is_merge` — whether commit is a merge commit (new boolean extension needed)
- `commit_story.git.parent_count` — number of parent commits (new int extension needed)

Adding these to the schema and prompt would fully satisfy COV-005 for `getCommitData` across future runs.

---

### RUN19-3: IS SPA-002 Orphan Span — Partial Instrumentation Creates Context Gap (P2)

**What happened**: IS scoring reports span `b48fbc5f` has an orphan parentSpanId `30d70fca` that doesn't exist in the trace. SPA-002 fires, reducing IS score from 90 to 80.

**Root cause hypothesis**: The generateAndSave* functions in summary-manager.js were instrumented in run-18 (9 spans). In run-19, these functions are absent from the instrumented output. The LangGraph pipelines called from those functions (summary-graph.js spans) may establish a parent context that references the absent orchestrator span. When those pipelines emit auto-instrumented LangChain spans, they reference a parent that never completed its span.

**Evidence**: The orphan span issue appears specifically in run-19 where the generateAndSave* orchestrators are missing. Run-18 had these orchestrators (all 9 spans) and did NOT have an SPA-002 failure.

**Required fix**: Resolving RUN19-1 (PRD #875 landing) should restore the generateAndSave* orchestrators and eliminate the orphan span context gap. No separate fix needed — this is a dependent effect of RUN19-1.

---

## §4. Per-Run Signal Changes

**context-capture-tool.js and reflection-tool.js trajectory change**: Runs 17–18 had these files FAILING (NDS-003 on server.tool() callback re-indentation). Run-19: both process without failure — 0 spans, correct skips. Pre-scan correctly identifies the exported function (`registerContextCaptureTool`, `registerReflectionTool`) as synchronous; the inner async callback is not exported, so COV-001 doesn't apply per current rubric. This is a genuine change in behavior, not just a different failure mode.

**summary-manager.js regression**: Trajectory is 3→6→9→6 spans across runs 12, 17, 18, 19. The 9-span high in run-18 was achieved via file-level instrumentation. Run-19 function-level fallback produced the same 3 `generateAndSave*` failures it had in runs 17 and earlier. PRD #875 is needed to restore file-level success on these functions.

**journal-graph.js third consecutive success**: Confirms the 65% thinking budget cap is sufficient for this file on most runs. No further investigation needed.

**Advisory contradiction rate**: Increased from ~50% (run-18) to ~78% (run-19) due to 39 new extension spans triggering structural SCH-001 false positives and 13 new attributes triggering CDQ-007 null-guard false positives on numeric lengths. Not a quality regression — a volume effect from new instrumentation.

---

## §5. Recommended Next Actions (Run-20 Prep)

**For spiny-orb team:**

1. **PRD #875 (P1)**: NDS-003 AST comparison — 5 new fixture candidates from run-19 added to the evidence base for M0 catalog. The RUN19-1 class (indentation-driven Prettier reformatting) is now documented with 5 concrete examples across 3 files. M0 fixture set should include all patterns from debug dumps for runs 17–19 per PRD #875's fixture strategy.

2. **RUN19-2 schema additions (P2)**: Add `commit_story.git.is_merge` (boolean), `commit_story.git.parent_count` (int), and `commit_story.git.command` (string) to the schema. Add prompt guidance explicitly requiring `commit_story.commit.message` with `isRecording()` guard and `commit_story.commit.timestamp` on `getCommitData`.

3. **RUN18-2 / RUN19 SCH-002 (P2)**: Add an explicit negative directive to the prompt: "`commit_story.journal.quotes_count` is specifically for AI-extracted journal quotes from journal generation; it must NOT be used for reflection discovery counts." OR add `commit_story.journal.reflections_count` to the schema. Two consecutive runs with the same mismatch means the current prompt guidance (semantic precision rule from PRD #857) is insufficient for this specific attribute.

**For eval team:**

- Run-20 primary goal: verify PRD #875 fixes RUN19-1 on summary-manager.js `generateAndSave*` and auto-summarize.js `triggerAutoSummaries`; if so, Q×F could reach 12+ (24/25 × 14 files if all partial files resolve)
- Watch: SPA-002 orphan span — should resolve automatically if generateAndSave* functions return
- Watch: COV-005 on git-collector.js — does getCommitData gain output attributes? Depends on prompt/schema fix
- Watch: SCH-002 on journal-manager.js — third run with this mismatch expected unless explicit directive added
