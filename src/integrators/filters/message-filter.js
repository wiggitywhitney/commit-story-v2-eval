/**
 * Message Filter - Filters noisy messages from chat context
 *
 * Removes tool calls, tool results, meta messages, empty content,
 * and plan-injection messages (AI-generated plans pasted as user messages)
 * while preserving human/assistant dialogue and context capture tool calls.
 */

/**
 * Detect if a message is too short to be meaningful dialogue
 *
 * Very short responses like "y", "ok", "k" don't add value to the journal.
 *
 * @param {string} content - Text content of the message
 * @returns {boolean} True if message is too short (3 chars or less)
 */
function isTooShortMessage(content) {
  if (!content) return true;
  return content.trim().length <= 3;
}

/**
 * Detect if a user message is "substantial" - meaningful for dialogue/decision extraction
 *
 * Substantial messages are long enough and contain actual discussion, not just
 * simple commands, acknowledgments, or slash commands.
 *
 * @param {string} content - Text content of the message
 * @returns {boolean} True if this is a substantial message
 */
function isSubstantialMessage(content) {
  if (!content) return false;

  const trimmed = content.trim();

  // Must be at least 50 characters
  if (trimmed.length < 50) return false;

  // Skip simple command/acknowledgment patterns
  const simplePatterns = [
    /^(yes|no|ok|okay|sure|thanks|thank you|got it|done|proceed|continue)\.?$/i,
    /^(y|n)$/i,
    /^\/\w+/, // slash commands
  ];

  for (const pattern of simplePatterns) {
    if (pattern.test(trimmed)) return false;
  }

  return true;
}

/**
 * Detect if a message is system noise (bash output, commands, system tags)
 *
 * These are automatically generated messages from Claude Code that contain
 * command output, not actual human dialogue. Includes:
 * - XML-style tags: <bash-stdout>, <local-command-caveat>, <command-message>, etc.
 * - Interrupt markers: [Request interrupted by user]
 *
 * We use a blanket filter for messages starting with '<' because genuine human
 * dialogue rarely starts with angle brackets, while system-generated content
 * (bash output, skill invocations, system caveats) consistently does.
 *
 * @param {string} content - Text content of the message
 * @returns {boolean} True if this is system noise
 */
function isSystemNoiseMessage(content) {
  if (!content) return false;

  const trimmed = content.trim();

  // Filter any message starting with '<' (XML-style system tags)
  // or '[Request interrupted' (user interrupt markers)
  return trimmed.startsWith('<') || trimmed.startsWith('[Request interrupted');
}

/**
 * Detect if a message is a plan-injection (AI-generated plan pasted as user message)
 *
 * When plan mode exits, Claude Code injects the approved plan as a `type: "user"` message.
 * This content is AI-generated (markdown structure, analysis, reasoning) but appears
 * as a user message. We filter these to prevent the dialogue extractor from quoting
 * AI-generated content as human speech.
 *
 * @param {string} content - Text content of the message
 * @returns {boolean} True if this looks like a plan-injection message
 */
function isPlanInjectionMessage(content) {
  // Plan injections are typically long and structured
  if (!content || content.length < 500) {
    return false;
  }

  // Check for plan markers - patterns that indicate AI-generated plan content
  const planMarkers = [
    /^Implement the following plan:/i,
    /^# .+\n\n## /m, // Markdown doc structure (# Title\n\n## Section)
    /\n\| .+ \| .+ \|/, // Markdown tables
    /\*\*Root cause\*\*:/i,
    /\*\*Problem\*\*:/i,
    /^## (Problem|Solution|Implementation|Verification)/m,
  ];

  return planMarkers.some((marker) => marker.test(content));
}

/**
 * Check if a message should be filtered out
 * @param {object} message - Chat message record
 * @returns {boolean} True if message should be filtered out
 */
function shouldFilterMessage(message) {
  // Must have a type
  if (!message.type) {
    return true;
  }

  // Only keep user and assistant messages
  if (!['user', 'assistant'].includes(message.type)) {
    return true;
  }

  // Filter meta messages
  if (message.isMeta === true) {
    return true;
  }

  // Get content
  const content = message.message?.content;

  // Filter empty content
  if (!content) {
    return true;
  }

  // If content is array, check for tool_use/tool_result
  if (Array.isArray(content)) {
    const hasToolUse = content.some((c) => c.type === 'tool_use');
    const hasToolResult = content.some((c) => c.type === 'tool_result');

    // EXCEPTION: Preserve journal_capture_context tool calls (per v1 DD-014)
    const isContextCapture = hasToolUse && content.some(
      (c) => c.type === 'tool_use' && c.name === 'journal_capture_context'
    );

    if (hasToolUse && !isContextCapture) {
      return true;
    }

    // Always filter tool results
    if (hasToolResult) {
      return true;
    }

    // Check if there's any meaningful text content
    // Context captures are preserved even without text (DD-014)
    const hasText = content.some((c) => c.type === 'text' && c.text?.trim());
    if (!hasText && !isContextCapture) {
      return true;
    }
  }

  // If content is string, check if empty
  if (typeof content === 'string' && !content.trim()) {
    return true;
  }

  return false; // Keep this message
}

/**
 * Extract text content from a message for display
 * @param {object} message - Chat message record
 * @returns {string} Extracted text content
 */
function extractTextContent(message) {
  const content = message.message?.content;

  if (!content) {
    return '';
  }

  // If string, return as-is
  if (typeof content === 'string') {
    return content;
  }

  // If array, extract text blocks
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n')
      .trim();
  }

  return '';
}

/**
 * Filter messages and extract relevant content
 * @param {object[]} messages - Array of chat messages
 * @returns {object} Filtered messages and stats
 */
export function filterMessages(messages) {
  const filtered = [];
  const stats = {
    total: messages.length,
    filtered: 0,
    preserved: 0,
    // Tracks user messages with meaningful content (50+ chars, not simple commands)
    // Used downstream to determine if there's enough discussion for dialogue/decision extraction
    substantialUserMessages: 0,
    byReason: {
      noType: 0,
      wrongType: 0,
      isMeta: 0,
      emptyContent: 0,
      toolUse: 0,
      toolResult: 0,
      planInjection: 0,
      systemNoise: 0,
      tooShort: 0,
    },
  };

  for (const message of messages) {
    if (shouldFilterMessage(message)) {
      stats.filtered++;

      // Track reason for filtering
      if (!message.type) {
        stats.byReason.noType++;
      } else if (!['user', 'assistant'].includes(message.type)) {
        stats.byReason.wrongType++;
      } else if (message.isMeta === true) {
        stats.byReason.isMeta++;
      } else {
        const content = message.message?.content;
        if (!content || (typeof content === 'string' && !content.trim())) {
          stats.byReason.emptyContent++;
        } else if (Array.isArray(content)) {
          if (content.some((c) => c.type === 'tool_result')) {
            stats.byReason.toolResult++;
          } else if (content.some((c) => c.type === 'tool_use')) {
            stats.byReason.toolUse++;
          } else {
            stats.byReason.emptyContent++;
          }
        }
      }
    } else {
      // Additional checks for user messages
      const textContent = extractTextContent(message);

      // Filter system noise (bash output, commands, system tags)
      if (message.type === 'user' && isSystemNoiseMessage(textContent)) {
        stats.filtered++;
        stats.byReason.systemNoise++;
        continue;
      }

      // Filter plan-injection messages (AI-generated plans pasted as user messages)
      if (message.type === 'user' && isPlanInjectionMessage(textContent)) {
        stats.filtered++;
        stats.byReason.planInjection++;
        continue;
      }

      // Filter very short messages (3 chars or less) - not meaningful dialogue
      if (message.type === 'user' && isTooShortMessage(textContent)) {
        stats.filtered++;
        stats.byReason.tooShort++;
        continue;
      }

      stats.preserved++;

      // Track substantial user messages for downstream quality checks
      if (message.type === 'user' && isSubstantialMessage(textContent)) {
        stats.substantialUserMessages++;
      }

      filtered.push({
        uuid: message.uuid,
        sessionId: message.sessionId,
        type: message.type,
        timestamp: message.timestamp,
        content: textContent,
        // Preserve context capture info if present
        isContextCapture: Array.isArray(message.message?.content)
          ? message.message.content.some(
              (c) => c.type === 'tool_use' && c.name === 'journal_capture_context'
            )
          : false,
      });
    }
  }

  return { messages: filtered, stats };
}

/**
 * Group filtered messages by session
 * @param {object[]} messages - Filtered messages
 * @returns {Map<string, object[]>} Messages grouped by sessionId
 */
export function groupFilteredBySession(messages) {
  const sessions = new Map();

  for (const message of messages) {
    const sessionId = message.sessionId;
    if (!sessionId) continue;

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    sessions.get(sessionId).push(message);
  }

  return sessions;
}
