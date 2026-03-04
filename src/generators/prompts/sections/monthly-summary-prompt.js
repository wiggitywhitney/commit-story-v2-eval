// ABOUTME: Prompt template for monthly summary generation (consolidates a month's weekly summaries)
// ABOUTME: Produces four sections: Month in Review, Accomplishments, Growth, Looking Ahead

/**
 * Generates the monthly summary prompt for consolidating a month's weekly summaries.
 *
 * @param {number} weekCount - Number of weekly summaries being consolidated
 * @returns {string} Complete prompt for monthly summary generation
 */
export function monthlySummaryPrompt(weekCount) {
  const scopeGuidance = weekCount === 1
    ? `There is only 1 weekly summary for this month. Keep the monthly summary brief — do not inflate a single week's work into a full month narrative.`
    : `There are ${weekCount} weekly summaries for this month. Look for the arc of the month — how work evolved from week to week, what themes emerged, and how early decisions shaped later work.`;

  return `
## Step 1: Read the Month's Weekly Summaries

You are consolidating a developer's month of work. Below are their weekly summaries — each one covers a full week's commits with a narrative, highlights, and patterns.

Read all weekly summaries carefully. For each week, note:
- The main work accomplished that week
- Key highlights and accomplishments
- Patterns and recurring themes
- How the week's work relates to other weeks in the month

${scopeGuidance}

## Step 2: Write the Month in Review

Write a narrative arc of the month. This is the "what did I accomplish this month" story — not a week-by-week recap.

Synthesize across weeks. If three weeks all involved the same project, describe the project's progression as one story, not three separate week summaries. Group related work into narrative threads.

**Voice & Tone:**
- Use contractions (wasn't, it's, didn't, they're)
- Refer to "the developer" (third person)
- Acknowledge problems casually ("it was getting messy", "kept breaking")
- Direct language, no corporate-speak
- Brief is fine — don't pad with filler

**Do NOT:**
- Recap each week separately ("In Week 1... In Week 2...")
- Repeat information that appears in multiple weekly summaries
- Infer motivation that isn't stated in the weekly summaries
- Invent details not present in the source summaries

BANNED WORDS: comprehensive, robust, significant, systematic, meticulous, methodical, sophisticated, leveraging, enhanced, utilizing. If any appear in your draft, replace them with simpler words.

## Step 3: Identify Accomplishments

Extract the most important things shipped or completed during the month. These are the items worth mentioning in a monthly retrospective — features shipped, problems solved, milestones reached.

For each accomplishment:
- State what was completed (1-2 sentences max)
- Include brief context for why it matters (only if evident from the summaries)

Limit to 3-7 accomplishments. If the month had only one notable achievement, list just that one.

If no clear accomplishments emerge from the summaries, output: "No standout accomplishments this month."

## Step 4: Surface Growth

Look across the month for evidence of learning and development:
- New skills or technologies adopted
- Patterns discovered or refined
- Problems that taught something
- Process improvements (how the developer's workflow changed)
- Technical depth gained in a particular area

These growth signals help the developer see their progress over time. If no growth signals are evident, output: "No notable growth signals this month."

## Step 5: Identify What's Looking Ahead

Look for threads that point toward future work:
- Open threads from the final week(s) that will carry into next month
- Emerging directions that started but aren't finished
- Questions raised but not yet answered
- Technical debt or cleanup identified but deferred

If no forward-looking threads are evident, output: "No open threads carrying into next month."

## Step 6: Output

Before outputting, verify: every claim in your summary traces back to a specific weekly summary. If you cannot point to which week supports a statement, remove it.

Output using this exact format with these exact markdown headers:

## Month in Review

[Your synthesized monthly narrative here. No bullet points in this section. Start directly with what happened.]

## Accomplishments

[Each accomplishment as a bullet point. Or the "no accomplishments" message.]

## Growth

[Each growth signal as a bullet point. Or the "no growth" message.]

## Looking Ahead

[Each forward-looking thread as a bullet point. Or the "no open threads" message.]

Output ONLY these four sections. No preamble. No closing commentary. Start directly with "## Month in Review".
`.trim();
}
