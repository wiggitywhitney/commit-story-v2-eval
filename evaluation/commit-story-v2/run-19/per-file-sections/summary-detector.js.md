### 10. utils/summary-detector.js (9 spans, 1 attempt)

All 9 async functions instrumented — 5 exported (`getDaysWithEntries`, `findUnsummarizedDays`, `getDaysWithDailySummaries`, `findUnsummarizedWeeks`, `findUnsummarizedMonths`) and 4 unexported helpers (`getSummarizedDays`, `getSummarizedWeeks`, `getSummarizedMonths`, `getWeeksWithWeeklySummaries`). This is the highest single-file span count in run-19, and resolves the run-12 partial (2 exported functions missed due to API overload). 1-attempt success, identical outcome to run-18.

**Structural fidelity** is excellent. The two sync utilities (`getTodayString`, `getNowDate`) are correctly excluded per RST-001. All JSDoc blocks and inline comments are preserved verbatim. The inner `readdir` try/catch blocks that return empty arrays or Sets on directory-not-found errors are preserved unmodified inside the span callbacks — the agent correctly identified these as graceful-degradation paths (NDS-005). Every span follows the canonical try/catch/finally pattern: `recordException` + `SpanStatusCode.ERROR` on failure, `span.end()` in `finally`, error rethrow. The return-value capture pattern in `findUnsummarizedDays` is correctly applied: the filter result is assigned to `result` before the `setAttribute` call, then `result` is returned — avoiding the premature-return-before-setAttribute pitfall.

**COV-004 for the four unexported helpers** is well-reasoned. Each helper is the sole I/O source for a distinct exported caller: `getSummarizedDays` is called only by `findUnsummarizedDays`; `getSummarizedWeeks` only by `findUnsummarizedWeeks`; `getSummarizedMonths` only by `findUnsummarizedMonths`; `getWeeksWithWeeklySummaries` only by `findUnsummarizedMonths`. Because each helper's `readdir` call is the primary I/O for that data class and is not duplicated in the exported caller's span, each helper's span captures independent, non-redundant trace data. The RST-004 permissive reading (standalone I/O in unexported functions) applies correctly.

**SCH-002 requires scrutiny.** The instrumented file introduces seven new attribute keys: `commit_story.journal.entries_count` (on `getDaysWithEntries`), `commit_story.summary.entries_count` (on `getSummarizedDays` and `getDaysWithDailySummaries`), `commit_story.summary.weeks_count` (on `getSummarizedWeeks` and `getWeeksWithWeeklySummaries`), `commit_story.summary.months_count` (on `getSummarizedMonths`), `commit_story.summary.unsummarized_days_count` (on `findUnsummarizedDays`), `commit_story.summary.unsummarized_weeks_count` (on `findUnsummarizedWeeks`), and `commit_story.summary.unsummarized_months_count` (on `findUnsummarizedMonths`). None appear in `semconv/attributes.yaml`. The agent notes confirm three as new (`unsummarized_days_count`, `unsummarized_weeks_count`, `unsummarized_months_count`) but do not explicitly mention the other four. SCH-002 is ADVISORY pending confirmation that all seven are declared as extensions — consistent with run-18, which passed SCH-002 for the same file with the same attribute keys.

**Attribute reuse** is semantically sound. `commit_story.summary.entries_count` is reused on two spans (`getSummarizedDays` returning a `Set<string>`, `getDaysWithDailySummaries` returning `string[]`), but both functions scan the same directory and count daily summary files — the reuse is coherent. Similarly, `commit_story.summary.weeks_count` appears on both `getSummarizedWeeks` (Set size) and `getWeeksWithWeeklySummaries` (array length), both counting weekly summary files. No CDQ-007 concerns: all attributes are set from locally constructed collections with known type and no nullable access.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — original business logic preserved throughout; only span scaffolding added |
| NDS-004 | PASS — no function signatures altered; `import { trace, SpanStatusCode }` and `const tracer` are the only additions at module level |
| NDS-005 | PASS — all inner `readdir` try/catch graceful-degradation blocks preserved unmodified inside `startActiveSpan` callbacks |
| NDS-006 | PASS — all JSDoc blocks and inline comments preserved |
| API-001 | PASS — `@opentelemetry/api` only; `trace` and `SpanStatusCode` imported correctly |
| COV-001 | PASS — all 5 exported async functions have entry-point spans |
| COV-003 | PASS — every span has outer try/catch/finally with `recordException` + `ERROR` + rethrow; inner graceful-degradation catches are NDS-005 preserved originals, not instrumentation catches |
| COV-004 | PASS — all 9 async functions instrumented; 4 unexported helpers qualify per RST-004 (standalone I/O, each the sole source for its data class); `getTodayString` and `getNowDate` sync, correctly excluded |
| COV-005 | PASS — result count attribute set on every span; `findUnsummarized*` spans capture the actionable output count (unsummarized items); helper spans capture the scanned count |
| RST-001 | PASS — `getTodayString` and `getNowDate` are sync; correctly excluded |
| RST-004 | PASS — 4 unexported helpers instrumented per RST-004 permissive reading; each is the sole I/O source for a distinct data class |
| SCH-001 | PASS — all 9 span names follow `commit_story.summary.<operation>` convention |
| SCH-002 | ADVISORY — 7 new attribute keys (`commit_story.journal.entries_count`, `commit_story.summary.entries_count`, `commit_story.summary.weeks_count`, `commit_story.summary.months_count`, and the 3 `unsummarized_*_count` attrs) are absent from `semconv/attributes.yaml`; agent notes confirm 3 as new extensions but do not mention the other 4 explicitly; result is advisory pending confirmation all 7 are declared as extensions |
| SCH-003 | PASS — all count attributes set from `.length` or `.size` on locally constructed arrays/Sets (int type correct) |
| CDQ-001 | PASS — `span.end()` in `finally` on all 9 spans; no redundant `span.end()` |
| CDQ-002 | PASS — `startActiveSpan` callback pattern throughout |
| CDQ-003 | PASS — no redundant `span.end()` outside `finally` |
| CDQ-005 | PASS — `startActiveSpan` with async callbacks |
| CDQ-006 | PASS — all span names are literal strings |
| CDQ-007 | PASS — all attributes set from `.length`/`.size` on locally constructed arrays and Sets; no nullable field access; no optional chaining in `setAttribute` calls |

**Failures**: None. SCH-002 is advisory pending extension declaration confirmation for all 7 new attribute keys — consistent with run-18 which passed SCH-002 for the same attributes on the same file.
