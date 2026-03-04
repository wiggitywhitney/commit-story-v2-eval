// ABOUTME: LangGraph StateGraph for daily summary generation (separate from per-commit journal-graph)
// ABOUTME: Consolidates a day's journal entries into Narrative, Key Decisions, and Open Threads sections

import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { dailySummaryPrompt } from './prompts/sections/daily-summary-prompt.js';

/**
 * Summary state definition using LangGraph Annotation API.
 * Input: entries (array of rendered markdown strings) and date.
 * Output: parsed sections from the LLM response.
 */
export const SummaryState = Annotation.Root({
  // Input
  entries: Annotation(),
  date: Annotation(),

  // Outputs (populated by node)
  narrative: Annotation(),
  keyDecisions: Annotation(),
  openThreads: Annotation(),

  // Metadata
  errors: Annotation({
    reducer: (left, right) => [...(left || []), ...(right || [])],
    default: () => [],
  }),
});

/**
 * Cache of model instances keyed by temperature.
 * Separate from journal-graph's cache to keep the two graphs independent.
 */
const models = new Map();

/**
 * Get or create a Claude model instance for a given temperature
 * @param {number} temperature - Temperature setting
 * @returns {ChatAnthropic} Model instance
 */
export function getModel(temperature = 0.7) {
  if (!models.has(temperature)) {
    models.set(
      temperature,
      new ChatAnthropic({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 4096,
        temperature,
      })
    );
  }
  return models.get(temperature);
}

/**
 * Reset all model instances (for testing)
 */
export function resetModel() {
  models.clear();
}

/**
 * Format journal entries for LLM consumption.
 * Numbers each entry and provides context about the day.
 * @param {string[]} entries - Rendered markdown journal entries
 * @returns {string} Formatted entries for the human message
 */
export function formatEntriesForSummary(entries) {
  if (!entries || entries.length === 0) {
    return 'No journal entries found for this date.';
  }

  const count = entries.length;
  const header = count === 1
    ? `The following is 1 journal entry from this day:`
    : `The following are ${count} journal entries from this day:`;

  const numbered = entries.map((entry, i) =>
    `--- Entry ${i + 1} of ${count} ---\n\n${entry}`
  ).join('\n\n');

  return `${header}\n\n${numbered}`;
}

/**
 * Parse the LLM's response into the three summary sections.
 * Extracts content between ## Narrative, ## Key Decisions, ## Open Threads headers.
 * @param {string} raw - Raw LLM output
 * @returns {{ narrative: string, keyDecisions: string, openThreads: string }}
 */
function parseSummarySections(raw) {
  const sections = { narrative: '', keyDecisions: '', openThreads: '' };
  if (!raw) return sections;

  // Split by ## headers and capture header names
  const sectionPattern = /^## (Narrative|Key Decisions|Open Threads)\s*$/gm;
  const matches = [...raw.matchAll(sectionPattern)];

  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1];
    const startIdx = matches[i].index + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const content = raw.slice(startIdx, endIdx).trim();

    if (name === 'Narrative') sections.narrative = content;
    else if (name === 'Key Decisions') sections.keyDecisions = content;
    else if (name === 'Open Threads') sections.openThreads = content;
  }

  // If no sections were parsed, put everything in narrative
  if (!sections.narrative && !sections.keyDecisions && !sections.openThreads) {
    sections.narrative = raw.trim();
  }

  return sections;
}

/**
 * Post-processing: clean daily summary output.
 * Strips preamble and replaces banned formal words.
 * Reuses the same banned word list as journal-graph.
 */
const BANNED_WORD_REPLACEMENTS = [
  [/\bcomprehensiv(e|ely)\b/gi, (_, suffix) => suffix === 'ely' ? 'thoroughly' : 'detailed'],
  [/\brobust\b/gi, 'solid'],
  [/\bsignificant\b/gi, 'important'],
  [/\bsystematic(ally)?\b/gi, (_, suffix) => suffix ? 'carefully' : 'structured'],
  [/\bmeticulous(ly)?\b/gi, (_, suffix) => suffix ? 'carefully' : 'careful'],
  [/\bmethodical(ly)?\b/gi, (_, suffix) => suffix ? 'carefully' : 'careful'],
  [/\ba sophisticated\b/gi, 'an advanced'],
  [/\bsophisticated\b/gi, 'advanced'],
  [/\bleverag(e[ds]?|ing)\b/gi, (_, suffix) => suffix === 'ing' ? 'using' : 'used'],
  [/\benhance[ds]?\b/gi, 'improved'],
  [/\benhancing\b/gi, 'improving'],
  [/\benhancements?\b/gi, (match) => match.endsWith('s') ? 'improvements' : 'improvement'],
  [/\butiliz(e[ds]?|ing|ation)\b/gi, (_, suffix) => {
    if (suffix === 'ing') return 'using';
    if (suffix === 'ation') return 'use';
    return 'used';
  }],
];

export function cleanDailySummaryOutput(raw) {
  if (!raw) return raw;

  let result = raw;

  // Replace banned words
  for (const [pattern, replacement] of BANNED_WORD_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  // Strip preamble before ## Narrative
  const narrativeIdx = result.indexOf('## Narrative');
  if (narrativeIdx > 0) {
    result = result.slice(narrativeIdx);
  }

  return result.trim() || raw;
}

/**
 * Daily summary generation node.
 * Reads journal entries and produces a consolidated daily summary.
 */
export async function dailySummaryNode(state) {
  const { entries, date } = state;

  // Early exit: no entries to summarize
  if (!entries || entries.length === 0) {
    return {
      narrative: 'No journal entries found for this date.',
      keyDecisions: '',
      openThreads: '',
      errors: [],
    };
  }

  try {
    const prompt = dailySummaryPrompt(entries.length);
    const formattedEntries = formatEntriesForSummary(entries);

    const result = await getModel(0.7).invoke([
      new SystemMessage(prompt),
      new HumanMessage(formattedEntries),
    ]);

    const cleaned = cleanDailySummaryOutput(result.content);
    const sections = parseSummarySections(cleaned);

    return {
      narrative: sections.narrative,
      keyDecisions: sections.keyDecisions,
      openThreads: sections.openThreads,
      errors: [],
    };
  } catch (error) {
    return {
      narrative: '[Daily summary generation failed]',
      keyDecisions: '',
      openThreads: '',
      errors: [`Daily summary generation failed: ${error.message}`],
    };
  }
}

/**
 * Build and compile the daily summary graph.
 * Simple single-node pipeline: START → generate_daily_summary → END
 */
function buildGraph() {
  const graph = new StateGraph(SummaryState)
    .addNode('generate_daily_summary', dailySummaryNode)
    .addEdge(START, 'generate_daily_summary')
    .addEdge('generate_daily_summary', END);

  return graph.compile();
}

let compiledGraph;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}

/**
 * Generate a daily summary from journal entries.
 * @param {string[]} entries - Rendered markdown journal entries for the day
 * @param {string} date - Date string (YYYY-MM-DD) for context
 * @returns {Promise<{ narrative: string, keyDecisions: string, openThreads: string, errors: string[], generatedAt: Date }>}
 */
export async function generateDailySummary(entries, date) {
  const graph = getGraph();
  const result = await graph.invoke({ entries, date });

  return {
    narrative: result.narrative || '',
    keyDecisions: result.keyDecisions || '',
    openThreads: result.openThreads || '',
    errors: result.errors || [],
    generatedAt: new Date(),
  };
}
