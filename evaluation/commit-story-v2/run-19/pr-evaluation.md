# PR Artifact Evaluation — Run-19

**PR**: https://github.com/wiggitywhitney/commit-story-v2/pull/71
**Branch**: spiny-orb/instrument-1779707477914
**State**: OPEN
**Created**: Automatically (first fully automatic push + PR in the series — issue #867 retry fix confirmed)

---

## Push Auth — Fully Automated

PR #71 is the first run with both auto-push AND auto-PR creation succeeding. Previous runs either required manual PAT push (runs 3–10) or had hook-created-commit failures (run-18). Issue #867 retry logic confirmed working: no "push again" message, no manual intervention.

---

## PR Title

**Title**: "Add OpenTelemetry instrumentation (27 files)"

The "27 files" in the title reflects files in the PR diff (committed + partial + some skips that have .instrumentation.md companion files), not the 30 files processed or 13 committed/partial. Slight ambiguity — the summary table in the body correctly states "10 committed, 3 partial, 17 no changes needed." Low priority finding; consistent with prior runs.

---

## PR Summary Quality

**Length**: 33,935 characters (~246 lines visible content)

### Accuracy Assessment

| Element | Accurate | Notes |
|---------|----------|-------|
| File counts (30 total / 10 committed / 3 partial / 17 no-changes) | YES | Matches run output exactly |
| Per-file span counts | YES | All 13 instrumented files correct |
| Per-file attempt counts | YES | Correct |
| Per-file cost | YES | Sum = $8.83 (slight variance from $8.60 estimate — likely rounding) |
| Correct skip list (17 files) | YES | All 17 listed correctly |
| Schema attribute additions (13 attrs) | YES | All 13 listed |
| Span extensions (39) | YES | All 39 listed |
| Token usage | YES | Input 250,810 / Output 360,582 / Cache read 644,153 / Cache write 660,203 |
| Auto-recommended libraries | YES | `@traceloop/instrumentation-langchain`, `@traceloop/instrumentation-mcp` |
| Model | YES | `claude-sonnet-4-6` |
| Span category breakdown | PARTIAL | Only shows 8 of 13 files; partial/multi-span files absent from breakdown table |

### Schema Changes Section

PR correctly includes both attribute additions (13 new) and span extensions (39). All 39 span IDs accurately listed. This continues the fix from RUN9-3 (schema changes section no longer omits span extensions).

### Span Category Breakdown

The table shows only 8 files (committed files with non-trivial span counts). Missing from the breakdown: `git-collector.js`, `summarize.js`, `auto-summarize.js` (committed), and all 3 partial files. This is an incomplete snapshot — a reviewer auditing the breakdown would miss the summarize.js and auto-summarize.js entries. Consistent behavior across prior runs; not a new regression.

### Advisory Findings Quality

52 advisory findings total. Breakdown:
- CDQ-007 (Attribute Data Quality): 32 findings
- SCH-001 (Span Names Match Registry): 14 findings
- COV-004 (Async Operation Spans): 6 findings
- CDQ-006 (isRecording Guard): ~3 findings (across summarize.js, summary-detector.js, auto-summarize.js)

#### CDQ-007 (32 findings) — Mixed accuracy

CDQ-007 fires for three distinct triggers: PII attribute names, raw filesystem paths, and unguarded property accesses. The advisory text groups all three together without distinguishing which fired.

| Trigger class | Valid? | Examples |
|--------------|--------|---------|
| PII on git-collector.js | VALID (advisory only — agent already omitted commit.author/email correctly) | `commit_story.commit.author` was omitted from getCommitData |
| Filesystem path on journal-paths/journal-manager | ADVISORY — known limitation from runs 16–18; path.basename not imported | `commit_story.journal.file_path` uses full path |
| Null-guard on `.length`/`.size` counts | FALSE POSITIVE — Map.size and Array.length are always numeric; no nullable access | `sessions_count`, `messages_count`, `entries_count` etc. |
| Null-guard on required parameters with defaults | FALSE POSITIVE — `commitRef` has `'HEAD'` default; `basePath` has `'.'` default | git-collector, index.js |

False-positive rate on CDQ-007 alone: ~25 of 32 (~78%) are null-guard false positives on numeric lengths or required parameters.

#### SCH-001 (14 findings) — Structural false positives

SCH-001 fires because the live-check validator sees span names not in the base `attributes.yaml` registry. All 14 are span extension names correctly declared in `semconv/agent-extensions.yaml`. The live-check does not load extension files, making this a systematic false positive across all extension spans. This is a known structural limitation (same as runs 11–18), not an agent quality issue.

**False positive rate**: 14/14 (100%). All are correctly registered extensions.

#### COV-004 (6 findings) — Partially valid

6 COV-004 advisories fire on files with async functions missing spans.

| File | Finding validity |
|------|----------------|
| context-capture-tool.js (inner `saveContext` callback) | ADVISORY — inner callback not exported; correct skip per rubric; structural observation |
| reflection-tool.js (inner `saveReflection` callback) | ADVISORY — same as above |
| summary-manager.js (`generateAndSave*` functions) | VALID — these ARE canonical COV-001/COV-004 failures identified in per-file evaluation |
| auto-summarize.js (`triggerAutoSummaries`) | VALID — canonical COV-001 failure |

**Valid COV-004 advisories**: 4 of 6. The two inner MCP handler findings are advisory (correct skip), the 4 partial-function findings are genuinely useful signals.

#### CDQ-006 (3 findings) — Partially valid

CDQ-006 fires for `span.setAttribute()` calls with expensive computations (filter, map, reduce) without `isRecording()` guards.

- `summarize.js` `runSummarize` — sets `entries_count` from `dates.length` (not a computation; false positive)
- `summary-detector.js` `findUnsummarizedDays` — the filter() result is captured to `result` first, then set on the span; the filter itself runs regardless of recording (valid if expensive on large datasets)
- `auto-summarize.js` — likely on a length/count setAttribute

Mixed: CDQ-006 findings on simple `.length` are false positives; the `findUnsummarizedDays` filter() case is a genuine advisory worth noting.

### Overall Advisory Accuracy

| Rule | Total | Valid | False Positive | Rate |
|------|-------|-------|----------------|------|
| CDQ-007 | 32 | ~7 | ~25 | ~78% FP |
| SCH-001 | 14 | 0 | 14 | 100% FP |
| COV-004 | 6 | 4 | 2 | 33% FP |
| CDQ-006 | 3 | ~1 | ~2 | ~67% FP |
| **Total** | **55** | **~12** | **~43** | **~78% FP** |

**Advisory contradiction rate**: ~78% — significantly higher than run-18's ~50% and run-12's ~44%. The increase is driven by the volume of new extension spans and attributes in run-19 triggering structural SCH-001 false positives, and the many new count attributes triggering CDQ-007 null-guard false positives.

---

## Cost

| Source | Amount |
|--------|--------|
| PR total | $8.83 |
| Run summary estimate | ~$8.60 |
| Run-18 | $9.16 |
| Delta vs run-18 | -$0.33 |
| Cost ceiling | $70.20 |

**$8.83** — second-lowest in the run-18/19 window. Cost reduction from run-18 is moderate (-$0.33). The three partial files (summary-manager.js $1.81, auto-summarize.js $1.12, summarize.js $1.40) drove the bulk of spend. Zero-cost pre-scan skips (17 files at $0.00) continue to anchor cost efficiency.

---

## Reviewer Utility Score

| Aspect | Score | Notes |
|--------|-------|-------|
| Completeness | 5/5 | All 30 files covered; schema changes accurate; token usage present |
| Accuracy | 4/5 | File-level data accurate; advisory findings ~78% false positive |
| Actionability | 3/5 | COV-004 and CDQ-006 findings partially useful; CDQ-007/SCH-001 noise is very high this run |
| Presentation | 4/5 | Clean markdown; tables well-formed; span breakdown table incomplete |
| **Overall** | **4.0/5** | Slight decline from run-18 (4.25/5) due to advisory noise increase |

---

## Notable Observations

1. **First fully automatic PR** — PRs for runs 3–10 required manual PAT pushes; run-18 required manual push after hook retry. Run-19 PR created with zero manual intervention. Issue #867 fix confirmed.

2. **Advisory noise increase** — 55 advisories vs run-18's reported 3,848 advisory findings in live-check (different granularity). The PR advisory section's 55 text-level findings have a high false-positive rate this run due to: (a) 39 new extension spans generating SCH-001 structural false positives, and (b) 13 new attributes generating CDQ-007 null-guard false positives on numeric lengths. This is expected when many new extensions are registered.

3. **COV-004 on partial functions correctly identified** — The advisory pass caught all 4 COV-004 misses on partial files (summary-manager.js × 3, auto-summarize.js × 1). These align with the canonical failures in the per-file evaluation. The advisory pass provides independent confirmation of the most important quality gaps.
