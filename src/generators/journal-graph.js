/**
 * Journal Graph - LangGraph StateGraph for journal generation
 *
 * Orchestrates AI generation of journal sections:
 * - Summary: Narrative overview of the commit
 * - Dialogue: Key quotes from human/assistant conversation
 * - Technical Decisions: Architecture and implementation decisions
 *
 * Graph structure:
 * START → [summary, technical] (parallel) → dialogue → END
 */

import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getAllGuidelines } from './prompts/guidelines/index.js';
import { summaryPrompt } from './prompts/sections/summary-prompt.js';
import { dialoguePrompt } from './prompts/sections/dialogue-prompt.js';
import { technicalDecisionsPrompt } from './prompts/sections/technical-decisions-prompt.js';

/**
 * Zod schema for dialogue extraction output
 */
const DialogueSchema = z.object({
  quotes: z.array(
    z.object({
      human: z.string().describe('Exact verbatim quote from the human developer'),
      assistant: z
        .string()
        .optional()
        .nullable()
        .describe('Optional relevant assistant response for context'),
    })
  ),
});

/**
 * Zod schema for technical decisions output
 */
const TechnicalDecisionsSchema = z.object({
  decisions: z.array(
    z.object({
      title: z.string().describe('Brief title of the decision'),
      status: z.enum(['Implemented', 'Discussed']).describe('Whether the decision resulted in code changes'),
      files: z.array(z.string()).describe('Files affected by this decision'),
      reasoning: z.array(z.string()).describe('Explicit reasoning points from the chat'),
    })
  ),
});

/**
 * Journal state definition using LangGraph Annotation API
 * Errors use a reducer to accumulate from parallel nodes
 */
export const JournalState = Annotation.Root({
  // Input
  context: Annotation(),

  // Outputs (populated by nodes)
  summary: Annotation(),
  dialogue: Annotation(),
  technicalDecisions: Annotation(),

  // Metadata
  errors: Annotation({
    reducer: (left, right) => [...(left || []), ...(right || [])],
    default: () => [],
  }),
});

/**
 * Lazy-initialized model instance
 * Uses Claude Haiku 4.5 for cost-effective generation
 */
let model;

/**
 * Get or create the Claude model instance
 * @returns {ChatAnthropic} Model instance
 */
export function getModel() {
  if (!model) {
    model = new ChatAnthropic({
      model: 'claude-3-5-haiku-latest',
      maxTokens: 2048,
      temperature: 0,
    });
  }
  return model;
}

/**
 * Reset model instance (for testing)
 */
export function resetModel() {
  model = null;
}

/**
 * Get model with structured output for a given schema
 * @param {z.ZodSchema} schema - Zod schema for output
 * @returns {ChatAnthropic} Model configured for structured output
 */
function getStructuredModel(schema) {
  return getModel().withStructuredOutput(schema);
}

/**
 * Analyze diff to determine if it contains functional code changes
 * (not just documentation or config files)
 * @param {string} diff - Git diff content
 * @returns {boolean} Whether the diff contains functional code changes
 */
function hasFunctionalCode(diff) {
  if (!diff) return false;

  // Documentation and config file patterns
  const docPatterns = [
    /^[+-]{3} [ab]\/.*\.md$/gm,
    /^[+-]{3} [ab]\/.*\.txt$/gm,
    /^[+-]{3} [ab]\/.*\.json$/gm,
    /^[+-]{3} [ab]\/.*\.ya?ml$/gm,
    /^[+-]{3} [ab]\/.*\.toml$/gm,
    /^[+-]{3} [ab]\/.*\.ini$/gm,
    /^[+-]{3} [ab]\/.*\.env.*$/gm,
    /^[+-]{3} [ab]\/.*\.gitignore$/gm,
    /^[+-]{3} [ab]\/.*LICENSE.*$/gm,
    /^[+-]{3} [ab]\/.*README.*$/gm,
    /^[+-]{3} [ab]\/.*CHANGELOG.*$/gm,
  ];

  // Code file patterns
  const codePatterns = [
    /^[+-]{3} [ab]\/.*\.js$/gm,
    /^[+-]{3} [ab]\/.*\.ts$/gm,
    /^[+-]{3} [ab]\/.*\.jsx$/gm,
    /^[+-]{3} [ab]\/.*\.tsx$/gm,
    /^[+-]{3} [ab]\/.*\.py$/gm,
    /^[+-]{3} [ab]\/.*\.rb$/gm,
    /^[+-]{3} [ab]\/.*\.go$/gm,
    /^[+-]{3} [ab]\/.*\.rs$/gm,
    /^[+-]{3} [ab]\/.*\.java$/gm,
    /^[+-]{3} [ab]\/.*\.c$/gm,
    /^[+-]{3} [ab]\/.*\.cpp$/gm,
    /^[+-]{3} [ab]\/.*\.h$/gm,
    /^[+-]{3} [ab]\/.*\.sh$/gm,
  ];

  // Check if any code files are in the diff
  for (const pattern of codePatterns) {
    if (pattern.test(diff)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if chat messages contain substantial discussion
 * (not just simple commands or acknowledgments)
 * @param {object[]} messages - Chat messages
 * @returns {boolean} Whether there's substantial discussion
 */
function hasSubstantialChat(messages) {
  if (!messages || messages.length === 0) return false;

  // Count user messages with meaningful content
  const substantialMessages = messages.filter((msg) => {
    if (msg.type !== 'user') return false;

    const content = (msg.content || '').trim();
    // Skip very short messages (likely commands or acknowledgments)
    if (content.length < 50) return false;

    // Skip simple command patterns
    const simplePatterns = [
      /^(yes|no|ok|okay|sure|thanks|thank you|got it|done|proceed|continue)\.?$/i,
      /^(y|n)$/i,
      /^\/\w+/, // slash commands
    ];

    for (const pattern of simplePatterns) {
      if (pattern.test(content)) return false;
    }

    return true;
  });

  // Consider substantial if there are at least 2 meaningful user messages
  return substantialMessages.length >= 2;
}

/**
 * Format chat messages for prompt inclusion
 * Uses JSON format for clear type identification
 * @param {object[]} messages - Filtered chat messages
 * @returns {string} Formatted messages
 */
function formatChatMessages(messages) {
  if (!messages || messages.length === 0) {
    return '*No conversation captured for this time window*';
  }

  return messages
    .map((msg) => {
      const type = msg.type === 'user' ? 'user' : 'assistant';
      const date = msg.timestamp ? new Date(msg.timestamp) : null;
      const time = date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString() : '';
      return `{"type":"${type}", "time":"${time}", "content":"${escapeForJson(msg.content)}"}`;
    })
    .join('\n\n');
}

/**
 * Escape content for JSON string inclusion
 * @param {string} content - Content to escape
 * @returns {string} Escaped content
 */
function escapeForJson(content) {
  if (!content) return '';
  return content
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Normalize text for quote verification
 * Lowercases, collapses whitespace, converts ellipsis markers to standard form
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeForVerification(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\[\.\.\.\]/g, '…')
    .replace(/\[…\]/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verify dialogue quotes exist in actual user messages
 * Uses exact substring matching with ellipsis segment support
 * @param {object} result - Structured output from AI with quotes array
 * @param {object[]} messages - Original chat messages
 * @returns {object} Verified result with invalid quotes removed
 */
function verifyDialogueQuotes(result, messages) {
  if (!result.quotes || result.quotes.length === 0) {
    return result;
  }

  // Get all user message content for verification (normalized)
  const userMessages = messages
    .filter((m) => m.type === 'user')
    .map((m) => normalizeForVerification(m.content));

  // Filter to quotes that actually appear in user messages
  const verifiedQuotes = result.quotes.filter((quote) => {
    const quoteText = normalizeForVerification(quote.human);
    if (!quoteText) return false;

    // Support truncated quotes by matching each segment in order
    // Ellipsis markers (...) split the quote into segments that must appear in order
    const segments = quoteText.split('…').filter(Boolean);

    return userMessages.some((msg) => {
      let searchIndex = 0;
      for (const segment of segments) {
        const foundIndex = msg.indexOf(segment, searchIndex);
        if (foundIndex === -1) return false;
        searchIndex = foundIndex + segment.length;
      }
      return true;
    });
  });

  return { quotes: verifiedQuotes };
}

/**
 * Verify technical decisions have backing in user chat messages
 * Filters out decisions where reasoning only appears in assistant messages
 * @param {object} result - Structured output from AI with decisions array
 * @param {object[]} messages - Original chat messages
 * @returns {object} Verified result with unverified decisions removed
 */
function verifyTechnicalDecisions(result, messages) {
  if (!result.decisions || result.decisions.length === 0) {
    return result;
  }

  // Only use user message content for verification (not assistant messages)
  // This prevents AI-only reasoning from passing as "developer decisions"
  const userContent = messages
    .filter((m) => m.type === 'user')
    .map((m) => (m.content || '').toLowerCase())
    .join(' ');

  if (!userContent) {
    return { decisions: [] };
  }

  // Filter to decisions where reasoning appears in user messages
  const verifiedDecisions = result.decisions.filter((decision) => {
    // Decision must have at least one reasoning point that appears in user chat
    return decision.reasoning.some((reason) => {
      // Extract significant words from reasoning (4+ chars)
      const words = reason
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);

      if (words.length === 0) return false;

      // At least 50% of significant words should appear in user messages
      const matchingWords = words.filter((word) => userContent.includes(word));
      return matchingWords.length >= Math.ceil(words.length * 0.5);
    });
  });

  return { decisions: verifiedDecisions };
}

/**
 * Format verified dialogue quotes to markdown
 * @param {object} result - Verified dialogue result
 * @returns {string} Formatted markdown
 */
function formatDialogueToMarkdown(result) {
  if (!result.quotes || result.quotes.length === 0) {
    return 'No significant dialogue found for this development session';
  }

  return result.quotes
    .map((quote) => {
      let formatted = `> **Human:** "${quote.human}"`;
      if (quote.assistant) {
        formatted += `\n> **Assistant:** "${quote.assistant}"`;
      }
      return formatted;
    })
    .join('\n\n');
}

/**
 * Format verified technical decisions to markdown
 * @param {object} result - Verified decisions result
 * @returns {string} Formatted markdown
 */
function formatTechnicalDecisionsToMarkdown(result) {
  if (!result.decisions || result.decisions.length === 0) {
    return 'No significant technical decisions or problem solving documented for this development session';
  }

  return result.decisions
    .map((decision) => {
      const filesStr = decision.files.length > 0 ? ` - FILES: ${decision.files.join(', ')}` : '';
      const reasoningStr = decision.reasoning.map((r) => `  - ${r}`).join('\n');
      return `**DECISION: ${decision.title}** (${decision.status})${filesStr}\n${reasoningStr}`;
    })
    .join('\n\n');
}

/**
 * Format context data as user message content
 * @param {object} context - Context data
 * @param {object} options - Formatting options
 * @returns {string} Formatted user message
 */
/**
 * Format context for summary generation (filters out assistant messages)
 * V1 approach: Summary is about what THE DEVELOPER did, so we only need user messages
 */
function formatContextForSummary(context) {
  const userOnlyMessages = (context.chat.messages || []).filter((m) => m.type === 'user');

  return `Generate a summary for this development session:

DATA SCHEMA:
- commit: The git commit that was made (hash, author, message, diff)
- chat_messages: Developer input during the session (type:"user" messages only)
  Note: Assistant responses have been filtered out - focus on what THE DEVELOPER did

COMMIT DATA:
${JSON.stringify(
  {
    hash: context.commit.shortHash,
    author: context.commit.author,
    message: context.commit.message,
    diff: context.commit.diff || 'No diff available',
  },
  null,
  2
)}

DEVELOPER MESSAGES (type:"user" only):
${JSON.stringify(userOnlyMessages.map((m) => ({ type: m.type, content: m.content })), null, 2)}`;
}

/**
 * Format context for dialogue/technical extraction (needs full chat)
 */
function formatContextForUser(context, options = {}) {
  const { includeSummary } = options;

  let userContent = `## Commit Information
**Hash**: ${context.commit.shortHash}
**Author**: ${context.commit.author}
**Message**: ${context.commit.message}

## Code Changes
\`\`\`diff
${context.commit.diff || 'No diff available'}
\`\`\`

## Development Conversation
DATA SCHEMA: type:"user" = developer input, type:"assistant" = AI responses
${formatChatMessages(context.chat.messages)}`;

  if (includeSummary) {
    userContent = `## Session Summary
${options.summary}

${userContent}`;
  }

  return userContent;
}

/**
 * Summary generation node
 * Creates a narrative overview of the commit
 */
async function summaryNode(state) {
  try {
    const { context } = state;
    const guidelines = getAllGuidelines();
    const hasFunctional = hasFunctionalCode(context.commit.diff);
    const hasChat = hasSubstantialChat(context.chat.messages);
    const sectionPrompt = summaryPrompt(hasFunctional, hasChat);

    const systemContent = `${guidelines}

${sectionPrompt}`;

    const userContent = formatContextForSummary(context);

    const result = await getModel().invoke([
      new SystemMessage(systemContent),
      new HumanMessage(userContent),
    ]);

    return { summary: result.content };
  } catch (error) {
    return {
      summary: '[Summary generation failed]',
      errors: [`Summary generation failed: ${error.message}`],
    };
  }
}

/**
 * Technical decisions extraction node
 * Identifies architecture and implementation decisions
 * Uses structured output with verification
 */
async function technicalNode(state) {
  try {
    const { context } = state;
    const guidelines = getAllGuidelines();

    // Modify prompt for structured output
    const structuredPrompt = `${technicalDecisionsPrompt}

Return your analysis as a JSON object with a "decisions" array. Each decision should have:
- title: Brief title of the decision
- status: "Implemented" or "Discussed"
- files: Array of affected files (can be empty)
- reasoning: Array of reasoning points explicitly from the chat`;

    const systemContent = `${guidelines}

${structuredPrompt}`;

    const userContent = formatContextForUser(context);

    const structuredModel = getStructuredModel(TechnicalDecisionsSchema);
    const result = await structuredModel.invoke([
      new SystemMessage(systemContent),
      new HumanMessage(userContent),
    ]);

    // Verify decisions have backing in chat
    const verified = verifyTechnicalDecisions(result, context.chat.messages || []);

    // Format to markdown
    const formatted = formatTechnicalDecisionsToMarkdown(verified);

    return { technicalDecisions: formatted };
  } catch (error) {
    return {
      technicalDecisions: '[Technical decisions extraction failed]',
      errors: [`Technical decisions extraction failed: ${error.message}`],
    };
  }
}

/**
 * Dialogue extraction node
 * Extracts key quotes from human/assistant conversation
 * Runs after summary to avoid redundancy
 * Uses structured output with verification
 */
async function dialogueNode(state) {
  try {
    const { context, summary } = state;
    const guidelines = getAllGuidelines();
    const maxQuotes = 4;

    // Replace {maxQuotes} placeholder in prompt
    const sectionPrompt = dialoguePrompt.replace(/{maxQuotes}/g, String(maxQuotes));

    // Modify prompt for structured output
    const structuredPrompt = `${sectionPrompt}

Return your analysis as a JSON object with a "quotes" array. Each quote should have:
- human: The exact verbatim quote from the human developer
- assistant: Optional relevant assistant response for context (or null)`;

    const systemContent = `${guidelines}

The summary of this development session is:
${summary}

${structuredPrompt}`;

    const userContent = formatContextForUser(context, { includeSummary: false });

    const structuredModel = getStructuredModel(DialogueSchema);
    const result = await structuredModel.invoke([
      new SystemMessage(systemContent),
      new HumanMessage(userContent),
    ]);

    // Verify quotes exist in actual user messages
    const verified = verifyDialogueQuotes(result, context.chat.messages || []);

    // Format to markdown
    const formatted = formatDialogueToMarkdown(verified);

    return { dialogue: formatted };
  } catch (error) {
    return {
      dialogue: '[Dialogue extraction failed]',
      errors: [`Dialogue extraction failed: ${error.message}`],
    };
  }
}

/**
 * Build and compile the journal generation graph
 * @returns {CompiledStateGraph} Compiled graph ready for execution
 */
function buildGraph() {
  // Node names use "generate_" prefix to avoid conflict with state attribute names
  const graph = new StateGraph(JournalState)
    .addNode('generate_summary', summaryNode)
    .addNode('generate_technical', technicalNode)
    .addNode('generate_dialogue', dialogueNode)
    // Parallel execution: summary and technical run simultaneously
    .addEdge(START, 'generate_summary')
    .addEdge(START, 'generate_technical')
    // Dialogue waits for both summary and technical to complete
    .addEdge('generate_summary', 'generate_dialogue')
    .addEdge('generate_technical', 'generate_dialogue')
    // End after dialogue
    .addEdge('generate_dialogue', END);

  return graph.compile();
}

// Compiled graph instance
let compiledGraph;

/**
 * Get or create the compiled graph
 * @returns {CompiledStateGraph} Compiled graph
 */
function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}

/**
 * Generate all journal sections from context
 * @param {Context} context - Gathered context from integrator
 * @returns {Promise<JournalSections>} Generated journal sections
 */
export async function generateJournalSections(context) {
  const graph = getGraph();

  const result = await graph.invoke({ context });

  return {
    summary: result.summary || '',
    dialogue: result.dialogue || '',
    technicalDecisions: result.technicalDecisions || '',
    errors: result.errors || [],
    generatedAt: new Date(),
  };
}

// Export node functions for testing
export {
  summaryNode,
  technicalNode,
  dialogueNode,
  formatChatMessages,
  formatContextForUser,
  formatContextForSummary,
  buildGraph,
  hasFunctionalCode,
  hasSubstantialChat,
  verifyDialogueQuotes,
  verifyTechnicalDecisions,
  formatDialogueToMarkdown,
  formatTechnicalDecisionsToMarkdown,
  DialogueSchema,
  TechnicalDecisionsSchema,
};
