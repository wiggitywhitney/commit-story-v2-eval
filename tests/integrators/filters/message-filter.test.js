import { describe, it, expect } from 'vitest';
import { filterMessages, groupFilteredBySession } from '../../../src/integrators/filters/message-filter.js';

/**
 * Helper: create a minimal chat message record
 */
function _makeMessage({
  type = 'user',
  content = 'Hello, this is a test message',
  uuid = crypto.randomUUID(),
  sessionId = 'session-1',
  timestamp = '2026-02-21T10:00:00Z',
  isMeta = false,
} = {}) {
  return {
    type,
    uuid,
    sessionId,
    timestamp,
    isMeta,
    message: { content },
  };
}

/**
 * Helper: create an assistant message with array content (tool_use)
 */
function _makeToolUseMessage({
  toolName = 'Bash',
  uuid = crypto.randomUUID(),
  sessionId = 'session-1',
  timestamp = '2026-02-21T10:01:00Z',
} = {}) {
  return {
    type: 'assistant',
    uuid,
    sessionId,
    timestamp,
    isMeta: false,
    message: {
      content: [
        { type: 'tool_use', name: toolName, input: {} },
      ],
    },
  };
}

/**
 * Helper: create a tool_result message
 */
function _makeToolResultMessage({
  uuid = crypto.randomUUID(),
  sessionId = 'session-1',
  timestamp = '2026-02-21T10:02:00Z',
} = {}) {
  return {
    type: 'user',
    uuid,
    sessionId,
    timestamp,
    isMeta: false,
    message: {
      content: [
        { type: 'tool_result', content: 'result output' },
      ],
    },
  };
}

describe('filterMessages', () => {
  describe('preserves valid messages', () => {
    it('preserves a user message with string content', () => {
      const messages = [_makeMessage({ content: 'This is a meaningful user message with enough length' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('user');
      expect(filtered[0].content).toBe('This is a meaningful user message with enough length');
      expect(stats.preserved).toBe(1);
      expect(stats.filtered).toBe(0);
    });

    it('preserves an assistant message with string content', () => {
      const messages = [_makeMessage({ type: 'assistant', content: 'Here is my response to your question' })];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('assistant');
    });

    it('preserves a message with array content containing text', () => {
      const messages = [{
        type: 'assistant',
        uuid: 'uuid-1',
        sessionId: 'session-1',
        timestamp: '2026-02-21T10:00:00Z',
        isMeta: false,
        message: {
          content: [
            { type: 'text', text: 'Here is my analysis of the situation' },
          ],
        },
      }];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].content).toBe('Here is my analysis of the situation');
    });

    it('preserves journal_capture_context tool calls (DD-014)', () => {
      const messages = [{
        type: 'assistant',
        uuid: 'uuid-ctx',
        sessionId: 'session-1',
        timestamp: '2026-02-21T10:00:00Z',
        isMeta: false,
        message: {
          content: [
            { type: 'tool_use', name: 'journal_capture_context', input: { text: 'context' } },
            { type: 'text', text: 'Capturing development context' },
          ],
        },
      }];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].isContextCapture).toBe(true);
    });
  });

  describe('filters out invalid messages', () => {
    it('filters messages with no type', () => {
      const messages = [{ uuid: 'u1', sessionId: 's1', timestamp: 'ts', message: { content: 'text' } }];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.noType).toBe(1);
    });

    it('filters messages with non-user/assistant type', () => {
      const messages = [_makeMessage({ type: 'system' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.wrongType).toBe(1);
    });

    it('filters meta messages', () => {
      const messages = [_makeMessage({ isMeta: true })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.isMeta).toBe(1);
    });

    it('filters messages with empty content', () => {
      const messages = [_makeMessage({ content: '' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.emptyContent).toBe(1);
    });

    it('filters messages with whitespace-only string content', () => {
      const messages = [_makeMessage({ content: '   \n\t  ' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.emptyContent).toBe(1);
    });

    it('filters messages with null content', () => {
      const messages = [{
        type: 'user',
        uuid: 'u1',
        sessionId: 's1',
        timestamp: 'ts',
        message: { content: null },
      }];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.emptyContent).toBe(1);
    });

    it('filters messages with no message property', () => {
      const messages = [{
        type: 'user',
        uuid: 'u1',
        sessionId: 's1',
        timestamp: 'ts',
      }];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
    });

    it('filters tool_use messages (non-context-capture)', () => {
      const messages = [_makeToolUseMessage({ toolName: 'Bash' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.toolUse).toBe(1);
    });

    it('filters tool_result messages', () => {
      const messages = [_makeToolResultMessage()];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.toolResult).toBe(1);
    });

    it('filters array content with no text blocks', () => {
      const messages = [{
        type: 'assistant',
        uuid: 'u1',
        sessionId: 's1',
        timestamp: 'ts',
        isMeta: false,
        message: {
          content: [
            { type: 'image', source: {} },
          ],
        },
      }];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('filters system noise', () => {
    it('filters messages starting with XML tags', () => {
      const messages = [_makeMessage({ content: '<bash-stdout>some output</bash-stdout>' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.systemNoise).toBe(1);
    });

    it('filters messages starting with local-command-caveat tags', () => {
      const messages = [_makeMessage({ content: '<local-command-caveat>some text</local-command-caveat>' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.systemNoise).toBe(1);
    });

    it('filters request interrupted messages', () => {
      const messages = [_makeMessage({ content: '[Request interrupted by user]' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.systemNoise).toBe(1);
    });

    it('does not filter assistant messages with XML-like content', () => {
      const messages = [_makeMessage({ type: 'assistant', content: '<thinking>Let me analyze this</thinking>' })];
      const { messages: filtered } = filterMessages(messages);

      // System noise filter only applies to user messages
      expect(filtered).toHaveLength(1);
    });
  });

  describe('filters plan-injection messages', () => {
    it('filters messages starting with "Implement the following plan:"', () => {
      const longPlan = 'Implement the following plan:\n\n## Step 1\nDo something\n\n## Step 2\nDo another thing\n' + 'x'.repeat(500);
      const messages = [_makeMessage({ content: longPlan })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.planInjection).toBe(1);
    });

    it('filters messages with markdown doc structure (# Title then ## Section)', () => {
      const longPlan = '# Authentication Refactor\n\n## Problem\nThe current auth system is broken\n\n## Solution\nRewrite everything\n' + 'x'.repeat(500);
      const messages = [_makeMessage({ content: longPlan })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.planInjection).toBe(1);
    });

    it('filters messages with markdown tables', () => {
      const longPlan = 'Here is the analysis of the problem:\n\n| Risk | Impact | Mitigation |\n| High | Major | Do something |\n' + 'x'.repeat(500);
      const messages = [_makeMessage({ content: longPlan })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.planInjection).toBe(1);
    });

    it('does not filter short messages even with plan-like markers', () => {
      // Plan injection detection requires length >= 500
      const shortMsg = '## Problem\nShort message';
      const messages = [_makeMessage({ content: shortMsg })];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(1);
    });
  });

  describe('filters too-short messages', () => {
    it('filters single-character user messages', () => {
      const messages = [_makeMessage({ content: 'y' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.tooShort).toBe(1);
    });

    it('filters "ok" user messages', () => {
      const messages = [_makeMessage({ content: 'ok' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.tooShort).toBe(1);
    });

    it('filters whitespace-padded short messages', () => {
      const messages = [_makeMessage({ content: '  y  ' })];
      const { messages: filtered, stats } = filterMessages(messages);

      expect(filtered).toHaveLength(0);
      expect(stats.byReason.tooShort).toBe(1);
    });

    it('preserves messages longer than 3 characters', () => {
      const messages = [_makeMessage({ content: 'yes!' })];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(1);
    });

    it('does not filter short assistant messages', () => {
      // Too-short filter only applies to user messages
      const messages = [_makeMessage({ type: 'assistant', content: 'ok' })];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered).toHaveLength(1);
    });
  });

  describe('stats tracking', () => {
    it('correctly counts total, filtered, and preserved', () => {
      const messages = [
        _makeMessage({ content: 'A valid message that is long enough' }),
        _makeMessage({ content: 'y' }), // too short
        _makeMessage({ type: 'system' }), // wrong type
        _makeToolUseMessage(), // tool use
      ];
      const { stats } = filterMessages(messages);

      expect(stats.total).toBe(4);
      expect(stats.preserved).toBe(1);
      expect(stats.filtered).toBe(3);
    });

    it('tracks substantialUserMessages count', () => {
      const messages = [
        _makeMessage({ content: 'This is a substantial message that discusses important design decisions about the architecture of our system' }),
        _makeMessage({ content: 'Short msg but valid' }), // preserved but not substantial (< 50 chars)
        _makeMessage({ type: 'assistant', content: 'This is a long assistant message that should not count as a substantial user message at all' }),
      ];
      const { stats } = filterMessages(messages);

      expect(stats.substantialUserMessages).toBe(1);
    });
  });

  describe('output shape', () => {
    it('returns extracted text content, not raw message structure', () => {
      const messages = [_makeMessage({
        content: 'Original text content here',
        uuid: 'test-uuid',
        sessionId: 'test-session',
        timestamp: '2026-02-21T12:00:00Z',
      })];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered[0]).toEqual({
        uuid: 'test-uuid',
        sessionId: 'test-session',
        type: 'user',
        timestamp: '2026-02-21T12:00:00Z',
        content: 'Original text content here',
        isContextCapture: false,
      });
    });

    it('extracts text from array content', () => {
      const messages = [{
        type: 'assistant',
        uuid: 'u1',
        sessionId: 's1',
        timestamp: '2026-02-21T10:00:00Z',
        isMeta: false,
        message: {
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
      }];
      const { messages: filtered } = filterMessages(messages);

      expect(filtered[0].content).toBe('First part\nSecond part');
    });
  });
});

describe('groupFilteredBySession', () => {
  it('groups messages by sessionId', () => {
    const messages = [
      { sessionId: 'session-a', type: 'user', content: 'msg1' },
      { sessionId: 'session-b', type: 'user', content: 'msg2' },
      { sessionId: 'session-a', type: 'assistant', content: 'msg3' },
    ];
    const sessions = groupFilteredBySession(messages);

    expect(sessions.size).toBe(2);
    expect(sessions.get('session-a')).toHaveLength(2);
    expect(sessions.get('session-b')).toHaveLength(1);
  });

  it('skips messages without sessionId', () => {
    const messages = [
      { sessionId: 'session-a', type: 'user', content: 'msg1' },
      { type: 'user', content: 'no session' },
    ];
    const sessions = groupFilteredBySession(messages);

    expect(sessions.size).toBe(1);
    expect(sessions.get('session-a')).toHaveLength(1);
  });

  it('returns empty map for empty input', () => {
    const sessions = groupFilteredBySession([]);

    expect(sessions.size).toBe(0);
  });
});
