/**
 * Guidelines Index
 *
 * Exports all guideline modules for easy importing and composition.
 */

import { antiHallucinationGuidelines } from './anti-hallucination.js';
import { accessibilityGuidelines } from './accessibility.js';

/**
 * Output format guideline - must be first to set expectations
 */
const outputFormatGuideline = `
CRITICAL OUTPUT INSTRUCTION:
You will receive guidance to help you write content. Think through the guidance internally, then OUTPUT ONLY YOUR FINAL CONTENT.

NEVER include in your output:
- Phrases like "I'll help you", "Let me", "Based on the plan"
- Questions like "Would you like me to proceed?"
- Step labels, numbered lists of what you'll do, or your analysis process
- Checkmarks, verification notes, or meta-commentary about your work
- References to "the plan" or instructions you received

Your entire response should be the final content only - no preamble, no process notes.
`.trim();

/**
 * Combines all guidelines into a single formatted string
 * for inclusion in system prompts
 */
export function getAllGuidelines() {
  return `
${outputFormatGuideline}

${antiHallucinationGuidelines}

${accessibilityGuidelines}
  `.trim();
}

// Export individual guidelines for selective use if needed
export { antiHallucinationGuidelines, accessibilityGuidelines };
