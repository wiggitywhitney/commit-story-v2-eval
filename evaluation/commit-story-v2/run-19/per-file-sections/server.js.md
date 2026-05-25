### 6. mcp/server.js (1 span, 1 attempt)

Single span on `main()` entry point. `createServer` (sync factory, unexported) correctly skipped per RST-001. 1-attempt success. Structurally identical to run-18, with minor span and attribute name variations.

The agent placed `startActiveSpan('commit_story.mcp.server_start', ...)` around the entire body of `main()`, including the `createServer()` call, transport instantiation, `server.connect(transport)`, and the `console.error` log line. A try/catch/finally pattern provides `span.recordException(error)`, `span.setStatus({ code: SpanStatusCode.ERROR })`, and `span.end()` in `finally`. The single attribute `commit_story.mcp.transport_type` is set to the hardcoded string `'stdio'` before `server.connect`. The `.catch()` block on the outer `main()` invocation retains the original `process.exit(1)` — this is in the catch callback at the call site, not inside `main()`'s instrumented body, so RST-006 does not apply.

Span name `commit_story.mcp.server_start` (run-19) differs from `commit_story.mcp.server.start` (run-18) and attribute name `commit_story.mcp.transport_type` differs from `commit_story.mcp.transport` (run-18). Both new names are extension attributes not in the schema, so SCH-001 and SCH-002 pass as extensions in either naming convention. The attribute value `'stdio'` is a hardcoded string constant with no nullable access, so CDQ-007 passes cleanly.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — only `main()` modified; `createServer` and `.catch()` call site unchanged |
| NDS-004 | PASS — `import { trace, SpanStatusCode }` added; `const tracer = trace.getTracer('commit-story')` at module level; no other new imports |
| NDS-005 | PASS — original had no try/catch in `main()`; new catch rethrows via `throw error`; outer `.catch()` handler preserved |
| NDS-006 | PASS — `const tracer = trace.getTracer('commit-story')` at module top-level |
| API-001 | PASS — `@opentelemetry/api` only; `trace` and `SpanStatusCode` used correctly |
| COV-001 | PASS — `main()` is the async process entry point; COV-001 overrides RST-004 for entry points |
| COV-003 | PASS — span has try/catch with `recordException` + `SpanStatusCode.ERROR` + rethrow; `span.end()` in finally |
| COV-004 | PASS — `main()` is the only async function; `createServer` is sync |
| COV-005 | PASS — `commit_story.mcp.transport_type` set to `'stdio'` captures transport identity |
| RST-001 | PASS — `createServer` is sync; correctly skipped |
| RST-004 | PASS — `main()` is the process entry point, not an unexported helper; COV-001 applies |
| SCH-001 | PASS — `commit_story.mcp.server_start` registered as extension span name |
| SCH-002 | PASS — `commit_story.mcp.transport_type` declared as extension attribute; no collision with schema-registered names |
| SCH-003 | PASS — `'stdio'` is a string constant matching the attribute's implicit `type: string` |
| CDQ-001 | PASS — no redundant `span.end()`; `finally` block calls it once |
| CDQ-002 | SKIP — `startActiveSpan` callback pattern; no manual context propagation or `context.with` needed |
| CDQ-003 | SKIP — no complex branching paths requiring multiple `span.end()` calls |
| CDQ-005 | PASS — `span.recordException(error)` precedes `span.setStatus({ code: SpanStatusCode.ERROR })` in catch |
| CDQ-006 | SKIP — no unbounded user input in attributes; `'stdio'` is a hardcoded constant |
| CDQ-007 | PASS — single attribute is a hardcoded string literal; no nullable field access |

**Failures**: None.
