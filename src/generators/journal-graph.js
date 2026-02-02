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
import { getAllGuidelines } from './prompts/guidelines/index.js';
import { summaryPrompt } from './prompts/sections/summary-prompt.js';
import { dialoguePrompt } from './prompts/sections/dialogue-prompt.js';
import { technicalDecisionsPrompt } from './prompts/sections/technical-decisions-prompt.js';

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

    const prompt = `${guidelines}

${sectionPrompt}

---

## Commit Information
**Hash**: ${context.commit.shortHash}
**Author**: ${context.commit.author}
**Message**: ${context.commit.message}

## Code Changes
\`\`\`diff
${context.commit.diff || 'No diff available'}
\`\`\`

## Development Conversation
${formatChatMessages(context.chat.messages)}`;

    const result = await getModel().invoke([{ role: 'user', content: prompt }]);

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
 */
async function technicalNode(state) {
  try {
    const { context } = state;
    const guidelines = getAllGuidelines();

    const prompt = `${guidelines}

${technicalDecisionsPrompt}

---

## Commit Information
**Hash**: ${context.commit.shortHash}
**Message**: ${context.commit.message}

## Code Changes
\`\`\`diff
${context.commit.diff || 'No diff available'}
\`\`\`

## Development Conversation
${formatChatMessages(context.chat.messages)}`;

    const result = await getModel().invoke([{ role: 'user', content: prompt }]);

    return { technicalDecisions: result.content };
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
 */
async function dialogueNode(state) {
  try {
    const { context, summary } = state;
    const guidelines = getAllGuidelines();
    const maxQuotes = 4;

    // Replace {maxQuotes} placeholder in prompt
    const sectionPrompt = dialoguePrompt.replace(/{maxQuotes}/g, String(maxQuotes));

    const prompt = `${guidelines}

The summary of this development session is:
${summary}

${sectionPrompt}

---

## Development Conversation
${formatChatMessages(context.chat.messages)}`;

    const result = await getModel().invoke([{ role: 'user', content: prompt }]);

    return { dialogue: result.content };
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
  buildGraph,
  hasFunctionalCode,
  hasSubstantialChat,
};
