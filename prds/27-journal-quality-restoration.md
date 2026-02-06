# PRD #27: Restore Journal Generation Quality to V1 Levels

## Overview

**Problem**: V2 journal entries have significant quality regressions compared to v1. Summaries use formal corporate language despite prompts asking for casual tone. Technical decisions sections are empty ~60-70% of the time. Dialogue extraction fails with parsing errors. Duplicate entries appear. Cross-context dialogue bleeds between sessions.

**Solution**: Systematically restore the v1 architectural patterns that produced high-quality output while keeping v2's LangGraph framework. A comprehensive root cause analysis identified 10 specific differences between v1 and v2, each with a clear fix.

**Research Document**: Before starting ANY milestone, read `docs/research/v1-v2-journal-quality-analysis.md` in this repo. It contains the complete v1 vs v2 comparison with exact file paths, line numbers, code examples, and impact analysis for every difference.

**Why This Matters**: Journal entries are the primary output of this tool. If they read like corporate tech documentation instead of friendly development recaps, the tool fails its purpose. The v1 implementation proved that high-quality output is achievable with the right architecture.

## Success Criteria

1. Summaries use casual, conversational tone (no "comprehensive", "robust", "leveraging")
2. Technical decisions sections are populated when the summary describes decisions being made
3. No `[Dialogue extraction failed]` errors in journal output
4. No duplicate entries for the same commit hash
5. Dialogue quotes are relevant to the code changes (no cross-context bleed)
6. Low-value quotes like "commit and push" are filtered out
7. All changes validated by regenerating entries for recent commits and comparing quality

## Dependencies

- None. This PRD modifies only the journal generation pipeline.

## Research Document

**CRITICAL**: Every milestone below references `docs/research/v1-v2-journal-quality-analysis.md`. That document contains:
- The exact v1 code that worked (with file paths and line numbers)
- The exact v2 code that's broken (with file paths and line numbers)
- The specific impact of each difference on output quality
- The recommended fix for each difference

The implementing AI MUST read the full research document before starting each milestone. The research doc is the source of truth for what needs to change and why.

---

## Milestone 1: Per-Node Temperature Settings
**Prerequisites**: Read `docs/research/v1-v2-journal-quality-analysis.md`, section "Difference 1: Temperature Settings"

**Status**: Not Started

The single biggest impact change. V2 uses temperature 0 globally. V1 used 0.7 for narrative sections and 0.1 for factual extraction.

**What to change**:
- Replace the single shared model instance with per-node model creation
- Summary node: temperature 0.7
- Dialogue node: temperature 0.7
- Technical decisions node: temperature 0.1

**Files to modify**: `src/generators/journal-graph.js` (the `getModel()` function and each node's model usage)

**Done when**: Each node uses its own temperature setting. Generate a test entry and confirm the summary tone is noticeably more casual.

---

## Milestone 2: Restore Step-by-Step Prompt Architecture
**Prerequisites**: Read `docs/research/v1-v2-journal-quality-analysis.md`, sections "Difference 2" and "Difference 3"

**Status**: Not Started

Restore the explicit Step 1, Step 2, ... Step N prompt structure from v1. The v1 prompts are in the v1 repo at `/Users/whitney.lee/Documents/Repositories/commit-story-v1`. Read them directly as your reference.

**What to change**:

**Summary prompt** (`src/generators/prompts/sections/summary-prompt.js`):
- Restore 4-step architecture: Step 1 (Understand Changes), Step 2 (Find Why in Chat), Step 3 (Write Summary), Step 4 (Verify and Output)
- Restore the self-verification in Step 4: "verify your summary is authentic - not inflated, not minimized"
- Restore the mentor audience framing in Step 3 (see Difference 10 in research doc)
- Keep the v2 voice/tone examples (they're good additions) but integrate them into the step structure

**Dialogue prompt** (`src/generators/prompts/sections/dialogue-prompt.js`):
- Restore 8-step architecture from v1: Understand, Find Quotes, Remove Routine, Narrow, Verify, Add Context, Quality Check, Format
- The v1 dialogue prompt is the gold standard. Read it at `src/generators/prompts/sections/dialogue-prompt.js` in the v1 repo
- Keep v2's WHAT TO SKIP additions (plan injection detection, system tags) but integrate them into the step structure

**Technical decisions prompt** (`src/generators/prompts/sections/technical-decisions-prompt.js`):
- Restore 5-step architecture from v1: Identify Decisions, Identify Files, Match to Changes, Extract Evidence, Format Output
- The v1 tech decisions prompt is at `src/generators/prompts/sections/technical-decisions-prompt.js` in the v1 repo

**Done when**: All three prompts use explicit Step N headers. Generate test entries and confirm the model follows the step process (check that verification steps actually filter output).

---

## Milestone 3: Return to Free-Form Output for Dialogue and Technical Decisions
**Prerequisites**: Read `docs/research/v1-v2-journal-quality-analysis.md`, section "Difference 4: Structured Output vs Free-Form"

**Status**: Not Started

Remove the Zod structured output schemas for dialogue and technical decisions. Return to free-form markdown output like v1.

**What to change**:
- Remove `DialogueSchema` and `TechnicalDecisionsSchema` Zod definitions
- Remove `getStructuredModel()`, `fixDoubleEncodedOutput()`, `tryRecoverFromParsingError()`
- Remove `verifyDialogueQuotes()`, `formatDialogueToMarkdown()`, `formatTechnicalDecisionsToMarkdown()`
- Dialogue node: invoke model directly, return markdown string (like v1's `dialogue-generator.js`)
- Technical node: invoke model directly, return markdown string (like v1's `technical-decisions-generator.js`)
- The step-by-step prompts (from Milestone 2) will enforce format via prompt instructions instead of schema

**Why**: The structured output approach introduced parsing failures (`[Dialogue extraction failed]`), binary all-or-nothing behavior, and lost the model's formatting judgment. V1 proved that well-crafted prompts produce correctly formatted output without schema enforcement.

**Done when**: No Zod schemas for dialogue/technical. No parsing recovery logic. Generate entries and confirm no `[...failed]` messages appear. Dialogue and technical decisions sections are formatted correctly via prompt instructions alone.

---

## Milestone 4: Restore Session Grouping and Context Formatting
**Prerequisites**: Read `docs/research/v1-v2-journal-quality-analysis.md`, sections "Difference 5" and "Difference 6"

**Status**: Not Started

Restore v1's session-grouped message format and self-documenting context descriptions.

**What to change**:

**Session grouping**:
- The v2 context integrator already groups messages by session (`context.chat.sessions` is a Map)
- Create a `formatSessionsForAI()` function (modeled on v1's `src/utils/session-formatter.js`) that outputs session-grouped JSON
- Replace `formatChatMessages()` with session-grouped format in all nodes

**Self-documenting context** (lower priority, do if time allows):
- Add description fields to context sections in `src/integrators/context-integrator.js`
- Include descriptions in system prompts for all nodes

**Done when**: Chat messages sent to AI are grouped by session with session_id, session_start, message_count. Generate entries and confirm no cross-context dialogue bleed.

---

## Milestone 5: Dynamic maxQuotes, Early Exits, and Entry Deduplication
**Prerequisites**: Read `docs/research/v1-v2-journal-quality-analysis.md`, sections "Difference 7", "Difference 8", and "Additional V2-Only Issues"

**Status**: Not Started

Restore v1's dynamic scaling and safety checks.

**What to change**:

**Dynamic maxQuotes** (in dialogue node):
- Replace hardcoded `4` with: `Math.ceil(substantialUserMessages.length * 0.08) + 1`
- Need to count substantial user messages from context before passing to prompt

**Early exits** (in dialogue and technical nodes):
- Before invoking AI, check if there are substantial user messages
- If none, return "No significant dialogue/decisions..." immediately without API call
- Reference v1's early exit logic in `dialogue-generator.js:72-74` and `technical-decisions-generator.js:55-57`

**Entry deduplication** (in `src/managers/journal-manager.js`):
- Before appending an entry, read the existing file and check if the commit hash already has an entry
- Skip writing if duplicate found

**Full commit details section**:
- Restore the programmatic commit details from v1 (`journal-generator.js:164-243`): files changed list, lines changed count, commit message
- Replace the current minimal hash + author output

**Done when**: maxQuotes scales with conversation size. Empty conversations don't trigger API calls. No duplicate entries appear when regenerating. Commit details include files changed and line counts.

---

## Milestone 6: Validation and Cleanup
**Prerequisites**: All previous milestones complete

**Status**: Not Started

End-to-end validation of the complete fix.

**What to do**:
1. Delete recent journal entries in both repos (commit-story-v2 and cluster-whisperer)
2. Regenerate entries for the last 5-10 commits in each repo
3. Evaluate every generated entry against the success criteria:
   - Casual tone (no corporate language)
   - Technical decisions populated when summary describes decisions
   - No parsing failure messages
   - No duplicates
   - No cross-context dialogue
   - No low-value quotes
4. Compare side-by-side with the old entries documented in the quality evaluation
5. Fix any remaining issues found during validation

**Done when**: All success criteria pass. Journal entries read like v1 quality or better.

---

## Non-Goals

- **Changing the LangGraph framework**: We're fixing the content generation, not the orchestration layer
- **Adding telemetry**: This is still Phase 1 (zero telemetry)
- **Changing the model provider**: We're staying with Claude/Anthropic, just fixing how we use it
- **Rewriting from scratch**: We're surgically restoring v1 patterns into the v2 architecture

## Technical Notes

### V1 Repo Location
The v1 codebase is at `/Users/whitney.lee/Documents/Repositories/commit-story-v1`. Key files to reference are listed in the research document's File Reference Map section.

### Testing Approach
After each milestone, generate journal entries for recent commits and evaluate quality. The `--dry-run` flag can be used to preview without saving. Manual evaluation is the primary validation method since journal quality is subjective.

### Guidelines Changes
The v2 guidelines (context framing, output format) were added to address symptoms of the underlying problems. Once the root causes are fixed (temperature, prompts, etc.), evaluate whether the extra guidelines are still needed or if they can be simplified back to v1's two guidelines (anti-hallucination + accessibility).

## Progress Log

_No progress yet - PRD just created_
