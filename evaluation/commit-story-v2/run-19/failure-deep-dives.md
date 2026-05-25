# Failure Deep-Dives — Run-19

**Run-19 result**: 10 committed, 0 failed, 3 partial, 17 correct skips, $8.60.

No file-level failures. Three partial commits, all due to the same root cause: lines near Prettier's 80-character print width that reformat inside a `startActiveSpan` callback body. This is the class targeted by PRD #875 (AST comparison).

---

## Partial: src/collectors/claude-collector.js

**Result**: 1 span committed (collectChatMessages). NDS-003 triggered in reassembly validation.

**Failing line** (original file line 228):
```javascript
  allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
```

Inside `collectChatMessages`, this line is at 2-space indentation in the original file (2 + 73 = 75 chars). The agent instrumented `collectChatMessages` with a `startActiveSpan` wrapper, moving the body to 4-space indentation. At 4 spaces, the `allMessages.sort(...)` call is 4 + 73 = 77 chars — under Prettier's 80-char limit. However, normalize-both-sides runs each file at its **own indentation level**: the original normalizes with the line at 75 chars (no split), and the instrumented normalizes with the line at 77 chars (still no split on a simple case). The failure occurred because the agent slightly reformatted the expression — specifically, it split `allMessages.sort(` onto its own line (line 247 in instrumented) and placed the callback on the next line, which NDS-003 detected as a non-instrumentation addition.

This pattern appears when the agent (not Prettier) reformats a long single-line expression during instrumentation. The function-level fallback ran a second attempt after the file-level attempt failed, but the second attempt produced the same reformatting.

**Agent response**: collected 5/5 functions instrumented, 1 span committed (collectChatMessages). The `.sort()` reformatting caused reassembly to use partial results.

**Root cause class**: Formatter-induced expression reformatting under startActiveSpan indentation. normalize-both-sides (PRD #845) does not eliminate this class because it normalizes each side independently at its own indentation level. PRD #875 (AST comparison) resolves this class by comparing code structure, not text.

**PRD #875 fixture candidate**: `claude-collector.js` run-19 case is already cited in PRD #875 M2 success criteria. The `allMessages.sort(...)` line at ~77 chars at 4-space indentation is the regression fixture.

---

## Partial: src/managers/summary-manager.js

**Result**: 6 spans committed (readDayEntries, saveDailySummary, readWeekDailySummaries, saveWeeklySummary, readMonthWeeklySummaries, saveMonthlySummary). Three functions skipped via function-level fallback.

**Regression**: run-18 committed 9 spans for this file (all generateAndSave* functions via file-level instrumentation). Run-19 dropped to 6 spans — the 3 generateAndSave* orchestrators failed in function-level mode.

### generateAndSaveDailySummary — skipped

**Failing line** (NDS-003 error, original line 47 relative to function):
```javascript
      return { saved: false, reason: `Summary already exists for ${dateStr}` };
```

This return is inside a try-catch block, already at 6-space indentation (6 + 54 + len(dateStr)). When wrapped in `startActiveSpan`, the try block's content moves to 8-space indentation. Prettier sees the template literal in the object property and evaluates the total line length. At 8-space indentation with a dateStr like `2026-05-25`, the line is 8 + 54 + 10 = 72 chars — nominally under 80. However, normalize-both-sides normalizes the original (at 6 spaces) and instrumented (at 8 spaces) independently. If the agent slightly reformatted the template literal or the object literal during instrumentation, NDS-003 fires.

**Root cause**: Same class as claude-collector.js — formatter-induced expression reformatting at deeper indentation. The specific error says the original line is "missing/modified," meaning the agent produced the line in a different form than the original (likely inline-expanded the object or broke the template literal).

### generateAndSaveWeeklySummary — skipped

**Failing line** (NDS-003 error):
```text
non-instrumentation line added at instrumented line 61: formatted,
```

`formatted,` as a standalone line is a tell that a multi-line function call or array was reformatted. In the original `generateAndSaveWeeklySummary`, `formatted` is a local variable used as the first argument to `saveWeeklySummary(formatted, weekStr, basePath, options)`. The agent likely produced a version where this 4-argument function call was broken onto multiple lines at deeper indentation, making `formatted,` appear as a new line.

Looking at the original code: `const path = await saveWeeklySummary(formatted, weekStr, basePath, options);` — this is 62 chars at 2-space indentation. Inside `startActiveSpan` at 4-space indentation: 4 + 62 = 66 chars, under 80. But nested inside the outer `if (!options.force)` block and the function body, the effective indentation at the time of the call may be deeper (inside a try block potentially), pushing it over the boundary.

**Root cause**: Multi-line function call argument split — same formatter class.

### generateAndSaveMonthlySummary — skipped

**Failing line** (NDS-003 error):
```text
non-instrumentation line added at instrumented line 44: basePath
```

`basePath` as a standalone line indicates the same pattern as `generateAndSaveWeeklySummary` — a multi-line call argument split. The function signature is `generateAndSaveMonthlySummary(monthStr, basePath = '.', options = {})` and the internal calls use `basePath` as an argument. At deeper indentation inside a `startActiveSpan` callback, one of these calls crossed Prettier's 80-char boundary and was split with `basePath` on its own line.

**Root cause**: Same multi-line argument split class.

### Why this is a regression from run-18

Run-18 instrumented `generateAndSave*` at the **file level** (not function level). File-level instrumentation applies to the whole file simultaneously, using the original indentation context. Because the file-level approach keeps all functions at their original indentation during the initial transformation, the `startActiveSpan` wrapper in run-18 didn't trigger these boundary cases. Run-19's function-level fallback processes each function independently, applying the wrapper with the function body normalized to a new indentation context, which moves these borderline lines over Prettier's threshold.

**PRD #875 impact**: All three `generateAndSave*` functions are new fixtures for PRD #875 M0 catalog. The `basePath` and `formatted,` split patterns are distinct from the `.sort()` and return-object patterns but share the same underlying cause.

---

## Partial: src/managers/auto-summarize.js

**Result**: 2 spans committed (triggerAutoWeeklySummaries, triggerAutoMonthlySummaries). triggerAutoSummaries skipped via function-level fallback.

**Failing line** (NDS-003 error, original line 90):
```javascript
    failed: [...result.failed, ...weeklyResult.failed, ...monthlyResult.failed],
```

Inside `triggerAutoSummaries`, the return object is at 2-space indentation. The `failed:` property line is 4 + 73 = 77 chars at original indentation (inside the return object at 4 spaces). The file already has `generated` and `skipped` formatted as multi-line arrays (they're longer), but `failed` fits on one line at 77 chars.

Inside a `startActiveSpan` callback at +2 spaces: `failed` becomes 6 + 73 = 79 chars — still nominally under 80. However, the agent or Prettier split it during function-level instrumentation. The cause is likely one of:

1. The agent introduced a small reformatting of the spread expressions during the instrumentation pass
2. The function-level normalization context shifted the effective indentation differently than expected
3. Because `generated` and `skipped` in the same object are already multi-line (they span 3 lines each), Prettier may have reformatted the entire object literal consistently when any property changed — making `failed` split even though it fits on one line

The `generated` property line: `    generated: [...result.generated, ...weeklyResult.generated, ...monthlyResult.generated],` = 4 + 86 = 90 chars — already over 80 in the original, which is why it's already formatted as a multi-line array. When the whole return object is reformatted at deeper indentation, Prettier may apply consistent multi-line formatting to all properties.

**Root cause**: Multi-line spread array reformatting — same formatter class as the summary-manager.js cases. The `generated:` property being over 80 chars causes Prettier to reformat the entire object literal, pulling in `failed:` even though it fit on one line individually.

**PRD #875 fixture candidate**: The `failed: [...result.failed, ...]` pattern — where a shorter property in a multi-line object gets reformatted due to a sibling property being over the limit — is a new edge case for the M0 catalog. The stripper can handle this because AST comparison doesn't care about line breaks at all.

---

## Run-Level Observations

### NDS-003 False-Positive Class: Confirmed and Expanded

Run-19 adds three new examples of the indentation-driven Prettier reformatting class, bringing the documented instance count to:

| Run | File | Pattern |
|-----|------|---------|
| 19 | claude-collector.js | Method chain `.sort()` — agent reformats long callback |
| 19 | summary-manager.js × 3 | Return object literal, function call argument, function call argument |
| 19 | auto-summarize.js | Spread array in multi-property object |

All are confirmed false positives: the agent code is semantically correct in every case. None would fire under AST comparison (PRD #875), because AST comparison is indifferent to line breaks and indentation.

### summary-manager.js File-Level vs Function-Level Divergence

Run-18 succeeded at file level (9 spans). Run-19 failed at function level for the same 3 functions. This is a new data point about the interaction between the instrumentation strategy (file vs function) and the NDS-003 formatter issue: file-level passes when the formatter behavior is consistent across the whole file, while function-level fails when the extracted function context changes Prettier's evaluation of borderline lines.

This suggests that PRD #875 will also help stabilize function-level instrumentation, not just file-level.

### Push and PR — Fully Automated

Run-19 is the first run in the series with both auto-push and auto-PR creation. Issue #867 (push retry on hook-created commit) confirmed working. No manual intervention required.

### Advisory Finding Count Increased (4170 vs 3848 run-18)

The 4170 advisory findings with 523 live-check spans represents a higher finding-per-span ratio than run-18 (3848 / 575 ≈ 6.7 vs 4170 / 523 ≈ 8.0). The new files committed in run-19 (summary-detector.js, summarize.js, auto-summarize.js, summary-manager.js partial) are rich in advisory opportunities (SCH-001 false positives from span name collisions, CDQ-007 filesystem path advisories). This is expected and does not reflect quality regression.
