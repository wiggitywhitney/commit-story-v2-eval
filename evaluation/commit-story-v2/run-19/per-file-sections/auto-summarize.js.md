### 14. managers/auto-summarize.js (2 spans, 3 attempts — PARTIAL)

The file exports three async functions: `triggerAutoSummaries` (the top-level orchestrator), `triggerAutoWeeklySummaries`, and `triggerAutoMonthlySummaries`. The agent committed spans on two of the three: `trigger_auto_weekly_summaries` and `trigger_auto_monthly_summaries`. `triggerAutoSummaries` was skipped after three attempts because of an NDS-003 failure on the spread-array return expression at the bottom of that function. The spread expression — `failed: [...result.failed, ...weeklyResult.failed, ...monthlyResult.failed]` — appears at deeper indentation inside a reformatted return object, and the validator could not verify the original structure was preserved. `getErrorMessage` (unexported, sync) was correctly skipped per RST-001 and RST-004.

The two committed spans are structurally clean. Each follows the established pattern: `tracer.startActiveSpan` with an `async (span)` callback, `findUnsummarized*` called before the for-loop (result count setAttribute deferred until after the loop), inner per-item graceful-degradation catches preserved inside the span callback per NDS-005, and an outer `try/catch/finally` with `recordException`, `setStatus(ERROR)`, and `span.end()`. The inner for-loop catches accumulate failed items into `result.failed` and `result.errors` without rethrowing — this is intentional per the function's "continue past failures to maximize coverage" contract (NDS-007 does not apply here because accumulating without rethrowing is the documented behavior, not silent suppression). The agent elected not to instrument `getErrorMessage` because it is unexported and synchronous; RST-001 and RST-004 both apply.

Attribute choices on both spans are coherent. `triggerAutoWeeklySummaries` sets `commit_story.summary.unsummarized_weeks_count` at entry (before the loop), then `commit_story.summary.generated_count` and `commit_story.summary.failed_count` at the end of the loop body. `triggerAutoMonthlySummaries` mirrors the same pattern with `commit_story.summary.unsummarized_months_count`. All five attributes are registered in `agent-extensions.yaml`. The unsummarized count captures queue depth at span entry; generated and failed counts capture outcome at span exit — this ordering is correct and consistent with how summary-manager.js instruments similar patterns. No null guards are needed: `findUnsummarizedWeeks` and `findUnsummarizedMonths` return initialized arrays (verified by the function contract and usage in this file), and `.length` on an initialized array cannot be undefined.

The COV-001 gap is meaningful. `triggerAutoSummaries` is the primary top-level orchestrator that sequences the daily→weekly→monthly pipeline: it calls `findUnsummarizedDays`, drives the daily for-loop, short-circuits if daily failures occurred, then calls `triggerAutoWeeklySummaries` and `triggerAutoMonthlySummaries` in sequence, and assembles the combined result via spread. It is both an exported function and the entry point most callers will invoke. Its absence leaves the top of the pipeline dark: the unsummarized days count, the daily generated/failed counts, and the early-return failure-skip path are all unobservable. The two committed sub-spans (`trigger_auto_weekly_summaries` and `trigger_auto_monthly_summaries`) appear as root spans rather than children of an orchestrator span. This is a meaningful observability gap, not a structural detail miss.

The NDS-003 failure on attempt 3 was caused by the reformatted spread-array return object. The original return statement spans multiple lines:

```js
return {
  generated: [...result.generated, ...weeklyResult.generated, ...monthlyResult.generated],
  skipped: [...result.skipped, ...weeklyResult.skipped, ...monthlyResult.skipped],
  failed: [...result.failed, ...weeklyResult.failed, ...monthlyResult.failed],
  errors: [...result.errors, ...weeklyResult.errors, ...monthlyResult.errors],
};
```

The agent reformatted this to align items vertically at deeper indentation inside the `startActiveSpan` callback. The validator's offset-based comparator saw the reformatted layout as a structural change. This is the same NDS-003 reformatting class that has caused partial and failed instrumentation across multiple runs — the agent restructures multi-line expressions to match its internal indentation conventions, and the validator interprets line-count or offset shifts as content removal.

| Rule | Result |
|------|--------|
| NDS-003 | PASS (2 committed spans) — committed code passed validator; NDS-003 failure on `triggerAutoSummaries` was the skip reason |
| API-001 | PASS — `@opentelemetry/api` only (`trace`, `SpanStatusCode`) |
| NDS-006 | PASS — all JSDoc blocks and inline comments in the two instrumented functions preserved |
| NDS-004 | PASS — both committed function signatures unchanged |
| NDS-005 | PASS — inner for-loop graceful-degradation catches (accumulate to `result.failed`/`result.errors`) preserved inside `startActiveSpan` callbacks; both functions' "continue past failures" contracts intact |
| COV-001 | **PARTIAL** — `triggerAutoWeeklySummaries` and `triggerAutoMonthlySummaries` have spans; `triggerAutoSummaries` (primary orchestrator, daily pipeline, early-return failure-skip path) is missing due to NDS-003 skip |
| COV-003 | PASS — both committed spans have outer catch with `recordException` + `SpanStatusCode.ERROR` + rethrow in finally |
| COV-004 | PASS (for 2 instrumented functions) — `getErrorMessage` unexported and sync, correctly excluded per RST-001 and RST-004; `triggerAutoSummaries` not scored here (COV-001 PARTIAL covers the gap) |
| COV-005 | PASS — `unsummarized_weeks_count` / `unsummarized_months_count` at entry; `generated_count` / `failed_count` at exit; queue depth and outcome both captured on each committed span |
| RST-001 | PASS — `getErrorMessage` (unexported, sync) correctly skipped |
| RST-004 | PASS |
| SCH-001 | PASS — `commit_story.summary.trigger_auto_weekly_summaries` and `commit_story.summary.trigger_auto_monthly_summaries` declared as span extensions in `agent-extensions.yaml` |
| SCH-002 | PASS — all five attributes (`unsummarized_weeks_count`, `unsummarized_months_count`, `generated_count`, `failed_count`) registered in `agent-extensions.yaml`; no semantic collision |
| SCH-003 | PASS — all counts from `.length` (int); no type coercion needed |
| CDQ-001 | PASS — `span.end()` in `finally` on both committed spans |
| CDQ-002 | PASS — `startActiveSpan` callback pattern; no manual context propagation |
| CDQ-003 | PASS — no redundant `span.end()` |
| CDQ-005 | PASS — `startActiveSpan` with async callbacks |
| CDQ-007 | PASS — all setAttribute calls use `.length` on locally constructed arrays; no nullable field access |

**Failures**: COV-001 PARTIAL — `triggerAutoSummaries` (primary orchestrator) missing span due to NDS-003 skip on spread-array return expression. The two sub-function spans are complete and correct; the missing orchestrator span leaves the daily pipeline, early-return failure-skip path, and combined result assembly unobservable.
