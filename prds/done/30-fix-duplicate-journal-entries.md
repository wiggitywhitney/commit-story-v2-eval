# PRD #30: Fix Duplicate Journal Entries from Cherry-Picked/Rebased Commits

## Problem Statement

When commits are cherry-picked or rebased, the `post-commit` hook fires for both the original commit and the newly created commit. Since cherry-pick/rebase produces a new hash with identical content, the current dedup logic (which matches on commit hash) fails to detect the duplicate entry. This results in two journal entries for the same logical change appearing in the daily journal file.

Observed on 2026-02-07 across both commit-story-v2 and cluster-whisperer repos:
- **commit-story-v2**: 1 duplicate pair (e749a96 / bb68ec4)
- **cluster-whisperer**: 2 duplicate pairs (e1e3c38 / 164e090, bbe9725 / 6573918)

The duplicates share identical author timestamps and commit messages but have different commit hashes and different parent commits — the hallmark of cherry-pick or rebase operations.

## Root Cause Analysis

**Current dedup logic** (`src/managers/journal-manager.js:184`):
```javascript
if (existing.includes(`Commit: ${commit.shortHash}`)) {
    return entryPath; // Skip duplicate
}
```

This only catches exact hash matches (e.g., running the hook twice for the same commit). It does not catch semantically identical commits created by cherry-pick or rebase, which have:
- Same tree hash (identical file content)
- Same author timestamp
- Same commit message
- **Different** commit hash
- **Different** parent commit
- **Different** committer timestamp

**v1 reference**: commit-story-v1 had no dedup logic at all (`appendFile` unconditionally). The DD-016 v2 merge commit handling in v1 is unrelated — it addresses merge commits (2+ parents), not cherry-pick/rebase duplicates.

## Solution Overview

Improve the dedup check to detect semantically identical commits by matching on author timestamp + commit message, rather than relying solely on commit hash. This catches cherry-picks and rebases because those operations preserve the original author date and message.

## Prior Work

- **v1 DD-016**: Merge commit skip logic (skip if merge AND no chat AND no diff). Different problem — addresses merge commits, not cherry-pick/rebase duplicates.
- **v2 hash-based dedup**: Added in the v2 rebuild. Catches exact re-runs but not cherry-pick/rebase.

## User Stories

- As a developer using cherry-pick or rebase workflows, I want the journal to contain only one entry per logical change
- As a developer reviewing journal entries, I want to trust that each entry represents a distinct piece of work

## Success Criteria

- [x] Cherry-picked commits do not produce duplicate journal entries
- [x] Rebased commits do not produce duplicate journal entries
- [x] Exact-hash duplicates (existing behavior) are still caught
- [x] Legitimate commits with the same message but different timestamps are NOT suppressed
- [x] The dedup approach works for both commit-story-v2's own journal and journals in other repos (cluster-whisperer)

## Milestones

### Milestone 1: Improve Dedup Logic in Journal Manager
**Status**: Complete

Replace the hash-only dedup check with a combined check that matches on:
1. **Commit hash** (existing — catches exact re-runs)
2. **Author timestamp + first line of commit message** (new — catches cherry-pick/rebase)

The timestamp match should use the formatted display string already present in journal headers (e.g., `## 8:01:13 AM CST`), since that's what's written to the file. This avoids needing to parse raw timestamps from existing entries.

**Done when**: A cherry-picked or rebased commit is detected as a duplicate and skipped. Existing exact-hash dedup still works.

### Milestone 2: Add Debug Logging for Skip Decisions
**Status**: Complete

Add debug output (using existing `debug()` pattern) that logs when a duplicate is detected and why (hash match vs semantic match). This aids troubleshooting without affecting normal output.

**Done when**: Running with debug enabled shows clear skip-reason messages for both dedup paths.

### Milestone 3: Validate Across Both Repos
**Status**: Complete

Test the fix by running commit-story against both repos to confirm:
- Normal commits generate entries as before
- Cherry-picked commits are correctly deduplicated
- The fix works when commit-story processes commits in cluster-whisperer (different repo context)

**Done when**: Manual validation confirms no regressions and cherry-pick/rebase duplicates are caught in both repos.

## Risks

- **False positive suppression**: Two legitimately different commits could share the same message and author timestamp (e.g., rapid `git commit --allow-empty` with identical messages). Mitigated by requiring BOTH timestamp AND message to match, making false positives extremely unlikely.
- **Timestamp formatting edge case**: If the formatted timestamp string changes (locale, timezone display), old entries might not match. Mitigated by the hash check remaining as the primary path — the semantic check is a secondary safety net.

## Dependencies

None. This is a standalone bug fix in the journal manager.
