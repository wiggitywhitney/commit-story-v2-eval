# PRD #39: Journal Summaries (Daily/Weekly/Monthly Rollups)

## Overview

**Problem**: Individual per-commit journal entries accumulate rapidly but there's no consolidated view of work across a day, week, or month. Developers lose the forest for the trees — reviewing yesterday's work means scanning N separate commit entries instead of reading one narrative.

**Solution**: Automated summary generation at daily, weekly, and monthly cadences. Daily summaries trigger on the first commit of a new day, consolidating all entries from the previous day. Weekly and monthly rollups build on top of dailies, creating a hierarchical narrative of development work.

**Why This Matters**: The commit-level journal captures the "what happened in this commit" story. Summaries capture the "what did I accomplish today/this week/this month" story — the level most useful for standups, retrospectives, and personal reflection.

**Prior Art**: This feature was designed in commit-story v1 (PRD-5) but never implemented. The v1 design is adapted here for v2's LangGraph architecture and Anthropic model.

## Success Criteria

1. Daily summaries generate automatically on first commit of a new day
2. Manual backfill command works for any historical date or date range
3. Gap detection correctly handles weekends, vacations, and irregular schedules
4. No duplicate summaries are created
5. Weekly summaries consolidate dailies into a coherent weekly narrative
6. Monthly summaries consolidate weeklies into a monthly retrospective
7. Existing per-commit journal generation is unaffected

## Dependencies

None — this PRD builds on the existing journal infrastructure (`journal-manager.js`, `journal-paths.js`, `journal-graph.js`).

## File Structure

```text
journal/
├── entries/          (existing - per-commit)
│   └── YYYY-MM/
│       └── YYYY-MM-DD.md
├── reflections/      (existing)
├── context/          (existing)
└── summaries/        (new)
    ├── daily/
    │   └── YYYY-MM-DD.md
    ├── weekly/
    │   └── YYYY-Www.md     (ISO week-year + week number, e.g., 2026-W01)
    └── monthly/
        └── YYYY-MM.md
```

## Milestones

### Milestone 1: Daily Summary Generation
**Status**: Complete

Implement the core daily summary pipeline — read all journal entries for a given date, generate a consolidated narrative via LangGraph, and write to `journal/summaries/daily/`.

**Key decisions**:
- Summary section structure: Use a summary-specific format rather than mirroring the 4-section commit entry structure. Daily summaries should feel like a standup recap, not a concatenated list of commits.
- Proposed sections: **Narrative** (what was accomplished and why), **Key Decisions** (consolidated technical decisions from the day), **Open Threads** (things left unfinished or questions raised)

**What's included**:
- [x] `src/utils/journal-paths.js` — add `getSummaryPath(cadence, date)` and `getSummariesDirectory(cadence)`
- [x] `src/generators/summary-graph.js` — new LangGraph StateGraph for summary generation (separate from per-commit journal-graph)
- [x] `src/generators/prompts/sections/daily-summary-prompt.js` — prompt template for daily consolidation
- [x] `src/managers/summary-manager.js` — orchestrates reading entries, calling the graph, writing output
- [x] Tests for all new components

**Done when**: `npx commit-story summarize 2026-02-22` reads that day's journal entries and produces a coherent daily summary in `journal/summaries/daily/2026-02-22.md`

---

### Milestone 2: Gap Detection and Auto-Trigger
**Status**: Complete

Make daily summaries automatic — detect the first commit of a new day and generate summaries for all unsummarized previous days.

**What's included**:
- [x] `src/utils/summary-detector.js` — identify which days have entries but no summary
- [x] Integration into `src/index.js` — after saving a journal entry, check if summaries are needed for previous days
- [x] Smart gap handling: skip days with no entries (weekends, vacations), detect irregular patterns
- [x] Duplicate prevention: check for existing summary files before generating
- [x] Configuration: environment variable to enable/disable auto-summaries (`COMMIT_STORY_AUTO_SUMMARIZE=true`)
- [x] Tests for gap detection logic and auto-trigger integration

**Done when**: Making the first commit on Monday automatically generates daily summaries for any unsummarized days from the previous week that had journal entries

---

### Milestone 3: Manual Backfill CLI
**Status**: Complete

Provide a CLI command for generating summaries on demand — useful for historical backfill, regeneration, and testing.

**What's included**:
- [x] CLI subcommand: `npx commit-story summarize [date|date-range] [--force]`
- [x] Date range support (inclusive endpoints, reversed ranges normalized to ascending): `npx commit-story summarize 2026-02-01..2026-02-15`
- [x] Single date: `npx commit-story summarize 2026-02-22`
- [x] `--force` flag to regenerate existing summaries
- [x] Progress indicator for multi-day backfill operations
- [x] Validation: skip dates with no entries, warn on dates with existing summaries
- [x] Tests for CLI argument parsing and backfill orchestration

**Done when**: `npx commit-story summarize 2026-02-01..2026-02-20` generates daily summaries for all days in that range that have entries, with a progress indicator

---

### Milestone 4: Weekly Summaries
**Status**: Not Started

Weekly rollups that consolidate daily summaries into a higher-level narrative. Uses ISO week-year + week numbers for consistency (note: ISO week-year can differ from calendar year near boundaries, e.g., 2019-12-30 is in ISO week 2020-W01).

**What's included**:
- [ ] `src/generators/prompts/sections/weekly-summary-prompt.js` — prompt for weekly consolidation
- [ ] Extend `summary-manager.js` to support weekly cadence
- [ ] Proposed sections: **Week in Review** (narrative arc of the week's work), **Highlights** (most significant accomplishments), **Patterns** (recurring themes, persistent blockers, emerging directions)
- [ ] Auto-trigger: generate weekly summary on first commit after a week boundary
- [ ] Manual: `npx commit-story summarize --weekly 2026-W08`
- [ ] Tests for weekly generation and cadence detection

**Done when**: Weekly summaries generate from daily summaries and read as a coherent weekly development narrative

---

### Milestone 5: Monthly Summaries
**Status**: Not Started

Monthly rollups that consolidate weekly summaries into a retrospective view.

**What's included**:
- [ ] `src/generators/prompts/sections/monthly-summary-prompt.js` — prompt for monthly consolidation
- [ ] Extend `summary-manager.js` to support monthly cadence
- [ ] Proposed sections: **Month in Review** (narrative arc), **Accomplishments** (shipped features, resolved issues), **Growth** (skills learned, patterns discovered), **Looking Ahead** (open threads, upcoming work)
- [ ] Auto-trigger: generate monthly summary on first commit of a new month
- [ ] Manual: `npx commit-story summarize --monthly 2026-02`
- [ ] Tests for monthly generation

**Done when**: Monthly summaries generate from weekly summaries and provide a useful retrospective of the month's development work

---

### Milestone 6: Documentation and Integration
**Status**: Not Started

User-facing documentation and polish for the summary feature.

**What's included**:
- [ ] Update README with summary commands and configuration
- [ ] Update `--help` output with summary subcommand
- [ ] Document environment variables (`COMMIT_STORY_AUTO_SUMMARIZE`, `COMMIT_STORY_TIMEZONE`)
- [ ] Document file structure for summaries directory
- [ ] Verify MCP tools (reflections, context) work correctly alongside summary generation

**Done when**: A new user can discover, configure, and use summary generation from the README alone

## Design Decisions

### DD-001: Separate LangGraph for summaries
**Decision**: Create `summary-graph.js` as a new StateGraph rather than extending `journal-graph.js`
**Rationale**: Per-commit generation and summary generation have different inputs (raw context vs. rendered markdown entries), different prompt structures, and different output formats. Keeping them separate avoids conditional complexity in the graph.

### DD-002: Summary-specific section structure
**Decision**: Use summary-focused sections (Narrative, Key Decisions, Open Threads) rather than mirroring the 4-section commit entry format
**Rationale**: Daily summaries serve a different purpose than commit entries. A standup-style narrative is more useful than concatenated summaries + concatenated dialogues. The weekly and monthly cadences get their own section structures too, optimized for their respective time horizons.

### DD-003: File existence for duplicate detection
**Decision**: Check for existing summary files rather than maintaining a metadata/tracking file
**Rationale**: Simpler, no state to manage, easy to inspect. If `journal/summaries/daily/2026-02-22.md` exists, that day is summarized. The `--force` flag allows regeneration when needed.

### DD-004: ISO week numbers for weekly summaries
**Decision**: Use ISO 8601 week numbers (e.g., `2026-W08.md`) for weekly summary filenames
**Rationale**: ISO weeks are unambiguous and widely understood. Avoids the complexity of custom week boundaries.

### DD-005: Timezone policy for boundary calculations
**Decision**: Use `COMMIT_STORY_TIMEZONE` env var (IANA format, e.g. `America/Chicago`) for all day/week/month boundary calculations. Falls back to system local time if unset.
**Rationale**: Day boundaries ("is this the first commit of a new day?"), ISO week numbering, and monthly rollup triggers all depend on which timezone interprets the commit timestamp. A developer in `America/New_York` and one in `Asia/Tokyo` would disagree on which day a midnight-UTC commit belongs to. The env var gives explicit control; the system-local fallback keeps zero-config working for solo developers. This follows v1's DD-008 lesson (UTC-first storage with timezone-aware display). All boundary helper functions accept a timezone parameter sourced from this env var.

## Open Questions

1. **Temperature for summary generation**: Should summaries use the same 0.7 temperature as commit narratives, or a different value? Higher temperatures might produce more creative weekly/monthly narratives but risk hallucination.

2. **Token budget for summary input**: Daily summaries read rendered markdown entries. What's the right token budget when a day has 20+ commits with long entries?

3. **Reflections in summaries**: Should daily summaries incorporate reflections and context captures from that day, or only the journal entries?

## Progress Log

### 2026-03-04
- Completed Milestone 3: Manual Backfill CLI
- Created `src/commands/summarize.js` — date parsing, range expansion, backfill orchestration
- Added subcommand routing to `src/index.js` — detects `summarize` as first arg, routes to handler
- Progress indicator with `[N/total]` format for multi-day operations
- Updated `--help` output with summarize subcommand documentation
- 22 new tests (10 arg parsing + 4 range expansion + 8 integration), all 410 tests passing
- Completed Milestone 2: Gap Detection and Auto-Trigger
- Created `summary-detector.js` — `findUnsummarizedDays()` and `getDaysWithEntries()` scan filesystem for gaps
- Created `auto-summarize.js` — orchestrates sequential summary generation with error resilience and progress callbacks
- Added `COMMIT_STORY_AUTO_SUMMARIZE` and `COMMIT_STORY_TIMEZONE` to config.js
- Integrated auto-trigger into index.js — runs after journal entry save when enabled
- 21 new tests (13 detector + 8 auto-summarize), all 388 tests passing
- Completed Milestone 1: Daily Summary Generation
- Added `getSummaryPath`, `getSummariesDirectory`, `getISOWeekString` to journal-paths.js
- Created `daily-summary-prompt.js` with 5-step architecture (authored via /write-prompt)
- Created `summary-graph.js` — separate LangGraph StateGraph per DD-001
- Created `summary-manager.js` — orchestrates read entries → generate → save with duplicate detection (DD-003)
- 55 new tests across 4 test files, all 367 tests passing

### 2026-02-23
- Created PRD from v1 PRD-5 design adapted for v2 architecture
- Defined 6 milestones: daily generation → auto-trigger → CLI backfill → weekly → monthly → docs
