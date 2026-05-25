### 12. collectors/claude-collector.js (1 span, 3 attempts — PARTIAL)

This file committed via function-level fallback after NDS-003 failure at reassembly. The agent instrumented all 5 functions using function-level spans across 3 attempts, but the reassembly validator rejected the output because `allMessages.sort()` at original line 228 was split across lines inside the `startActiveSpan` callback at a deeper indentation level. The committed output reflects the function-level fallback path — one span on `collectChatMessages`, the sole exported async function — rather than the rejected multi-function assembly.

The committed instrumentation is evaluated on its own merits. NDS-003 is marked PARTIAL because the failure occurred at the reassembly stage, not in the committed output itself. The function-level fallback output passes syntax validation and preserves all original logic intact.

The agent demonstrated good diagnostic judgment in the early-return path: `sessions_count=0` and `messages_count=0` are set before returning the empty-data object when `projectPath` is null. This is useful diagnostic telemetry — an observer can distinguish "no project dir found" from "project dir found but no messages." The `commit_story.context.source='claude_code'` attribute uses the registered enum value correctly.

The `try/catch` in `parseJSONLFile`'s for-loop (graceful-degradation for malformed JSONL lines, NDS-007 pattern) is not wrapped by the span — it sits inside a helper that is correctly skipped per RST-001. The sync helpers (`getClaudeProjectsDir`, `encodeProjectPath`, `getClaudeProjectPath`, `findJSONLFiles`, `groupBySession`, `filterMessages`, `parseJSONLFile`) are all correctly excluded.

| Rule | Result |
|------|--------|
| NDS-003 | PARTIAL — committed function-level output is structurally clean; failure was at reassembly of multi-function output where `allMessages.sort()` was split at deeper indentation inside `startActiveSpan` callback |
| NDS-004 | PASS — `collectChatMessages` signature preserved verbatim (multi-line form with `repoPath`, `commitTime`, `previousCommitTime`) |
| NDS-005 | PASS — original had no try/catch; new catch rethrows after recording exception and setting ERROR status |
| NDS-006 | PASS — all JSDoc blocks and inline comments preserved |
| API-001 | PASS — `@opentelemetry/api` only (`SpanStatusCode`, `trace`) |
| COV-001 | PASS — `collectChatMessages` (sole exported async function) has entry-point span |
| COV-003 | PASS — catch calls `recordException`, `setStatus({ code: SpanStatusCode.ERROR })`, `throw error` |
| COV-004 | PASS — `collectChatMessages` is the only exported async function; all 7 sync helpers correctly skipped per RST-001 |
| COV-005 | PASS — `commit_story.context.source`, `time_window_start`, `time_window_end`, `sessions_count`, `messages_count` all set |
| RST-001 | PASS — all sync helpers (`getClaudeProjectsDir`, `encodeProjectPath`, `getClaudeProjectPath`, `findJSONLFiles`, `filterMessages`, `groupBySession`, `parseJSONLFile`) excluded |
| RST-004 | PASS — no internal detail spans; single entry-point span only |
| SCH-001 | PASS — `commit_story.context.collect_chat_messages` follows `commit_story.<category>.<operation>` convention |
| SCH-002 | PASS — all 5 attributes are registered schema keys (`commit_story.context.*`) |
| SCH-003 | PASS — counts are int (`.size`, `.length`); timestamps via `.toISOString()` (string); `source` uses registered enum value `claude_code` |
| CDQ-001 | PASS — `span.end()` in `finally`; covers early null-return and error paths |
| CDQ-002 | PASS — `startActiveSpan` callback pattern; no manual context manipulation |
| CDQ-003 | PASS — no redundant `span.end()` calls |
| CDQ-005 | PASS — `startActiveSpan` used; no `tracer.startSpan` with manual propagation |
| CDQ-007 | PASS — `sessions_count` from `sessions.size` (Map, always numeric); `messages_count` from `allMessages.length` (Array, always numeric); early-return path sets both to `0` before returning |

**Failures**: None on committed output. NDS-003 PARTIAL reflects reassembly-level rejection (split `allMessages.sort()` inside span callback), not a defect in the committed function-level fallback.
