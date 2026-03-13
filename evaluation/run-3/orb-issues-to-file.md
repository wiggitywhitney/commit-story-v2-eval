# Orb Issues to File — Run-3 Findings

These issues were discovered during evaluation run-3 and should be filed on spinybacked-orbweaver.

## Issue 1: Token Budget Is Post-Hoc — Spends Tokens Then Discards Result

**Acceptance criterion:** `commit-story-v2-eval/src/utils/commit-analyzer.js` and `commit-story-v2-eval/src/generators/journal-graph.js` are either (a) pre-flight skipped with a clear reason before spending tokens, or (b) instrumented successfully with a warning if over budget. No file should spend tokens and return nothing.

**Problem:** The `maxTokensPerFile` budget check happens AFTER the LLM API call completes. The flow:
1. `instrumentFile()` makes the LLM call → tokens are spent
2. Tokens accumulated in `cumulativeTokens`
3. THEN checks `cumulativeTokens > maxTokensPerFile`
4. If exceeded → file reverted, result = "failed"

In run-3, `commit-analyzer.js` spent 88,125 tokens and got nothing back at the 80K default. In run-2, `journal-graph.js` spent ~94K tokens with the same result.

The pre-flight cost ceiling is just `fileCount × maxTokensPerFile` (global worst-case), not a per-file prediction. There's no "this file looks too big, skip it" logic.

**User impact:** "Don't spend the maximum budget and show me nothing. That's terrible."

**Proposed fixes (pick one or both):**
- **Pre-flight estimation**: Estimate per-file token cost from file size/line count and skip files predicted to exceed budget before making API calls. Validate estimation accuracy against the two commit-story-v2-eval files: commit-analyzer.js (~88K actual) and journal-graph.js (~94K actual at default budget).
- **Remove budget as a hard failure**: If already past the budget after an attempt, show the result anyway (maybe with a warning) rather than discarding paid-for work

**Code locations:**
- Budget check: `src/fix-loop/instrument-with-retry.ts` line 330-336
- Pre-flight ceiling: `src/coordinator/coordinate.ts` lines 83-106
- Token accumulation: `src/fix-loop/instrument-with-retry.ts` line 323

---

## Issue 2: Null Parsed Output Has No Diagnostics

**Problem:** When the LLM returns output that doesn't match the Zod schema, the error message is completely opaque:
```text
LLM response had null parsed_output — no structured output was returned
```

No information about:
- What the LLM actually returned (raw output preview)
- Why it stopped (`stop_reason`: `end_turn` vs `max_tokens`)
- How many output tokens were used (hitting max_tokens suggests truncation)
- What Zod validation field failed

In run-3, `journal-graph.js` and `sensitive-filter.js` both failed with this error across all 3 retry attempts. Without diagnostics, we can't tell if it's truncation, malformed JSON, or schema mismatch.

**Proposed fix:** Enhanced logging in `src/agent/instrument-file.ts` line 190-196:
```typescript
if (response.parsed_output == null) {
  const rawPreview = response.content[0]?.type === 'text'
    ? response.content[0].text.substring(0, 500)
    : '<no text block>';
  const diagnostics = [
    `stop_reason: ${response.stop_reason}`,
    `output_tokens: ${response.usage.output_tokens}`,
    `raw_output_preview: ${rawPreview}`,
  ].join('; ');
  // Include diagnostics in error message
}
```

**Code locations:**
- Null check: `src/agent/instrument-file.ts` lines 190-196
- Retry classification: `src/fix-loop/instrument-with-retry.ts` lines 165-175

---

## Issue 3: Zero-Span Files Give No Reason in CLI Output

**Problem:** When verbose output shows `success (0 spans)`, there's no explanation of WHY no spans were added. The LLM is required to populate a `notes` field explaining decisions, but this only surfaces in the PR summary — not in the CLI output during the run.

For a live demo or real-time monitoring, seeing "0 spans" with no context is confusing. Is it a utility file? Did the schema not match? Were all functions too small?

**Proposed fix:** In `src/interfaces/instrument-handler.ts` line 138, when `spansAdded === 0`, append the reason from the notes field:
```text
success (0 spans — utility file, no functions meeting instrumentation criteria)
```

**Code locations:**
- Verbose output callback: `src/interfaces/instrument-handler.ts` lines 135-146
- Notes field in output: `src/fix-loop/types.ts` line 24-63
- PR summary rendering: `src/deliverables/pr-summary.ts` lines 259-278

---

## Issue 4: NDS-003 Should Allow Instrumentation-Motivated Refactors or Escalate to User

**Acceptance criterion:** Both NDS-003-failing commit-story-v2-eval files succeed:
- `src/integrators/context-integrator.js` — agent wants to extract `previousCommitTime || new Date(...)` into a const for span attribute access
- `src/managers/journal-manager.js` — agent wants to add `if (commit.hash) {` guard and heavily restructures the function

At minimum, context-integrator.js (single, small refactor) should succeed. journal-manager.js (heavy restructuring) may also benefit from Issue #9 (function-level instrumentation).

**Problem:** Sometimes proper instrumentation requires minor code restructuring that doesn't change runtime behavior — like extracting an inline expression into a `const` so a span attribute can reference it. NDS-003 treats ALL non-instrumentation changes as violations, even when the change is semantically necessary for correct instrumentation.

**Run-3 examples:**

- `context-integrator.js`: The agent extracted `previousCommitTime || new Date(...)` from inside an object literal into a `const windowStart` — likely to set a span attribute on the computed value. The expression was already on line 80 inline; the agent just hoisted it. NDS-003 flagged this, the agent tried 3 times, and failed all 3 because it was convinced the extraction was necessary.

- `journal-manager.js`: The agent added `if (commit.hash) {` guard — possibly to wrap a span around the deduplication logic. With 5x NDS-003 + 3x COV-003, the agent was heavily restructuring the function across all 3 attempts.

**The feedback loop failure:** The agent gets NDS-003 feedback ("don't modify business logic") but persists because it believes the change IS needed for correct instrumentation. Three identical failures across initial → multi-turn fix → fresh regeneration suggests the feedback isn't persuasive enough, or the agent genuinely needs the refactor.

**Proposed fixes:**
- **Escalate to user**: When the same NDS-003 violation appears across all retry attempts, surface it: "I need to modify this line for proper instrumentation — approve?"
- **Allow safe refactors after repeated attempts**: If the agent makes the same refactor across all 3 attempts despite NDS-003 feedback, auto-allow it on the theory that persistence = genuine need. Threshold TBD — maybe 3 identical violations across attempts triggers an "allow" rather than a "fail". Open question: is this a good idea, or does it create a loophole?
- **Allow safe refactors**: Recognize "extract to const" and "hoist expression" as safe, behavior-preserving changes that enable instrumentation
- **Better feedback**: Tell the agent specifically what alternative approach to use (e.g., "set the attribute inside the span.end() call instead of extracting the variable")

**Code locations:**
- NDS-003 validation: `src/validation/tier2/nds003.ts`
- Retry/oscillation logic: `src/fix-loop/instrument-with-retry.ts` lines 376-400
- Feedback formatting: `src/validation/feedback.ts`

---

## Issue 5: Orb Should Accept Multiple Path Arguments

**Problem:** `orb instrument` only accepts a single path argument. Running `orb instrument file1.js file2.js` fails with "Unknown argument." This forces targeted re-runs to be done one file at a time, which is clunky and means each file gets its own branch/PR rather than being grouped.

**Discovered during:** Run-3 supplemental re-run of 2 large files — had to invoke orb twice.

**Proposed fix:** Accept variadic path arguments, or support glob patterns like `orb instrument src/generators/*.js`.

---

## Issue 6: Oscillation Error Doesn't Say Which Validation Rule Triggered It

**Problem:** When oscillation is detected, the error message is:
```text
Oscillation detected during fresh regeneration: Duplicate errors detected across consecutive attempts
```

This doesn't tell you WHICH validation rule(s) the agent kept failing on. Was it NDS-003? COV-003? Something else? Without this, the user can't assess whether the oscillation is a fundamental limitation or a fixable feedback issue.

**Discovered during:** Run-3 supplemental re-run of `journal-graph.js`.

**Proposed fix:** Include the specific validation rule(s) and error details in the oscillation message, e.g.:
```text
Oscillation detected during fresh regeneration: NDS-003 (non-instrumentation line at line 42) repeated across all 3 attempts
```

**Code location:** `src/fix-loop/instrument-with-retry.ts` oscillation detection (lines 376-400)

---

## Issue 7: Test Suite Integration

**Problem:** The spinybacked-orbweaver README lists a test suite as a prerequisite/recommendation, but the agent never actually runs the target project's test suite after instrumentation. Running tests post-instrumentation would catch issues that static validation misses — like NDS-003 violations that pass validation but break runtime behavior, or instrumentation that changes function signatures.

**Use cases for test suite integration:**
- Post-instrumentation smoke test: "does `npm test` still pass?"
- Catching subtle business logic modifications that NDS-003's pattern matching misses
- Validating that added imports don't break the module graph
- Confidence signal in the PR summary: "all 47 tests pass after instrumentation"

**Proposed fix:** Add an optional `testCommand` config in `orb.yaml` (e.g., `testCommand: npm test`). Run it after all files are instrumented but before PR creation. Report results in PR summary.

---

## Issue 8: Unify "Oscillation Detected" and "Validation Failed After Repeated Identical Attempts"

**Problem:** Two files that failed for the same fundamental reason (agent stuck repeating the same mistake) got different error messages:
- `context-integrator.js`: "Validation failed: NDS-003"
- `journal-graph.js`: "Oscillation detected during fresh regeneration: Duplicate errors detected"

From the user's perspective, these are the same problem: the agent can't instrument this file. The distinction is an implementation detail of the oscillation detector (exact vs fuzzy error signature matching). Reporting should be unified.

**Proposed fix:** When all 3 attempts fail with the same validation rule (even if details differ slightly), report it consistently — something like:
```text
failed (all 3 attempts failed NDS-003 — agent unable to instrument without modifying business logic)
```

---

## Issue 9: Function-Level Instrumentation for Large Files

**Acceptance criterion:** Both large commit-story-v2-eval files succeed with at least partial instrumentation:
- `src/generators/journal-graph.js` — failed run-2 (token budget) and run-3 (oscillation). Has never been successfully instrumented.
- `src/managers/journal-manager.js` — failed run-3 (NDS-003 x5, COV-003 x3). Agent heavily restructures it in single-shot mode.

Success = at least some functions in each file get instrumented, even if others are skipped. Partial coverage of a large file is better than zero.

**Problem:** Large files (500+ lines, like `journal-graph.js`) are sent to the LLM as a single unit. This causes:
- Token budget consumed mostly by file context, leaving little room for output
- LLM has to reason about the entire file at once → lower accuracy
- One mistake anywhere fails the entire file → all-or-nothing outcome
- Oscillation more likely in complex files (more opportunities for NDS-003 violations)

`journal-graph.js` has failed across run-2 (token budget) and run-3 (oscillation). It may be fundamentally too large for single-shot instrumentation.

**Proposed approach:** Instrument large files function-by-function:
1. Parse the file to identify function boundaries
2. Give the LLM a structural map of the whole file (function names, call relationships, exports)
3. Instrument each function individually with the structural context
4. Reassemble the file with all instrumented functions

**Benefits:**
- Partial success possible (8/10 functions instrumented > 0/10)
- Smaller context per LLM call = better accuracy and lower token cost
- NDS-003 violations scoped to one function, not the whole file
- Token budget spread across smaller units
- Functions that genuinely can't be instrumented get skipped individually

**Design question:** Does the LLM need whole-file context to make good instrumentation decisions? (e.g., "only instrument the outer function, not the inner one it calls"). A hybrid approach — structural map + per-function detail — could address this.

---

## Issue 10: Add Option to Disable Max Token Budget

**Problem:** There's no way to say "I don't care about cost, just try to instrument the file." The `maxTokensPerFile` setting has no "unlimited" option. For evaluation runs or when a user is willing to pay, they should be able to opt out of the budget entirely.

**Proposed fix:** Accept `maxTokensPerFile: 0` or `maxTokensPerFile: unlimited` in orb.yaml to disable the budget check.

---

## Issue 11: Fix null parsed_output so sensitive-filter.js succeeds

**Acceptance criterion:** `orb instrument src/integrators/filters/sensitive-filter.js` succeeds.

**Context:** This 236-line file with straightforward pure functions fails with null parsed_output on every attempt across two independent runs (run-3 main + supplemental). It's a simple file — 12 regex patterns, 4 exported functions, no complex control flow. It should be easy to instrument.

**Depends on:** Issue #2 (null parsed_output diagnostics). Start by adding diagnostics to confirm the root cause before choosing a fix.

**Leading theory:** The file contains complex regex patterns with backslashes, `[\s\S]*?`, escaped brackets, and multi-line PEM key detection patterns. When the LLM reproduces file content inside a JSON string field (structured output), these characters likely cause JSON parsing failures. The Zod schema rejects the malformed JSON → null parsed_output.

**Evidence supporting regex theory:**
- File has 12 regex patterns with heavy escaping
- LLM must reproduce these exactly inside a JSON string value
- Other files of similar size and complexity succeed — the difference is regex density
- Null parsed_output = Zod validation failed = likely malformed JSON, not refusal or truncation

**Possible fixes (choose after diagnostics confirm root cause):**
- **Diff-based output format**: Instead of "return the entire file as a JSON string," have the LLM return only the changes (additions/modifications). Avoids needing to reproduce regex patterns verbatim in JSON.
- **Post-process JSON repair**: Fix common LLM JSON escaping errors (unescaped backslashes, broken unicode sequences) before Zod validation.
- **Separate content block**: Return instrumented code outside the JSON structure (e.g., in a text content block) so it doesn't need JSON escaping.

---

## Issue 12: Validate GitHub Token at Startup, Not After Instrumentation

**Acceptance criterion:** When `--pr` is enabled (the default), orb validates that git push credentials work BEFORE processing any files. If credentials are invalid, fail immediately with a clear message instead of running the entire instrumentation and losing the PR at the end.

**Problem:** In run-3, orb processed all 21 files (~35 minutes, real API costs), created commits on a local branch, then failed at the very last step:
```text
Push failed — skipping PR creation: Pushing to https://github.com/wiggitywhitney/commit-story-v2-eval.git
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed
```

The instrumented code is on a local branch but the PR artifact — which is valuable for evaluation — was lost. The user had to discover this after the entire run completed.

**Proposed fix:**
- At startup (before file processing), if `--pr` is enabled, do a lightweight git credential check (e.g., `git ls-remote` or similar)
- If credentials are invalid, fail immediately with: "PR creation is enabled but git push credentials are invalid. Fix credentials or use --no-pr."
- Consider also validating the GitHub token can create PRs (not just push) via the GitHub API

**Code location:** `src/coordinator/coordinate.ts` or `src/interfaces/instrument-handler.ts` (startup sequence)

---

## Additional Observations

### NDS-003 Feedback Loop May Be Insufficient

When NDS-003 catches a business logic modification, the agent gets 3 attempts (initial → multi-turn fix → fresh regeneration) but keeps making the same change. This suggests:
- The feedback about NDS-003 isn't compelling enough for the LLM to change approach
- The agent may believe the code change IS necessary for correct instrumentation
- If a code change truly is needed for proper instrumentation, this should surface to the user rather than silently failing

**Specific examples from run-3:**
- `context-integrator.js`: Agent kept trying to add `const windowStart = previousCommitTime || new Date(...)` at line 75
- `journal-manager.js`: Agent kept trying to add `if (commit.hash) {` at line 187, plus 5 other NDS-003 violations and 3 COV-003 violations

**Question to investigate:** Are these code changes actually needed for proper instrumentation? If so, the tool should escalate to the user ("I need to modify business logic here — approve?") rather than failing silently.

### Span Count Discussion

Run-3 produced relatively few spans across 16 successful files. The 0-span files (accessibility.js, anti-hallucination.js, dialogue-prompt.js, summary-prompt.js, technical-decisions-prompt.js, config.js) are all prompt templates or config — likely correct to skip. But even the instrumented files had low span counts (1-3 spans each). Whether this represents good telemetry practice or under-instrumentation needs evaluation against the Weaver schema in the per-file evaluation milestone.

Good telemetry practice favors fewer, high-signal spans over many low-value ones. Entry points, external calls, and schema-defined operations should have spans. Internal helpers, formatters, and pure functions should not. The per-file evaluation will assess whether the right functions got spans.
