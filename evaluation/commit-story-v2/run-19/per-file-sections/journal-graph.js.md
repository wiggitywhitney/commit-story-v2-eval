### 3. generators/journal-graph.js (4 spans, 2 attempts)

**RUN18-3 HELD**: 4 spans, 2 attempts — same attempt count and span count as run-18. File continues to be a clean instrumentation target with no regressions.

Four exported async functions each receive one span: `summaryNode`, `technicalNode`, `dialogueNode` (the three LangGraph node functions), and `generateJournalSections` (the public orchestrator). Thirteen sync helpers and unexported utilities correctly skipped. The three node functions retain their original graceful-degradation catches inside `startActiveSpan` callbacks (NDS-005/NDS-007 pattern A — finally block, no ERROR status). The orchestrator's catch records exception, sets ERROR status, and rethrows (COV-003 pattern). LangChain calls are auto-instrumented via `@traceloop/instrumentation-langchain`; manual spans wrap the application-layer logic above them (COV-006).

The agent correctly removed `if (result.response_metadata?.model != null)` guard blocks from the original — those would have triggered NDS-003 had they been retained with setAttribute calls inside, and there are no corresponding attributes in the schema for `response_metadata.model`. The `gen_ai.usage.input_tokens/output_tokens` pair is guarded by `result.usage_metadata != null` (the `!= null` form, not the weaker `!== undefined`). Optional chaining on `NODE_TEMPERATURES?.summary` is safe — NODE_TEMPERATURES is a module-level const that is always defined. The `commit_story.commit.message` and `vcs.ref.head.revision` attributes in `generateJournalSections` are set unconditionally from `context.commit.message` and `context.commit.shortHash` — these are required contract inputs to the function, treated as guaranteed present by the entire call chain (CDQ-007 PASS).

| Rule | Result |
|------|--------|
| NDS-003 | PASS — all function bodies intact; no closing braces, template literals, or business logic removed |
| NDS-004 | PASS — all 4 async function signatures unchanged |
| NDS-005 | PASS — original graceful-degradation catches in summaryNode, technicalNode, dialogueNode preserved inside `startActiveSpan` callbacks |
| NDS-006 | PASS — all JSDoc blocks and inline comments preserved |
| API-001 | PASS — `@opentelemetry/api` only; `SpanStatusCode` imported correctly |
| COV-001 | PASS — all 4 exported async functions have entry-point spans |
| COV-003 | PASS — `generateJournalSections` catch records exception + sets ERROR status + rethrows; node catches are original graceful-degradation (NDS-005), not new error handling |
| COV-004 | PASS — all 4 exported async functions instrumented; 13 sync helpers correctly skipped per RST-001 |
| COV-005 | PASS — `commit_story.ai.section_type`, `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.request.temperature`, `gen_ai.request.max_tokens` on node spans; `commit_story.journal.sections`, `commit_story.commit.message`, `vcs.ref.head.revision` on orchestrator span |
| COV-006 | PASS — manual spans wrap application logic above auto-instrumented LangChain calls |
| RST-001 | PASS — `getModel`, `resetModel`, `getGraph`, `buildGraph`, `analyzeCommitContent`, `hasFunctionalCode`, `generateImplementationGuidance`, `formatSessionsForAI`, `formatChatMessages`, `formatContextForSummary`, `formatContextForUser`, `cleanDialogueOutput`, `cleanTechnicalOutput`, `cleanSummaryOutput`, `escapeForJson` all sync or module-level, correctly skipped |
| RST-004 | PASS — no internal detail spans added |
| SCH-001 | PASS — span names `commit_story.journal.generate_summary`, `commit_story.journal.generate_technical`, `commit_story.journal.generate_dialogue`, `commit_story.journal.generate_sections` all follow `commit_story.<category>.<operation>` convention |
| SCH-002 | PASS — all attributes are registered schema keys (`commit_story.ai.section_type`, `commit_story.journal.sections`, `commit_story.commit.message`) or OTel GenAI/VCS refs |
| SCH-003 | PASS — `section_type` enum values match registered members; `temperature` is numeric; `sections` is string array; `max_tokens` is numeric |
| SCH-004 | PASS — `gen_ai.provider.name`, `gen_ai.operation.name`, `gen_ai.request.model` are proper OTel GenAI refs, not custom duplicates |
| CDQ-001 | PASS — `span.end()` in `finally` block on all 4 spans |
| CDQ-002 | PASS — `startActiveSpan` callback pattern used throughout |
| CDQ-003 | PASS — no redundant `span.end()` calls |
| CDQ-005 | PASS — `startActiveSpan` with async callbacks on all 4 spans |
| CDQ-006 | PASS — no unbounded user input in attributes; `commit_story.commit.message` is standard commit subject line |
| CDQ-007 | PASS — `gen_ai.usage.input_tokens/output_tokens` guarded by `result.usage_metadata != null`; `NODE_TEMPERATURES?.summary` is optional chaining on a module const (always defined); `sections` is a literal array; `commit.message` and `commit.shortHash` are required contract inputs |
| CDQ-009 | NOT APPLICABLE — no `!== undefined` guards around setAttribute; usage_metadata guard uses the stronger `!= null` form |
| CDQ-010 | NOT APPLICABLE — no string-method calls on property accesses in setAttribute arguments |

**Failures**: None.
