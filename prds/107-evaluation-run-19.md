# PRD #19: JS Evaluation Run-19: commit-story-v2 — NDS-003 Content-Aware Diff Verification

**Status:** In Progress
**Created:** 2026-05-16
**GitHub Issue:** #107
**Depends on:** PRD #18 (run-18 complete, actionable fix output delivered to spiny-orb team)

---

## Problem Statement

Run-18 scored 24/25 (96%) with 11 committed files and a Q×F of 10.6 — improvement from run-17's 8.8 plateau. COV returned to 5/5. Three findings need verification in run-19:

1. **RUN18-1 (P1)** — NDS-003 reconciler gap: context-capture-tool.js (saveContext), reflection-tool.js (saveReflection), index.js (main()), and summary-graph.js all fail with the same offset calculation error when `startActiveSpan` wraps function bodies inside nested callbacks. Agent code is semantically correct in all cases; the validator cannot verify it. PRD #845 (content-aware diff) is the required fix — run-19 verifies whether it landed.

2. **RUN18-2 (P2)** — SCH-002 on journal-manager.js: `commit_story.journal.quotes_count` used for `reflections.length` (reflection file discovery count). The attribute is defined for AI-extracted journal quotes — a different operation class. Either a new schema attribute (`commit_story.journal.reflections_count`) or an explicit agent directive is needed.

3. **RUN18-3 (P2)** — Auto-push failure: `progress-md-pr.sh` pre-push hook creates a PROGRESS.md commit mid-push and exits non-zero. spiny-orb doesn't retry. Fix: detect "Push again to include it" in hook output and retry.

### Primary Goal

Verify that RUN18-1 (NDS-003 reconciler gap) is resolved:
- context-capture-tool.js commits `saveContext` with a span
- reflection-tool.js commits `saveReflection` with a span
- index.js commits `main()` with a span
- summary-graph.js commits with 6 spans
- NDS-003 gate passes (5/5 gates)

### Secondary Goals

- RUN18-2 verified: journal-manager.js `discoverReflections` uses correct attribute for reflection count (not `quotes_count`)
- journal-graph.js second data point: run-18 committed (4 spans, 2 attempts) after run-17 full failure — confirm structural fix vs one-off LLM variation
- Push behavior: does auto-push succeed, or does the hook-creates-commit issue (RUN18-3) persist?
- IS: maintain 90/100 (SPA-001 structural calibration mismatch — not a regression target)
- Tenth consecutive push/PR success expected

### Run-18 Scores (baseline for run-19 comparison)

| Dimension | Run-18 | Run-17 | Run-16 |
|-----------|--------|--------|--------|
| NDS | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| COV | **5/5 (100%)** | 3/5 (60%) | 3/5 (60%) |
| RST | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) |
| API | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| SCH | 3/4 (75%) | 3/4 (75%) | 4/4 (100%) |
| CDQ | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) |
| **Total** | **24/25 (96%)** | **22/25 (88%)** | **22/25 (88%)** |
| **Gates** | **5/5** | **4/5** | **5/5** |
| **Files** | **11** | **10+1p** | **10+3p** |
| **Cost** | **$9.16** | **$10.43** | **$12.29** |
| **Push/PR** | **YES (#70, manual)** | **YES (#69)** | **YES (#68)** |
| **IS** | **90/100** | **90/100** | **80/100** |
| **Q×F** | **10.6** | **8.8** | **8.8** |

### Unresolved from Prior Runs

| Item | Origin | Runs Open | Status |
|------|--------|-----------|--------|
| RUN18-1: NDS-003 reconciler gap (startActiveSpan in nested callbacks) | RUN17-1 | 2 runs | P1 — PRD #845 content-aware diff fix needed |
| RUN18-2: journal-manager.js SCH-002 (quotes_count semantic mismatch) | RUN18-2 | 1 run | P2 — new schema attribute or agent directive needed |
| RUN18-3: Auto-push failure (pre-push hook creates commit mid-push) | RUN18-3 | 1 run | P2 — spiny-orb retry logic needed |
| IS SPA-001: INTERNAL span count structural | RUN15-4 | 4 runs | Structural calibration mismatch |
| Advisory contradiction rate ~50% | RUN11-1 | 9 runs | SCH-001 false positives on extension spans |
| RUN17-5: Advisory pass rollback path unaudited | RUN17-5 | 2 runs | Low — issue #856 tracks; no confirmed test coverage |

---

## Solution Overview

Same four-phase structure as runs 5–18:

1. **Pre-run verification** — Verify RUN18-1, RUN18-2, RUN18-3 fixes landed
2. **Evaluation run** — Execute `spiny-orb instrument` on commit-story-v2
3. **Structured evaluation** — Per-file evaluation with per-agent methodology, including two user-facing checkpoints
4. **Process refinements** — Encode methodology changes, draft PRD #20

### Two-Repo Workflow

Same as runs 9–18.

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

1. Quality score of 24/25 or better (conservative: SCH-002 still open) or 25/25 (target: all P1/P2 fixes land)
2. context-capture-tool.js, reflection-tool.js, index.js, and summary-graph.js all commit with spans (RUN18-1 reconciler fix verified)
3. NDS-003 gate passes (5/5 gates)
4. At least 15 committed files (recovering from run-18's 11 — if 4 newly-unblocked files commit)
5. Push/PR succeeds (tenth consecutive)
6. Per-file span counts verified by post-hoc counting
7. All evaluation artifacts generated from canonical methodology (per-agent approach)
8. Both user-facing checkpoints completed (Findings Discussion + handoff pause)

---

## Milestones

- [x] **Read `docs/language-extension-plan.md` completely before proceeding with any other milestone.** Pay particular attention to step 9.5 (SPA-001 calibration note for commit-story-v2) and step 9 (IS scoring protocol). **Do not mark this complete until you have read both sections.**

- [x] **Collect skeleton documents** — Create `evaluation/commit-story-v2/run-19/` directory with `lessons-for-prd20.md` skeleton. Must run before pre-run verification step 12.

- [x] **Pre-run verification** — Verify spiny-orb fixes and validate run prerequisites:
  1. **Handoff triage review**: Read the spiny-orb team's triage of `evaluation/commit-story-v2/run-18/actionable-fix-output.md`. Check which issues were filed (RUN18-1: PRD #845 update; RUN18-2: schema attribute or agent directive; RUN18-3: push retry logic) and confirm their status.
  2. **RUN18-1 fix** (P1 — critical): Verify PRD #845 content-aware diff has landed. Check whether any reconciler changes address the `startActiveSpan` re-indentation offset inflation. If PRD #845 M2+ has regression fixtures for the `server.tool()` callback pattern (context-capture-tool.js lines 124–125) and the multi-function pattern (summary-graph.js line 485), confirm they pass. If PRD #845 has NOT landed, still proceed — run-19 will confirm the gap persists and add a third data point.
  3. **RUN18-2 fix** (P2): Verify that `commit_story.journal.reflections_count` has been added to the schema (or an explicit negative directive added to the prompt preventing `quotes_count` reuse for reflection discovery). Check `semconv/attributes.yaml` in commit-story-v2 and `src/agent/prompt.ts` in spiny-orb.
  4. **RUN18-3 fix** (P2): Check if spiny-orb's push logic handles the "Committed X update. Push again" hook pattern. If fixed, auto-push should succeed without manual intervention.
  5. **Other spiny-orb fixes since run-18**: Check spiny-orb main for any merged PRs relevant to commit-story-v2 evaluation.
  6. **Target repo readiness** (commit-story-v2): Verify on `main`, clean working tree, spiny-orb.yaml and semconv/ exist. Check for any staged .instrumentation.md files from run-18 (expected; spiny-orb will overwrite them).
  7. **Push auth stability check**: Verify token still works (dry-run push to non-existent branch).
  8. **File inventory**: Count .js files in commit-story-v2's `src/` directory (expect 30).
  9. Rebuild spiny-orb from **main**: `cd ~/Documents/Repositories/spinybacked-orbweaver && npm install && npm run build`
  10. Record version and findings status.
  11. **README check**: Verify `README.md` on main has rows for runs 15–18 in the commit-story-v2 run history table. If the table ends at run-14, the run-18 eval branch's README updates did not reach main yet — add the missing rows before the run.
  12. Append observations to `evaluation/commit-story-v2/run-19/lessons-for-prd20.md`.

- [x] **Evaluation run-19** — Whitney runs `spiny-orb instrument` in her own terminal. **Do NOT run the command yourself.** AI role: (1) confirm readiness with Whitney, (2) once Whitney provides the log output, save it to `evaluation/commit-story-v2/run-19/spiny-orb-output.log` and write `evaluation/commit-story-v2/run-19/run-summary.md`, (3) **if auto PR creation failed**, create the PR from the file spiny-orb already wrote to disk — do NOT write a shortened manual body: `gh pr create --body-file ~/Documents/Repositories/commit-story-v2/spiny-orb-pr-summary.md --repo wiggitywhitney/commit-story-v2 --head <instrument-branch> --title "..."`

  AI must create `evaluation/commit-story-v2/run-19/debug-dumps/` before handing Whitney the command.

  **Exact command** (run from `~/Documents/Repositories/commit-story-v2`):
  ```bash
  caffeinate -s env -u ANTHROPIC_CUSTOM_HEADERS -u ANTHROPIC_BASE_URL vals exec -i -f .vals.yaml -- node ~/Documents/Repositories/spinybacked-orbweaver/bin/spiny-orb.js instrument src --verbose --thinking --debug-dump-dir ~/Documents/Repositories/spinybacked-orbweaver-eval/evaluation/commit-story-v2/run-19/debug-dumps 2>&1 | tee ~/Documents/Repositories/spinybacked-orbweaver-eval/evaluation/commit-story-v2/run-19/spiny-orb-output.log
  ```

  **After saving artifacts and committing, push the eval branch to origin immediately** (`git push -u origin <eval-branch>`). The branch holds the only copy of run-19 artifacts until the "Copy artifacts to main" milestone runs — do not leave it local-only.

- [ ] **Findings Discussion** *(user-facing checkpoint 1)* — After `run-summary.md` is written, before any evaluation documents are started: report to Whitney: (1) files committed / failed / partial, (2) whether any checkpoint failures occurred, (3) RUN18-1 fix result — specifically whether context-capture-tool.js, reflection-tool.js, index.js, and summary-graph.js all committed with spans, (4) RUN18-2 result — whether journal-manager.js `discoverReflections` used a correct attribute for reflection count, (5) journal-graph.js result — did it commit again (2nd consecutive) or regress?, (6) quality score if visible, (7) cost, (8) push/PR status (auto or manual?), (9) overall attempt-count distribution (D-1 signal). Keep it conversational, under 10 lines. Wait for acknowledgment before proceeding.

- [x] **Failure deep-dives** — For each failed file AND run-level failure. Includes any partial files.
  Produces: `evaluation/commit-story-v2/run-19/failure-deep-dives.md`
  Style reference: `Read docs/templates/eval-run-style-reference/failure-deep-dives.md`

- [x] **Per-file evaluation** — Full rubric on ALL files (no spot-checking). Evaluate all rules across all committed and partial files.
  Produces: `evaluation/commit-story-v2/run-19/per-file-evaluation.md`
  Style reference: `Read docs/templates/eval-run-style-reference/per-file-evaluation.md`

  **(D-2) Use one agent per file**: Spawn one agent per file in parallel; each agent reads style reference, `evaluation/commit-story-v2/run-18/per-file-evaluation.md` (for rule descriptions), original source (`git show main:src/file`), committed source (`git show <instrument-branch>:src/file`), agent notes from log, debug dump if applicable, and schema (`semconv/attributes.yaml`); each writes its section to `evaluation/commit-story-v2/run-19/per-file-sections/<filename>.md`; main context assembles into per-file-evaluation.md. Correct-skip files: one batch agent for RST-001 verification.

  **(D-1) Track attempt counts**: For each file, note attempts. Assess whether ≥2-attempt files show better quality (real fixes) vs noise (formatting churn).

- [ ] **PR artifact evaluation** — Evaluate PR quality.
  Produces: `evaluation/commit-story-v2/run-19/pr-evaluation.md`
  Style reference: `Read docs/templates/eval-run-style-reference/pr-evaluation.md`

- [ ] **Rubric scoring** — Synthesize dimension-level scores.
  Produces: `evaluation/commit-story-v2/run-19/rubric-scores.md`
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
  5. **Claude runs** the scorer: `node evaluation/is/score-is.js evaluation/is/eval-traces.json > evaluation/commit-story-v2/run-19/is-score.md`
  6. **Claude runs**: `datadog-agent start`
  Produces: `evaluation/commit-story-v2/run-19/is-score.md`

- [ ] **Baseline comparison** — Compare run-19 vs runs 2–18.
  Produces: `evaluation/commit-story-v2/run-19/baseline-comparison.md`
  Style reference: `Read docs/templates/eval-run-style-reference/baseline-comparison.md`

- [ ] **Update root README** — After baseline comparison, update `README.md`: (1) add a row for run-19 to the run history table (quality, gates, files, spans, cost, push/PR, IS score); (2) update the "next run" sentence to reference run-20 and its primary goals.

- [ ] **Actionable fix output** — Primary handoff deliverable. At milestone completion:
  1. Run the cross-document audit agent to verify consistency across all run-19 evaluation artifacts.
  2. *(User-facing checkpoint 2)* Give Whitney an interpreted summary of key findings — failures, root causes, notable patterns, what to watch for in run-20.
  3. Print the absolute file path of `evaluation/commit-story-v2/run-19/actionable-fix-output.md`.
  4. **Pause.** Do not proceed to Draft PRD #20 until Whitney confirms she has handed the document off to the spiny-orb team.

- [ ] **Draft PRD #20** — Create on a separate branch from main. Merge the PRD PR to main so `/prd-start` can pick it up. Carry forward both user-facing checkpoints into PRD #20's milestone structure. IS scoring milestone must use the same format as this PRD's IS scoring milestone. Per-file evaluation milestone must specify the D-2 per-agent approach.

- [ ] **Copy artifacts to main** — From main, run `git checkout <eval-branch> -- evaluation/commit-story-v2/run-19/` to copy all artifacts. Commit to main with message `eval: save run-19 artifacts to main [skip ci]`. Add one row to `evaluation/commit-story-v2/run-log.md` for run-19 and commit with `eval: update run-log for run-19 [skip ci]`. Push main. This step runs before `/prd-done` so the artifacts land on main while the eval branch is still reachable.

---

## Decision Log

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|

---

## Score Projections for Run-19

**If PRD #845 lands and resolves RUN18-1:**
- Conservative: 24/25, 15 files (4 newly-unblocked + 11 from run-18), Q×F ≈ 14.4
- Target: 25/25, 15 files, Q×F = 15.0 (perfect quality + all files commit)
- Journal-graph.js: expect commit (2nd consecutive confirms structural fix)

**If PRD #845 has NOT landed (same reconciler gap persists):**
- Conservative: 24/25, 11 files, Q×F ≈ 10.6 (same as run-18, with potential SCH-002 fix)
- 4 files continue to fail for a third run; PRD #845 M1 trigger condition would be met (3 examples)
