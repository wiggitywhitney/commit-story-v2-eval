/**
 * Summary Section Prompt - Restructured with Step-Based Architecture
 *
 * Generates narrative summaries of development sessions with authentic significance matching.
 *
 * Ported from v1: Removed telemetry code, kept all prompt logic.
 */

// Always present - opening sentence
const openingSentence = `Write one opening sentence that states what changed. Lead with the thing that changed as the subject, followed by a strong past-tense verb. Avoid filler adjectives like significant, notable, or meaningful. Avoid "The session..." or "The developer..." openings.`;

// Code changes with chat context
const codeWithContext = `Describe what changed in the code and why (not documentation files like .md, .txt, or task management files). This is usually the longest part of the summary. Include the problems solved, alternatives considered, and the reasoning behind decisions. Discussion depth and complexity matter more than code volume. Write in friendly, direct language - avoid jargon and tech-speak when explaining to the mentor.`;

// Discussions
const discussions = `Summarize discussions that didn't produce functional code. Length should match significance - major strategic decisions deserve detail, minor discussions can be brief or omitted.`;

// Code without chat context
const codeWithoutContext = `Describe what changed in the code (not documentation files like .md, .txt, or task management files). Keep it brief and factual - you don't have chat context to explain why. Length should match the scope of changes.`;

// Documentation only
const documentationOnly = `Is your opening sentence enough information about this commit? It probably is, since there was not much discussion between the AI and the developer. However, if there is an important detail you may take one more sentence and describe it.`;

/**
 * Generates the summary prompt with conditional instructions
 * @param {boolean} hasFunctionalCode - Whether commit has functional code changes
 * @param {boolean} hasSubstantialChat - Whether session has substantial discussions
 * @returns {string} Complete summary prompt
 */
export function summaryPrompt(hasFunctionalCode, hasSubstantialChat) {
  // Step 2: Conditional based on chat and code presence
  let step2;
  if (hasSubstantialChat && hasFunctionalCode) {
    // Scenario 1: Code + Chat - look for why behind code changes
    step2 = `## Step 2: Find the Why in the Chat

In the chat data, type:"user" messages are from the human developer. type:"assistant" messages are from the AI. The user is your boss and their questions and insights are more important to you, although the overall story of the session matters too.

Look through the chat conversations for discussions about these specific changes. Why were they made? What problems did they solve? What alternatives were considered?

Also include important discussions and discoveries, even if they didn't result in code changes.`;
  } else if (hasSubstantialChat && !hasFunctionalCode) {
    // Scenario 3: No Code + Chat - look for what was discussed/decided
    step2 = `## Step 2: Find What Was Discussed

In the chat data, type:"user" messages are from the human developer. type:"assistant" messages are from the AI. The user is your boss and their questions and insights are more important to you, although the overall story of the session matters too.

Look through the chat conversations. What was discussed, planned, or decided? What problems were explored? What alternatives were considered?`;
  } else {
    // Scenario 2 & 4: No substantial chat - skip
    step2 = `## Step 2: Skip this step.`;
  }

  // Step 3 instructions based on scenario
  let step3Instructions = openingSentence;

  if (hasFunctionalCode && hasSubstantialChat) {
    // Scenario 1: Code + Chat - full context available
    step3Instructions += `\n\n${codeWithContext}`;
    step3Instructions += `\n\n${discussions}`;
  } else if (hasFunctionalCode && !hasSubstantialChat) {
    // Scenario 2: Code + No Chat - just describe what changed
    step3Instructions += `\n\n${codeWithoutContext}`;
  } else if (!hasFunctionalCode && hasSubstantialChat) {
    // Scenario 3: No Code + Chat - discussions only
    step3Instructions += `\n\n${discussions}`;
  } else {
    // Scenario 4: No Code + No Chat - documentation only
    step3Instructions += `\n\n${documentationOnly}`;
  }

  // Conditional intro for Step 3 based on scenario
  let step3Intro;
  if (!hasFunctionalCode && !hasSubstantialChat) {
    // Scenario 4: No code, no chat - routine documentation update
    step3Intro = `## Step 3: Write the Summary

This is a routine documentation update with minimal discussion. Write a brief factual summary.

**Important guidelines:**
- Use accurate verbs: "planned/designed/documented" for planning work, "implemented/built/coded" for functional code
- Be honest - some work is interesting, some is routine. Both deserve accurate description without inflation or minimization
- Avoid subjective qualifiers like "successfully", "significant", "major progress"
- One sentence is often enough for simple changes`;
  } else {
    // Scenarios 1, 2, 3: Normal framing
    step3Intro = `## Step 3: Write the Summary

Write for someone unfamiliar with the project who has no prior context. Write the summary as natural conversational prose, no bullet points, no section headers.

**Voice & Tone:**
Write casually but clearly, like explaining to a friend. Use third person ("the developer") to keep it universal.

TOO FORMAL (avoid):
"The authentication module was refactored to implement a more maintainable architecture."
"The journal output architecture was restructured to prevent reasoning artifacts."

GOOD (aim for this):
"The developer cleaned up the authentication code - it was getting tangled, so they restructured it."
"The prompts were leaking internal reasoning into the final output, so the developer changed them to keep that internal."

Key voice markers:
- Use contractions (wasn't, it's, didn't, they're)
- Refer to "the developer" (third person, universal)
- Acknowledge problems casually ("it was getting messy", "kept breaking")
- Direct language over corporate-speak
- Brief is fine - don't pad with filler

**Important guidelines:**
- Use accurate verbs: "planned/designed/documented" for planning work, "implemented/built/coded" for functional code
- Be honest - some work is interesting, some is routine. Both deserve accurate description without inflation or minimization
- Avoid subjective qualifiers like "successfully", "significant", "major progress"`;
  }

  const prompt = `
You are writing a journal entry about a development session. Write in third person using "the developer" to keep it universal.

VOICE REQUIREMENT (CRITICAL):
- Write casually, like explaining to a friend who codes
- Use "the developer" (third person) not "I" or passive voice
- Use contractions: "didn't", "wasn't", "it's", "they're"
- Keep it brief and direct

BAD: "The journal output architecture was restructured to prevent reasoning artifacts."
GOOD: "The developer restructured the journal output to stop it from leaking internal reasoning."

BAD: "The core problem was that the previous prompts used step-by-step instructions."
GOOD: "The prompts were walking through steps out loud, so the developer changed them to keep that internal."

INTERNAL ANALYSIS (do not output this):
- First, analyze the git diff: What files changed? What was added, removed, or modified?
- Distinguish between documentation files and functional code files.
${step2.replace('## Step 2: ', '- ')}

WRITING GUIDELINES:
${step3Intro.replace('## Step 3: Write the Summary\n\n', '')}

${step3Instructions}

OUTPUT:
Write only your final narrative prose summary in third person. No bullet points, no numbered lists - prose paragraphs only. Do not include any analysis steps or meta-commentary. Just the summary text.
`.trim();

  return prompt;
}
