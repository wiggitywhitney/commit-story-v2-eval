### 13. managers/summary-manager.js (6 spans, 2 attempts — PARTIAL)

This is a regression from run-18, which achieved full COV-004 coverage with 9 spans across all 9 exported async functions. Run-19 committed only 6 spans — the 6 read/save helpers — while all 3 `generateAndSave*` orchestrators were skipped due to NDS-003 violations on attempt 2.

The root cause differs across all three skipped functions. `generateAndSaveDailySummary` triggered NDS-003 on its return object literal (multi-line reformatted to deeper indentation inside `startActiveSpan`). `generateAndSaveWeeklySummary` had an NDS-003 violation on a formatted multi-line argument expression. `generateAndSaveMonthlySummary` had an NDS-003 violation on the `basePath` argument line. In all three cases, the agent attempted function-level instrumentation (the fallback strategy for this run) but the NDS-003 validator rejected the result on both attempts. The agent correctly reported these as NDS-003 skips and committed only the passing 6 spans.

This is the worst outcome for COV-001: the 3 skipped functions are the primary exported async orchestrators that the `commands/summarize.js` callers depend on. The read/save helpers they call (readDayEntries, saveDailySummary, readWeekDailySummaries, saveWeeklySummary, readMonthWeeklySummaries, saveMonthlySummary) all have spans, so the instrumented layer is the I/O substrate — but the top-level pipeline entry points that coordinate LangGraph calls and control the full daily/weekly/monthly flow have no spans. An operator looking at traces would see I/O activity without the orchestration context that ties it together.

The trajectory for this file is: 3 spans (run-12) → 6 spans (run-17) → 9 spans (run-18, full coverage) → 6 spans (run-19, regression). Run-18 solved this file by using file-level instrumentation that preserved the multi-line signatures verbatim. Run-19's function-level fallback approach could not handle the body complexity of the orchestrators, and the validator rejected both attempts for each.

The 6 committed spans are well-constructed. `readDayEntries` sets `commit_story.journal.entry_date`, `commit_story.journal.file_path`, and `commit_story.journal.entries_count`. `saveDailySummary` sets `commit_story.journal.entry_date` and `commit_story.journal.file_path`. `readWeekDailySummaries` sets `commit_story.summary.week_label` and `commit_story.summary.entries_count`. `saveWeeklySummary` sets `commit_story.summary.week_label` and `commit_story.journal.file_path`. `readMonthWeeklySummaries` sets `commit_story.summary.month_label` and `commit_story.summary.entries_count`. `saveMonthlySummary` sets `commit_story.summary.month_label` and `commit_story.journal.file_path` (set post-write, before span end). All 6 use the correct try/catch/finally pattern with `recordException`, `setStatus(ERROR)`, and rethrow.

`commit_story.summary.entries_count` is used for all three pipeline levels (daily, weekly, monthly) as the count of items read — appropriate reuse of a schema-defined integer attribute across the read functions. The attribute correctly reflects `summaries.length` on fully-initialized arrays, so CDQ-007 null-guard concerns do not apply.

The CDQ-007 note from the agent log about `summaryPath` using the full path without importing `basename` is a commentary on a COV-005 limitation — the agent set the full path, which is valid for `commit_story.journal.file_path` (the schema defines it as an output file path). No import change was required.

The 5 sync functions (formatDailySummary, formatWeeklySummary, formatMonthlySummary, getWeekBoundaries, getMonthBoundaries) are all correctly skipped per RST-001.

| Rule | Result |
|------|--------|
| NDS-003 | PASS for 6 committed spans — all committed bodies accepted by validator; FAIL was the reason for the 3 skips, not a committed violation |
| NDS-004 | PASS — parameter lists preserved verbatim on all 6 committed functions |
| NDS-005 | PASS — ENOENT-swallowing catch blocks (readFile, access, readdir) all preserved in committed functions |
| NDS-006 | PASS — all inline comments preserved in committed functions |
| API-001 | PASS — `@opentelemetry/api` only; `SpanStatusCode` and `trace` imported correctly |
| COV-001 | PARTIAL — 3 of 6 exported async orchestrators missing spans; read/save helpers covered but primary pipeline entry points (generateAndSaveDailySummary, generateAndSaveWeeklySummary, generateAndSaveMonthlySummary) not instrumented |
| COV-003 | PASS for 6 committed spans — all have try/catch/finally with recordException + ERROR status + rethrow |
| COV-004 | PARTIAL — 6 of 9 exported async functions covered; 3 skipped due to NDS-003 on both attempts; 5 sync helpers correctly skipped per RST-001 |
| COV-005 | PASS for committed spans — date/path/count attributes on read and save functions; schema-appropriate selections |
| RST-001 | PASS — formatDailySummary, formatWeeklySummary, formatMonthlySummary, getWeekBoundaries, getMonthBoundaries all correctly skipped |
| RST-004 | PASS — no unexported async functions in this file |
| SCH-001 | PASS — span names registered under commit_story.summary.* and commit_story.journal.* namespaces |
| SCH-002 | PASS — commit_story.summary.entries_count (int), week_label/month_label (string), journal.entry_date (string), journal.file_path (string) all correctly typed per schema |
| SCH-003 | PASS — entries_count set from .length (int); label arguments are string type; date converted via .toISOString().split('T')[0] |
| CDQ-001 | PASS |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-007 | PASS — counts from .length on initialized arrays; label strings are required arguments; no nullable field access in setAttribute calls |

**Failures**: COV-001 PARTIAL, COV-004 PARTIAL — 3 of 9 exported async functions missing spans (generateAndSaveDailySummary, generateAndSaveWeeklySummary, generateAndSaveMonthlySummary) due to NDS-003 on function-level fallback strategy. Regression from run-18's complete 9-span coverage.
