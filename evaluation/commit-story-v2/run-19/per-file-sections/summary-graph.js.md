### 4. generators/summary-graph.js (6 spans, 1 attempt)

**P1 RUN18-1 RESOLVED** — this file FAILED in run-18 (NDS-003 reconciler offset gap; 6 span wrappers inflated line offsets, causing validator to flag line 485 as missing). Run-19 PRD #845 fix confirmed: the file committed cleanly on the first attempt.

The file implements three parallel LangGraph pipelines — daily, weekly, and monthly summary generation. Each pipeline contributes two spans: a node function (`*_node`) and a public orchestrator (`generate_*`). The six resulting spans are `commit_story.summary.daily_node`, `commit_story.summary.generate_daily`, `commit_story.summary.weekly_node`, `commit_story.summary.generate_weekly`, `commit_story.summary.monthly_node`, and `commit_story.summary.generate_monthly`. Three new attributes were declared as schema extensions: `commit_story.summary.entries_count` (int — input item count, reused across all three pipelines), `commit_story.summary.week_label` (string — ISO week identifier, e.g., `2026-W09`), and `commit_story.summary.month_label` (string — month identifier, e.g., `2026-02`). All three are registered in `agent-extensions.yaml`.

Each of the six functions follows the same two-catch structure inherited from the original source. The inner catch — which returns a graceful-failure state object without rethrowing — is the original graceful-degradation catch. The agent correctly preserved these as NDS-007 expected-condition catches: no `recordException` or `setStatus(ERROR)` added. The outer catch, added by the agent, handles truly unexpected errors and applies the full `recordException` + `setStatus(ERROR)` + rethrow pattern per COV-003. LangChain `model.invoke()` and `graph.invoke()` calls are covered by `@traceloop/instrumentation-langchain` auto-instrumentation, satisfying COV-006.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — all six functions committed; original business logic, early-exit paths, and graceful-degradation catches preserved intact; 1-attempt success confirms reconciler gap resolved |
| NDS-004 | PASS — no function signatures altered |
| NDS-005 | PASS — inner graceful-degradation catches in all three node functions preserved untouched inside `startActiveSpan` callbacks |
| NDS-006 | PASS — all JSDoc blocks and inline comments preserved |
| API-001 | PASS — `@opentelemetry/api` only |
| COV-001 | PASS — all 6 exported async functions have entry-point spans |
| COV-003 | PASS — all 6 spans have outer catch with `recordException` + `setStatus(ERROR)` + rethrow |
| COV-004 | PASS — all 6 exported async functions instrumented; sync helpers correctly skipped per RST-001 |
| COV-005 | PASS — `commit_story.journal.entry_date`, `commit_story.summary.entries_count`, `week_label`, `month_label` |
| COV-006 | PASS — `model.invoke()` and `graph.invoke()` calls instrumented by `@traceloop/instrumentation-langchain` |
| RST-001 | PASS — all sync formatting, parsing, cleaning, and graph-builder helpers skipped |
| RST-004 | PASS — one span per exported async function; no internal detail spans |
| SCH-001 | PASS — all 6 span names declared in `agent-extensions.yaml` under `commit_story.summary.*` convention |
| SCH-002 | PASS — all 3 new attributes declared in `agent-extensions.yaml`; no semantic collisions |
| SCH-003 | PASS — `entries_count` from `.length` (int); `week_label`, `month_label` from string parameters |
| CDQ-001 | PASS — `span.end()` in `finally` on all 6 spans |
| CDQ-002 | PASS — `startActiveSpan` callback pattern throughout |
| CDQ-003 | PASS — no redundant `span.end()` calls |
| CDQ-005 | PASS — `startActiveSpan` with async callbacks |
| CDQ-006 | PASS — no unbounded user input in attributes |
| CDQ-007 | PASS — `entries != null` guards before `.length` access; `week_label`, `month_label`, `entry_date` are required string parameters |

**Failures**: None. **P1 RUN18-1 status: RESOLVED.**
