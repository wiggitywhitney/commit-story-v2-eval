# PRD #20: JS Evaluation Run-20: commit-story-v2 — NDS-003 Indentation Formatter Fix Verification

**Status:** Ready
**Created:** 2026-05-27
**GitHub Issue:** #109
**Depends on:** PRD #19 (run-19 complete, actionable fix output delivered to spiny-orb team)

---

## Problem Statement

Run-19 scored 21/25 (84%) with 10 committed files and a Q×F of 8.4 — a regression from run-18's 24/25 (96%) driven by a new NDS-003 false-positive class. Three findings need verification in run-20:

1. **RUN19-1 (P1)** — NDS-003 indentation-driven Prettier reformatting: when `startActiveSpan` wrapping moves function body lines to a deeper indentation level, lines near Prettier's 80-character print width reformat differently. This blocked `generateAndSaveDailySummary`, `generateAndSaveWeeklySummary`, `generateAndSaveMonthlySummary` in summary-manager.js (regression from 9 spans to 6); `triggerAutoSummaries` in auto-summarize.js; and caused claude-collector.js to commit via function-level fallback with NDS-003 at reassembly. PRD #885 (multiLine flag normalization) is the fix — run-20 verifies whether it landed.

2. **RUN19-2 (P2)** — COV-005 attribute thinning on git-collector.js `getCommitData`: only `vcs.ref.head.revision` (input parameter) is set; `commit_story.commit.message`, `commit_story.commit.timestamp`, and other output attributes absent. Run-18 set 4 attributes. Fix requires prompt guidance and potentially new schema attributes (`commit_story.git.is_merge`, `commit_story.git.parent_count`, `commit_story.git.command`).

3. **RUN19-3 (P2)** — IS SPA-002 orphan span: span `b48fbc5f` references parent `30d70fca` absent from the trace. Root cause: missing `generateAndSave*` orchestrator spans create context propagation gaps in auto-instrumented LangChain calls. Expected to resolve automatically if RUN19-1 fix lands.

### Primary Goal

Verify that RUN19-1 (NDS-003 indentation-driven Prettier reformatting) is resolved:
- summary-manager.js commits `generateAndSaveDailySummary`, `generateAndSaveWeeklySummary`, `generateAndSaveMonthlySummary` with spans (restoring run-18's 9-span coverage)
- auto-summarize.js commits `triggerAutoSummaries` with a span
- claude-collector.js commits cleanly without reassembly NDS-003 failure
- COV dimension recovers to ≥ 4/5

### Secondary Goals

- RUN19-2 verified: git-collector.js `getCommitData` sets output attributes (`commit_story.commit.message` and/or `commit_story.commit.timestamp`, or new schema extensions)
- IS SPA-002: orphan span absent from run-20 trace (expected consequence of RUN19-1 fix)
- SCH-002 watch: does journal-manager.js `discoverReflections` still use `commit_story.journal.quotes_count`? Three consecutive runs would confirm the directive is insufficient
- journal-graph.js: fourth consecutive success expected
- Q×F target ≥ 12.0 if generateAndSave* functions commit (24/25 × 14+ files)

### Run-19 Scores (baseline for run-20 comparison)

| Dimension | Run-19 | Run-18 | Run-17 |
|-----------|--------|--------|--------|
| NDS | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| COV | **2/5 (40%)** | 5/5 (100%) | 3/5 (60%) |
| RST | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) |
| API | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| SCH | 3/4 (75%) | 3/4 (75%) | 3/4 (75%) |
| CDQ | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) |
| **Total** | **21/25 (84%)** | **24/25 (96%)** | **22/25 (88%)** |
| **Gates** | **5/5** | **5/5** | **4/5** |
| **Files** | **10+3p** | **11** | **10+1p** |
| **Cost** | **$8.83** | **$9.16** | **$10.43** |
| **Push/PR** | **YES (#71, AUTO)** | **YES (#70, manual)** | **YES (#69)** |
| **IS** | **80/100** | **90/100** | **90/100** |
| **Q×F** | **8.4** | **10.6** | **8.8** |

### Unresolved from Prior Runs

| Item | Origin | Runs Open | Status |
|------|--------|-----------|--------|
| RUN19-1: NDS-003 indentation-driven Prettier reformatting | RUN19-1 | 1 run | P1 — PRD #885 multiLine flag fix needed |
| RUN19-2: git-collector.js COV-005 (getCommitData missing output attributes) | RUN19-2 | 1 run | P2 — prompt guidance + schema extensions needed |
| RUN18-2: journal-manager.js SCH-002 (quotes_count semantic mismatch) | RUN18-2 | 2 runs | P2 — explicit schema attribute needed |
| IS SPA-001: INTERNAL span count structural | RUN15-4 | 5 runs | Structural calibration mismatch; not a regression target |
| IS SPA-002: orphan span (partial instrumentation context gap) | RUN19-3 | 1 run | P2 — expected to resolve if RUN19-1 fix lands |

---

## Solution Overview

Same four-phase structure as runs 5–19:

1. **Pre-run verification** — Verify RUN19-1, RUN19-2, and SCH-002 fixes landed
2. **Evaluation run** — Execute `spiny-orb instrument` on commit-story-v2
3. **Structured evaluation** — Per-file evaluation with per-agent methodology, including two user-facing checkpoints
4. **Process refinements** — Encode methodology changes, draft PRD #21

### Two-Repo Workflow

Same as runs 9–19.

| Repo | Path | Role |
|------|------|------|
| **commit-story-v2** (target) | `~/Documents/Repositories/commit-story-v2` | spiny-orb instruments this repo |
| **spinybacked-orbweaver-eval** (evaluation) | `~/Documents/Repositories/spinybacked-orbweaver-eval` | Evaluation artifacts live here |
| **spinybacked-orbweaver** (agent) | `~/Documents/Repositories/spinybacked-orbweaver` | The spiny-orb agent |

### Eval Branch Convention

This PRD document merges to `main` so `/prd-start` can pick it up.

The **evaluation execution branch** created by `/prd-start` from main **never merges to main**. Before closing with `/prd-done`, run the "Copy artifacts to main" milestone. When `/prd-done` runs at completion, close the issue without merging or deleting the eval branch.

---

## Success Criteria

1. COV recovers to ≥ 4/5 — `generateAndSave*` and `triggerAutoSummaries` commit with spans
2. Quality score ≥ 24/25 (96%) if RUN19-1 fix lands; 21/25 (84%) if not (same as run-19)
3. IS SPA-002 orphan span absent from run-20 trace
4. At least 14 committed files if partial functions resolve
5. Push/PR succeeds automatically (eleventh consecutive)
6. Per-file span counts verified by post-hoc counting
7. All evaluation artifacts generated from canonical methodology (per-agent approach)
8. Both user-facing checkpoints completed (Findings Discussion + handoff pause)

---

## Milestones

- [x] **Read `docs/language-extension-plan.md` completely before proceeding with any other milestone.** Pay particular attention to step 9.5 (SPA-001 calibration note for commit-story-v2) and step 9 (IS scoring protocol). **Do not mark this complete until you have read both sections.**

- [x] **Collect skeleton documents** — Create `evaluation/commit-story-v2/run-20/` directory with `lessons-for-prd21.md` skeleton. Must run before pre-run verification step 12.

- [x] **Pre-run verification** — Verify spiny-orb fixes and validate run prerequisites:
  1. **Handoff triage review**: Read the spiny-orb team's triage of `evaluation/commit-story-v2/run-19/actionable-fix-output.md`. Check which issues were filed and confirm their status.
  2. **RUN19-1 fix** (P1 — critical): Verify PRD #885 (NDS-003 multiLine flag normalization) has landed. Check `checkNonInstrumentationDiffNormalized` in `src/languages/javascript/rules/nds003.ts` — does it reset `multiLine: false` on `ObjectLiteralExpression` and `ArrayLiteralExpression` nodes before Prettier runs? If PRD #885 has regression fixtures for the return-object-literal and spread-array patterns from run-19 debug dumps, confirm they pass. If PRD #885 has NOT landed, still proceed — run-20 will confirm the gap persists.
  3. **RUN19-2 fix** (P2): Verify prompt guidance for `getCommitData` has been updated to require `commit_story.commit.message` (with `isRecording()` guard) and `commit_story.commit.timestamp`. Check whether new schema attributes (`commit_story.git.is_merge`, `commit_story.git.parent_count`, `commit_story.git.command`) were added to `semconv/attributes.yaml` in the **target repo** (`~/Documents/Repositories/commit-story-v2/semconv/attributes.yaml`) — these attributes go in the target fork, not in spiny-orb.
  4. **RUN18-2 fix watch** (P2 — third run watch): Check for an explicit negative directive for `commit_story.journal.quotes_count` in `src/agent/prompt.ts` (must state: restricted to AI-extracted journal quote context, must not be used for reflection discovery file counts), OR check if `commit_story.journal.reflections_count` has been added to the commit-story-v2 schema. Two consecutive runs without fix — if a third occurs, prompt change is clearly insufficient alone.
  5. **Other spiny-orb fixes since run-19**: Check spiny-orb main for any merged PRs relevant to commit-story-v2 evaluation.
  6. **Target repo readiness** (commit-story-v2): Verify on `main`, clean working tree, spiny-orb.yaml and semconv/ exist. Check for staged .instrumentation.md files from run-19 (expected; spiny-orb will overwrite them).
  7. **Push auth stability check**: Verify token still works (dry-run push to non-existent branch).
  8. **File inventory**: Count .js files in commit-story-v2's `src/` directory (expect 30).
  9. Rebuild spiny-orb from **main**: `cd ~/Documents/Repositories/spinybacked-orbweaver && npm install && npm run build`
  10. Record version and findings status.
  11. **README check**: Verify `README.md` on main has rows for runs 15–19 in the commit-story-v2 run history table.
  12. Append observations to `evaluation/commit-story-v2/run-20/lessons-for-prd21.md`.

- [ ] **Evaluation run-20** — Whitney runs `spiny-orb instrument` in her own terminal. **Do NOT run the command yourself.** AI role: (1) confirm readiness with Whitney, (2) once Whitney provides the log output, save it to `evaluation/commit-story-v2/run-20/spiny-orb-output.log` and write `evaluation/commit-story-v2/run-20/run-summary.md`, (3) **if auto PR creation failed**, create the PR from the file spiny-orb already wrote to disk — do NOT write a shortened manual body: `gh pr create --body-file ~/Documents/Repositories/commit-story-v2/spiny-orb-pr-summary.md --repo wiggitywhitney/commit-story-v2 --head <instrument-branch> --title "..."`

  `evaluation/commit-story-v2/run-20/debug-dumps/` already exists. Do not attempt to create it again.

  **Exact command** (run from `~/Documents/Repositories/commit-story-v2`):
  ```bash
  caffeinate -s env -u ANTHROPIC_CUSTOM_HEADERS -u ANTHROPIC_BASE_URL vals exec -i -f .vals.yaml -- node ~/Documents/Repositories/spinybacked-orbweaver/bin/spiny-orb.js instrument src --verbose --thinking --debug-dump-dir ~/Documents/Repositories/spinybacked-orbweaver-eval/evaluation/commit-story-v2/run-20/debug-dumps 2>&1 | tee ~/Documents/Repositories/spinybacked-orbweaver-eval/evaluation/commit-story-v2/run-20/spiny-orb-output.log
  ```

  **After saving artifacts and committing, push the eval branch to origin immediately** (`git push -u origin <eval-branch>`). The branch holds the only copy of run-20 artifacts until the "Copy artifacts to main" milestone runs — do not leave it local-only.

- [ ] **Findings Discussion** *(user-facing checkpoint 1)* — After `run-summary.md` is written, before any evaluation documents are started: report to Whitney: (1) files committed / failed / partial, (2) whether any checkpoint failures occurred, (3) RUN19-1 fix result — specifically whether summary-manager.js `generateAndSave*` and auto-summarize.js `triggerAutoSummaries` all committed with spans, (4) RUN19-2 result — whether `getCommitData` sets output attributes beyond the input revision, (5) SCH-002 watch — did journal-manager.js use `quotes_count` again?, (6) journal-graph.js result — fourth consecutive?, (7) quality score if visible, (8) cost, (9) push/PR status (auto or manual?), (10) overall attempt-count distribution (D-1 signal). Keep it conversational, under 10 lines. Wait for acknowledgment before proceeding.

- [ ] **Failure deep-dives** — For each failed file AND run-level failure. Includes any partial files.
  Produces: `evaluation/commit-story-v2/run-20/failure-deep-dives.md`
  Style reference: `Read docs/templates/eval-run-style-reference/failure-deep-dives.md`

- [ ] **Per-file evaluation** — Full rubric on ALL files (no spot-checking). Evaluate all rules across all committed and partial files.
  Produces: `evaluation/commit-story-v2/run-20/per-file-evaluation.md`
  Style reference: `Read docs/templates/eval-run-style-reference/per-file-evaluation.md`

  **(D-2) Use one agent per file**: Spawn one agent per file in parallel; each agent reads style reference, `evaluation/commit-story-v2/run-19/per-file-evaluation.md` (for rule descriptions), original source (`git show main:src/file`), committed source (`git show <instrument-branch>:src/file`), agent notes from log, debug dump if applicable, and schema (`semconv/attributes.yaml`); each writes its section to `evaluation/commit-story-v2/run-20/per-file-sections/<filename>.md`; main context assembles into per-file-evaluation.md. Correct-skip files: one batch agent for RST-001 verification.

  **(D-1) Track attempt counts**: For each file, note attempts. Assess whether ≥2-attempt files show better quality (real fixes) vs noise (formatting churn).

- [ ] **PR artifact evaluation** — Evaluate PR quality.
  Produces: `evaluation/commit-story-v2/run-20/pr-evaluation.md`
  Style reference: `Read docs/templates/eval-run-style-reference/pr-evaluation.md`

- [ ] **Rubric scoring** — Synthesize dimension-level scores.
  Produces: `evaluation/commit-story-v2/run-20/rubric-scores.md`
  Style reference: `Read docs/templates/eval-run-style-reference/rubric-scores.md`

- [ ] **IS scoring run** — Follow `docs/language-extension-plan.md` step 9. Full protocol in `evaluation/is/README.md` (commit-story-v2 section).

  1. **Claude runs**: `datadog-agent stop`
  2. **Claude starts** the OTel Collector in the background:
     ```bash
     docker run --rm -d --name otelcol-is -w /etc/otelcol -p 4318:4318 --user "$(id -u):$(id -g)" -v /Users/whitney.lee/Documents/Repositories/spinybacked-orbweaver-eval/evaluation/is:/etc/otelcol otel/opentelemetry-collector-contrib:latest --config /etc/otelcol/otelcol-config.yaml
     ```
  3. **Claude checks out** instrument files and runs the app from `~/Documents/Repositories/commit-story-v2`:
     ```bash
     git checkout spiny-orb/instrument-XXXXXXXXXX -- src/ examples/
     OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces env -u ANTHROPIC_CUSTOM_HEADERS -u ANTHROPIC_BASE_URL vals exec -i -f .vals.yaml -- node --import ./examples/instrumentation.js src/index.js HEAD
     git checkout main -- src/ examples/
     ```
     Note: omit `COMMIT_STORY_TRACELOOP=true` — `@traceloop/instrumentation-langchain` API incompatibility crashes the process. See `evaluation/is/README.md`.
  4. **Claude stops** the Collector: `docker stop otelcol-is`
  5. **Claude runs** the scorer: `node evaluation/is/score-is.js evaluation/is/eval-traces.json > evaluation/commit-story-v2/run-20/is-score.md`
  6. **Claude runs**: `datadog-agent start`
  Produces: `evaluation/commit-story-v2/run-20/is-score.md`

- [ ] **Baseline comparison** — Compare run-20 vs runs 2–19.
  Produces: `evaluation/commit-story-v2/run-20/baseline-comparison.md`
  Style reference: `Read docs/templates/eval-run-style-reference/baseline-comparison.md`

- [ ] **Update root README** — After baseline comparison, update `README.md`: (1) add a row for run-20 to the run history table (quality, gates, files, spans, cost, push/PR, IS score); (2) update the "next run" sentence to reference run-21 and its primary goals.

- [ ] **Actionable fix output** — Primary handoff deliverable. At milestone completion:
  1. Run the cross-document audit agent to verify consistency across all run-20 evaluation artifacts.
  2. *(User-facing checkpoint 2)* Give Whitney an interpreted summary of key findings — failures, root causes, notable patterns, what to watch for in run-21.
  3. Print the absolute file path of `evaluation/commit-story-v2/run-20/actionable-fix-output.md`.
  4. **Pause.** Do not proceed to Draft PRD #21 until Whitney confirms she has handed the document off to the spiny-orb team.

- [ ] **Draft PRD #21** — Create on a separate branch from main. Merge the PRD PR to main so `/prd-start` can pick it up. Carry forward both user-facing checkpoints into PRD #21's milestone structure. IS scoring milestone must use the same format as this PRD's IS scoring milestone. Per-file evaluation milestone must specify the D-2 per-agent approach.

- [ ] **Copy artifacts to main** — From main, run `git checkout <eval-branch> -- evaluation/commit-story-v2/run-20/` to copy all artifacts. Commit to main with message `eval: save run-20 artifacts to main [skip ci]`. Add one row to `evaluation/commit-story-v2/run-log.md` for run-20 and commit with `eval: update run-log for run-20 [skip ci]`. Push main. This step runs before `/prd-done` so the artifacts land on main while the eval branch is still reachable.

---

## Decision Log

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|

---

## Score Projections for Run-20

**If PRD #885 lands and resolves RUN19-1:**
- COV recovers to 4/5 or 5/5 (generateAndSave* × 3, triggerAutoSummaries commit)
- Conservative: 23/25 (92%), 14 files — COV-005 still open on getCommitData → 1 SCH+COV failure
- Target: 24/25 (96%), 14 files — if COV-005 also fixed → Q×F = 24/25 × 14 = 13.4 (matching run-15 record)
- SCH-002 on journal-manager.js persists unless explicit schema attribute added: 24/25 vs 25/25

**If PRD #885 has NOT landed (same patterns persist):**
- COV stays at 2/5; generateAndSave* and triggerAutoSummaries continue to fail
- Conservative: 21/25 (84%), same as run-19 — Q×F ≈ 8.4 (flat from run-19)
