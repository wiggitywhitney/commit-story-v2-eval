// ABOUTME: Prompt template for daily summary generation (consolidates a day's journal entries)
// ABOUTME: Produces three sections: Narrative, Key Decisions, Open Threads

/**
 * Generates the daily summary prompt for consolidating a day's journal entries.
 *
 * @param {number} entryCount - Number of journal entries being summarized
 * @returns {string} Complete prompt for daily summary generation
 */
export function dailySummaryPrompt(entryCount) {
  const scopeGuidance = entryCount === 1
    ? `There is only 1 journal entry for this day. Keep the summary brief and factual — do not pad or inflate a single commit's work into something larger.`
    : `There are ${entryCount} journal entries for this day. Look for connections between commits — recurring themes, evolving approaches, and how earlier work led to later decisions.`;

  return `
## Step 1: Inventory the Day's Work

You are summarizing a developer's day of work. Below are their journal entries from the day — each one documents a single commit with its own summary, dialogue, technical decisions, and sometimes reflections.

Read all entries carefully. For each entry, note:
- What changed (the core action)
- Why it changed (motivation, if mentioned)
- Any decisions made or problems encountered
- Any unfinished threads or open questions

${scopeGuidance}

## Step 2: Write the Narrative

Write a standup-style recap of the day. This is the "what did I accomplish today" story — not a list of commits.

Synthesize across entries. If three commits all relate to the same feature, describe the feature work once with the full arc, not three separate paragraphs. Group related work together. Mention unrelated work separately.

**Voice & Tone:**
- Use contractions (wasn't, it's, didn't, they're)
- Refer to "the developer" (third person)
- Acknowledge problems casually ("it was getting messy", "kept breaking")
- Direct language, no corporate-speak
- Brief is fine — don't pad with filler

**Do NOT:**
- List commits individually ("In commit abc123...")
- Repeat the same information from multiple entries
- Infer motivation that isn't stated in the entries
- Invent details not present in the source entries

BANNED WORDS: comprehensive, robust, significant, systematic, meticulous, methodical, sophisticated, leveraging, enhanced, utilizing. If any appear in your draft, replace them with simpler words.

## Step 3: Consolidate Key Decisions

Extract technical decisions from across the day's entries. Merge duplicates — if the same decision appears in multiple entries, consolidate into one.

For each decision:
- State what was decided
- Include the reasoning (only if explicitly stated in the entries)
- Note tradeoffs (only if explicitly discussed)

If no technical decisions were documented in any entry, output: "No key decisions documented today."

## Step 4: Identify Open Threads

Scan the entries for:
- Questions raised but not answered
- Work started but not finished
- Problems identified but not resolved
- Ideas mentioned for future exploration
- Reflections that surface unresolved concerns

These are threads the developer might pick up tomorrow. If none exist, output: "No open threads identified."

## Step 5: Output

Before outputting, verify: every claim in your summary traces back to a specific entry. If you cannot point to which entry supports a statement, remove it.

Output using this exact format with these exact markdown headers:

## Narrative

[Your synthesized narrative prose here. No bullet points. No commit hashes. Start directly with what happened.]

## Key Decisions

[Each decision as a bullet point with reasoning. Or the "no decisions" message.]

## Open Threads

[Each open thread as a bullet point. Or the "no threads" message.]

Output ONLY these three sections. No preamble. No closing commentary. Start directly with "## Narrative".
`.trim();
}
