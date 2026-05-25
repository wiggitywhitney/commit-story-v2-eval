### 2. collectors/git-collector.js (2 spans, 3 attempts)

Both exported async functions (`getPreviousCommitTime`, `getCommitData`) are instrumented with `startActiveSpan` — consistent with run-18, which first resolved the long-standing RUN17-3 gap. The four unexported helpers (`runGit`, `getCommitMetadata`, `getCommitDiff`, `getMergeInfo`) are correctly excluded per RST-001/RST-004. Structural fidelity is clean: all JSDoc blocks preserved, no signatures altered, `runGit`'s existing error branches untouched inside the new span wrappers. The key regression from run-18 is attribute thinning in `getCommitData`: where run-18 set `vcs.ref.head.revision`, `commit_story.commit.timestamp`, `commit_story.commit.author`, and `commit_story.commit.message`, run-19 sets only `vcs.ref.head.revision`. The PII rationale for dropping `author`/`authorEmail` is sound (CDQ-007), but omitting `commit_story.commit.message` entirely — rather than guarding it with `isRecording()` as the agent notes describe — weakens COV-005 for `getCommitData`. The `getPreviousCommitTime` span correctly captures `vcs.ref.head.revision` and `commit_story.commit.timestamp` (ISO string) with a null early-return guard on the timestamp path.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — only span wrappers added; no business logic restructured |
| NDS-004 | PASS — no function signatures altered |
| NDS-005 | PASS — `runGit`'s original error handling preserved; new catch blocks record exception and rethrow |
| NDS-006 | PASS — all JSDoc blocks and inline comments intact |
| API-001 | PASS — `@opentelemetry/api` only; `SpanStatusCode` and `trace` imported correctly |
| COV-001 | PASS — both exported async functions have entry-point spans |
| COV-003 | PASS — no outbound HTTP or database calls; `execFile` is a local subprocess call handled by `runGit` (unexported) |
| COV-004 | PASS — both exported async functions have spans; 4 unexported helpers correctly excluded per RST-004; `runGit` is unexported, RST-004 exemption applies |
| COV-005 | FAIL — `getCommitData` sets only `vcs.ref.head.revision` on entry; `commit_story.commit.message`, `commit_story.commit.author`, and merge/parent attributes absent from the span; `getPreviousCommitTime` is correct (revision + timestamp); overall attribute density for `getCommitData` is insufficient given the rich `CommitData` shape it returns |
| COV-006 | N/A — no auto-instrumented library calls in this file |
| RST-001 | PASS — `runGit`, `getCommitMetadata`, `getCommitDiff`, `getMergeInfo` all unexported; no spans added |
| RST-004 | PASS — unexported helper exclusion consistent and correct |
| SCH-001 | PASS — `commit_story.context.get_previous_commit_time` and `commit_story.git.get_commit_data` follow the `commit_story.<category>.<operation>` convention |
| SCH-002 | PASS — `vcs.ref.head.revision` is a registered OTel VCS ref; `commit_story.commit.timestamp` is in the schema; no unregistered keys used |
| SCH-003 | PASS — `commit_story.commit.timestamp` set via `.toISOString()` (string type matches schema); `vcs.ref.head.revision` is always a string |
| SCH-004 | N/A — agent notes identify 3 candidate extension attributes (`commit_story.git.command`, `commit_story.git.is_merge`, `commit_story.git.parent_count`) but none are used in the instrumented code; schema gap is advisory only |
| CDQ-001 | PASS — both spans closed in `finally` blocks; covers early-return and error paths |
| CDQ-002 | PASS — `startActiveSpan` callback pattern; no manual context propagation |
| CDQ-003 | PASS — no redundant `span.end()` outside `finally` |
| CDQ-005 | PASS — `startActiveSpan` with async callbacks throughout |
| CDQ-006 | PASS — `SpanStatusCode.ERROR` set only in catch blocks; no status set on success path |
| CDQ-007 | PASS — `commitRef` is a non-nullable parameter with a default; `commit_story.commit.timestamp` in `getPreviousCommitTime` only reached after the `timestamps.length < 2` early-return guard; `commit_story.commit.author`/`authorEmail` correctly omitted (PII) rather than set unconditionally from parsed strings |
| CDQ-009 | N/A — no span name constructed from dynamic values |
| CDQ-010 | N/A — no array attributes set |

**Failures**: COV-005 — `getCommitData` span sets only the input parameter (`vcs.ref.head.revision`) and none of the rich output attributes available in the returned `CommitData` object (`commit_story.commit.message`, merge status, parent count). Run-18 passed COV-005 by setting author, message, and timestamp on `getCommitData`; run-19 drops all of these. Even excluding PII fields, `commit_story.commit.message` (guarded with null-check or `isRecording()`) and `commit_story.git.is_merge`/`commit_story.git.parent_count` (new schema extensions) would have satisfied COV-005 without CDQ-007 risk.
